import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
