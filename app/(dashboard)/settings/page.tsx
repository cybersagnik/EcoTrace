"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Settings, Key, Save, CheckCircle2, SunMoon } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [dailyLimit, setDailyLimit] = useState(300);
  const [intensityThreshold, setIntensityThreshold] = useState(250);
  const [apiToken, setApiToken] = useState("********************************");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg("Platform configuration preferences saved successfully!");
    setTimeout(() => setToastMsg(null), 3500);
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-panel-solid p-4 shadow-glass backdrop-blur-glass text-emerald-400 font-mono text-xs animate-bounce">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      <PageHeader
        title="Platform Configuration"
        subtitle="Manage carbon calculation parameters, theme appearance preferences, grid API integrations, and workspace notification preferences."
      />

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Section 1: Appearance & Theme System */}
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <SunMoon className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-text">Workspace Appearance & Theme</h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div>
              <span className="font-semibold text-text block mb-0.5">Interface Color Mode</span>
              <span className="text-text-muted text-[11px]">
                Currently active: <span className="font-bold text-accent capitalize">{theme} Mode</span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="flex rounded-lg border border-border/80 bg-bg/80 p-1">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-accent text-bg shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-accent text-bg shadow-sm"
                      : "text-text-muted hover:text-text"
                  }`}
                >
                  Light
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Carbon Calculation Targets */}
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <Settings className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-bold text-text">Carbon Budget & Intensity Targets</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-mono text-xs">
            <div>
              <label className="block text-text-muted dark:text-slate-300 text-slate-700 mb-1.5 font-semibold">Daily Fleet Carbon Limit (kg CO2e)</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-border/80 bg-[#0b0f17] dark:bg-[#0b0f17] bg-slate-50 px-3 py-2 text-text dark:text-white text-slate-900 focus:border-accent focus:outline-none shadow-inner"
              />
            </div>
            <div>
              <label className="block text-text-muted dark:text-slate-300 text-slate-700 mb-1.5 font-semibold">Clean Grid Intensity Threshold (gCO2e/kWh)</label>
              <input
                type="number"
                value={intensityThreshold}
                onChange={(e) => setIntensityThreshold(Number(e.target.value))}
                className="w-full rounded-lg border border-border/80 bg-[#0b0f17] dark:bg-[#0b0f17] bg-slate-50 px-3 py-2 text-text dark:text-white text-slate-900 focus:border-accent focus:outline-none shadow-inner"
              />
            </div>
          </div>
        </div>

        {/* Section 3: API Keys & Grid Providers */}
        <div className="rounded-card border border-border bg-panel-solid dark:bg-[#111b24] bg-white p-6 shadow-level-1 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <Key className="h-4 w-4 text-emerald-400" />
            <h2 className="font-display text-base font-bold text-text">Grid Signal Providers</h2>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <label className="block text-text-muted mb-1.5 font-semibold">WattTime / ElectricityMaps API Token</label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-bg/80 px-3 py-2 text-text focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 font-mono text-xs font-semibold text-bg hover:bg-sky-400 transition-all shadow-glow active:scale-95 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>Save Preferences</span>
        </button>
      </form>
    </div>
  );
}
