"use client";

import { Radio } from "lucide-react";
import { BlockedCategory } from "@/components/shared/BlockedCategory";

export default function IoTDevicesPage() {
  return (
    <BlockedCategory
      icon={Radio}
      title="IoT Sensors"
      subtitle="Tier 2 device support is on the Phase 5 roadmap. No data flows through this category yet."
    />
  );
}
