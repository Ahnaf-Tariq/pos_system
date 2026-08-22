"use client";

import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  closeDrawerSchema,
  type CloseDrawerFormValues,
  type CloseDrawerInput,
} from "@/lib/validations/cash-drawer";
import { cn, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CloseDrawerDialogProps {
  open: boolean;
  currency: string;
  openingBalance: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expected: number;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CloseDrawerInput) => Promise<void>;
}

function varianceTone(variance: number) {
  if (variance === 0) return "text-emerald-400";
  if (variance > 0) return "text-amber-400";
  return "text-destructive";
}

function varianceLabel(variance: number) {
  if (variance === 0) return "Balanced";
  if (variance > 0) return "Over";
  return "Short";
}

export function CloseDrawerDialog({
  open,
  currency,
  openingBalance,
  cashSales,
  cashIn,
  cashOut,
  expected,
  onOpenChange,
  onSubmit,
}: CloseDrawerDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CloseDrawerFormValues, unknown, CloseDrawerInput>({
    resolver: zodResolver(closeDrawerSchema),
    defaultValues: { closing_balance_actual: expected, notes: "" },
  });

  const actual = Number(
    useWatch({ control, name: "closing_balance_actual" }) ?? 0,
  );
  const variance = useMemo(
    () => Math.round((actual - expected) * 100) / 100,
    [actual, expected],
  );

  useEffect(() => {
    if (!open) return;
    reset({ closing_balance_actual: expected, notes: "" });
  }, [open, expected, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close drawer</DialogTitle>
          <DialogDescription>
            Count the cash in the drawer and compare it to the expected amount.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values);
          })}
          className="space-y-4"
        >
          <dl className="grid gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Opening balance</dt>
              <dd className="money font-medium">
                {formatMoney(openingBalance, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">POS sales</dt>
              <dd className="money font-medium">
                {formatMoney(cashSales, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cash in</dt>
              <dd className="money font-medium">
                {formatMoney(cashIn, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cash out</dt>
              <dd className="money font-medium">
                {formatMoney(cashOut, currency)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Expected in drawer</dt>
              <dd className="money text-base font-semibold text-primary">
                {formatMoney(expected, currency)}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <Label htmlFor="actual-counted">Actual cash counted</Label>
            <Input
              id="actual-counted"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              {...register("closing_balance_actual", { valueAsNumber: true })}
            />
            {errors.closing_balance_actual ? (
              <p className="text-sm text-destructive">
                {errors.closing_balance_actual.message}
              </p>
            ) : null}
          </div>

          <p className={cn("text-sm font-medium", varianceTone(variance))}>
            Variance {formatMoney(variance, currency)} (
            {varianceLabel(variance)})
          </p>

          <div className="space-y-2">
            <Label htmlFor="close-notes">Notes</Label>
            <Textarea
              id="close-notes"
              placeholder="Optional"
              {...register("notes")}
              className="resize-none"
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
              {isSubmitting ? "Closing…" : "Close drawer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
