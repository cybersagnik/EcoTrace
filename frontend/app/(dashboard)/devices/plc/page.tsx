"use client";

import { Cpu } from "lucide-react";
import { BlockedCategory } from "@/components/shared/BlockedCategory";

export default function PLCDevicesPage() {
  return (
    <BlockedCategory
      icon={Cpu}
      title="PLC Controllers"
      subtitle="Tier 2 device support is on the Phase 5 roadmap. No data flows through this category yet."
    />
  );
}
