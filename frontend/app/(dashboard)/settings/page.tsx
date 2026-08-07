"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Settings, Key, Save, CheckCircle2, SunMoon, Loader2, AlertTriangle } from "lucide-react";
import { getSettings, updateSettings } from "@/services/api/settings";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [dailyLimit, setDailyLimit] = useState(300);
  const [intensityThreshold, setIntensityThreshold] = useState(250);
  const [apiToken, setApiToken] = useState("");
  const [loadedMaskedToken, setLoadedMaskedToken] = useState<string | null>(null);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    setError(null);
    getSettings()
      .then((s) => {
        setDailyLimit(s.daily_limit_kg);
        setIntensityThreshold(s.intensity_threshold_g_per_kwh);
        setLoadedMaskedToken(s.grid_provider_token_masked);
        setTokenConfigured(s.grid_provider_configured);
        setApiToken(s.grid_provider_token_masked ?? "");
      })
      .catch((e) => setError(e.message ?? String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: {
        daily_limit_kg: number;
        intensity_threshold_g_per_kwh: number;
        grid_provider_token?: string;
      } = {
        daily_limit_kg: dailyLimit,
        intensity_threshold_g_per_kwh: intensityThreshold,
      };
      // Only send the token if the user actually typed a new one
      const tokenChanged = apiToken.trim() !== "" && apiToken.trim() !== (loadedMaskedToken ?? "");
      if (tokenChanged) {
        payload.grid_provider_token = apiToken.trim();
      }
      await updateSettings(payload);
      setTokenConfigured(tokenChanged ? true : tokenConfigured);
      setToastMsg("Platform configuration preferences saved successfully!");
      setTimeout(() => setToastMsg(null), 3500);
      loadSettings();
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border border-accent/30 bg-panel p-4 text-success font-mono text-xs">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <span>{toastMsg}</span>
        </div>
      )}

      <PageHeader
        title="Platform Configuration"
        subtitle="Manage carbon calculation parameters, theme appearance preferences, grid API integrations, and workspace notification preferences."
      />

      {loading ? (
        <div className="flex items-center gap-2 rounded-card border border-border bg-panel p-6 font-mono text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" />
          <span>Loading platform settings…</span>
        </div>
      ) : error && !toastMsg ? (
        <div className="flex items-center gap-2 rounded-card border border-amber/30 bg-amber/10 p-4 font-mono text-xs text-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
          {/* Section 1: Appearance & Theme System */}
          <div className="rounded-card border border-border bg-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
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
                <div className="flex rounded border border-border bg-bg/80 p-1">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`rounded px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      theme === "dark"
                        ? "bg-accent text-bg"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`rounded px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                      theme === "light"
                        ? "bg-accent text-bg"
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
          <div className="rounded-card border border-border bg-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Settings className="h-4 w-4 text-accent" />
              <h2 className="font-display text-base font-bold text-text">Carbon Budget & Intensity Targets</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 font-mono text-xs">
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">Daily Fleet Carbon Limit (kg CO2e)</label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">Clean Grid Intensity Threshold (gCO2e/kWh)</label>
                <input
                  type="number"
                  value={intensityThreshold}
                  onChange={(e) => setIntensityThreshold(Number(e.target.value))}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: API Keys & Grid Providers */}
          <div className="rounded-card border border-border bg-panel p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Key className="h-4 w-4 text-success" />
              <h2 className="font-display text-base font-bold text-text">Grid Signal Providers</h2>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">WattTime / ElectricityMaps API Token</label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={tokenConfigured ? "•••• stored token" : "Paste a new token to configure"}
                  className="w-full rounded border border-border bg-bg/80 px-3 py-2 text-text focus:border-accent focus:outline-none"
                />
                <span className="mt-1.5 block text-[11px] text-text-faint">
                  {tokenConfigured
                    ? `Configured (${loadedMaskedToken ?? "stored"}). Paste a new token to replace it.`
                    : "No grid provider token configured yet."}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-card border border-amber/30 bg-amber/10 p-4 font-mono text-xs text-amber">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded bg-accent px-6 py-2.5 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saving ? "Saving…" : "Save Preferences"}</span>
          </button>
        </form>
      )}
    </div>
  );
}
