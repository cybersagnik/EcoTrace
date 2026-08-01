"use client";
import { ErrorState } from "@/components/shared/ErrorState";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState message="Couldn't load fleet data." onRetry={reset} />;
}
