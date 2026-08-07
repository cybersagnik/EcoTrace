import { cn } from "@/utils/helpers";

interface BadgeProps {
  children: React.ReactNode;
  color?: string; // e.g. "var(--clean)" — used for intensity/status dots
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded border border-border px-2 py-0.5 font-mono text-xs text-text-muted",
        className
      )}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </span>
  );
}
