package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

const (
	refreshMargin = 15 * time.Minute // refresh when 15 min remain on the token
)

// TokenLifecycleManager schedules proactive token refresh and handles
// 401-triggered immediate refresh. Both code paths update the same
// credential store atomically under a mutex.
// SECURITY: access_token is never logged — only device_id and expiry times.
type TokenLifecycleManager struct {
	mu       sync.RWMutex
	creds    Credentials
	keyStore KeyStore
	authURL  string
	client   *http.Client
	sm       *RegistrationStateMachine
	stopCh   chan struct{}
}

func NewTokenLifecycleManager(
	creds Credentials,
	ks KeyStore,
	authURL string,
	client *http.Client,
	sm *RegistrationStateMachine,
) *TokenLifecycleManager {
	return &TokenLifecycleManager{
		creds:    creds,
		keyStore: ks,
		authURL:  authURL,
		client:   client,
		sm:       sm,
		stopCh:   make(chan struct{}),
	}
}

// Start begins the background refresh scheduler.
func (m *TokenLifecycleManager) Start() {
	go m.scheduleRefresh()
}

// Stop shuts down the background scheduler.
func (m *TokenLifecycleManager) Stop() {
	close(m.stopCh)
}

// GetToken returns the current valid access token.
// SECURITY: caller receives the token string only — never the full Credentials struct.
func (m *TokenLifecycleManager) GetToken() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.creds.AccessToken
}

// On401 triggers an immediate out-of-cycle token refresh.
// Called by Send Orchestrator when a send returns 401.
func (m *TokenLifecycleManager) On401() {
	log.Printf("[token] 401 received — triggering immediate refresh")
	go func() {
		if err := m.refresh(); err != nil {
			log.Printf("[token] immediate refresh failed: %v", err)
		}
	}()
}

func (m *TokenLifecycleManager) scheduleRefresh() {
	for {
		m.mu.RLock()
		expiresAt := m.creds.ExpiresAt
		m.mu.RUnlock()

		refreshAt := expiresAt.Add(-refreshMargin)
		waitDur := time.Until(refreshAt)

		if waitDur < 0 {
			// Token already in refresh window — refresh immediately
			waitDur = 0
		}

		log.Printf("[token] next refresh scheduled in %s (at %s)",
			waitDur.Round(time.Second), refreshAt.Format(time.RFC3339))

		select {
		case <-m.stopCh:
			return
		case <-time.After(waitDur):
			if err := m.refresh(); err != nil {
				log.Printf("[token] scheduled refresh failed: %v", err)
				// Retry in 60 seconds rather than giving up
				select {
				case <-m.stopCh:
					return
				case <-time.After(60 * time.Second):
					continue
				}
			}
		}
	}
}

func (m *TokenLifecycleManager) refresh() error {
	m.mu.RLock()
	deviceID := m.creds.DeviceID
	m.mu.RUnlock()

	log.Printf("[token] refreshing token for device_id=%s", deviceID)

	payload := map[string]string{
		"device_id":    deviceID,
		"device_class": "linux",
	}
	body, _ := json.Marshal(payload)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, m.authURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build refresh request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := m.client.Do(req)
	if err != nil {
		return fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	limited := io.LimitReader(resp.Body, 16*1024)
	respBody, _ := io.ReadAll(limited)

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		// Refresh token itself rejected — device revoked
		// Transition Registration SM to FAILED — do not silently re-register
		log.Printf("[token] refresh rejected (HTTP %d) — device may be revoked", resp.StatusCode)
		m.sm.state = StateRegistrationFailed
		return fmt.Errorf("token refresh rejected: HTTP %d — device revoked, restart with new bootstrap token",
			resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("refresh failed: HTTP %d", resp.StatusCode)
	}

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresAt   string `json:"expires_at"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("parse refresh response: %w", err)
	}

	expiresAt, err := time.Parse(time.RFC3339, result.ExpiresAt)
	if err != nil {
		expiresAt = time.Now().Add(55 * time.Minute)
	}

	m.mu.Lock()
	m.creds.AccessToken = result.AccessToken
	m.creds.ExpiresAt = expiresAt
	m.mu.Unlock()

	// Persist updated token to keystore
	m.mu.RLock()
	updatedCreds := m.creds
	m.mu.RUnlock()

	if err := m.keyStore.SaveCredentials(updatedCreds); err != nil {
		log.Printf("[token] WARNING: refresh succeeded but credential save failed: %v", err)
	}

	log.Printf("[token] refresh complete device_id=%s new_expiry=%s",
		deviceID, expiresAt.Format(time.RFC3339))
	return nil
}
