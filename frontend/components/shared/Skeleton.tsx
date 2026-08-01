"use client";

export function SkeletonBox({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-border/60 ${className}`}
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
          className="rounded-card border border-border/80 bg-panel-solid/80 p-5 shadow-glass backdrop-blur-glass space-y-3"
        >
          <div className="flex justify-between items-center">
            <SkeletonBox className="h-3 w-28" />
            <SkeletonBox className="h-8 w-8 rounded-lg" />
          </div>
          <SkeletonBox className="h-8 w-36" />
          <SkeletonBox className="h-4 w-24" />
        </div>
      ))}
      <div className="col-span-full rounded-card border border-border/80 bg-panel-solid/60 p-4">
        <SkeletonBox className="h-3 w-48 mb-2" />
        <SkeletonBox className="h-2.5 w-full rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonDeviceTable() {
  return (
    <div className="mb-8 rounded-card border border-border/80 bg-panel-solid/80 p-5 shadow-glass space-y-4">
      <div className="flex justify-between items-center border-b border-border/50 pb-4">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-8 w-64 rounded-lg" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center py-2 border-b border-border/30">
            <SkeletonBox className="h-4 w-32" />
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-4 w-20" />
            <SkeletonBox className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTrendChart() {
  return (
    <div className="mb-8 rounded-card border border-border/80 bg-panel-solid/80 p-6 shadow-glass space-y-4">
      <div className="flex justify-between items-center border-b border-border/50 pb-4">
        <SkeletonBox className="h-5 w-64" />
        <SkeletonBox className="h-8 w-32 rounded-lg" />
      </div>
      <SkeletonBox className="h-64 w-full rounded-xl" />
    </div>
  );
}
