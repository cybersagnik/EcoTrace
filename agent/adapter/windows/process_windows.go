//go:build windows

package windows

import (
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"
	"unicode/utf16"
	"unsafe"

	"github.com/Ecotrace/agent/core"
	"github.com/Ecotrace/agent/schema"
)

// Process/workload telemetry for the Windows adapter.
//
// Enumerates processes via Toolhelp32, reads per-process CPU times via
// GetProcessTimes, and working-set via GetProcessMemoryInfo (psapi).
// CPU% is computed from 100ns-tick deltas between consecutive collection
// windows divided by wall time × processor count, so the very first
// collection reports 0% for every process (no delta basis yet).
//
// Service mapping: the executable name is used as the workload label —
// resolving Windows service names would require WMI/SCM, which is out of
// scope for the stdlib-only adapter.
//
// Design Rule 2: no business logic — only OS/hardware translation.

const maxProcessSamplesWindows = 40

const (
	processQueryLimitedInformation = 0x1000
	th32csSnapProcess              = 0x2
	errorNoMoreFiles               = 0x12
)

var (
	psapi                 = syscall.NewLazyDLL("psapi.dll")
	procCreateToolhelp32  = kernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32First    = kernel32.NewProc("Process32FirstW")
	procProcess32Next     = kernel32.NewProc("Process32NextW")
	procOpenProcess       = kernel32.NewProc("OpenProcess")
	procCloseHandle       = kernel32.NewProc("CloseHandle")
	procGetProcessTimes   = kernel32.NewProc("GetProcessTimes")
	procGetProcessMemInfo = psapi.NewProc("GetProcessMemoryInfo")
)

type processEntry32W struct {
	Size            uint32
	CntUsage        uint32
	ProcessID       uint32
	DefaultHeapID   uintptr
	ModuleID        uint32
	CntThreads      uint32
	ParentProcessID uint32
	PriClassBase    int32
	Flags           uint32
	ExeFile         [260]uint16
}

type processMemoryCounters struct {
	CB                         uint32
	PageFaultCount             uint32
	PeakWorkingSetSize         uintptr
	WorkingSetSize             uintptr
	QuotaPeakPagedPoolUsage    uintptr
	QuotaPagedPoolUsage        uintptr
	QuotaPeakNonPagedPoolUsage uintptr
	QuotaNonPagedPoolUsage     uintptr
	PagefileUsage              uintptr
	PeakPagefileUsage          uintptr
	PrivateUsage               uintptr
}

func exeName(buf []uint16) string {
	for i, c := range buf {
		if c == 0 {
			buf = buf[:i]
			break
		}
	}
	return string(utf16.Decode(buf))
}

// snapshotProcesses returns pid → executable name (no ".exe").
func snapshotProcesses() (map[uint32]string, error) {
	hand, _, _ := procCreateToolhelp32.Call(uintptr(th32csSnapProcess), 0)
	if hand == 0 || hand == ^uintptr(0) {
		return nil, syscall.Errno(1) // ERROR_INVALID_FUNCTION
	}
	defer procCloseHandle.Call(hand)

	var entry processEntry32W
	entry.Size = uint32(unsafe.Sizeof(entry))
	r, _, _ := procProcess32First.Call(hand, uintptr(unsafe.Pointer(&entry)))
	if r == 0 {
		return nil, syscall.Errno(errorNoMoreFiles)
	}

	out := make(map[uint32]string)
	for {
		out[entry.ProcessID] = strings.TrimSuffix(exeName(entry.ExeFile[:]), ".exe")
		r, _, _ = procProcess32Next.Call(hand, uintptr(unsafe.Pointer(&entry)))
		if r == 0 {
			break
		}
	}
	return out, nil
}

func processTimes(pid uint32) (kernel, user uint64, ok bool) {
	h, _, _ := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if h == 0 {
		return 0, 0, false
	}
	defer procCloseHandle.Call(h)

	var create, exit, kern, usr filetime
	r, _, _ := procGetProcessTimes.Call(
		h,
		uintptr(unsafe.Pointer(&create)),
		uintptr(unsafe.Pointer(&exit)),
		uintptr(unsafe.Pointer(&kern)),
		uintptr(unsafe.Pointer(&usr)),
	)
	if r == 0 {
		return 0, 0, false
	}
	return kern.val(), usr.val(), true
}

func workingSet(pid uint32) int64 {
	h, _, _ := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if h == 0 {
		return 0
	}
	defer procCloseHandle.Call(h)

	var pmc processMemoryCounters
	pmc.CB = uint32(unsafe.Sizeof(pmc))
	r, _, _ := procGetProcessMemInfo.Call(h, uintptr(unsafe.Pointer(&pmc)), uintptr(pmc.CB))
	if r == 0 {
		return 0
	}
	return int64(pmc.WorkingSetSize)
}

type procCPU struct {
	kernel uint64
	user   uint64
}

// windowsProcCollector caches previous per-pid CPU ticks for delta math.
type windowsProcCollector struct {
	prev   map[uint32]procCPU
	prevAt time.Time
}

func (c *windowsProcCollector) collect() []core.Metric {
	pids, err := snapshotProcesses()
	if err != nil {
		return nil
	}
	names := pids

	now := time.Now()
	next := make(map[uint32]procCPU, len(pids))
	type info struct {
		pid  uint32
		name string
		cpu  float64
		rss  int64
	}
	infos := make([]info, 0, len(pids))

	cores := runtime.NumCPU()
	for pid := range pids {
		k, u, ok := processTimes(pid)
		if !ok {
			continue
		}
		next[pid] = procCPU{kernel: k, user: u}

		var cpu float64
		if prev, ok2 := c.prev[pid]; ok2 && !c.prevAt.IsZero() {
			dk := k - prev.kernel
			du := u - prev.user
			dt := now.Sub(c.prevAt).Seconds()
			if dt > 0 && dt < 180 {
				cpu = ((float64(dk) + float64(du)) / (dt * 1e7) / float64(cores)) * 100
				if cpu > 100 {
					cpu = 100
				}
				if cpu < 0 {
					cpu = 0
				}
			}
		}
		infos = append(infos, info{
			pid:  pid,
			name: names[pid],
			cpu:  cpu,
			rss:  workingSet(pid),
		})
	}
	c.prev, c.prevAt = next, now

	sort.Slice(infos, func(i, j int) bool {
		if infos[i].cpu != infos[j].cpu {
			return infos[i].cpu > infos[j].cpu
		}
		return infos[i].rss > infos[j].rss
	})
	if len(infos) > maxProcessSamplesWindows {
		infos = infos[:maxProcessSamplesWindows]
	}

	metrics := make([]core.Metric, 0, len(infos)+1)
	metrics = append(metrics, core.Metric{
		Name: "process_count", Value: float64(len(pids)), Timestamp: now,
	})
	for _, p := range infos {
		metrics = append(metrics, core.Metric{
			Name:      "process",
			Value:     p.cpu,
			Timestamp: now,
			Process: &schema.ProcessSample{
				Pid:        int32(p.pid),
				Name:       p.name,
				Service:    p.name,
				CpuPercent: float32(p.cpu),
				RssBytes:   p.rss,
			},
		})
	}
	return metrics
}
