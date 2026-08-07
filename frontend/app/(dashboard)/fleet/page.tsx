"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { useFleets } from "@/hooks/useFleets";
import { useFleet } from "@/hooks/useFleet";
import { formatCarbonKg } from "@/utils/formatter";
import {
  Server,
  Globe,
  Zap,
  Activity,
  Plus,
  X,
  Check,
  Trash2,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Fleet } from "@/types/fleet";

export default function FleetPage() {
  const { fleets, loading, error, refetch, create, remove } = useFleets();
  const { fleet: aggregate } = useFleet();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Fleet | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    grid_region: "",
    grid_intensity_g_per_kwh: 240,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  if (loading || !fleets) {
    return <LoadingState label="Loading fleet registry..." />;
  }
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (form.name.trim().length < 2) {
      setFormError("Fleet name must be at least 2 characters");
      return;
    }
    if (form.grid_region.trim().length < 2) {
      setFormError("Grid region is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const fleet = await create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        grid_region: form.grid_region.trim(),
        grid_intensity_g_per_kwh: form.grid_intensity_g_per_kwh,
      });
      setIsCreateOpen(false);
      setForm({ name: "", description: "", grid_region: "", grid_intensity_g_per_kwh: 240 });
      showToast(`Fleet "${fleet.name}" created`);
    } catch (err) {
      setFormError((err as Error).message ?? "Failed to create fleet");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      showToast(`Fleet "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message}`);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded border border-accent/30 bg-panel p-4 text-accent font-mono text-xs">
          <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
          <div className="w-[92vw] max-w-md rounded border border-high/40 bg-panel p-6 space-y-5 animate-scale-in">
            <div className="flex items-center gap-2 text-high border-b border-border pb-3">
              <Trash2 className="h-5 w-5" />
              <h3 className="font-display text-base font-bold text-text">
                Delete Fleet
              </h3>
            </div>
            <div className="space-y-3 font-mono text-xs">
              <p className="text-text font-semibold">
                Permanently delete <span className="text-high">{deleteTarget.name}</span>?
              </p>
              {deleteTarget.total_devices > 0 ? (
                <div className="rounded bg-high/10 border border-high/20 p-3 text-high font-semibold">
                  Cannot delete: {deleteTarget.total_devices} device(s) still assigned.
                  Unassign them first.
                </div>
              ) : (
                <div className="rounded bg-amber/10 border border-amber/20 p-3 text-amber font-semibold">
                  This action cannot be undone.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-border font-mono text-xs">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteTarget.total_devices > 0}
                className="flex items-center gap-2 rounded bg-high px-4 py-2 font-semibold text-white hover:bg-high transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Fleet modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 animate-fade-in">
          <div className="w-[92vw] max-w-md max-h-[85vh] overflow-y-auto rounded border border-border bg-panel p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent" />
                <h3 className="font-display text-base font-bold text-text">
                  Create New Fleet
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-text-faint hover:text-text p-1 rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">
                  Fleet Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IND-TCS"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text placeholder-text-faint focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai DC — production cluster"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text placeholder-text-faint focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">
                  Grid Region Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. IN-MH, US-CAL, EU-DE"
                  value={form.grid_region}
                  onChange={(e) => setForm({ ...form, grid_region: e.target.value })}
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text placeholder-text-faint focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-text-faint">
                  ISO-style region code (e.g. IN-MH, US-CAL, EU-DE)
                </p>
              </div>
              <div>
                <label className="block text-text-muted mb-1.5 font-semibold">
                  Grid Intensity (gCO2e/kWh)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={form.grid_intensity_g_per_kwh}
                  onChange={(e) =>
                    setForm({ ...form, grid_intensity_g_per_kwh: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-border bg-elevated/40 px-3 py-2 text-text focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-[10px] text-text-faint">
                  Reference: EU ≈ 240, US-CAL ≈ 240, IN ≈ 720, CN ≈ 580
                </p>
              </div>

              {formError && (
                <div className="rounded bg-high/10 border border-high/20 p-3 text-high font-semibold">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded border border-border px-4 py-2 font-semibold text-text-muted hover:text-text cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded bg-accent px-4 py-2 font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{isSubmitting ? "Creating..." : "Create Fleet"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PageHeader
        title="Fleet Registry"
        subtitle="User-managed logical groupings of devices. Create a fleet and assign any device category to it."
        badge={`${fleets.length} Fleet${fleets.length === 1 ? "" : "s"}`}
        action={
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 rounded bg-accent px-4 py-2.5 font-mono text-xs font-semibold text-white hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Fleet</span>
          </button>
        }
      />

      {/* Aggregate stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Active Devices
            </span>
            <Server className="h-4 w-4 text-success" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {aggregate?.summary.active_devices ?? 0}
          </div>
          <div className="mt-1 text-xs text-text-muted font-mono">
            across {fleets.length} fleet{fleets.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Total Carbon Today
            </span>
            <Activity className="h-4 w-4 text-blue" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {aggregate ? formatCarbonKg(aggregate.summary.total_carbon_kg) : "—"}
          </div>
          <div className="mt-1 text-xs text-text-muted font-mono">
            aggregate across all fleets
          </div>
        </div>

        <div className="rounded-card border border-border bg-panel p-5">
          <div className="flex items-center justify-between text-text-muted mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">
              Primary Grid Mix
            </span>
            <Zap className="h-4 w-4 text-amber" />
          </div>
          <div className="font-mono text-2xl font-bold text-text">
            {aggregate?.summary.grid_region ?? "—"}
          </div>
          <div className="mt-1 text-xs text-text-muted font-mono">
            {aggregate?.summary.grid_region === "Mixed"
              ? "Multiple regions in use"
              : "fleet-aware"}
          </div>
        </div>
      </div>

      {/* Fleet list */}
      {fleets.length === 0 ? (
        <div className="rounded border-2 border-dashed border-border bg-panel p-10 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded bg-elevated text-text-faint">
            <Globe className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-text">No fleets configured yet</h3>
            <p className="text-xs text-text-muted">
              Create your first fleet (e.g. <span className="font-mono">IND-TCS</span>) to start
              grouping devices. Until you do, every device stays unassigned.
            </p>
          </div>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded bg-accent px-4 py-2 font-mono text-xs font-semibold text-bg hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Fleet</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {fleets.map((f) => (
            <div
              key={f.id}
              className="rounded-card border border-border bg-panel p-6 hover:border-accent/40 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-mono text-base font-bold text-text truncate" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      f.active_devices > 0
                        ? "bg-accent/10 text-accent border border-accent/30"
                        : "bg-elevated text-text-faint border border-border"
                    }`}
                  >
                    {f.active_devices > 0 ? `${f.active_devices} live` : "idle"}
                  </span>
                </div>

                {f.description && (
                  <p className="text-xs text-text-muted mb-3 line-clamp-2">{f.description}</p>
                )}

                <div className="space-y-2 font-mono text-xs bg-bg/60 p-3 rounded mb-4">
                  <div className="flex justify-between">
                    <span className="text-text-faint">Grid Region:</span>
                    <span className="font-bold text-text">{f.grid_region}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-faint">Intensity:</span>
                    <span className="font-bold text-amber">
                      {f.grid_intensity_g_per_kwh.toFixed(0)} gCO2e/kWh
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-faint">Devices:</span>
                    <span className="font-bold text-text">
                      {f.active_devices} / {f.total_devices}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-faint">Carbon Today:</span>
                    <span className="font-bold text-text">
                      {formatCarbonKg(f.carbon_g_today / 1000)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-xs">
                <button
                  onClick={() => setDeleteTarget(f)}
                  disabled={f.total_devices > 0}
                  className="flex items-center gap-1 text-high hover:text-high disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={f.total_devices > 0 ? "Unassign devices first" : "Delete fleet"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
                <Link
                  href={`/fleet/${f.id}`}
                  className="flex items-center gap-1 text-accent hover:underline font-semibold cursor-pointer"
                >
                  <span>Manage Devices</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unassigned devices banner */}
      {fleets.length > 0 && (
        <div className="rounded border border-amber/30 bg-amber/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-mono text-xs font-semibold text-amber">
              Devices not assigned to any fleet are aggregated under &quot;Unassigned&quot;
            </p>
            <p className="text-[11px] text-text-muted">
              Open any device from <Link href="/devices/endpoints" className="text-accent hover:underline font-semibold">Devices → Endpoints</Link> to
              assign it to a fleet, or visit <Link href="/fleet" className="text-accent hover:underline font-semibold">Fleet Registry</Link> to
              create a new one.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
