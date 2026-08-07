import { HTMLAttributes } from "react";
import { cn } from "@/utils/helpers";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-border bg-panel p-5", className)}
      {...props}
    />
  );
}
