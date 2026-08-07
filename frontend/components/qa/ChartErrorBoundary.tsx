"use client";

import { Component, ReactNode } from "react";

interface ChartErrorBoundaryProps {
  children: ReactNode;
  label?: string;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
}

/** Per-chart error boundary so one failing chart never takes down the page. */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChartErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error(`[QA Chart ${this.props.label ?? ""}]`, error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-card border border-high/30 bg-panel p-6 text-center">
          <span className="font-mono text-xs text-high">CHART ERROR</span>
          <p className="text-xs text-text-muted">
            {this.props.label ?? "This chart"} failed to render. Reload the page or re-import the dataset.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
