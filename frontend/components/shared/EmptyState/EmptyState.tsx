export function EmptyState({ message = "Nothing here yet." }: { message?: string }) {
  return (
    <div className="rounded-card border border-dashed border-border p-10 text-center font-mono text-sm text-text-faint">
      {message}
    </div>
  );
}
