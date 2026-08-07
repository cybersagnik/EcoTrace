import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[1.25rem] font-semibold text-text">
            {title}
          </h1>
          {badge && (
            <span className="rounded border border-border bg-elevated px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1 text-[0.8rem] text-text-muted leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}
