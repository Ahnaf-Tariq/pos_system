"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker, Select } from "antd";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { fetchVendors } from "@/lib/vendors/catalog";
import {
  createExpense,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_LABELS,
  updateExpense,
} from "@/lib/expenses/catalog";
import {
  expenseSchema,
  type ExpenseFormValues,
  type ExpenseInput,
} from "@/lib/validations/expense";
import {
  ExpenseCategory,
  ExpensePaymentMethod,
} from "@/types/enums";
import type { ExpenseListRow, Vendor } from "@/types/interfaces";
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

interface ExpenseEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  authId: string;
  locationId: string | null;
  expense?: ExpenseListRow | null;
  onSaved: () => void;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseEditorDialog({
  open,
  onOpenChange,
  userId,
  authId,
  locationId,
  expense = null,
  onSaved,
}: ExpenseEditorDialogProps) {
  const isEditing = Boolean(expense?.id);
  const lockedCash = Boolean(expense?.cash_movement_id);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues, unknown, ExpenseInput>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      title: "",
      amount: undefined,
      category: ExpenseCategory.OTHER,
      payment_method: ExpensePaymentMethod.CASH,
      expense_date: todayKey(),
      vendor_id: "",
      notes: "",
    },
  });

  const category = watch("category");
  const paymentMethod = watch("payment_method");
  const expenseDate = watch("expense_date");
  const vendorId = watch("vendor_id");

  useEffect(() => {
    if (!open || !locationId) return;
    void (async () => {
      try {
        const supabase = createClient();
        setVendors(await fetchVendors(supabase, userId, locationId));
      } catch {
        setVendors([]);
      }
    })();
  }, [open, userId, locationId]);

  useEffect(() => {
    if (!open) return;
    reset({
      title: expense?.title ?? "",
      amount: expense?.amount,
      category: (expense?.category as ExpenseCategory) ?? ExpenseCategory.OTHER,
      payment_method:
        (expense?.payment_method as ExpensePaymentMethod) ??
        ExpensePaymentMethod.CASH,
      expense_date: expense?.expense_date ?? todayKey(),
      vendor_id: expense?.vendor_id ?? "",
      notes: expense?.notes ?? "",
    });
  }, [open, expense, reset]);

  async function onSave(values: ExpenseInput) {
    if (!isEditing && !locationId) {
      toast.error("Select a location first");
      return;
    }
    if (lockedCash) {
      toast.error("Cash drawer expenses cannot be edited");
      return;
    }

    try {
      const supabase = createClient();
      if (isEditing && expense) {
        await updateExpense(supabase, {
          userId,
          expenseId: expense.id,
          values,
        });
        toast.success("Expense updated");
      } else if (locationId) {
        await createExpense(supabase, {
          userId,
          locationId,
          recordedBy: authId,
          values,
        });
        toast.success(
          values.payment_method === ExpensePaymentMethod.CASH
            ? "Expense recorded (cash drawer updated if open)"
            : "Expense recorded",
        );
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save expense");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription>
            Track rent, utilities, supplies, and other operating costs. Cash
            expenses pull from an open cash drawer when one exists.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-title">Title</Label>
            <Input
              id="expense-title"
              placeholder="e.g. Electricity bill"
              disabled={lockedCash}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                disabled={lockedCash}
                {...register("amount")}
              />
              {errors.amount ? (
                <p className="text-sm text-destructive">
                  {errors.amount.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <DatePicker
                className="w-full"
                value={expenseDate ? dayjs(expenseDate) : null}
                disabled={lockedCash}
                onChange={(value) =>
                  setValue(
                    "expense_date",
                    value ? value.format("YYYY-MM-DD") : todayKey(),
                    { shouldValidate: true },
                  )
                }
                allowClear={false}
              />
              {errors.expense_date ? (
                <p className="text-sm text-destructive">
                  {errors.expense_date.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                className="w-full"
                value={category}
                disabled={lockedCash}
                onChange={(value) =>
                  setValue("category", value as ExpenseCategory, {
                    shouldValidate: true,
                  })
                }
                options={Object.values(ExpenseCategory).map((value) => ({
                  value,
                  label: EXPENSE_CATEGORY_LABELS[value],
                }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                className="w-full"
                value={paymentMethod}
                disabled={lockedCash}
                onChange={(value) =>
                  setValue("payment_method", value as ExpensePaymentMethod, {
                    shouldValidate: true,
                  })
                }
                options={Object.values(ExpensePaymentMethod).map((value) => ({
                  value,
                  label: EXPENSE_PAYMENT_LABELS[value],
                }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select
              className="w-full"
              allowClear
              placeholder="Optional"
              value={vendorId || undefined}
              disabled={lockedCash}
              onChange={(value) =>
                setValue("vendor_id", value ?? "", { shouldValidate: true })
              }
              options={vendors.map((vendor) => ({
                value: vendor.id,
                label: vendor.name,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
              placeholder="Optional"
              disabled={lockedCash}
              className="resize-none"
              {...register("notes")}
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
            <Button type="submit" disabled={isSubmitting || lockedCash}>
              {isSubmitting
                ? "Saving…"
                : isEditing
                  ? "Save"
                  : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
