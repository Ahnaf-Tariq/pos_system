"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CashMovementType } from "@/types/enums";
import {
  cashMovementSchema,
  type CashMovementFormValues,
  type CashMovementInput,
} from "@/lib/validations/cash-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddCashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CashMovementInput) => Promise<void>;
}

export function AddCashMovementDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddCashMovementDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CashMovementFormValues, unknown, CashMovementInput>({
    resolver: zodResolver(cashMovementSchema),
    defaultValues: {
      type: CashMovementType.CASH_IN,
      amount: undefined,
      reason: "",
    },
  });

  const type = useWatch({ control, name: "type" });

  useEffect(() => {
    if (!open) return;
    reset({
      type: CashMovementType.CASH_IN,
      amount: undefined,
      reason: "",
    });
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add cash movement</DialogTitle>
          <DialogDescription>
            Record cash put into or taken out of the drawer.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          className="space-y-4"
        >
          <div className="flex gap-2">
            {(
              [
                [CashMovementType.CASH_IN, "Cash in"],
                [CashMovementType.CASH_OUT, "Cash out"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={type === value ? "default" : "outline"}
                className="min-h-11 flex-1"
                onClick={() => setValue("type", value)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-amount">Amount</Label>
            <Input
              id="movement-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              {...register("amount")}
            />
            {errors.amount ? (
              <p className="text-sm text-destructive">
                {errors.amount.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-reason">Reason</Label>
            <Input
              id="movement-reason"
              placeholder="Optional"
              {...register("reason")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Add movement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
