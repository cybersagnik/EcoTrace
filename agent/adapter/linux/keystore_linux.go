//go:build linux

package linux

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Ecotrace/agent/core"
)

const (
	credDir      = ".ecotrace"
	keyFile      = "device.key"
	credsFile    = "device-credentials.json"
	keyFilePerms = 0600 // owner read/write only — SECURITY REQUIREMENT
	dirPerms     = 0700 // owner only
)

// LinuxKeyStore implements core.KeyStore using the filesystem.
// Private key is stored at ~/.ecotrace/device.key with 0600 permissions.
// Credentials are stored at ~/.ecotrace/device-credentials.json with 0600.
// SECURITY: no group or other read/write on any credential file.
type LinuxKeyStore struct {
	baseDir string
	privKey *ecdsa.PrivateKey
}

func NewLinuxKeyStore() (*LinuxKeyStore, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot determine home directory: %w", err)
	}
	base := filepath.Join(home, credDir)
	if err := os.MkdirAll(base, dirPerms); err != nil {
		return nil, fmt.Errorf("cannot create credential directory %s: %w", base, err)
	}
	// Enforce directory permissions even if it already existed
	if err := os.Chmod(base, dirPerms); err != nil {
		return nil, fmt.Errorf("cannot set permissions on %s: %w", base, err)
	}
	return &LinuxKeyStore{baseDir: base}, nil
}

// GeneratePrivateKey creates an ECDSA P-256 key pair.
// The private key is written to disk at 0600.
// Returns the PEM-encoded public key for registration.
// SECURITY: private key never leaves this function as a raw value.
func (k *LinuxKeyStore) GeneratePrivateKey() ([]byte, error) {
	privKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("key generation failed: %w", err)
	}

	// Marshal private key to PKCS8 DER
	privDER, err := x509.MarshalPKCS8PrivateKey(privKey)
	if err != nil {
		return nil, fmt.Errorf("marshal private key: %w", err)
	}

	// Write private key PEM — 0600 enforced
	keyPath := filepath.Join(k.baseDir, keyFile)
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privDER})

	if err := writeSecureFile(keyPath, privPEM); err != nil {
		return nil, fmt.Errorf("write private key: %w", err)
	}

	k.privKey = privKey

	// Marshal public key for registration
	pubDER, err := x509.MarshalPKIXPublicKey(&privKey.PublicKey)
	if err != nil {
		return nil, fmt.Errorf("marshal public key: %w", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})
	return pubPEM, nil
}

// Sign signs data using the stored ECDSA private key.
// SECURITY: the private key is loaded from disk fresh each call
// rather than cached in memory long-term.
func (k *LinuxKeyStore) Sign(data []byte) ([]byte, error) {
	privKey, err := k.loadPrivKey()
	if err != nil {
		return nil, fmt.Errorf("load private key for signing: %w", err)
	}
	sig, err := ecdsa.SignASN1(rand.Reader, privKey, data)
	if err != nil {
		return nil, fmt.Errorf("sign failed: %w", err)
	}
	return sig, nil
}

// LoadStoredCredentials reads persisted credentials from disk.
// Returns an error if no credentials exist (not a fatal condition —
// caller should treat this as "needs registration").
func (k *LinuxKeyStore) LoadStoredCredentials() (core.Credentials, error) {
	credsPath := filepath.Join(k.baseDir, credsFile)
	data, err := os.ReadFile(credsPath)
	if err != nil {
		return core.Credentials{}, fmt.Errorf("no stored credentials: %w", err)
	}

	var creds core.Credentials
	if err := json.Unmarshal(data, &creds); err != nil {
		return core.Credentials{}, fmt.Errorf("corrupt credentials file: %w", err)
	}

	// SECURITY: reject expired credentials — force re-registration
	if time.Now().After(creds.ExpiresAt) {
		return core.Credentials{}, fmt.Errorf("stored credentials expired at %s", creds.ExpiresAt)
	}

	return creds, nil
}

// SaveCredentials persists credentials to disk at 0600.
// SECURITY: writes atomically via temp file + rename to prevent
// partial writes leaving a corrupt credential file.
func (k *LinuxKeyStore) SaveCredentials(creds core.Credentials) error {
	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal credentials: %w", err)
	}
	credsPath := filepath.Join(k.baseDir, credsFile)
	return writeSecureFile(credsPath, data)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// writeSecureFile writes data to path using a temp file + rename.
// Enforces 0600 permissions on the final file.
// SECURITY: temp file is also created at 0600 to prevent race conditions
// where another process reads the file between creation and chmod.
func writeSecureFile(path string, data []byte) error {
	dir := filepath.Dir(path)
	base := filepath.Base(path)

	tmp, err := os.CreateTemp(dir, "."+base+".tmp")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpPath := tmp.Name()

	// Set permissions BEFORE writing data
	if err := tmp.Chmod(keyFilePerms); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("set temp file permissions: %w", err)
	}

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("write to temp file: %w", err)
	}

	if err := tmp.Sync(); err != nil { // flush to disk before rename
		tmp.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("sync temp file: %w", err)
	}
	tmp.Close()

	// Atomic rename — on Linux this is atomic within the same filesystem
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename temp to %s: %w", path, err)
	}
	return nil
}

func (k *LinuxKeyStore) loadPrivKey() (*ecdsa.PrivateKey, error) {
	keyPath := filepath.Join(k.baseDir, keyFile)
	data, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("read private key file: %w", err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("invalid PEM in key file")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("parse private key: %w", err)
	}

	ecKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("key is not ECDSA")
	}
	return ecKey, nil
}
