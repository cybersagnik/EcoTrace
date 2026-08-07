import { Spinner } from "@/components/ui/Spinner";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-10 font-mono text-sm text-text-faint">
      <Spinner /> {label}
    </div>
  );
}
