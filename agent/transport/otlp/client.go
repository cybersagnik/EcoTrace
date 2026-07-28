package otlp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/Ecotrace/agent/schema"
)

// Client implements core.Transport by sending TelemetryEnvelopes
// as JSON to the OTLP HTTP endpoint via nginx.
// SECURITY:
//   - JWT attached to every request via Authorization header
//   - Response body limited to 8KB
//   - 10s request timeout
//   - 401 response triggers Token Lifecycle Manager refresh
type Client struct {
	endpoint   string
	httpClient *http.Client
	getToken   func() string // injected — never stores token directly
	on401      func()        // injected — triggers TLM refresh
}

func NewClient(endpoint string, httpClient *http.Client, getToken func() string, on401 func()) *Client {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{
		endpoint:   endpoint,
		httpClient: httpClient,
		getToken:   getToken,
		on401:      on401,
	}
}

// Send wraps the TelemetryEnvelope in a minimal OTLP-compatible JSON body
// and POSTs it to the configured endpoint.
// SECURITY: Authorization header is set fresh on every request via getToken().
func (c *Client) Send(env *schema.TelemetryEnvelope) error {
	// Wrap in minimal OTLP traces structure expected by ingestion-http
	payload := map[string]interface{}{
		"resourceSpans": []map[string]interface{}{
			{
				"resource": map[string]interface{}{
					"attributes": []map[string]interface{}{
						{"key": "service.name", "value": map[string]string{"stringValue": "ecotrace-agent"}},
						{"key": "device_id", "value": map[string]string{"stringValue": env.DeviceId}},
						{"key": "device_class", "value": map[string]string{"stringValue": env.DeviceClass}},
					},
				},
				"scopeSpans": []map[string]interface{}{
					{
						"spans": []map[string]interface{}{
							{
								"name":              "telemetry.collect",
								"startTimeUnixNano": fmt.Sprintf("%d", env.WindowStartMs*1e6),
								"endTimeUnixNano":   fmt.Sprintf("%d", env.WindowEndMs*1e6),
								"attributes": []map[string]interface{}{
									{"key": "cpu_usage", "value": map[string]interface{}{"doubleValue": env.CpuUsage}},
									{"key": "memory_usage", "value": map[string]interface{}{"doubleValue": env.MemoryUsage}},
									{"key": "network_sent", "value": map[string]interface{}{"intValue": fmt.Sprintf("%d", env.NetworkSent)}},
									{"key": "network_received", "value": map[string]interface{}{"intValue": fmt.Sprintf("%d", env.NetworkReceived)}},
									{"key": "device_id", "value": map[string]string{"stringValue": env.DeviceId}},
									{"key": "schema_version", "value": map[string]string{"stringValue": env.SchemaVersion}},
									{"key": "os", "value": map[string]string{"stringValue": env.OperatingSystem}},
									{"key": "hostname", "value": map[string]string{"stringValue": env.Hostname}},
								},
							},
						},
					},
				},
			},
		},
		// Embed the full envelope as a custom field for the ingestion worker
		"_ecotrace_envelope": env,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal envelope: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.endpoint+"/v1/traces", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}

	token := c.getToken()
	if token == "" {
		return fmt.Errorf("no access token available — agent not registered")
	}

	// SECURITY: fresh token on every request
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("send failed: %w", err)
	}
	defer resp.Body.Close()
	// Drain and discard response body to allow connection reuse
	io.Copy(io.Discard, io.LimitReader(resp.Body, 8*1024))

	if resp.StatusCode == http.StatusUnauthorized {
		log.Printf("[transport] 401 — triggering token refresh")
		if c.on401 != nil {
			c.on401()
		}
		return fmt.Errorf("send rejected: 401 unauthorized (token refresh triggered)")
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("send failed: HTTP %d", resp.StatusCode)
	}

	log.Printf("[transport] sent envelope device_id=%s cpu=%.1f%% mem=%.1f%%",
		env.DeviceId, env.CpuUsage, env.MemoryUsage)
	return nil
}
