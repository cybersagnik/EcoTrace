import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DeviceTable } from "@/components/dashboard/DeviceTable";
import { Device } from "@/types/device";

describe("DeviceTable Unit Tests", () => {
  const mockDevices: Device[] = [
    {
      device_id: "edge-node-linux-04",
      device_class: "linux-server",
      os: "Ubuntu 22.04 LTS",
      carbon_g: 184.6,
      status: "operating",
      schema_version: "1.0.0",
    },
    {
      device_id: "ws-win-audrey",
      device_class: "windows-workstation",
      os: "Windows 11 Pro",
      carbon_g: 412.1,
      status: "operating",
      schema_version: "1.0.0",
    },
    {
      device_id: "edge-gateway-01",
      device_class: "iot-sensor",
      os: "Debian 12",
      carbon_g: 95.3,
      status: "operating",
      schema_version: "1.0.0",
    },
  ];

  it("renders the accurate number of device rows corresponding to received API data", () => {
    render(<DeviceTable devices={mockDevices} />);

    // Check device IDs in table
    expect(screen.getByText("edge-node-linux-04")).toBeInTheDocument();
    expect(screen.getByText("ws-win-audrey")).toBeInTheDocument();
    expect(screen.getByText("edge-gateway-01")).toBeInTheDocument();

    // Check row count header indicator
    expect(screen.getByText("3 nodes online")).toBeInTheDocument();
  });

  it("renders fallback UI when device array is empty", () => {
    render(<DeviceTable devices={[]} />);

    expect(screen.getByText(/No data — agent may be offline/i)).toBeInTheDocument();
  });
});
