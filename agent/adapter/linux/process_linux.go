//go:build linux

package linux

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Ecotrace/agent/core"
	"github.com/Ecotrace/agent/schema"
)

// Process/workload telemetry for the Linux adapter.
//
// Samples per-process CPU (utime+stime jiffies deltas), RSS, and maps each
// process to a workload/service via its cgroup (systemd unit, container
// scope). The values are surfaced to Core as Metrics with Name="process"
// and a populated Process field; Core collects them into
// envelope.processes[] for downstream service attribution.
//
// Design Rule 2: this file contains no business logic — it only translates
// /proc reads into port data.

const maxProcessSamples = 40

type procTick struct {
	utime uint64
	stime uint64
}

type procSnapshot struct {
	totalJiffies uint64
	procs        map[int]*procTick
}

// snapshotProcs reads /proc/stat total jiffies plus every /proc/<pid>/stat
// utime+stime. Must be called twice with a gap to compute deltas.
func snapshotProcs() (procSnapshot, error) {
	snap := procSnapshot{procs: make(map[int]*procTick)}

	st, err := readProcStat()
	if err != nil {
		return snap, err
	}
	snap.totalJiffies = st.total

	entries, err := os.ReadDir("/proc")
	if err != nil {
		return snap, err
	}

	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		t, ok := readProcTick(pid)
		if ok {
			snap.procs[pid] = t
		}
	}
	return snap, nil
}

// readProcTick parses /proc/<pid>/stat. Field 2 (comm) may contain spaces,
// so we anchor on the last ')' and treat everything after as fields[3+]:
//
//	fields[0]  = state        (field 3)
//	fields[11] = utime        (field 14)
//	fields[12] = stime        (field 15)
func readProcTick(pid int) (*procTick, bool) {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return nil, false
	}
	line := string(b)
	rparen := strings.LastIndex(line, ")")
	if rparen < 0 || rparen+2 >= len(line) {
		return nil, false
	}
	fields := strings.Fields(line[rparen+2:])
	if len(fields) < 23 {
		return nil, false
	}
	utime, _ := strconv.ParseUint(fields[11], 10, 64)
	stime, _ := strconv.ParseUint(fields[12], 10, 64)
	return &procTick{utime: utime, stime: stime}, true
}

func procName(pid int) string {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/comm", pid))
	if err != nil {
		return fmt.Sprintf("pid%d", pid)
	}
	return strings.TrimSpace(string(b))
}

func procRSSBytes(pid int) int64 {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return 0
	}
	line := string(b)
	rparen := strings.LastIndex(line, ")")
	if rparen < 0 {
		return 0
	}
	fields := strings.Fields(line[rparen+2:])
	if len(fields) < 22 {
		return 0
	}
	// rss is field 24 of /proc/<pid>/stat → index 21 after the comm strip.
	pages, _ := strconv.ParseInt(fields[21], 10, 64)
	if pages <= 0 {
		return 0
	}
	return pages * int64(os.Getpagesize())
}

// serviceName maps a pid to a workload label using cgroup v2 paths.
//
//	/system.slice/ssh.service      → "ssh.service"
//	/system.slice/docker-abc.scope → "docker-abc"
//	/init.scope                    → process name (WSL puts every user
//	                                 process in /init.scope, so "init"
//	                                 would swallow them all)
//	anything else                  → falls back to process name
func serviceName(pid int, name string) string {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/cgroup", pid))
	if err != nil {
		return name
	}
	lines := strings.Split(string(b), "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		line := strings.TrimSpace(lines[i])
		colon := strings.Index(line, ":")
		if colon < 0 {
			continue
		}
		path := strings.TrimSpace(line[colon+1:])
		if path == "" || path == "/" {
			continue
		}
		seg := strings.TrimPrefix(path, "/")
		parts := strings.Split(seg, "/")
		last := parts[len(parts)-1]
		if last == "" || last == "system.slice" || last == "user.slice" {
			continue
		}
		// Normalize unit/scope names for display (drop ".scope", keep ".service").
		unit := strings.TrimSuffix(last, ".scope")
		if unit == "init" {
			// The WSL container bucket — not a real service. Use the process
			// name so user-spawned workloads aren't all attributed to "init".
			return name
		}
		if strings.HasSuffix(unit, ".service") ||
			strings.HasSuffix(unit, ".mount") ||
			strings.HasSuffix(unit, ".slice") ||
			strings.Contains(unit, "docker-") {
			return unit
		}
		return unit
	}
	return name
}

// collectProcesses returns per-process metrics for the collection window.
// Two snapshots ~500ms apart give CPU% deltas; on the very first call the
// delta basis is empty so processes report 0% CPU (RSS/name still valid).
func collectProcesses(window core.TimeRange) ([]core.Metric, error) {
	s1, err := snapshotProcs()
	if err != nil {
		return nil, fmt.Errorf("process snapshot 1 failed: %w", err)
	}
	time.Sleep(500 * time.Millisecond)
	s2, err := snapshotProcs()
	if err != nil {
		return nil, fmt.Errorf("process snapshot 2 failed: %w", err)
	}

	type procInfo struct {
		pid     int
		name    string
		service string
		rss     int64
		cpuPct  float64
	}
	infos := make([]procInfo, 0, len(s2.procs))
	totalDelta := float64(s2.totalJiffies - s1.totalJiffies)

	for pid, t2 := range s2.procs {
		name := procName(pid)
		rss := procRSSBytes(pid)

		var cpuPct float64
		if t1, ok := s1.procs[pid]; ok && totalDelta > 0 {
			dt := float64((t2.utime + t2.stime) - (t1.utime + t1.stime))
			cpuPct = (dt / totalDelta) * 100.0
			if cpuPct < 0 {
				cpuPct = 0
			}
		}

		infos = append(infos, procInfo{
			pid:     pid,
			name:    name,
			service: serviceName(pid, name),
			rss:     rss,
			cpuPct:  cpuPct,
		})
	}

	// Keep the highest-CPU processes (fall back to RSS ordering when idle)
	// so the envelope stays small.
	sort.Slice(infos, func(i, j int) bool {
		if infos[i].cpuPct != infos[j].cpuPct {
			return infos[i].cpuPct > infos[j].cpuPct
		}
		return infos[i].rss > infos[j].rss
	})
	if len(infos) > maxProcessSamples {
		infos = infos[:maxProcessSamples]
	}

	now := time.Now()
	metrics := make([]core.Metric, 0, len(infos)+2)
	metrics = append(metrics, core.Metric{
		Name: "process_count", Value: float64(len(s2.procs)), Timestamp: now,
	})
	for _, p := range infos {
		metrics = append(metrics, core.Metric{
			Name:      "process",
			Value:     p.cpuPct,
			Timestamp: now,
			Process: &schema.ProcessSample{
				Pid:        int32(p.pid),
				Name:       p.name,
				Service:    p.service,
				CpuPercent: float32(p.cpuPct),
				RssBytes:   p.rss,
			},
		})
	}
	return metrics, nil
}

// loadAverage1m reads the 1-minute load average from /proc/loadavg.
func loadAverage1m() (float64, error) {
	f, err := os.Open("/proc/loadavg")
	if err != nil {
		return 0, err
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return 0, fmt.Errorf("empty /proc/loadavg")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 1 {
		return 0, fmt.Errorf("unexpected /proc/loadavg format")
	}
	v, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, err
	}
	return v, nil
}
