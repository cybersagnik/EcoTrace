"use client";

export function EmptyChartState() {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center">
      <p className="font-mono text-xs text-text-faint">No data for the current filter selection.</p>
    </div>
  );
}
