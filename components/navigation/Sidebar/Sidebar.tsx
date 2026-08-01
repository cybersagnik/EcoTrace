"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Cpu,
  Server,
  BarChart3,
  FileText,
  Bell,
  Settings,
  Search,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/utils/helpers";
import { CommandPalette } from "@/components/navigation/CommandPalette";

const NAV_ITEMS_WITH_ICONS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Devices", href: "/devices", icon: Cpu, badge: "12 active" },
  { label: "Fleet Regions", href: "/fleet", icon: Server },
  { label: "Carbon Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Alerts", href: "/alerts", icon: Bell, badgeAlert: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (isMobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [pathname, isMobileOpen, onMobileClose]);

  const renderContent = () => (
    <div className="flex flex-1 flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#16A34A]/30 bg-slate-950 shadow-md">
              <Image
                src="/images/ecotrace_logo.jpg"
                alt="EcoTrace 3D Logo"
                width={40}
                height={40}
                priority
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div>
              <div className="font-display text-base font-bold tracking-wide text-text flex items-center gap-1.5">
                ECOTRACE
                <span className="rounded bg-[#16A34A]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#16A34A] border border-[#16A34A]/20">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-text-faint">Sustainability Platform</p>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden rounded-lg p-2 text-text-muted hover:text-text hover:bg-elevated cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Search trigger */}
        <button
          onClick={() => {
            setSearchOpen(true);
            if (onMobileClose) onMobileClose();
          }}
          className="mb-6 flex w-full items-center justify-between rounded-xl border border-border bg-elevated/50 px-3 py-2.5 text-xs text-text-muted hover:border-[#16A34A]/30 hover:text-text transition-all cursor-pointer shadow-sm min-h-[44px]"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-text-faint" />
            Quick search...
          </span>
          <kbd className="rounded border border-border bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
            ⌘K
          </kbd>
        </button>

        {/* Navigation Items */}
        <div className="mb-2 px-3 text-[10px] font-semibold tracking-wider text-text-faint uppercase">
          Menu
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS_WITH_ICONS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                suppressHydrationWarning
                onClick={() => {
                  if (onMobileClose) onMobileClose();
                }}
                className={cn(
                  "group relative flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300 ease-out cursor-pointer min-h-[44px]",
                  isActive
                    ? "bg-[#16A34A]/10 text-[#16A34A] font-semibold border-l-4 border-[#16A34A] pl-2.5 shadow-sm"
                    : "text-text-muted hover:bg-elevated/70 hover:text-text hover:translate-x-1"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                      isActive ? "text-[#16A34A]" : "text-text-faint group-hover:text-text"
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[10px] text-text-faint group-hover:text-text-muted">
                    {item.badge}
                  </span>
                )}

                {item.badgeAlert && (
                  <span className="relative flex h-2 w-2" suppressHydrationWarning>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="mt-8 rounded-xl border border-[#16A34A]/20 bg-[#16A34A]/5 p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-medium text-[#22C55E] mb-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Grid Sync Operational</span>
        </div>
        <p className="text-[11px] text-text-faint leading-relaxed">
          Tracking 12 IoT telemetry sensors across 3 regional power zones.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-4 md:flex z-10 shadow-sm">
        {renderContent()}
      </aside>

      {/* Mobile Off-Canvas Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <aside className="relative flex w-4/5 max-w-xs flex-1 flex-col justify-between border-r border-border bg-panel-solid dark:bg-[#0F172A] bg-white p-4 shadow-2xl z-10 animate-slide-in-left">
            {renderContent()}
          </aside>
        </div>
      )}
    </>
  );
}
