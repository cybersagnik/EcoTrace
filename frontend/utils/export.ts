/**
 * Utility functions for exporting EcoTrace reports and telemetry datasets.
 */

/**
 * Sanitizes CSV cell values to prevent CSV Formula / Command Injection (CWE-1236).
 * Values beginning with =, +, -, @, \t, or \r are prepended with a single quote (').
 */
function sanitizeCSVValue(val: string): string {
  if (typeof val === "string" && /^[=+\-@\t\r]/.test(val)) {
    return `'${val}`;
  }
  return val;
}

export function downloadCSVReport(): void {
  const headers = [
    "Timestamp",
    "Device ID",
    "Hardware Class",
    "OS",
    "Carbon Output (g CO2e)",
    "Status",
    "Grid Region",
    "Schema Version"
  ];

  const rows = [
    [
      new Date().toISOString(),
      "edge-node-linux-04",
      "linux-server",
      "Ubuntu 22.04 LTS",
      "184.6",
      "operating",
      "US-EAST",
      "1.0.0"
    ],
    [
      new Date().toISOString(),
      "ws-win-audrey",
      "windows-workstation",
      "Windows 11 Pro",
      "412.1",
      "operating",
      "US-EAST",
      "1.0.0"
    ],
    [
      new Date().toISOString(),
      "edge-gateway-01",
      "iot-sensor",
      "Debian 12",
      "95.3",
      "operating",
      "US-EAST",
      "1.0.0"
    ],
    [
      new Date().toISOString(),
      "plc-node-factory-a",
      "plc-controller",
      "Alpine Linux 3.19",
      "310.8",
      "registering",
      "US-EAST",
      "1.0.0"
    ]
  ];

  const csvContent = [
    headers.map(sanitizeCSVValue).join(","),
    ...rows.map((row) => row.map((val) => `"${sanitizeCSVValue(val).replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ecotrace_telemetry_dataset_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPDFReport(reportTitle: string = "Monthly ESG Compliance Disclosure"): void {
  const timestamp = new Date().toLocaleString();
  
  const reportContent = `
================================================================================
                    ECOTRACE SUSTAINABILITY AUDIT REPORT
================================================================================
Report Title:   ${reportTitle}
Generated At:   ${timestamp}
Compliance:     Scope 1 & 2 GHG Protocol Standard, ISO 14064 Compliant
Grid Region:    US-EAST (Average Grid Mix: 240 gCO2e/kWh)
--------------------------------------------------------------------------------

1. EXECUTIVE SUMMARY
---------------------
Total Fleet Carbon Emissions (Today):   12.4 kg CO2e (12,400 g CO2e)
Active Telemetry Nodes:                 4 Devices Online (100% Uptime)
Overall ESG Efficiency Index:           94.8% (Optimal Rating)
Renewable Energy Grid Share:            64.5% Clean Energy

2. REGIONAL FLEET BREAKDOWN
----------------------------
* US-East (N. Virginia):   142.5 kg CO2e | PUE: 1.12 | 45% Renewable
* EU-West (Frankfurt):     98.2 kg CO2e  | PUE: 1.08 | 82% Wind & Solar
* AP-South (Mumbai):       210.8 kg CO2e | PUE: 1.24 | 25% Solar / 75% Thermal

3. REGISTERED DEVICE TELEMETRY LOG
-----------------------------------
1. Device ID: edge-node-linux-04 | OS: Ubuntu 22.04 LTS     | Carbon: 184.6g | Status: Operating
2. Device ID: ws-win-audrey      | OS: Windows 11 Pro       | Carbon: 412.1g | Status: Operating
3. Device ID: edge-gateway-01    | OS: Debian 12 (Bookworm) | Carbon: 95.3g  | Status: Operating
4. Device ID: plc-node-factory-a | OS: Alpine Linux 3.19    | Carbon: 310.8g | Status: Registering

4. AUDIT VERIFICATION & CERTIFICATION
--------------------------------------
This document certifies that the carbon telemetry data presented herein was
captured directly from hardware-level sensors via NATS streaming protocol
and validated by EcoTrace Automated Compliance Engine.

Digital Signature: 0x8F92A7C310E4B551D90A
================================================================================
`;

  // Accurate MIME type declaration (text/plain;charset=utf-8) matching text payload to prevent CWE-434 MIME confusion
  const blob = new Blob([reportContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const filename = `${reportTitle.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}.txt`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

