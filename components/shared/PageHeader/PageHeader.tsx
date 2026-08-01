import React from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-5 transition-all">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            {title}
          </h1>
          {badge && (
            <span className="rounded-full bg-accent/15 px-3 py-0.5 font-mono text-xs font-semibold text-accent border border-accent/25 shadow-sm">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="mt-1.5 text-xs sm:text-sm text-text-muted leading-relaxed max-w-3xl">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}
