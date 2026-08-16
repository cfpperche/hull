import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Verb + object, e.g. "Close account?" */
  title: string;
  /** What will be destroyed, named concretely. */
  description: ReactNode;
  /** Label for the destructive action, e.g. "Close account". */
  confirmLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  pendingLabel?: string;
  onConfirm: () => void;
  children?: ReactNode;
  "data-testid"?: string;
};

/**
 * The dialog AGENTS.md requires before anything destructive or irreversible.
 * Deliberately an AlertDialog, not a Dialog: it takes a modal focus trap and
 * does not close on an outside click or Escape by accident.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  pending = false,
  pendingLabel,
  onConfirm,
  children,
  "data-testid": testId,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]",
            "transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
          )}
        />
        <AlertDialogPrimitive.Popup
          data-testid={testId}
          className={cn(
            "bg-popover fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-xl border p-5 shadow-lg outline-none",
            "transition-all data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <AlertDialogPrimitive.Title className="text-base font-semibold tracking-tight">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted-foreground mt-1.5 text-sm">
            {description}
          </AlertDialogPrimitive.Description>
          {children ? <div className="mt-4 grid gap-2">{children}</div> : null}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Close
              render={
                <Button type="button" variant="outline" size="sm" disabled={pending}>
                  {cancelLabel}
                </Button>
              }
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              data-testid={testId ? `${testId}-confirm` : undefined}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
