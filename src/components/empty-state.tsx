import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ElementType;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: "default" | "success";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  tone = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "mb-3 size-10",
            tone === "success" ? "text-success/40" : "text-muted-foreground/30",
          )}
        />
      )}
      <p className="text-sm font-semibold">{title}</p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
