"use client";

import { ReactNode } from "react";
import { Clock, LucideIcon } from "lucide-react";

interface BlockedCategoryProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function BlockedCategory({
  icon: Icon,
  title,
  subtitle,
  children,
}: BlockedCategoryProps) {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-[92vw] max-w-lg rounded border border-amber/30 bg-panel p-10 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded border border-amber/30 bg-amber/10 text-amber">
            <Icon className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded border border-amber/30 bg-amber/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-amber">
              <Clock className="h-3 w-3" />
              <span>Phase 5 — Coming Soon</span>
            </div>
            <h2 className="font-display text-2xl font-semibold text-text">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-text-muted leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
