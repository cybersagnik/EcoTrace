"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  LayoutDashboard,
  Cpu,
  Server,
  Radio,
  Network,
  BarChart3,
  FileText,
  Bell,
  Settings,
  ArrowRight,
} from "lucide-react";

interface CommandItem {
  title: string;
  category: string;
  href: string;
  icon: any;
}

const COMMAND_ITEMS: CommandItem[] = [
  { title: "Overview Dashboard", category: "Navigation", href: "/dashboard", icon: LayoutDashboard },
  { title: "Devices — Endpoints", category: "Navigation · Devices", href: "/devices/endpoints", icon: Server },
  { title: "Devices — IoT Sensors", category: "Navigation · Devices", href: "/devices/iot", icon: Radio },
  { title: "Devices — Fleets", category: "Navigation · Devices", href: "/devices/fleets", icon: Network },
  { title: "Devices — PLC Controllers", category: "Navigation · Devices", href: "/devices/plc", icon: Cpu },
  { title: "Multi-Region Fleet Clusters", category: "Navigation", href: "/fleet", icon: Server },
  { title: "Carbon Analytics & Intensity", category: "Navigation", href: "/analytics", icon: BarChart3 },
  { title: "Sustainability Reports", category: "Navigation", href: "/reports", icon: FileText },
  { title: "Real-time Telemetry Alerts", category: "Navigation", href: "/alerts", icon: Bell },
  { title: "Platform Configuration", category: "Navigation", href: "/settings", icon: Settings },
];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (href: string) => {
    router.push(href);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center theme-overlay p-4 pt-20">
      <div className="w-full max-w-lg rounded-card border border-border bg-panel p-4 space-y-3 animate-fade-in">
        {/* Search Input Box */}
        <div className="relative flex items-center border-b border-border pb-3">
          <Search className="h-4 w-4 text-accent shrink-0 mr-3" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search page..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent font-mono text-xs text-text placeholder-text-faint focus:outline-none"
          />
          <button onClick={onClose} className="text-text-faint hover:text-text p-1 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command Results */}
        <div className="max-h-64 overflow-y-auto space-y-1 font-mono text-xs">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => handleSelect(item.href)}
                  className="w-full flex items-center justify-between rounded p-2.5 text-left text-text-muted hover:bg-accent/15 hover:text-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-accent" />
                    <span>{item.title}</span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-text-faint">No matching commands found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
