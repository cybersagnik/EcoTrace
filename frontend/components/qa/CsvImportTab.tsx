"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, FileSpreadsheet, UploadCloud, RefreshCw } from "lucide-react";
import { useQaDashboard } from "@/features/qa/QaDashboardProvider";
import { Card } from "@/components/ui/Card";
import { TELEMETRY_SCHEMA_COLUMNS } from "@/types/telemetry";
import { cn } from "@/utils/helpers";

export function CsvImportTab() {
  const { importCsv, importSample, sourceInfo } = useQaDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!/\.csv$/i.test(file.name)) {
        setError("Only .csv files are supported.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          if (text.trim() === "") {
            setError("The file is empty.");
            return;
          }
          importCsv(file.name, text);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to read the CSV file.");
        }
      };
      reader.onerror = () => setError("Failed to read the file.");
      reader.readAsText(file);
    },
    [importCsv]
  );

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed px-6 py-12 text-center transition-colors",
            dragging
              ? "border-accent/60 bg-accent/5"
              : "border-border bg-elevated/40 hover:border-accent/40 hover:bg-elevated"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded border border-border bg-panel">
            {dragging ? (
              <UploadCloud className="h-6 w-6 text-accent" />
            ) : (
              <FileSpreadsheet className="h-6 w-6 text-accent" />
            )}
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-text">
              {dragging ? "Drop the telemetry export to import" : "Drop a telemetry CSV export here"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              or <span className="font-mono text-accent">click to browse</span> — parsed and validated entirely in your browser
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </div>

        {error && (
          <p className="mt-3 rounded border border-high/30 bg-high/5 px-3 py-2 font-mono text-xs text-high">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-md text-xs text-text-muted">
            Expects the canonical 16-column export schema. Rows are validated against 16 checks (schema,
            ranges, enums, fleet consistency, duplicates, timestamps) before analytics render.
          </p>
          <button
            onClick={importSample}
            className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-elevated px-3 py-2 font-mono text-xs text-text-muted transition-colors hover:border-accent/40 hover:text-accent cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try sample dataset
          </button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileUp className="h-3.5 w-3.5 text-accent" />
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            Expected schema ({TELEMETRY_SCHEMA_COLUMNS.length} columns)
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TELEMETRY_SCHEMA_COLUMNS.map((col, idx) => (
            <span
              key={col}
              className="rounded border border-border bg-elevated/60 px-2 py-1 font-mono text-[11px] text-text-muted"
            >
              <span className="text-text-faint">{String(idx).padStart(2, "0")} </span>
              {col}
            </span>
          ))}
        </div>
        {sourceInfo && (
          <p className="mt-3 border-t border-border pt-3 font-mono text-xs text-text-faint">
            Last import: {sourceInfo.fileName} · {sourceInfo.rowCount} rows ·{" "}
            {new Date(sourceInfo.importedAt).toLocaleString()}
          </p>
        )}
      </Card>
    </div>
  );
}
