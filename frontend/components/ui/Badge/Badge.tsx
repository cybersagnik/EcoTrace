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
        "inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 font-mono text-xs text-text-muted",
        className
      )}
    >
      {color && (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}26` }}
        />
      )}
      {children}
    </span>
  );
}
