"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/utils/helpers";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  className?: string;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const clear = () => onChange([]);

  const summary =
    value.length === 0 || value.length === options.length
      ? allLabel
      : `${value.length} selected`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-[36px] w-full items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 py-2 text-xs text-text-muted transition-colors hover:border-accent/40 cursor-pointer",
          open && "border-accent/40"
        )}
      >
        <span className="truncate">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{label}: </span>
          {summary}
        </span>
        {value.length > 0 ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                clear();
              }
            }}
            className="text-text-faint hover:text-text"
            aria-label={`Clear ${label} filter`}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[200px] rounded-card border border-border bg-panel p-1.5 shadow-lg">
          <div className="max-h-56 overflow-y-auto">
            {options.length === 0 ? (
              <div className="px-3 py-2 font-mono text-xs text-text-faint">No options in dataset</div>
            ) : (
              options.map((opt) => {
                const checked = value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className="flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs text-text-muted transition-colors hover:bg-elevated hover:text-text cursor-pointer"
                  >
                    <span className="truncate">{opt.label}</span>
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        checked ? "border-accent bg-accent text-bg" : "border-border"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
