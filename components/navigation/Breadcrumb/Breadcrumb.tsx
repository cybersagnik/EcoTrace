// Phase-later. Useful once nested routes (e.g. /devices/[id]) exist.
export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="font-mono text-xs text-text-faint">{items.join(" / ")}</div>
  );
}
