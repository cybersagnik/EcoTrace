//go:build windows

package windows

import (
	"syscall"
	"unsafe"

	"github.com/Ecotrace/agent/core"
)

// WindowsMetricSource reads CPU %, memory %, and cumulative network bytes
// via Win32 API (GetSystemTimes / GlobalMemoryStatusEx / GetIfTable).
// Stdlib-only — no x/sys dependency, works when cross-compiled from WSL.
type WindowsMetricSource struct {
	prevIdle   uint64
	prevKernel uint64
	prevUser   uint64
	hasPrev    bool
	prevInOct  uint64
	prevOutOct uint64
	hasNet     bool
	procs      windowsProcCollector
}

func NewWindowsMetricSource() *WindowsMetricSource {
	return &WindowsMetricSource{}
}

var (
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	iphlpapi                 = syscall.NewLazyDLL("iphlpapi.dll")
	procGetSystemTimes       = kernel32.NewProc("GetSystemTimes")
	procGlobalMemoryStatusEx = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetIfTable           = iphlpapi.NewProc("GetIfTable")
)

type filetime struct {
	Low  uint32
	High uint32
}

func (ft *filetime) val() uint64 { return uint64(ft.High)<<32 | uint64(ft.Low) }

func (s *WindowsMetricSource) cpuPercent() float64 {
	var idle, kernel, user filetime
	r, _, _ := procGetSystemTimes.Call(
		uintptr(unsafe.Pointer(&idle)),
		uintptr(unsafe.Pointer(&kernel)),
		uintptr(unsafe.Pointer(&user)),
	)
	if r == 0 {
		return 0
	}
	idleV, kernelV, userV := idle.val(), kernel.val(), user.val()
	if !s.hasPrev {
		s.prevIdle, s.prevKernel, s.prevUser = idleV, kernelV, userV
		s.hasPrev = true
		return 0
	}
	idleD := idleV - s.prevIdle
	kernelD := kernelV - s.prevKernel
	userD := userV - s.prevUser
	s.prevIdle, s.prevKernel, s.prevUser = idleV, kernelV, userV
	total := kernelD + userD
	if total <= 0 {
		return 0
	}
	return float64(total-idleD) / float64(total) * 100
}

type memoryStatusEx struct {
	Length               uint32
	MemoryLoad           uint32
	TotalPhys            uint64
	AvailPhys            uint64
	TotalPageFile        uint64
	AvailPageFile        uint64
	TotalVirtual         uint64
	AvailVirtual         uint64
	AvailExtendedVirtual uint64
}

func memoryPercent() float64 {
	ms := &memoryStatusEx{Length: uint32(unsafe.Sizeof(memoryStatusEx{}))}
	r, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(ms)))
	if r == 0 {
		return 0
	}
	return float64(ms.MemoryLoad)
}

// MIB_IFROW offsets (x64) — fields relevant here:
//
//	InOctets at byte 552, OutOctets at byte 576, row size 860 bytes.
const (
	ifRowSize     = 860
	ifRowInOctets = 552
	ifRowOutOct   = 576
)

func (s *WindowsMetricSource) networkDeltas() (int64, int64) {
	var inOct, outOct uint64
	var size uint32
	procGetIfTable.Call(0, uintptr(unsafe.Pointer(&size)), 0)
	if size < 4 {
		return 0, 0
	}
	buf := make([]byte, size)
	r, _, _ := procGetIfTable.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)), 0)
	if r != 0 {
		return 0, 0
	}
	numEntries := *(*uint32)(unsafe.Pointer(&buf[0]))
	for i := uint32(0); i < numEntries; i++ {
		row := unsafe.Pointer(uintptr(unsafe.Pointer(&buf[0])) + 4 + uintptr(i)*ifRowSize)
		inOct += uint64(*(*uint32)(unsafe.Add(row, ifRowInOctets)))
		outOct += uint64(*(*uint32)(unsafe.Add(row, ifRowOutOct)))
	}

	var sent, recv int64
	if s.hasNet {
		if inOct >= s.prevInOct {
			recv = int64(inOct - s.prevInOct)
		}
		if outOct >= s.prevOutOct {
			sent = int64(outOct - s.prevOutOct)
		}
	}
	s.prevInOct, s.prevOutOct = inOct, outOct
	s.hasNet = true
	return sent, recv
}

func (s *WindowsMetricSource) Collect(window core.TimeRange) ([]core.Metric, error) {
	cpu := s.cpuPercent()
	mem := memoryPercent()
	sent, recv := s.networkDeltas()
	metrics := []core.Metric{
		{Name: "cpu_usage", Value: cpu, Timestamp: window.End},
		{Name: "memory_usage", Value: mem, Timestamp: window.End},
		{Name: "network_sent", Value: float64(sent), Timestamp: window.End},
		{Name: "network_received", Value: float64(recv), Timestamp: window.End},
	}
	// Best-effort workload telemetry — never fail the whole collection.
	if procs := s.procs.collect(); procs != nil {
		metrics = append(metrics, procs...)
	} else {
		metrics = append(metrics, core.Metric{Name: "process_count", Value: 0, Timestamp: window.End})
	}
	return metrics, nil
}
