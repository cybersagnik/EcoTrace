//go:build windows

package windows

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"os"
	"path/filepath"
	"time"

	"github.com/Ecotrace/agent/core"
)

// WindowsKeyStore persists identity in %USERPROFILE%\.ecotrace.
// SECURITY NOTE: this is a file-based store (not DPAPI/CNG) so the agent
// can run unprivileged on a demo workstation. Swap Sign/GeneratePrivateKey
// for NCryptCreatePersistedKey when moving to production.
type WindowsKeyStore struct {
	dir string
}

func NewWindowsKeyStore() (*WindowsKeyStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}
	dir := filepath.Join(home, ".ecotrace")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	return &WindowsKeyStore{dir: dir}, nil
}

func (k *WindowsKeyStore) credPath() string { return filepath.Join(k.dir, "credentials.json") }
func (k *WindowsKeyStore) keyPath() string  { return filepath.Join(k.dir, "device.key") }

func (k *WindowsKeyStore) GeneratePrivateKey() ([]byte, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	pemData := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	if err := os.WriteFile(k.keyPath(), pemData, 0600); err != nil {
		return nil, err
	}
	pub, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		return nil, err
	}
	return pub, nil
}

func (k *WindowsKeyStore) Sign(data []byte) ([]byte, error) {
	pemData, err := os.ReadFile(k.keyPath())
	if err != nil {
		return nil, err
	}
	block, _ := pem.Decode(pemData)
	if block == nil {
		return nil, errors.New("invalid key file")
	}
	key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	digest := sha256.Sum256(data)
	return rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
}

func (k *WindowsKeyStore) LoadStoredCredentials() (core.Credentials, error) {
	raw, err := os.ReadFile(k.credPath())
	if err != nil {
		return core.Credentials{}, err
	}
	var c struct {
		DeviceID     string `json:"device_id"`
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		IssuedAt     string `json:"issued_at"`
		ExpiresAt    string `json:"expires_at"`
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		return core.Credentials{}, err
	}
	issued, _ := time.Parse(time.RFC3339, c.IssuedAt)
	expires, _ := time.Parse(time.RFC3339, c.ExpiresAt)
	return core.Credentials{
		DeviceID:     c.DeviceID,
		AccessToken:  c.AccessToken,
		RefreshToken: c.RefreshToken,
		IssuedAt:     issued,
		ExpiresAt:    expires,
	}, nil
}

func (k *WindowsKeyStore) SaveCredentials(creds core.Credentials) error {
	payload := map[string]interface{}{
		"device_id":     creds.DeviceID,
		"access_token":  creds.AccessToken,
		"refresh_token": creds.RefreshToken,
		"issued_at":     creds.IssuedAt.Format(time.RFC3339),
		"expires_at":    creds.ExpiresAt.Format(time.RFC3339),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return os.WriteFile(k.credPath(), raw, 0600)
}
