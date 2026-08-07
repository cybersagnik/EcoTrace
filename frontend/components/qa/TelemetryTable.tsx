"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, TableProperties } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { Table, TableHead, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { formatBytes, formatPct, formatTimestamp } from "@/utils/qa/formatters";
import { IssueSeverity, TelemetryRow } from "@/types/telemetry";
import { cn } from "@/utils/helpers";

type SortKey = "timestamp" | "energyWh" | "carbonG" | "cpuUsagePct" | "memoryUsagePct" | "deviceId";
type SortDir = "asc" | "desc";

const SORTABLE: Record<SortKey, string> = {
  timestamp: "Timestamp",
  deviceId: "Device ID",
  energyWh: "Energy",
  carbonG: "Carbon",
  cpuUsagePct: "CPU",
  memoryUsagePct: "Mem",
};

export function TelemetryTable() {
  const { filteredRows, issues } = useQaDashboard();
  const { page, pageSize, next, prev, reset } = usePagination(20);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Reset to page 0 when the dataset or filters change.
  useEffect(() => {
    reset();
  }, [filteredRows, reset]);

  const issueMap = useMemo(() => {
    const map = new Map<number, Set<IssueSeverity>>();
    issues.forEach((issue) => {
      if (issue.rowIndex === null) return;
      const set = map.get(issue.rowIndex) ?? new Set<IssueSeverity>();
      set.add(issue.severity);
      map.set(issue.rowIndex, set);
    });
    return map;
  }, [issues]);

  const sorted = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp = 0;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv);
      } else {
        cmp = Number(av) - Number(bv);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "timestamp" ? "desc" : "asc");
    }
  };

  const SortHeader = ({ k, children }: { k: SortKey; children: string }) => {
    const active = sortKey === k;
    const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button
        onClick={() => handleSort(k)}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-[0.08em] transition-colors cursor-pointer",
          active ? "text-accent" : "text-text-muted hover:text-text"
        )}
      >
        {children}
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  const statusColor = (s: string): string => {
    switch (s) {
      case "active":
        return "text-success";
      case "inactive":
        return "text-text-muted";
      case "error":
        return "text-high";
      default:
        return "text-moderate";
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TableProperties className="h-3.5 w-3.5 text-accent" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Telemetry Table
          </h3>
          <span className="font-mono text-[11px] text-text-faint">
            {sorted.length} rows · page {safePage + 1}/{totalPages}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={safePage === 0}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={next}
            disabled={safePage >= totalPages - 1}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 font-mono text-[11px] text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell><SortHeader k="timestamp">Timestamp</SortHeader></TableHeaderCell>
              <TableHeaderCell><SortHeader k="deviceId">Device</SortHeader></TableHeaderCell>
              <TableHeaderCell>Class</TableHeaderCell>
              <TableHeaderCell>Fleet</TableHeaderCell>
              <TableHeaderCell>Region</TableHeaderCell>
              <TableHeaderCell><SortHeader k="energyWh">Energy</SortHeader></TableHeaderCell>
              <TableHeaderCell><SortHeader k="carbonG">Carbon</SortHeader></TableHeaderCell>
              <TableHeaderCell><SortHeader k="cpuUsagePct">CPU</SortHeader></TableHeaderCell>
              <TableHeaderCell><SortHeader k="memoryUsagePct">Mem</SortHeader></TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Model</TableHeaderCell>
              <TableHeaderCell className="text-right">QA</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {pageRows.map((row: TelemetryRow) => {
              const rowIssues = issueMap.get(row.rowIndex);
              return (
                <tr key={`${row.rowIndex}-${row.timestamp}`}>
                  <TableCell className="whitespace-nowrap font-mono text-xs text-text-muted">
                    {formatTimestamp(row.timestamp)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text">{row.deviceId || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{row.deviceClass || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">
                    {row.fleetName ?? row.fleetId ?? <span className="text-text-faint">Unassigned</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{row.gridRegion ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-text-muted">
                    {row.energyWh.toFixed(1)} Wh
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-text-muted">
                    {row.carbonG.toFixed(2)} g
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-text-muted">
                    {formatPct(row.cpuUsagePct)}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums text-text-muted">
                    {formatPct(row.memoryUsagePct)}
                  </TableCell>
                  <TableCell className={cn("font-mono text-xs capitalize", statusColor(row.deviceStatus))}>
                    {row.deviceStatus || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">{row.attributionModel || "—"}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-1">
                      {rowIssues?.has("error") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-high" title="Has errors" />
                      )}
                      {rowIssues?.has("warning") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-moderate" title="Has warnings" />
                      )}
                      {rowIssues?.has("info") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-info" title="Has info" />
                      )}
                      {!rowIssues || rowIssues.size === 0 ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-success" title="Passed checks" />
                      ) : null}
                    </span>
                  </TableCell>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={12} className="border-b border-border py-8 text-center font-mono text-xs text-text-faint">
                  No rows match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </Card>
  );
}
