"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchCustomerOrders,
  fetchCustomersWithStats,
} from "@/lib/customers/catalog";
import type { Customer, CustomerStats, Order } from "@/types/interfaces";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppLoader } from "@/components/ui/app-loader";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CustomerEditorDialog } from "@/components/customers/customer-editor-dialog";

interface CustomersManagerProps {
  userId: string;
  currency: string;
}

export function CustomersManager({ userId, currency }: CustomersManagerProps) {
  const [customers, setCustomers] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerStats | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<CustomerStats | null>(
    null,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerStats | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const supabase = createClient();
      setCustomers(await fetchCustomersWithStats(supabase, userId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load customers";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["customers", "orders"],
    onChange: () => void refresh({ silent: true }),
  });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (customer) =>
        customer.full_name.toLowerCase().includes(q) ||
        (customer.phone ?? "").toLowerCase().includes(q) ||
        (customer.email ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const {
    pageItems: pagedCustomers,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(visible, { resetKey: search });

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(customer: CustomerStats) {
    setEditing(customer);
    setEditorOpen(true);
  }

  async function openDetail(customer: CustomerStats) {
    setDetailCustomer(customer);
    setDetailOpen(true);
    const supabase = createClient();
    setOrders(await fetchCustomerOrders(supabase, userId, customer.id));
  }

  async function handleSaved(_customer: Customer) {
    await refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success("Customer deleted");
      setDeleteOpen(false);
      setDeleteTarget(null);
      await refresh();
    }
    setDeleteLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            CRM list with spend, loyalty points, and order history.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            Add customer
          </Button>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search name, phone, email…"
        className="max-w-sm"
      />

      {loading ? (
        <AppLoader fullPage />
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No customers yet. Add one or attach customers from POS.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Total spend</th>
                <th className="px-4 py-3 font-medium">Loyalty</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{customer.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {customer.phone || customer.email || "No contact"}
                    </p>
                  </td>
                  <td className="px-4 py-3">{customer.email || "-"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {customer.order_count}
                  </td>
                  <td className="px-4 py-3 money text-sm">
                    {formatMoney(customer.total_spend, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {customer.loyalty_points} pts
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(customer.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-8"
                        title="History"
                        aria-label="History"
                        onClick={() => void openDetail(customer)}
                      >
                        <History className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => openEdit(customer)}
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
                          setDeleteTarget(customer);
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

      <CustomerEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        userId={userId}
        customer={editing}
        showLoyalty
        onSaved={(customer) => void handleSaved(customer)}
      />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailCustomer?.full_name}</DialogTitle>
            <DialogDescription>
              {detailCustomer?.phone ||
                detailCustomer?.email ||
                "Order history"}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {orders.length === 0 ? (
              <li className="text-sm text-muted-foreground">No orders yet.</li>
            ) : (
              orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p>{formatDateTime(order.created_at)}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {order.status.replaceAll("_", " ")} ·{" "}
                      {order.order_type.replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="money text-xs">
                    {formatMoney(order.grand_total, currency)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteOpen}
        title={
          deleteTarget
            ? `Delete ${deleteTarget.full_name}?`
            : "Delete customer?"
        }
        confirmText="Delete"
        cancelText="Cancel"
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
