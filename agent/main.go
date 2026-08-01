//go:build linux

package main

import (
	"crypto/tls"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/Ecotrace/agent/adapter/linux"
	"github.com/Ecotrace/agent/core"
	otlp "github.com/Ecotrace/agent/transport/otlp"
)

func main() {
	// ── Config from flags / env ───────────────────────────────────────────────
	baseURL := flag.String("server", envOr("ECOTRACE_SERVER", "https://localhost"), "EcoTrace server URL")
	bootstrapToken := flag.String("token", envOr("BOOTSTRAP_TOKEN", ""), "Bootstrap token for registration")
	deviceClass := flag.String("class", envOr("DEVICE_CLASS", "linux"), "Device class")
	flag.Parse()

	if *bootstrapToken == "" {
		log.Fatal("[agent] FATAL: bootstrap token required (--token or BOOTSTRAP_TOKEN env var)")
	}

	hostname, _ := os.Hostname()
	log.Printf("[agent] starting EcoTrace agent host=%s class=%s server=%s", hostname, *deviceClass, *baseURL)

	// ── HTTP client — TLS with optional insecure for dev ─────────────────────
	// SECURITY: set ECOTRACE_INSECURE_TLS=true only in development
	// Never use in production
	tlsConfig := &tls.Config{}
	if os.Getenv("ECOTRACE_INSECURE_TLS") == "true" {
		log.Printf("[agent] WARNING: TLS verification disabled (dev mode only)")
		tlsConfig.InsecureSkipVerify = true
	}
	httpClient := &http.Client{
		Timeout:   30 * time.Second,
		Transport: &http.Transport{TLSClientConfig: tlsConfig},
	}

	// ── KeyStore ─────────────────────────────────────────────────────────────
	home, _ := os.UserHomeDir()
	ks, err := linux.NewLinuxKeyStore()
	if err != nil {
		log.Fatalf("[agent] keystore init failed: %v", err)
	}
	bufferBase := filepath.Join(home, ".ecotrace")

	// ── Registration ─────────────────────────────────────────────────────────
	regConfig := core.RegistrationConfig{
		BootstrapToken:  *bootstrapToken,
		RegistrationURL: *baseURL + "/register",
		AuthURL:         *baseURL + "/auth/token",
		DeviceClass:     *deviceClass,
		Hostname:        hostname,
		OS:              "linux",
		HTTPClient:      httpClient,
	}

	sm := core.NewRegistrationSM(regConfig, ks)
	if err := sm.Start(); err != nil {
		log.Fatalf("[agent] registration failed: %v", err)
	}

	creds := sm.GetCredentials()
	log.Printf("[agent] registered device_id=%s", creds.DeviceID)

	// ── Token Lifecycle Manager ───────────────────────────────────────────────
	tlm := core.NewTokenLifecycleManager(creds, ks, *baseURL+"/auth/token", httpClient, sm)
	tlm.Start()
	defer tlm.Stop()

	// ── Transport ─────────────────────────────────────────────────────────────
	transport := otlp.NewClient(*baseURL, httpClient, tlm.GetToken, tlm.On401)

	// ── Buffer ────────────────────────────────────────────────────────────────
	buffer := core.NewLocalBuffer(bufferBase)
	log.Printf("[agent] buffer restored %d envelopes from disk", buffer.Len())

	// ── Envelope Builder ──────────────────────────────────────────────────────
	builder := core.NewEnvelopeBuilder(creds, *deviceClass)

	// ── Metric Source ─────────────────────────────────────────────────────────
	metricSrc := linux.NewLinuxMetricSource()

	// ── Send Orchestrator ─────────────────────────────────────────────────────
	orchestrator := core.NewSendOrchestrator(buffer, transport)
	orchestrator.Start()

	// ── Collection loop ───────────────────────────────────────────────────────
	log.Printf("[agent] collection loop started (30s interval)")
	ticker := time.NewTicker(30 * time.Second)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)

	for {
		select {
		case <-sigCh:
			log.Printf("[agent] shutdown signal received")
			ticker.Stop()
			orchestrator.Stop()
			log.Printf("[agent] clean shutdown complete")
			return

		case t := <-ticker.C:
			window := core.TimeRange{
				Start: t.Add(-30 * time.Second),
				End:   t,
			}
			metrics, err := metricSrc.Collect(window)
			if err != nil {
				log.Printf("[agent] metric collection error: %v", err)
				continue
			}

			env, err := builder.Build(metrics, window)
			if err != nil {
				log.Printf("[agent] envelope build error: %v", err)
				continue
			}

			buffer.Push(env)
			log.Printf("[agent] collected cpu=%.1f%% mem=%.1f%% buffer=%d",
				env.CpuUsage, env.MemoryUsage, buffer.Len())
		}
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
