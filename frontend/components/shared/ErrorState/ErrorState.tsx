interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong.", onRetry }: ErrorStateProps) {
  return (
    <div className="rounded-card border border-carbon-high/30 bg-panel p-6 text-center">
      <p className="font-mono text-sm text-carbon-high">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 font-mono text-xs text-accent underline">
          Try again
        </button>
      )}
    </div>
  );
}
