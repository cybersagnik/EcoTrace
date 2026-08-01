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
        className="flex items-center gap-2.5 rounded-full border border-border/80 bg-elevated/70 p-1.5 pr-3 hover:border-accent/40 transition-all cursor-pointer"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-accent to-emerald-400 font-display text-xs font-bold text-slate-950 shadow-sm">
          EA
        </div>
        <span className="hidden text-xs font-medium text-text md:inline-block">
          EcoAdmin
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-faint" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border/80 bg-panel-solid dark:bg-[#0f172a] bg-white p-2 shadow-2xl z-50 animate-fade-in">
          <div className="px-3 py-2 border-b border-border/60 mb-1">
            <p className="text-xs font-bold text-text dark:text-white text-slate-900">EcoAdmin Workspace</p>
            <p className="text-[11px] font-mono text-text-muted dark:text-slate-400 text-slate-500">admin@ecotrace.io</p>
          </div>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-text-muted hover:bg-elevated hover:text-accent dark:hover:text-sky-400 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-accent shrink-0" />
            <span>Organization Settings</span>
          </Link>

          <Link
            href="/login"
            onClick={handleSignOut}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </Link>
        </div>
      )}
    </div>
  );
}
