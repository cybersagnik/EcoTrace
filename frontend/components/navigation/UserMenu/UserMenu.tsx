"use client";

import Link from "next/link";
import { User, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { clearSessionToken } from "@/lib/auth";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = () => {
    clearSessionToken();
    setOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 rounded-full border border-border bg-elevated/70 p-1.5 pr-3 hover:border-accent/40 transition-colors cursor-pointer"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent font-display text-xs font-bold text-bg">
          EA
        </div>
        <span className="hidden text-xs font-medium text-text md:inline-block">
          EcoAdmin
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded border border-border bg-panel p-2 z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-border mb-1">
            <p className="text-xs font-bold text-text">EcoAdmin Workspace</p>
            <p className="text-[11px] font-mono text-text-muted">admin@ecotrace.io</p>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded px-3 py-2 text-xs font-semibold text-text-muted hover:bg-elevated hover:text-accent transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
            <span>Organization Settings</span>
          </Link>

          <Link
            href="/login"
            onClick={handleSignOut}
            className="flex items-center gap-2.5 rounded px-3 py-2 text-xs font-semibold text-high hover:bg-high/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </Link>
        </div>
      )}
    </div>
  );
}
