//go:build linux

package linux

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Ecotrace/agent/core"
)

// LinuxMetricSource implements core.MetricSource using /proc filesystem.
// Never imports platform-specific syscall packages in core/ — only here.
type LinuxMetricSource struct{}

func NewLinuxMetricSource() *LinuxMetricSource {
	return &LinuxMetricSource{}
}

// Collect reads system metrics over the given window.
// CPU usage requires two samples (delta calculation) — window.Start and window.End
// define the gap. For a 30s window, call with Start=now-30s, End=now.
func (s *LinuxMetricSource) Collect(window core.TimeRange) ([]core.Metric, error) {
	cpu, err := cpuUsagePercent()
	if err != nil {
		return nil, fmt.Errorf("cpu read failed: %w", err)
	}

	mem, err := memoryUsagePercent()
	if err != nil {
		return nil, fmt.Errorf("memory read failed: %w", err)
	}

	netSent, netRecv, err := networkBytes()
	if err != nil {
		return nil, fmt.Errorf("network read failed: %w", err)
	}

	now := time.Now()
	metrics := []core.Metric{
		{Name: "cpu_usage",        Value: cpu,     Timestamp: now},
		{Name: "memory_usage",     Value: mem,     Timestamp: now},
		{Name: "network_sent",     Value: float64(netSent), Timestamp: now},
		{Name: "network_received", Value: float64(netRecv), Timestamp: now},
	}

	// ── Workload telemetry (processes, load average) ────────────────
	// Best-effort: a failure here must never fail the whole collection,
	// since process sampling requires a second /proc pass.
	if load, err := loadAverage1m(); err == nil {
		metrics = append(metrics, core.Metric{Name: "load_average_1m", Value: load, Timestamp: now})
	}
	if procs, err := collectProcesses(window); err == nil {
		metrics = append(metrics, procs...)
	} else {
		// process_count still reported as 0 is acceptable — telemetry continues
		metrics = append(metrics, core.Metric{Name: "process_count", Value: 0, Timestamp: now})
	}

	return metrics, nil
}

// ── CPU ──────────────────────────────────────────────────────────────────────

type cpuStat struct {
	total uint64
	idle  uint64
}

func readProcStat() (cpuStat, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuStat{}, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 5 {
			return cpuStat{}, fmt.Errorf("unexpected /proc/stat format")
		}
		var vals [10]uint64
		for i := 1; i < len(fields) && i <= 10; i++ {
			v, err := strconv.ParseUint(fields[i], 10, 64)
			if err != nil {
				return cpuStat{}, fmt.Errorf("parse /proc/stat field %d: %w", i, err)
			}
			vals[i-1] = v
		}
		// Fields: user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
		idle  := vals[3] + vals[4] // idle + iowait
		total := vals[0] + vals[1] + vals[2] + vals[3] + vals[4] +
		         vals[5] + vals[6] + vals[7]
		return cpuStat{total: total, idle: idle}, nil
	}
	return cpuStat{}, fmt.Errorf("cpu line not found in /proc/stat")
}

func cpuUsagePercent() (float64, error) {
	s1, err := readProcStat()
	if err != nil {
		return 0, err
	}
	// 500ms sample interval — fast enough for 30s collection windows
	time.Sleep(500 * time.Millisecond)
	s2, err := readProcStat()
	if err != nil {
		return 0, err
	}

	totalDelta := float64(s2.total - s1.total)
	idleDelta  := float64(s2.idle  - s1.idle)

	if totalDelta == 0 {
		return 0, nil
	}
	return (1.0 - idleDelta/totalDelta) * 100.0, nil
}

// ── Memory ───────────────────────────────────────────────────────────────────

func memoryUsagePercent() (float64, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	defer f.Close()

	values := make(map[string]uint64)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		key := strings.TrimSuffix(fields[0], ":")
		val, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			continue
		}
		values[key] = val
	}

	total, ok1 := values["MemTotal"]
	avail, ok2 := values["MemAvailable"]
	if !ok1 || !ok2 || total == 0 {
		return 0, fmt.Errorf("MemTotal or MemAvailable not found in /proc/meminfo")
	}

	used := total - avail
	return (float64(used) / float64(total)) * 100.0, nil
}

// ── Network ──────────────────────────────────────────────────────────────────

func networkBytes() (sent uint64, received uint64, err error) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	// Skip 2 header lines
	scanner.Scan()
	scanner.Scan()

	for scanner.Scan() {
		line := scanner.Text()
		// Format: iface: recv_bytes ... send_bytes ...
		colonIdx := strings.Index(line, ":")
		if colonIdx < 0 {
			continue
		}
		iface  := strings.TrimSpace(line[:colonIdx])
		// Skip loopback — only count real interfaces
		if iface == "lo" {
			continue
		}
		fields := strings.Fields(line[colonIdx+1:])
		if len(fields) < 10 {
			continue
		}
		// Column 0: receive bytes, Column 8: transmit bytes
		r, _ := strconv.ParseUint(fields[0], 10, 64)
		t, _ := strconv.ParseUint(fields[8], 10, 64)
		received += r
		sent     += t
	}
	return sent, received, nil
}
