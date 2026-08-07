"use client";
import { ErrorState } from "@/components/shared/ErrorState";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState onRetry={reset} />;
}
