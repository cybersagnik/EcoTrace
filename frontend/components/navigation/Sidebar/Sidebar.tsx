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
  X,
  Radio,
  Network,
  ChevronRight,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/utils/helpers";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { useDeviceCategories } from "@/hooks/useDevices";

type NavLeaf = {
  label: string;
  href: string;
  icon: typeof Cpu;
  badge?: string;
  badgeAlert?: boolean;
  comingSoon?: boolean;
  countKey?: "endpoints" | "iot" | "plc" | "fleets";
};

type NavGroup = {
  label: string;
  icon: typeof Cpu;
  children: NavLeaf[];
};

type NavItem = NavLeaf | NavGroup;

const isGroup = (item: NavItem): item is NavGroup => "children" in item;

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Devices",
    icon: Cpu,
    children: [
      {
        label: "Endpoints",
        href: "/devices/endpoints",
        icon: Server,
        countKey: "endpoints",
      },
      {
        label: "IoT Sensors",
        href: "/devices/iot",
        icon: Radio,
        comingSoon: true,
        countKey: "iot",
      },
      {
        label: "Fleets",
        href: "/devices/fleets",
        icon: Network,
        countKey: "fleets",
      },
      {
        label: "PLC Controllers",
        href: "/devices/plc",
        icon: Cpu,
        comingSoon: true,
        countKey: "plc",
      },
    ],
  },
  { label: "Fleet Regions", href: "/fleet", icon: Server },
  { label: "Carbon Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Alerts", href: "/alerts", icon: Bell, badgeAlert: true },
  { label: "QA Dashboard", href: "/qa", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const { counts } = useDeviceCategories();

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

  const renderLeaf = (item: NavLeaf) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    const liveCount =
      item.countKey && counts ? counts[item.countKey] : undefined;

    return (
      <Link
        key={item.href}
        href={item.href}
        suppressHydrationWarning
        onClick={() => {
          if (onMobileClose) onMobileClose();
        }}
        className={cn(
          "group relative flex items-center justify-between rounded px-4 py-2 text-[0.8rem] font-medium transition-colors cursor-pointer min-h-[36px]",
          isActive
            ? "bg-elevated text-text border-l-2 border-l-accent"
            : "text-text-muted hover:bg-elevated/50 hover:text-text"
        )}
      >
        <div className="flex items-center gap-2.5">
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              isActive ? "text-text" : "text-text-faint"
            )}
          />
          <span>{item.label}</span>
        </div>

        {item.comingSoon && (
          <span className="rounded border border-amber-500/30 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-400">
            P5
          </span>
        )}

        {!item.comingSoon && liveCount !== undefined && (
          <span className="rounded bg-border px-1.5 py-0.5 font-mono text-[0.7rem] text-text-muted">
            {liveCount}
          </span>
        )}
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const Icon = group.icon;
    const childActive = group.children.some((c) => pathname === c.href);
    const anyChildLive = group.children.some(
      (c) => c.countKey && counts && counts[c.countKey] > 0
    );
    const liveTotal =
      counts && group.children.some((c) => c.countKey === "endpoints")
        ? counts.endpoints
        : undefined;

    return (
      <div key={group.label} className="flex flex-col gap-0.5">
        <div
          className={cn(
            "flex items-center justify-between rounded px-4 py-2 text-[0.8rem] font-medium transition-colors min-h-[36px]",
            childActive
              ? "text-text bg-elevated border-l-2 border-l-accent"
              : "text-text-muted hover:text-text"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon
              className={cn(
                "h-3.5 w-3.5",
                childActive ? "text-text" : "text-text-faint"
              )}
            />
            <span>{group.label}</span>
          </div>

          <div className="flex items-center gap-2">
            {liveTotal !== undefined && liveTotal > 0 && (
              <span className="rounded bg-border px-1.5 py-0.5 font-mono text-[0.7rem] text-text-muted">
                {liveTotal}
              </span>
            )}
            {!anyChildLive && (
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 text-text-faint",
                  childActive && "text-text"
                )}
              />
            )}
          </div>
        </div>

        <div className="ml-3 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-border pl-3">
          {group.children.map(renderLeaf)}
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div className="flex flex-1 flex-col justify-between h-full">
      <div>
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-elevated">
              <Image
                src="/images/ecotrace_logo.jpg"
                alt="EcoTrace 3D Logo"
                width={32}
                height={32}
                priority
                className="h-full w-full object-cover object-center"
              />
            </div>
            <div>
              <div className="font-display text-[0.85rem] font-semibold tracking-[0.08em] text-text">
                ECOTRACE
              </div>
              <p className="text-[11px] text-text-faint">Sustainability Platform</p>
            </div>
          </div>

          {/* Close button for Mobile Drawer */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="md:hidden rounded p-2 text-text-muted hover:text-text hover:bg-elevated cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
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
          className="mb-6 flex w-full items-center justify-between rounded border border-border bg-elevated/50 px-3 py-2 text-xs text-text-muted hover:border-accent/40 hover:text-text transition-colors cursor-pointer min-h-[36px]"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-text-faint" />
            Quick search...
          </span>
          <kbd className="rounded border border-border bg-bg/80 px-1.5 py-0.5 font-mono text-[10px] text-text-faint">
            ⌘K
          </kbd>
        </button>

        {/* Navigation Items */}
        <div className="mb-2 px-4 text-[10px] font-semibold tracking-wider text-text-faint uppercase">
          Menu
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) =>
            isGroup(item) ? renderGroup(item) : renderLeaf(item)
          )}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="mt-8 border-t border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium text-success mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>Grid Sync Operational</span>
        </div>
        <p className="text-[0.75rem] text-text-faint leading-relaxed">
          Tracking Tier 1 endpoint telemetry across the active grid region.
        </p>
      </div>
    </div>
  );

  return (
    <>
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden w-[220px] shrink-0 flex-col justify-between border-r border-border bg-[#0D1117] p-3 md:flex z-10">
        {renderContent()}
      </aside>

      {/* Mobile Off-Canvas Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-bg/80"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <aside className="relative flex w-4/5 max-w-xs flex-1 flex-col justify-between border-r border-border bg-[#0D1117] p-3 z-10 animate-slide-in-left">
            {renderContent()}
          </aside>
        </div>
      )}
    </>
  );
}
