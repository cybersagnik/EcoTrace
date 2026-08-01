"use client";

import React from "react";
import Image from "next/image";
import { Leaf, Zap, ShieldCheck } from "lucide-react";

export function SustainabilityBackground() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Ambient Sky & Eco Glow Radial Flares */}
      <div className="absolute -top-32 -left-32 h-[650px] w-[650px] rounded-full bg-emerald-500/10 dark:bg-emerald-400/15 blur-[140px] transition-all duration-700 animate-pulse" />
      <div className="absolute top-1/4 -right-20 h-[600px] w-[600px] rounded-full bg-sky-400/15 dark:bg-sky-400/20 blur-[140px] transition-all duration-700" />
      <div className="absolute -bottom-32 left-1/3 h-[600px] w-[600px] rounded-full bg-teal-500/10 dark:bg-emerald-500/10 blur-[150px] transition-all duration-700" />

      {/* 2. Editorial Sustainability Botanical Prismatic Art Layer */}
      <div className="absolute right-0 top-0 h-full w-full lg:w-1/2 xl:w-2/5 opacity-55 dark:opacity-45 transition-opacity duration-700 pointer-events-none">
        <div className="relative h-full w-full mask-radial-vignette">
          <Image
            src="/images/sustainability_bg.png"
            alt="Sustainability Botanical Prismatic Artwork"
            fill
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority
            className="object-cover object-right-top filter brightness-105 saturate-110 dark:brightness-100 dark:contrast-115 dark:saturate-120"
          />
        </div>
      </div>

      {/* 4. Ambient Floating Botanical Particles */}
      <div className="absolute top-1/4 left-1/3 text-emerald-500/20 dark:text-emerald-400/30 animate-drift-1">
        <Leaf className="h-5 w-5 rotate-12" />
      </div>
      <div className="absolute top-2/3 right-1/4 text-emerald-500/15 dark:text-emerald-400/25 animate-drift-2">
        <Leaf className="h-4 w-4 -rotate-45" />
      </div>
      <div className="absolute bottom-1/3 left-1/4 text-sky-500/15 dark:text-sky-400/25 animate-drift-3">
        <Leaf className="h-6 w-6 rotate-45" />
      </div>
    </div>
  );
}
