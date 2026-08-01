"use client";

import { useState } from "react";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Navbar } from "@/components/navigation/Navbar";
import { SustainabilityBackground } from "@/components/shared/SustainabilityBackground/SustainabilityBackground";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="relative flex min-h-screen bg-bg text-text antialiased overflow-x-hidden">
      {/* Sustainability Background Visual Layer (pointer-events-none, z-0) */}
      <SustainabilityBackground />

      {/* Foreground Interactive Content Layer */}
      <Sidebar isMobileOpen={isMobileOpen} onMobileClose={() => setIsMobileOpen(false)} />
      
      <div className="relative z-10 flex flex-1 flex-col min-w-0">
        <Navbar onMenuClick={() => setIsMobileOpen(true)} />
        <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8 pb-24 flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
