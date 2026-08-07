import { InputHTMLAttributes } from "react";
import { cn } from "@/utils/helpers";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
