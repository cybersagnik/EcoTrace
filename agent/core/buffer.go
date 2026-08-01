package core

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Ecotrace/agent/schema"
)

const (
	maxBufferSize     = 2880 // 24h at 30s intervals
	evictionBatchSize = 100  // drop oldest 100 when full
)

// LocalBuffer queues envelopes pending successful transmission.
// Thread-safe. Persists to disk on write so envelopes survive agent restart.
// SECURITY: buffer file stored in credDir (0700) so only the agent user can read it.
type LocalBuffer struct {
	mu       sync.Mutex
	items    []*schema.TelemetryEnvelope
	filePath string
}

func NewLocalBuffer(baseDir string) *LocalBuffer {
	b := &LocalBuffer{
		filePath: filepath.Join(baseDir, "send-buffer.json"),
	}
	b.load() // restore from disk if available
	return b
}

// Push adds an envelope to the buffer.
// If the buffer is full, the oldest envelopes are evicted first.
func (b *LocalBuffer) Push(env *schema.TelemetryEnvelope) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.items) >= maxBufferSize {
		log.Printf("[buffer] full (%d items) — evicting %d oldest", len(b.items), evictionBatchSize)
		b.items = b.items[evictionBatchSize:]
	}
	b.items = append(b.items, env)
	b.persist()
}

// Drain returns all buffered envelopes and clears the buffer.
// Called by Send Orchestrator when flushing.
func (b *LocalBuffer) Drain() []*schema.TelemetryEnvelope {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.items) == 0 {
		return nil
	}
	out := make([]*schema.TelemetryEnvelope, len(b.items))
	copy(out, b.items)
	b.items = b.items[:0]
	b.persist()
	return out
}

// Restore puts envelopes back into the buffer (called after a failed send).
func (b *LocalBuffer) Restore(envs []*schema.TelemetryEnvelope) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.items = append(envs, b.items...) // prepend so order is preserved
	if len(b.items) > maxBufferSize {
		b.items = b.items[len(b.items)-maxBufferSize:]
	}
	b.persist()
}

// Len returns current buffer size.
func (b *LocalBuffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.items)
}

func (b *LocalBuffer) persist() {
	if b.filePath == "" {
		return
	}
	data, err := json.Marshal(b.items)
	if err != nil {
		log.Printf("[buffer] persist marshal error: %v", err)
		return
	}
	// Write to temp + rename for atomicity
	tmp := b.filePath + ".tmp"
	if err := os.WriteFile(tmp, data, 0600); err != nil {
		log.Printf("[buffer] persist write error: %v", err)
		return
	}
	if err := os.Rename(tmp, b.filePath); err != nil {
		log.Printf("[buffer] persist rename error: %v", err)
	}
}

func (b *LocalBuffer) load() {
	if b.filePath == "" {
		return
	}
	data, err := os.ReadFile(b.filePath)
	if err != nil {
		return // no buffer file — normal on first run
	}
	var items []*schema.TelemetryEnvelope
	if err := json.Unmarshal(data, &items); err != nil {
		log.Printf("[buffer] corrupt buffer file — starting fresh: %v", err)
		os.Remove(b.filePath)
		return
	}
	// Discard envelopes older than 24h — they're stale
	cutoff := time.Now().Add(-24 * time.Hour)
	for _, item := range items {
		// Note: schema.TelemetryEnvelope no longer has CreatedAt field
		// Buffer expiry is based on WindowEndMs instead
		windowEnd := time.UnixMilli(item.WindowEndMs)
		if windowEnd.After(cutoff) {
			b.items = append(b.items, item)
		}
	}
	if dropped := len(items) - len(b.items); dropped > 0 {
		log.Printf("[buffer] dropped %d stale envelopes from disk buffer", dropped)
	}
	log.Printf("[buffer] restored %d envelopes from disk", len(b.items))
}
