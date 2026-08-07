"use client";

import { useMemo } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { MultiSelect } from "@/components/qa/MultiSelect";
import { Input } from "@/components/ui/Input";
import { getFilterOptions } from "@/utils/qa/filters";
import { cn } from "@/utils/helpers";

export function FilterBar() {
  const { rows, filters, setFilters, resetFilters, filteredRows } = useQaDashboard();

  const options = useMemo(() => getFilterOptions(rows), [rows]);

  const statuses = options.statuses.length > 0 ? options.statuses : ["active", "inactive", "error"];

  const anyActive =
    filters.deviceIds.length > 0 ||
    filters.fleetIds.length > 0 ||
    filters.regions.length > 0 ||
    filters.statuses.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  return (
    <div className="rounded-card border border-border bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-accent" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Filters
          </h3>
          <span className="font-mono text-[11px] text-text-faint">
            {filteredRows.length} / {rows.length} rows
          </span>
        </div>
        <button
          onClick={resetFilters}
          disabled={!anyActive}
          className={cn(
            "flex items-center gap-1.5 rounded border border-border px-2 py-1 font-mono text-[11px] transition-colors cursor-pointer",
            anyActive
              ? "text-text-muted hover:text-text hover:border-accent/40"
              : "cursor-not-allowed text-text-faint"
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MultiSelect
          label="Device"
          className="lg:col-span-1"
          options={options.deviceIds.map((d) => ({ value: d, label: d }))}
          value={filters.deviceIds}
          onChange={(deviceIds) => setFilters({ deviceIds })}
        />
        <MultiSelect
          label="Fleet"
          className="lg:col-span-1"
          options={options.fleetIds.map((f) => ({ value: f, label: f }))}
          value={filters.fleetIds}
          onChange={(fleetIds) => setFilters({ fleetIds })}
        />
        <MultiSelect
          label="Region"
          className="lg:col-span-1"
          options={options.regions.map((r) => ({ value: r, label: r }))}
          value={filters.regions}
          onChange={(regions) => setFilters({ regions })}
        />
        <MultiSelect
          label="Status"
          className="lg:col-span-1"
          options={statuses.map((s) => ({ value: s, label: s }))}
          value={filters.statuses}
          onChange={(statuses) => setFilters({ statuses })}
        />
        <div className="flex flex-col gap-1 lg:col-span-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">From</span>
          <Input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => setFilters({ dateFrom: e.target.value || null })}
            className="w-full min-h-[36px]"
          />
        </div>
        <div className="flex flex-col gap-1 lg:col-span-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">To</span>
          <Input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => setFilters({ dateTo: e.target.value || null })}
            className="w-full min-h-[36px]"
          />
        </div>
      </div>
    </div>
  );
}
