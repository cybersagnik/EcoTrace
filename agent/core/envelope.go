package core

import (
	"fmt"
	"os"
	"runtime"

	"github.com/Ecotrace/agent/schema"
)

const (
	SchemaVersion    = "1.0"
	CollectorVersion = "0.1.0"
)

// EnvelopeBuilder constructs validated schema.TelemetryEnvelopes from raw metrics.
// The builder stamps device identity from credentials — adapters never set
// device_id directly. This eliminates a whole class of cross-device spoofing bugs.
type EnvelopeBuilder struct {
	deviceID    string
	deviceClass string
	hostname    string
	os          string
}

func NewEnvelopeBuilder(creds Credentials, deviceClass string) *EnvelopeBuilder {
	hostname, _ := os.Hostname()
	return &EnvelopeBuilder{
		deviceID:    creds.DeviceID,
		deviceClass: deviceClass,
		hostname:    hostname,
		os:          runtime.GOOS,
	}
}

// Build assembles and validates a schema.TelemetryEnvelope from a metric slice.
// Returns an error if required metrics are missing or values are out of range.
// SECURITY: invalid envelopes are rejected here — before buffering or sending.
func (b *EnvelopeBuilder) Build(metrics []Metric, window TimeRange) (*schema.TelemetryEnvelope, error) {
	metricMap := make(map[string]float64)
	for _, m := range metrics {
		metricMap[m.Name] = m.Value
	}

	// Validate required fields
	required := []string{"cpu_usage", "memory_usage", "network_sent", "network_received"}
	for _, r := range required {
		if _, ok := metricMap[r]; !ok {
			return nil, fmt.Errorf("missing required metric: %s", r)
		}
	}

	// Range validation — SECURITY: reject obviously corrupt data before it enters the pipeline
	if cpu := metricMap["cpu_usage"]; cpu < 0 || cpu > 100 {
		return nil, fmt.Errorf("cpu_usage out of range: %f", cpu)
	}
	if mem := metricMap["memory_usage"]; mem < 0 || mem > 100 {
		return nil, fmt.Errorf("memory_usage out of range: %f", mem)
	}
	if metricMap["network_sent"] < 0 {
		return nil, fmt.Errorf("network_sent cannot be negative")
	}
	if metricMap["network_received"] < 0 {
		return nil, fmt.Errorf("network_received cannot be negative")
	}

	return &schema.TelemetryEnvelope{
		SchemaVersion:    SchemaVersion,
		CollectorVersion: CollectorVersion,
		DeviceId:         b.deviceID, // always from credentials — never from adapter
		DeviceClass:      b.deviceClass,
		OperatingSystem:  b.os,
		Hostname:         b.hostname,
		WindowStartMs:    window.Start.UnixMilli(),
		WindowEndMs:      window.End.UnixMilli(),
		CpuUsage:         float32(metricMap["cpu_usage"]),
		MemoryUsage:      float32(metricMap["memory_usage"]),
		NetworkSent:      int64(metricMap["network_sent"]),
		NetworkReceived:  int64(metricMap["network_received"]),
	}, nil
}
