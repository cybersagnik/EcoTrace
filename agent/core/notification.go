package core

import (
	"log"
	"sync"
	"time"
)

// Notification is a control-plane message delivered to this device.
// Content comes from the platform (e.g. an admin "optimize" suggestion).
type Notification struct {
	ID       int64
	Title    string
	Message  string
	Severity string
}

// NotificationInbox is an OPTIONAL port. A platform adapter implements it to
// receive control-plane notifications (e.g. a Windows toast adapter). Adapters
// that do NOT implement it simply never receive notifications — Core never
// assumes an inbox exists.
//
// Design Rule 1 stays intact: this interface is pure business contract. The
// adapter owns transport (HTTP pull) and rendering (OS toast), Core owns the
// polling schedule, dedup bookkeeping, and acknowledgement policy.
type NotificationInbox interface {
	// FetchPending pulls notifications queued for this device from the
	// control plane. The server atomically marks them delivered on fetch.
	FetchPending() ([]Notification, error)
	// Show renders a single notification on the device (adapter-specific).
	Show(n Notification) error
	// MarkSeen acknowledges delivery back to the control plane.
	MarkSeen(id int64) error
}

// NotificationPoller is a platform-agnostic scheduler around an inbox.
// It polls immediately on start, then on a fixed interval.
type NotificationPoller struct {
	inbox    NotificationInbox
	interval time.Duration
	stopCh   chan struct{}
	once     sync.Once
}

func NewNotificationPoller(inbox NotificationInbox, interval time.Duration) *NotificationPoller {
	if interval < 5*time.Second {
		interval = 30 * time.Second
	}
	return &NotificationPoller{
		inbox:    inbox,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

func (p *NotificationPoller) Start() {
	go p.run()
	log.Printf("[notifications] poller started — interval=%s", p.interval)
}

func (p *NotificationPoller) Stop() {
	p.once.Do(func() { close(p.stopCh) })
}

func (p *NotificationPoller) run() {
	p.pollOnce()
	ticker := time.NewTicker(p.interval)
	defer ticker.Stop()
	for {
		select {
		case <-p.stopCh:
			return
		case <-ticker.C:
			p.pollOnce()
		}
	}
}

func (p *NotificationPoller) pollOnce() {
	items, err := p.inbox.FetchPending()
	if err != nil {
		log.Printf("[notifications] fetch failed: %v", err)
		return
	}
	for _, n := range items {
		log.Printf("[notifications] received id=%d severity=%s title=%q", n.ID, n.Severity, n.Title)
		if err := p.inbox.Show(n); err != nil {
			log.Printf("[notifications] render failed id=%d: %v", n.ID, err)
		}
		if err := p.inbox.MarkSeen(n.ID); err != nil {
			log.Printf("[notifications] ack failed id=%d: %v", n.ID, err)
		} else {
			log.Printf("[notifications] acknowledged id=%d", n.ID)
		}
	}
}
