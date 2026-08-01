import { HTMLAttributes, TableHTMLAttributes } from "react";
import { cn } from "@/utils/helpers";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse", className)} {...props} />;
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-elevated", className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-text-faint",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-border-soft px-4 py-3.5 text-sm text-text-muted last:border-b-0", className)}
      {...props}
    />
  );
}
