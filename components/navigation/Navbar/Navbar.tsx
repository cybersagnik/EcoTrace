"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { UserMenu } from "@/components/navigation/UserMenu";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { useFleet } from "@/hooks/useFleet";
import { useAlerts } from "@/hooks/useAlerts";
import { useDemoMode } from "@/lib/demoMode";
import { Bell, Globe, Zap, Menu } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Overview Dashboard",
  "/devices": "Hardware & IoT Devices",
  "/fleet": "Multi-Region Fleet",
  "/analytics": "Carbon Analytics & Intensity",
  "/reports": "Sustainability Reports",
  "/alerts": "Real-time Telemetry Alerts",
  "/settings": "Platform Configuration",
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname();
  const { fleet } = useFleet();
  const { unacknowledgedCount } = useAlerts();
  const { isDemoMode, toggleDemoMode } = useDemoMode();

  const currentTitle = ROUTE_LABELS[pathname] || "Dashboard";

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-navbar dark:bg-[#0F172A] bg-white px-4 sm:px-6 py-3 shadow-sm min-h-[56px]">
      {/* Left: Mobile Hamburger Trigger + Breadcrumb / Page Title */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="md:hidden flex items-center justify-center rounded-xl border border-border bg-elevated/50 p-2 text-text-muted hover:text-text hover:border-[#16A34A]/40 transition-all cursor-pointer min-h-[44px] min-w-[44px]"
            aria-label="Open Mobile Navigation Menu"
          >
            <Menu className="h-5 w-5 text-text" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="hidden xs:flex items-center gap-1.5 text-xs font-mono text-text-faint">
            <Globe className="h-3.5 w-3.5 text-[#16A34A]" />
            <span>ecotrace</span>
            <span>/</span>
          </div>
          <h1 className="font-display text-xs sm:text-sm font-semibold text-text tracking-wide truncate max-w-[140px] sm:max-w-none">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Right Navbar Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Non-invasive Demo Mode Toggle */}
        <button
          onClick={toggleDemoMode}
          title={isDemoMode ? "Demo Mode Active (Pre-recorded Fallback Data)" : "Live Telemetry Mode"}
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold transition-all cursor-pointer min-h-[36px] ${
            isDemoMode
              ? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#F59E0B] shadow-sm"
              : "border-border/80 bg-elevated/50 text-text-muted hover:text-text hover:border-[#16A34A]/40"
          }`}
        >
          <Zap className={`h-3 w-3 ${isDemoMode ? "text-[#F59E0B] fill-[#F59E0B] animate-pulse" : ""}`} />
          <span>{isDemoMode ? "DEMO MODE: ON" : "LIVE MODE"}</span>
        </button>

        <div className="hidden xs:block">
          <LiveIndicator count={fleet?.summary.active_devices ?? 0} />
        </div>

        {/* Global Alert Notification Icon */}
        <Link
          href="/alerts"
          aria-label="Alert Notifications"
          suppressHydrationWarning
          className="relative flex items-center justify-center rounded-full border border-border/80 bg-elevated/60 p-2 text-text-muted hover:border-[#16A34A]/40 hover:text-text transition-all cursor-pointer min-h-[40px] min-w-[40px]"
        >
          <Bell className="h-4 w-4" />
          {unacknowledgedCount > 0 && (
            <span
              suppressHydrationWarning
              className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-[#F59E0B] animate-ping"
            ></span>
          )}
        </Link>

        {/* Theme System Light/Dark Toggle */}
        <ThemeToggle />

        <UserMenu />
      </div>
    </header>
  );
}
