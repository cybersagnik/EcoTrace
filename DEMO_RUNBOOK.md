# EcoTrace Cold-Start Deployment & Runbook (< 5 Minutes)

> **Objective**: Deploy, initialize, and verify the full EcoTrace platform from a clean cold-start environment in **under 5 minutes**.

---

## Step-by-Step Spin-Up Procedure

### Step 1: Clone / Clean Environment Check (Time: 0:00 - 0:30)
Ensure node version is $\ge$ 18.0.0. Navigate to the project root directory:
```bash
cd "e:\project\EcoTrace\extract all\ecotrace-frontend"
node -v
npm -v
```

### Step 2: Install Dependencies & Build (Time: 0:30 - 2:30)
Run dependency installation and production build verification:
```bash
cmd /c npm install
cmd /c npm run build
```

### Step 3: Run Automated Test Verification (Time: 2:30 - 3:15)
Verify that unit tests pass cleanly:
```bash
cmd /c npm test
```
*Expected Output*: `3 passed (3), 9 passed (9 tests)`.

### Step 4: Launch Dev / Production Server (Time: 3:15 - 3:45)
Start the Next.js production server:
```bash
cmd /c npm run start
```
or launch local development mode:
```bash
cmd /c npm run dev
```

### Step 5: Verification & Liveness Probe (Time: 3:45 - 4:30)
Open browser or run curl to verify health endpoint:
```bash
curl http://localhost:3000/api/health
```
*Expected Response*: `{"status":"ok","timestamp":"..."}`

Navigate to `http://localhost:3000/dashboard` in the web browser. Ensure the Demo Mode toggle (`[⚡ DEMO MODE: ON]`) is active for offline/fallback stability.

---

## Emergency Troubleshooting & Fallback Procedures

| Issue / Failure | Immediate Runbook Remedy | Time to Recover |
| :--- | :--- | :--- |
| **Port 3000 occupied** | Run `cmd /c npx kill-port 3000` then restart `npm run dev`. | 5 seconds |
| **Backend API Unreachable** | Toggle `[⚡ DEMO MODE: ON]` in top navbar. Built-in interceptor will instantly serve pre-recorded mock payloads. | 2 seconds |
| **Browser rendering freeze** | Hard refresh browser tab (`Ctrl + F5` / `Cmd + Shift + R`). | 3 seconds |
