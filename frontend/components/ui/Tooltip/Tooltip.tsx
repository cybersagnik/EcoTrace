// Phase-later. Minimal title-attribute shim until a positioned tooltip is needed.
export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return <span title={label}>{children}</span>;
}
