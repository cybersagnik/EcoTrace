"use client";

export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-border/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonFleetCard() {
  return (
    <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-card border border-border bg-panel p-5 space-y-3"
        >
          <div className="flex justify-between items-center">
            <SkeletonBox className="h-3 w-28" />
            <SkeletonBox className="h-8 w-8 rounded" />
          </div>
          <SkeletonBox className="h-8 w-36" />
          <SkeletonBox className="h-4 w-24" />
        </div>
      ))}
      <div className="col-span-full rounded-card border border-border bg-panel p-4">
        <SkeletonBox className="h-3 w-48 mb-2" />
        <SkeletonBox className="h-1 w-full rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonDeviceTable() {
  return (
    <div className="mb-8 rounded-card border border-border bg-panel p-5 space-y-4">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-8 w-64 rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-border">
            <SkeletonBox className="h-4 w-32" />
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-5 w-24 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTrendChart() {
  return (
    <div className="mb-8 rounded-card border border-border bg-panel p-6 space-y-4">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <SkeletonBox className="h-5 w-64" />
        <SkeletonBox className="h-8 w-32 rounded" />
      </div>
      <SkeletonBox className="h-64 w-full rounded" />
    </div>
  );
}
