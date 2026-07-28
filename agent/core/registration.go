package core

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

type RegistrationState int

const (
	StateUnregistered RegistrationState = iota
	StateRegistering
	StateOperating
	StateRegistrationFailed
)

type RegistrationConfig struct {
	BootstrapToken  string
	RegistrationURL string // https://host/register
	AuthURL         string // https://host/auth/token
	DeviceClass     string // linux | windows
	Hostname        string
	OS              string
	// SECURITY: TLS config for the HTTP client
	HTTPClient *http.Client
}

type RegistrationStateMachine struct {
	state    RegistrationState
	config   RegistrationConfig
	keyStore KeyStore
	creds    Credentials
}

func NewRegistrationSM(cfg RegistrationConfig, ks KeyStore) *RegistrationStateMachine {
	if cfg.HTTPClient == nil {
		// Default client — 10s timeout, no redirect following
		cfg.HTTPClient = &http.Client{
			Timeout: 10 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		}
	}
	return &RegistrationStateMachine{
		state:    StateUnregistered,
		config:   cfg,
		keyStore: ks,
	}
}

func (sm *RegistrationStateMachine) Start() error {
	log.Printf("[registration] state=UNREGISTERED device_class=%s hostname=%s",
		sm.config.DeviceClass, sm.config.Hostname)

	// Step 1: Try existing credentials
	creds, err := sm.keyStore.LoadStoredCredentials()
	if err == nil && creds.DeviceID != "" {
		log.Printf("[registration] reusing credentials device_id=%s expires=%s",
			creds.DeviceID, creds.ExpiresAt.Format(time.RFC3339))
		sm.creds = creds
		sm.state = StateOperating
		log.Printf("[registration] state=OPERATING")
		return nil
	}
	log.Printf("[registration] no valid stored credentials: %v", err)

	// Step 2: Register as new device
	sm.state = StateRegistering
	log.Printf("[registration] state=REGISTERING")

	pubKey, err := sm.keyStore.GeneratePrivateKey()
	if err != nil {
		sm.state = StateRegistrationFailed
		return fmt.Errorf("[registration] key generation failed: %w", err)
	}

	creds, err = sm.callRegistrationService(pubKey)
	if err != nil {
		sm.state = StateRegistrationFailed
		log.Printf("[registration] state=REGISTRATION_FAILED: %v", err)
		log.Printf("[registration] TERMINAL: obtain a new bootstrap token and restart the agent")
		return err
	}

	if err := sm.keyStore.SaveCredentials(creds); err != nil {
		sm.state = StateRegistrationFailed
		return fmt.Errorf("[registration] credential save failed: %w", err)
	}

	sm.creds = creds
	sm.state = StateOperating
	log.Printf("[registration] state=OPERATING device_id=%s", creds.DeviceID)
	return nil
}

func (sm *RegistrationStateMachine) GetCredentials() Credentials { return sm.creds }
func (sm *RegistrationStateMachine) State() RegistrationState    { return sm.state }

// UpdateCredentials is called by the Token Lifecycle Manager after a refresh.
func (sm *RegistrationStateMachine) UpdateCredentials(creds Credentials) error {
	if err := sm.keyStore.SaveCredentials(creds); err != nil {
		return err
	}
	sm.creds = creds
	return nil
}

// callRegistrationService posts to the Registration Service and returns credentials.
// SECURITY: bootstrap_token is sent over TLS only (enforced by nginx config).
// SECURITY: response body is limited to 64KB to prevent memory exhaustion.
func (sm *RegistrationStateMachine) callRegistrationService(pubKey []byte) (Credentials, error) {
	payload := map[string]string{
		"bootstrap_token": sm.config.BootstrapToken,
		"device_class":    sm.config.DeviceClass,
		"hostname":        sm.config.Hostname,
		"os":              sm.config.OS,
		"public_key":      string(pubKey),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return Credentials{}, fmt.Errorf("marshal registration payload: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		sm.config.RegistrationURL, bytes.NewReader(body))
	if err != nil {
		return Credentials{}, fmt.Errorf("build registration request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// SECURITY: never log the bootstrap token
	log.Printf("[registration] POST %s device_class=%s", sm.config.RegistrationURL, sm.config.DeviceClass)

	resp, err := sm.config.HTTPClient.Do(req)
	if err != nil {
		return Credentials{}, fmt.Errorf("registration request failed: %w", err)
	}
	defer resp.Body.Close()

	// SECURITY: limit response body size
	limited := io.LimitReader(resp.Body, 64*1024)
	respBody, err := io.ReadAll(limited)
	if err != nil {
		return Credentials{}, fmt.Errorf("read registration response: %w", err)
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		// SECURITY: log status code only, never log the response body (may contain tokens)
		return Credentials{}, fmt.Errorf("registration failed: HTTP %d (check bootstrap token)", resp.StatusCode)
	}

	var result struct {
		DeviceID    string `json:"device_id"`
		AccessToken string `json:"access_token"`
		ExpiresAt   string `json:"expires_at"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return Credentials{}, fmt.Errorf("parse registration response: %w", err)
	}

	expiresAt, err := time.Parse(time.RFC3339, result.ExpiresAt)
	if err != nil {
		// Fallback: 55 minutes from now (slightly under the 60m JWT lifetime)
		expiresAt = time.Now().Add(55 * time.Minute)
	}

	return Credentials{
		DeviceID:    result.DeviceID,
		AccessToken: result.AccessToken,
		IssuedAt:    time.Now(),
		ExpiresAt:   expiresAt,
	}, nil
}
