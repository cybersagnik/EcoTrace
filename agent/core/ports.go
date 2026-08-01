// core/ports.go
// Package core contains zero platform-specific code.
// Every OS call goes through one of these three interfaces.
// The Go toolchain enforces this: importing a Linux-only package
// inside /core will fail to compile on GOOS=windows.
package core

import (
	"time"

	"github.com/Ecotrace/agent/schema"
)

// Credentials holds the identity data persisted after registration.
type Credentials struct {
	DeviceID     string
	AccessToken  string
	RefreshToken string
	IssuedAt     time.Time
	ExpiresAt    time.Time
}

// Metric is a single collected measurement.
type Metric struct {
	Name      string
	Value     float64
	Timestamp time.Time
}

// TimeRange defines a metric collection window.
type TimeRange struct {
	Start time.Time
	End   time.Time
}

// KeyStore abstracts credential storage and cryptographic operations.
// Linux implementation: openssl key at ~/.ecotrace/device.key (0600).
// Windows implementation: DPAPI-encrypted blob or CNG key.
type KeyStore interface {
	GeneratePrivateKey() (publicKey []byte, err error)
	Sign(data []byte) (signature []byte, err error)
	LoadStoredCredentials() (Credentials, error)
	SaveCredentials(creds Credentials) error
}

// MetricSource abstracts OS-level metric collection.
// Linux implementation: /proc/stat, /proc/meminfo, /proc/net/dev.
// Windows implementation: WMI / PDH queries.
type MetricSource interface {
	Collect(window TimeRange) ([]Metric, error)
}

// Transport abstracts the network send path.
// Both Linux and Windows use the shared transport/otlp package.
// A future constrained platform could provide a different implementation.
type Transport interface {
	Send(envelope *schema.TelemetryEnvelope) error
}
