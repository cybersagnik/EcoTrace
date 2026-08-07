import { cn } from "@/utils/helpers";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-md bg-elevated", className)} />;
}
