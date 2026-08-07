//go:build windows

package windows

import (
	"net/http"

	otlp "github.com/Ecotrace/agent/transport/otlp"
)

// NewWindowsTransport wires the shared OTLP/HTTP client for Windows.
// Both Tier 1 agents use the same transport package — only the wiring lives
// in the adapter.
func NewWindowsTransport(baseURL string, httpClient *http.Client, getToken func() string, on401 func()) *otlp.Client {
	return otlp.NewClient(baseURL, httpClient, getToken, on401)
}
