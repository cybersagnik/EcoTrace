package core

import (
	"log"
	"time"

	"github.com/Ecotrace/agent/schema"
)

const (
	flushInterval = 30 * time.Second
	maxRetries    = 3
	retryBackoff  = 5 * time.Second
)

// SendOrchestrator decides when to flush the buffer and handles retry logic.
// It never touches credentials directly — token access goes through the
// TokenLifecycleManager's GetToken() method.
type SendOrchestrator struct {
	buffer    *LocalBuffer
	transport Transport
	stopCh    chan struct{}
}

func NewSendOrchestrator(buffer *LocalBuffer, transport Transport) *SendOrchestrator {
	return &SendOrchestrator{
		buffer:    buffer,
		transport: transport,
		stopCh:    make(chan struct{}),
	}
}

// Start begins the 30-second flush loop in the background.
func (o *SendOrchestrator) Start() {
	go o.run()
}

// Stop shuts down the flush loop. Performs one final flush before exiting.
func (o *SendOrchestrator) Stop() {
	close(o.stopCh)
}

func (o *SendOrchestrator) run() {
	ticker := time.NewTicker(flushInterval)
	defer ticker.Stop()

	log.Printf("[orchestrator] started — flush interval=%s", flushInterval)

	for {
		select {
		case <-o.stopCh:
			log.Printf("[orchestrator] stopping — flushing remaining buffer")
			o.flush()
			return
		case <-ticker.C:
			o.flush()
		}
	}
}

// flush drains the buffer and sends each envelope with retry + backoff.
// On send failure, envelopes are restored to the buffer for the next cycle.
func (o *SendOrchestrator) flush() {
	envs := o.buffer.Drain()
	if len(envs) == 0 {
		return
	}

	log.Printf("[orchestrator] flushing %d envelope(s)", len(envs))

	var failed []*schema.TelemetryEnvelope

	for _, env := range envs {
		sent := false
		for attempt := 1; attempt <= maxRetries; attempt++ {
			err := o.transport.Send(env)
			if err == nil {
				sent = true
				break
			}
			log.Printf("[orchestrator] send attempt %d/%d failed for device_id=%s: %v",
				attempt, maxRetries, env.DeviceId, err)
			if attempt < maxRetries {
				time.Sleep(retryBackoff * time.Duration(attempt)) // exponential-ish backoff
			}
		}
		if !sent {
			log.Printf("[orchestrator] giving up on envelope — returning to buffer device_id=%s",
				env.DeviceId)
			failed = append(failed, env)
		}
	}

	if len(failed) > 0 {
		o.buffer.Restore(failed)
		log.Printf("[orchestrator] %d envelope(s) returned to buffer", len(failed))
	}
}
