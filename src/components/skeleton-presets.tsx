import { cn } from "@/lib/utils";

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-2xl border border-border bg-card", className)} />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return <SkeletonPulse className={cn("h-28", className)} />;
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-14 animate-pulse rounded-xl border border-border bg-card",
        className,
      )}
    />
  );
}

export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-[72px] animate-pulse rounded-xl border border-border bg-card",
        className,
      )}
    />
  );
}

export function SkeletonText({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-3 animate-pulse rounded-full bg-muted",
        className,
      )}
    />
  );
}

export function SkeletonList({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  cols = "3",
  className,
}: {
  count?: number;
  cols?: "2" | "3" | "4" | "6";
  className?: string;
}) {
  const colsMap: Record<string, string> = {
    "2": "grid-cols-2",
    "3": "grid-cols-2 md:grid-cols-3",
    "4": "grid-cols-2 md:grid-cols-4",
    "6": "grid-cols-3 md:grid-cols-6",
  };
  return (
    <div className={cn("grid gap-3", colsMap[cols], className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonKpiStrip({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        count === 4 && "grid-cols-2 lg:grid-cols-4",
        count === 6 && "grid-cols-3 md:grid-cols-6",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpi key={i} />
      ))}
    </div>
  );
}

export function SkeletonVehicleCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <div className="aspect-video w-full animate-pulse bg-muted" />
      <div className="space-y-2 p-3.5">
        <SkeletonText className="w-3/4" />
        <SkeletonText className="w-1/2" />
        <div className="flex gap-1 pt-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-4 w-10 animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
