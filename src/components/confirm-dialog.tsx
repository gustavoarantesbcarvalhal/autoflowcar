import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 rounded-2xl border-border p-0">
        <DialogHeader className="items-center px-6 pb-4 pt-6">
          <div
            className={cn(
              "mb-3 grid size-12 place-items-center rounded-full",
              variant === "danger" ? "bg-destructive/10" : "bg-muted",
            )}
          >
            <AlertTriangle
              className={cn(
                "size-5",
                variant === "danger" ? "text-destructive" : "text-muted-foreground",
              )}
            />
          </div>
          <DialogTitle className="text-center text-base">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-center text-sm">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter className="flex-row gap-2 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="h-10 flex-1 rounded-[10px] border border-border text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={isPending}
            className={cn(
              "h-10 flex-1 rounded-[10px] text-sm font-semibold text-white transition-colors disabled:opacity-60",
              variant === "danger"
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90",
            )}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
