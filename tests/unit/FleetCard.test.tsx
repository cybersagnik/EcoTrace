import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { FleetCard } from "@/components/dashboard/FleetCard";
import { FleetSummary } from "@/types/fleet";

describe("FleetCard Unit Tests", () => {
  const mockSummary: FleetSummary = {
    total_carbon_kg: 12.4,
    total_carbon_g: 12400.0,
    delta_pct_vs_yesterday: -3.1,
    grid_region: "US-EAST",
    last_sync_seconds_ago: 30,
    last_updated: "2026-07-28T12:00:00.000Z",
    intensity: "moderate",
    active_devices: 4,
  };

  it("renders the correct total carbon value in grams and kg equivalent", () => {
    render(<FleetCard summary={mockSummary} />);

    // Total carbon output heading and values
    expect(screen.getByText(/Total Carbon Output/i)).toBeInTheDocument();
    expect(screen.getByText("12,400")).toBeInTheDocument();
    expect(screen.getByText(/12.4 kg equivalent/i)).toBeInTheDocument();
  });

  it("renders the active devices count correctly", () => {
    render(<FleetCard summary={mockSummary} />);

    expect(screen.getByText(/Active Devices/i)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(/nodes active/i)).toBeInTheDocument();
  });

  it("displays fallback error UI when summary is null", () => {
    render(<FleetCard summary={null} />);

    expect(screen.getByText(/No data — agent may be offline/i)).toBeInTheDocument();
  });
});
