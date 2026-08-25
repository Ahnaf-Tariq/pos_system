"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteExpense,
  fetchExpenses,
  formatExpenseCategory,
  formatExpensePaymentMethod,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_LABELS,
} from "@/lib/expenses/catalog";
import { ExpenseCategory, ExpensePaymentMethod } from "@/types/enums";
import type { ExpenseListRow } from "@/types/interfaces";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { formatDate, formatMoney } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLoader } from "@/components/ui/app-loader";
import { TablePagination } from "@/components/ui/table-pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ExpenseEditorDialog } from "@/components/expenses/expense-editor-dialog";

interface ExpensesManagerProps {
  userId: string;
  authId: string;
  currency: string;
}

export function ExpensesManager({
  userId,
  authId,
  currency,
}: ExpensesManagerProps) {
  const { selectedLocationId } = useLocationContext();
  const [expenses, setExpenses] = useState<ExpenseListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [paymentMethod, setPaymentMethod] = useState<
    ExpensePaymentMethod | "all"
  >("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseListRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseListRow | null>(null);

  const hasActiveFilters = useMemo(() => {
    return (
      search.trim() !== "" ||
      category !== "all" ||
      paymentMethod !== "all" ||
      fromDate !== "" ||
      toDate !== ""
    );
  }, [search, category, paymentMethod, fromDate, toDate]);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setPaymentMethod("all");
    setFromDate("");
    setToDate("");
  };

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selectedLocationId) {
        setExpenses([]);
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        setExpenses(
          await fetchExpenses(supabase, userId, {
            locationId: selectedLocationId,
            category,
            paymentMethod,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            search,
          }),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load expenses",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      userId,
      selectedLocationId,
      category,
      paymentMethod,
      fromDate,
      toDate,
      search,
    ],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["expenses", "cash_movements"],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId),
  });

  const {
    pageItems: pagedExpenses,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(expenses, {
    resetKey: `${category}|${paymentMethod}|${search}|${fromDate}|${toDate}|${selectedLocationId ?? ""}`,
  });

  const totals = useMemo(() => {
    const total = expenses.reduce((sum, row) => sum + row.amount, 0);
    const cash = expenses
      .filter((row) => row.payment_method === ExpensePaymentMethod.CASH)
      .reduce((sum, row) => sum + row.amount, 0);
    return { total, cash, count: expenses.length };
  }, [expenses]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(expense: ExpenseListRow) {
    if (expense.cash_movement_id) {
      toast.error(
        "Cash drawer expenses cannot be edited. Delete and re-add instead.",
      );
      return;
    }
    setEditing(expense);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const supabase = createClient();
      await deleteExpense(supabase, {
        userId,
        expenseId: deleteTarget.id,
      });
      toast.success("Expense deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete expense",
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record operating costs by category. Cash expenses update an open
            drawer automatically.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          disabled={!selectedLocationId}
        >
          <Plus className="size-4" />
          Add expense
        </Button>
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">
          Select a location in the header.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Total expenses"
              value={formatMoney(totals.total, currency)}
              hint={`${totals.count} records in view`}
            />
            <StatCard
              label="Cash expenses"
              value={formatMoney(totals.cash, currency)}
              hint="Paid from till when drawer was open"
            />
            <StatCard
              label="Other payments"
              value={formatMoney(totals.total - totals.cash, currency)}
              hint="Card and bank transfer"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, vendor, notes…"
              className="w-full flex-1 min-w-[240px]"
            />
            <Select
              className="w-full sm:w-[180px]"
              value={category}
              onChange={(value) =>
                setCategory(value as ExpenseCategory | "all")
              }
              options={[
                { value: "all", label: "All categories" },
                ...Object.values(ExpenseCategory).map((value) => ({
                  value,
                  label: EXPENSE_CATEGORY_LABELS[value],
                })),
              ]}
            />
            <Select
              className="w-full sm:w-[180px]"
              value={paymentMethod}
              onChange={(value) =>
                setPaymentMethod(value as ExpensePaymentMethod | "all")
              }
              options={[
                { value: "all", label: "All payment methods" },
                ...Object.values(ExpensePaymentMethod).map((value) => ({
                  value,
                  label: EXPENSE_PAYMENT_LABELS[value],
                })),
              ]}
            />
            <DatePicker
              className="w-full sm:w-[150px]"
              value={fromDate ? dayjs(fromDate) : null}
              onChange={(value: Dayjs | null) =>
                setFromDate(value ? value.format("YYYY-MM-DD") : "")
              }
              placeholder="From date"
              allowClear
            />
            <DatePicker
              className="w-full sm:w-[150px]"
              value={toDate ? dayjs(toDate) : null}
              onChange={(value: Dayjs | null) =>
                setToDate(value ? value.format("YYYY-MM-DD") : "")
              }
              placeholder="To date"
              allowClear
            />
            {hasActiveFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-1.5 shrink-0"
                title="Clear All Filters"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          {loading ? (
            <AppLoader fullPage />
          ) : expenses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No expenses match these filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-secondary/40 text-left text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Vendor</th>
                      <th className="px-4 py-3 font-medium">Notes</th>
                      <th className="px-4 py-3 font-medium">By</th>
                      <th className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedExpenses.map((expense) => (
                      <tr key={expense.id} className="border-t border-border">
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          {formatDate(expense.expense_date)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{expense.title}</p>
                          {expense.cash_movement_id ? (
                            <p className="mt-0.5 text-xs text-primary">
                              Linked to cash drawer
                            </p>
                          ) : null}
                        </td>
                        <td className="money px-4 py-3 font-medium">
                          {formatMoney(expense.amount, currency)}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {formatExpenseCategory(expense.category)}
                        </td>
                        <td className="px-4 py-3 capitalize">
                          {formatExpensePaymentMethod(expense.payment_method)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expense.vendor_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expense.notes?.trim() ? expense.notes.trim() : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {expense.recorded_by_name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title="Edit"
                              aria-label="Edit"
                              disabled={Boolean(expense.cash_movement_id)}
                              onClick={() => openEdit(expense)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8 text-destructive hover:text-destructive"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => {
                                setDeleteTarget(expense);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                from={from}
                to={to}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <ExpenseEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
        userId={userId}
        authId={authId}
        locationId={selectedLocationId}
        expense={editing}
        onSaved={() => void refresh()}
      />

      <ConfirmModal
        open={deleteOpen}
        title={
          deleteTarget ? `Delete ${deleteTarget.title}?` : "Delete expense?"
        }
        description={
          deleteTarget?.cash_movement_id
            ? "If the linked cash drawer is still open, the cash-out movement will be removed too."
            : "This cannot be undone."
        }
        confirmText="Delete"
        danger
        confirmLoading={deleteLoading}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
