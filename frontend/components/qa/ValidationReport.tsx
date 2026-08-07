"use client";

import { useMemo } from "react";
import { ShieldCheck, AlertTriangle, XCircle, Info } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeaderCell, TableCell } from "@/components/ui/Table";
import { ISSUE_META, SEVERITY_ORDER } from "@/utils/qa/validator";
import { IssueCode, IssueSeverity } from "@/types/telemetry";
import { cn } from "@/utils/helpers";

const SEVERITY_STYLES: Record<IssueSeverity, { dot: string; text: string; badge: string }> = {
  error: { dot: "bg-high", text: "text-high", badge: "border-high/30 text-high" },
  warning: { dot: "bg-moderate", text: "text-moderate", badge: "border-moderate/30 text-moderate" },
  info: { dot: "bg-info", text: "text-info", badge: "border-info/30 text-info" },
};

export function ValidationReport() {
  const { issues, sourceInfo } = useQaDashboard();

  const grouped = useMemo(() => {
    const map = new Map<IssueCode, { code: IssueCode; count: number; sample: string; sampleRows: number[] }>();
    issues.forEach((issue) => {
      const entry = map.get(issue.code) ?? {
        code: issue.code,
        count: 0,
        sample: issue.message,
        sampleRows: [] as number[],
      };
      entry.count += 1;
      if (issue.rowIndex !== null && entry.sampleRows.length < 3) {
        entry.sampleRows.push(issue.rowIndex + 1);
      }
      map.set(issue.code, entry);
    });
    return Array.from(map.values())
      .sort((a, b) => {
        const sev = (c: IssueCode): number => SEVERITY_ORDER.indexOf(ISSUE_META[c].severity);
        return sev(a.code) - sev(b.code) || b.count - a.count;
      });
  }, [issues]);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;

  const stats = [
    { label: "Errors", count: errors, icon: XCircle, severity: "error" as IssueSeverity },
    { label: "Warnings", count: warnings, icon: AlertTriangle, severity: "warning" as IssueSeverity },
    { label: "Info", count: infos, icon: Info, severity: "info" as IssueSeverity },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Validation Report
          </h3>
          {sourceInfo && (
            <span className="font-mono text-[11px] text-text-faint">· {sourceInfo.fileName}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stats.map((s) => (
            <Badge key={s.label} className={SEVERITY_STYLES[s.severity].badge}>
              <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_STYLES[s.severity].dot)} />
              {s.count} {s.label.toLowerCase()}
            </Badge>
          ))}
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-success">
          No validation issues — dataset passed all checks.
        </p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Severity</TableHeaderCell>
              <TableHeaderCell>Check</TableHeaderCell>
              <TableHeaderCell className="text-right">Count</TableHeaderCell>
              <TableHeaderCell>Sample rows</TableHeaderCell>
              <TableHeaderCell>Message</TableHeaderCell>
            </tr>
          </TableHead>
          <tbody>
            {grouped.map((g) => {
              const meta = ISSUE_META[g.code];
              const style = SEVERITY_STYLES[meta.severity];
              return (
                <tr key={g.code}>
                  <TableCell>
                    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs uppercase", style.text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                      {meta.severity}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text">{g.code}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-text">
                    {g.count}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-text-muted">
                    {g.sampleRows.length > 0 ? g.sampleRows.map((r) => `#${r}`).join(", ") : "—"}
                  </TableCell>
                  <TableCell className="max-w-md text-xs text-text-muted">{g.sample}</TableCell>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
