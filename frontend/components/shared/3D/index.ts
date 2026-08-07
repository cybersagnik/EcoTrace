"use client";

import dynamic from "next/dynamic";

export const EcoTech3DCanvas = dynamic(
  () => import("./EcoTech3DCanvas").then((mod) => mod.EcoTech3DCanvas),
  { ssr: false }
);
