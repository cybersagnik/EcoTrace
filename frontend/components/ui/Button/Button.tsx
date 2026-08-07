import { ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/helpers";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-3.5 py-2 font-mono text-sm transition-colors",
        variant === "primary" && "bg-accent text-bg hover:opacity-85",
        variant === "ghost" && "border border-border text-text-muted hover:text-text",
        className
      )}
      {...props}
    />
  );
}
