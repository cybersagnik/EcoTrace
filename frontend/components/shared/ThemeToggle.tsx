"use client";

import { useTheme } from "@/lib/theme/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-8 w-16 rounded-full border border-border bg-elevated/70 p-1" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="relative flex h-8 w-16 items-center rounded-full border border-border bg-elevated/70 p-1 transition-colors duration-150 hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
      title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
    >
      {/* Background Icons */}
      <div className="flex w-full justify-between px-1 text-text-faint">
        <Sun className={`h-3.5 w-3.5 ${!isDark ? "text-amber font-bold" : ""}`} />
        <Moon className={`h-3.5 w-3.5 ${isDark ? "text-blue font-bold" : ""}`} />
      </div>

      {/* Sliding Knob */}
      <div
        className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-bg transition-transform duration-150 ease-in-out ${
          isDark ? "translate-x-7" : "translate-x-0"
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-bg" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-bg" />
        )}
      </div>
    </button>
  );
}
