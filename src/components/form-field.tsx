import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputCls =
  "h-9 w-full rounded-[10px] border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50";

export const textareaCls =
  "w-full rounded-[10px] border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50 resize-none";

export const selectCls =
  "h-9 w-full cursor-pointer rounded-[10px] border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50";

export const labelCls =
  "mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground";

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required,
  hint,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface FormSectionProps {
  title: string;
  className?: string;
  children: ReactNode;
}

export function FormSection({ title, className, children }: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}
