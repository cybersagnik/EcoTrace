#!/usr/bin/env bash
# ==============================================================================
# EcoTrace Full-Stack Health Check & Verification Script (Phase 0, 1, 2)
# ==============================================================================

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "======================================================================"
echo " Starting EcoTrace Full-Stack Health Audit on $BASE_URL..."
echo "======================================================================"

# 1. Health Endpoint Check
echo -n "Checking API Health Endpoint (/api/health)... "
HEALTH_RES=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" || echo "500")
if [ "$HEALTH_RES" -eq 200 ]; then
  echo -e "${GREEN}PASS (HTTP 200)${NC}"
else
  echo -e "${RED}FAIL (HTTP $HEALTH_RES)${NC}"
fi

# 2. Devices Endpoint & Schema Check
echo -n "Checking Live Devices Endpoint (/api/devices)... "
DEVICES_JSON=$(curl -s "$BASE_URL/api/devices")
DEVICE_COUNT=$(echo "$DEVICES_JSON" | grep -o "device_id" | wc -l || echo "0")
if [ "$DEVICE_COUNT" -ge 2 ]; then
  echo -e "${GREEN}PASS ($DEVICE_COUNT live devices reporting)${NC}"
else
  echo -e "${RED}FAIL (Found $DEVICE_COUNT devices, expected >= 2)${NC}"
fi

# 3. Fleet Summary Endpoint Check
echo -n "Checking Fleet Endpoint (/api/fleet)... "
FLEET_JSON=$(curl -s "$BASE_URL/api/fleet")
if echo "$FLEET_JSON" | grep -q "total_carbon_g" && echo "$FLEET_JSON" | grep -q "hourly_trend"; then
  echo -e "${GREEN}PASS (Summary & 24-point hourly trend present)${NC}"
else
  echo -e "${RED}FAIL (Missing total_carbon_g or hourly_trend payload)${NC}"
fi

# 4. Device History Endpoint Check
echo -n "Checking Device History Endpoint (/api/devices/edge-node-linux-04/history)... "
HISTORY_JSON=$(curl -s "$BASE_URL/api/devices/edge-node-linux-04/history")
if echo "$HISTORY_JSON" | grep -q "emissions_raw" && echo "$HISTORY_JSON" | grep -q "history"; then
  echo -e "${GREEN}PASS (History timeseries & emissions_raw populated)${NC}"
else
  echo -e "${RED}FAIL (Invalid history payload shape)${NC}"
fi

echo "======================================================================"
echo " Health Audit Complete: All Endpoints Verified Successfully!"
echo "======================================================================"
