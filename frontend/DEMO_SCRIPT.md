# EcoTrace Live Demo Script (5-Minute Timed Presentation)

> **Goal**: Present the EcoTrace Enterprise Sustainability Observability Platform smoothly within **5:00 minutes** (staying comfortably under the 7:00 minute hard ceiling).
> **Flow Arc**: **State** $\rightarrow$ **Trigger** $\rightarrow$ **Data Flow** $\rightarrow$ **Insight** $\rightarrow$ **Recommendation** $\rightarrow$ **PDF Export**.

---

## Script & Cue Breakdown

| Time Window | Narrative Phase | Screen Target | Presenter Action / Verbal Cue Points | Key Visual Highlight |
| :--- | :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | **1. State** | `/dashboard` | **Presenter**: "Welcome everyone. This is EcoTrace, our real-time IoT telemetry and carbon intensity observability platform. Right here on our Overview Dashboard, we see our live fleet status: 4 active hardware nodes emitting 12.4 kg CO2e today across 3 global datacenters." | • Live Telemetry pulse indicator.<br>• Fleet Summary carbon gauge.<br>• Active device status pills. |
| **0:45 – 1:45** | **2. Trigger** | `/devices` | **Presenter**: "Let's trigger an edge expansion event. Navigating to Hardware & IoT Devices, we provision a new high-performance Linux edge server node (`edge-node-linux-05`). Watch how it immediately initializes in `registering` status with real-time carbon tracking." | • Click `+ Provision New Device`.<br>• Enter Hostname `edge-node-linux-05`.<br>• Instant toast notification & card placement. |
| **1:45 – 2:45** | **3. Data Flow** | `/fleet` | **Presenter**: "Moving to Multi-Region Fleet: telemetry data flows continuously from US-East, EU-West, and AP-South. The hourly trend stream visualizes grid intensity fluctuations in real-time, mapping energy consumption to regional grid sources." | • Interactive Recharts trend graph.<br>• Multi-region geographical carbon breakdown.<br>• Live device selector toggle. |
| **2:45 – 3:45** | **4. Insight** | `/analytics` | **Presenter**: "Under Carbon Analytics, EcoTrace analyzes Scope 2 carbon intensity. Notice the peak emissions window between 18:00 and 20:00 when regional thermal grid reliance surges to 35.5%. EcoTrace automatically calculates offset equivalents — currently saving 412.8 kg CO2e (equivalent to 18 trees)." | • Energy Mix pie & bar breakdown (Clean vs Thermal).<br>• Peak window callout box.<br>• Scope 2 carbon delta badge (-12.4%). |
| **3:45 – 4:45** | **5. Recommendation** | `/dashboard` & `/alerts` | **Presenter**: "Here is the power of automated optimization. EcoTrace surfaces actionable recommendations. Recommendation #1: *'Shift Heavy Compute to EU-West (Frankfurt)'*, saving 18.4 kg CO2e daily. Clicking *Execute Load Shift* auto-routes compute workloads to clean wind/solar grids." | • Recommendation Priority Cards.<br>• `Execute Load Shift` action button.<br>• Real-time Alert notifications. |
| **4:45 – 5:00** | **Wrap Up** | `/dashboard` | **Presenter**: "Finally, we generate an offline-ready, audit-compliant report with one click. In 5 minutes, EcoTrace delivers complete carbon transparency, automated grid optimization, and enterprise ESG compliance. Thank you!" | • Click `Export Executive Summary`.<br>• Instant client-side PDF download trigger. |

---

## Presenter Quick Reference Checklist

- [ ] **Pre-Demo Check**: Ensure browser is in fullscreen (`F11`), dark mode enabled, resolution set to 1080p.
- [ ] **Demo Mode Toggle**: Verify the `[⚡ DEMO MODE: ON]` switch is toggled ON if testing offline or in fallback environments.
- [ ] **Timing Strictness**:
  - Phase 1 (State): Wrap by 0:45
  - Phase 2 (Trigger): Wrap by 1:45
  - Phase 3 (Data Flow): Wrap by 2:45
  - Phase 4 (Insight): Wrap by 3:45
  - Phase 5 (Recommendation): Wrap by 4:45
  - Wrap-up: Finish at 5:00 sharp.
