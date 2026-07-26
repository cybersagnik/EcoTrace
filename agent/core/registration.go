// core/registration.go
package core

import (
	"fmt"
	"log"
)

type RegistrationState int

const (
	StateUnregistered RegistrationState = iota
	StateRegistering
	StateOperating
	StateRegistrationFailed // Terminal — requires human intervention + new bootstrap token
)

type RegistrationConfig struct {
	BootstrapToken  string
	RegistrationURL string // e.g. https://ecotrace-demo/register
	AuthURL         string // e.g. https://ecotrace-demo/auth/token
}

type RegistrationStateMachine struct {
	state    RegistrationState
	config   RegistrationConfig
	keyStore KeyStore
	creds    Credentials
}

func NewRegistrationSM(cfg RegistrationConfig, ks KeyStore) *RegistrationStateMachine {
	return &RegistrationStateMachine{
		state:    StateUnregistered,
		config:   cfg,
		keyStore: ks,
	}
}

// Start runs the full registration flow synchronously.
// Returns an error only for terminal failures.
func (sm *RegistrationStateMachine) Start() error {
	log.Printf("[registration] state: UNREGISTERED")

	// Step 1: Check for existing credentials.
	creds, err := sm.keyStore.LoadStoredCredentials()
	if err == nil && creds.DeviceID != "" {
		log.Printf("[registration] existing credentials found for device_id=%s", creds.DeviceID)
		sm.creds = creds
		sm.state = StateOperating
		log.Printf("[registration] state: OPERATING (reused credentials)")
		return nil
	}

	// Step 2: No credentials — register.
	sm.state = StateRegistering
	log.Printf("[registration] state: REGISTERING")

	pubKey, err := sm.keyStore.GeneratePrivateKey()
	if err != nil {
		sm.state = StateRegistrationFailed
		return fmt.Errorf("[registration] key generation failed: %w", err)
	}

	// TODO (Jul 28): implement actual HTTP call to Registration Service
	// For now, stub returns a hardcoded device_id for compilation.
	creds, err = sm.callRegistrationService(pubKey)
	if err != nil {
		sm.state = StateRegistrationFailed
		log.Printf("[registration] state: REGISTRATION_FAILED — %v", err)
		log.Printf("[registration] This is a terminal state. Obtain a new bootstrap token and restart.")
		return err
	}

	if err := sm.keyStore.SaveCredentials(creds); err != nil {
		sm.state = StateRegistrationFailed
		return fmt.Errorf("[registration] failed to persist credentials: %w", err)
	}

	sm.creds = creds
	sm.state = StateOperating
	log.Printf("[registration] state: OPERATING — device_id=%s", creds.DeviceID)
	return nil
}

func (sm *RegistrationStateMachine) GetCredentials() Credentials {
	return sm.creds
}

func (sm *RegistrationStateMachine) State() RegistrationState {
	return sm.state
}

// callRegistrationService is a stub — replace with real HTTP call on Jul 28.
func (sm *RegistrationStateMachine) callRegistrationService(pubKey []byte) (Credentials, error) {
	// STUB: hardcoded for compilation. Real implementation in Jul 28 tasks.
	return Credentials{
		DeviceID:    "stub-device-001",
		AccessToken: "stub-token",
	}, nil
}
