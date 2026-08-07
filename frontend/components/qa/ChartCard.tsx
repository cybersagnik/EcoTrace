"use client";

import { useRef, ReactNode } from "react";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { exportSvgAsPng, findChartSvg } from "@/utils/qa/pngExport";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  downloadName: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function ChartCard({ title, subtitle, downloadName, icon, children }: ChartCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const svg = findChartSvg(containerRef.current);
    if (svg) {
      exportSvgAsPng(svg, downloadName);
    }
  };

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-display text-sm font-semibold text-text">{title}</h3>
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
        </div>
        <button
          onClick={handleDownload}
          title="Download chart as PNG"
          className="flex shrink-0 items-center gap-1.5 rounded border border-border bg-elevated/50 px-2 py-1 font-mono text-[11px] text-text-muted transition-colors hover:border-accent/40 hover:text-accent cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">PNG</span>
        </button>
      </div>
      <div ref={containerRef} className="min-h-[240px] w-full flex-1">
        {children}
      </div>
    </Card>
  );
}
