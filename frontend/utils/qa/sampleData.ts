import { TELEMETRY_SCHEMA_COLUMNS } from "@/types/telemetry";

/**
 * Deterministic synthetic dataset generator so the QA Dashboard can be
 * exercised without a real export file. Values are clearly synthetic
 * (edge-node-XX / ws-*-XX device IDs) and the generator is seeded so the
 * output is reproducible between runs — it is NOT a substitute for the
 * real telemetry export contract.
 */

interface SampleDevice {
  id: string;
  deviceClass: string;
  os: string;
  hostname: string;
  fleetId: string | null;
  fleetName: string | null;
  gridRegion: string | null;
  baseEnergyWh: number;
  cpuBias: number;
}

const SAMPLE_DEVICES: SampleDevice[] = [
  { id: "edge-node-01", deviceClass: "linux-server", os: "linux", hostname: "edge-01", fleetId: "flt-in-kol", fleetName: "INFOTRICS", gridRegion: "IN-KOL", baseEnergyWh: 320, cpuBias: 12 },
  { id: "edge-node-02", deviceClass: "linux-server", os: "linux", hostname: "edge-02", fleetId: "flt-in-kol", fleetName: "INFOTRICS", gridRegion: "IN-KOL", baseEnergyWh: 280, cpuBias: 18 },
  { id: "edge-node-03", deviceClass: "linux-server", os: "linux", hostname: "edge-03", fleetId: null, fleetName: null, gridRegion: null, baseEnergyWh: 210, cpuBias: 9 },
  { id: "ws-audrey-01", deviceClass: "windows-workstation", os: "windows", hostname: "AUDREY-PC", fleetId: "flt-us-west", fleetName: "US-WEST-DEV", gridRegion: "US-WEST", baseEnergyWh: 150, cpuBias: 6 },
  { id: "ws-jordan-02", deviceClass: "windows-workstation", os: "windows", hostname: "JORDAN-LT", fleetId: "flt-us-west", fleetName: "US-WEST-DEV", gridRegion: "US-WEST", baseEnergyWh: 130, cpuBias: 4 },
  { id: "ws-priya-03", deviceClass: "windows-workstation", os: "windows", hostname: "PRIYA-14", fleetId: "flt-eu-fra", fleetName: "EU-FRA-OPS", gridRegion: "EU-FRA", baseEnergyWh: 165, cpuBias: 7 },
];

const ATTRIBUTION_MODELS = ["v0.1", "v0.2", "v0.3"];
const STATUSES = ["active", "active", "active", "inactive", "error"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quote = (v: string): string => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);

export function generateSampleCsv(seed = 42): string {
  const rnd = mulberry32(seed);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const lines: string[] = [];

  const header = TELEMETRY_SCHEMA_COLUMNS.join(",");
  const rows: string[] = [];

  const emit = (
    ts: string,
    device: SampleDevice,
    energy: number,
    carbon: number,
    cpu: number,
    mem: number,
    netSent: number,
    netRecv: number,
    status: string,
    model: string,
  ) => {
    const row = [
      ts,
      device.id,
      device.deviceClass,
      device.os,
      device.hostname,
      device.fleetId ?? "",
      device.fleetName ?? "",
      device.gridRegion ?? "",
      energy.toFixed(2),
      carbon.toFixed(2),
      cpu.toFixed(1),
      mem.toFixed(1),
      String(Math.round(netSent)),
      String(Math.round(netRecv)),
      status,
      model,
    ].map(quote);
    rows.push(row.join(","));
  };

  const carbonFactor: Record<string, number> = { "v0.1": 1.02, "v0.2": 0.11, "v0.3": 0.05 };

  for (let day = 6; day >= 0; day -= 1) {
    for (let hour = 0; hour < 24; hour += 4) {
      SAMPLE_DEVICES.forEach((device) => {
        const model = ATTRIBUTION_MODELS[Math.floor(rnd() * ATTRIBUTION_MODELS.length)];
        const energy = device.baseEnergyWh * (0.65 + rnd() * 0.7);
        const carbon = energy * carbonFactor[model] * (0.8 + rnd() * 0.4);
        const cpu = Math.min(100, Math.max(0, device.cpuBias + rnd() * 35));
        const mem = Math.min(100, Math.max(0, 20 + rnd() * 50));
        const netSent = (rnd() * 80 + 10) * 1024 * 1024;
        const netRecv = (rnd() * 120 + 20) * 1024 * 1024;
        const status = STATUSES[Math.floor(rnd() * STATUSES.length)];
        const ts = new Date(now - day * dayMs - hour * 60 * 60 * 1000).toISOString();
        emit(ts, device, energy, carbon, cpu, mem, netSent, netRecv, status, model);
      });
    }
  }

  // Deliberate defects so the validation pipeline is demonstrable:
  const last = SAMPLE_DEVICES[0];
  const baseTs = new Date(now - 1 * dayMs - 8 * 60 * 60 * 1000).toISOString();
  // Duplicate of a naturally generated row (edge-node-01, day 1, hour 8).
  emit(baseTs, last, 300, 20.0, 25.0, 40.0, 50 * 1024 * 1024, 60 * 1024 * 1024, "active", "v0.3");
  // A row with negative carbon (flags NEGATIVE_CARBON).
  emit(baseTs, last, 200, -12.5, 30.0, 45.0, 20 * 1024 * 1024, 25 * 1024 * 1024, "active", "v0.3");

  lines.push(header, ...rows);
  return lines.join("\n");
}
