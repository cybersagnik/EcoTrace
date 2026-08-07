//go:build linux

package main

import (
	"fmt"
	"time"

	"github.com/Ecotrace/agent/adapter/linux"
	"github.com/Ecotrace/agent/core"
)

func main() {
	src := linux.NewLinuxMetricSource()
	fmt.Println("Collecting metrics from /proc (takes ~500ms for CPU delta)...")
	for i := 1; i <= 5; i++ {
		window := core.TimeRange{
			Start: time.Now().Add(-30 * time.Second),
			End:   time.Now(),
		}
		metrics, err := src.Collect(window)
		if err != nil {
			fmt.Printf("ERROR: %v\n", err)
			continue
		}
		fmt.Printf("\n[Sample %d]\n", i)
		for _, m := range metrics {
			fmt.Printf("  %-20s = %.2f\n", m.Name, m.Value)
		}
		time.Sleep(3 * time.Second)
	}
	fmt.Println("\nMetric collection: OK")
}
