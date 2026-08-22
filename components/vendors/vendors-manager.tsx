"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchVendors } from "@/lib/vendors/catalog";
import type { Vendor } from "@/types/interfaces";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AppLoader } from "@/components/ui/app-loader";
import { TablePagination } from "@/components/ui/table-pagination";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { VendorEditorDialog } from "@/components/vendors/vendor-editor-dialog";

interface VendorsManagerProps {
  userId: string;
}

export function VendorsManager({ userId }: VendorsManagerProps) {
  const { selectedLocationId } = useLocationContext();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selectedLocationId) {
        setVendors([]);
        setLoading(false);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const supabase = createClient();
        setVendors(await fetchVendors(supabase, userId, selectedLocationId));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load vendors";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [userId, selectedLocationId],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["vendors"],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId),
  });

  const {
    pageItems: pagedVendors,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(vendors);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(vendor: Vendor) {
    setEditing(vendor);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("vendors")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success("Vendor deleted");
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
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your suppliers for each location.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          disabled={!selectedLocationId}
        >
          <Plus className="size-4" />
          Add vendor
        </Button>
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">
          Select a location in the header.
        </p>
      ) : loading ? (
        <AppLoader fullPage />
      ) : vendors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No vendors yet for this location.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedVendors.map((vendor) => (
                <tr key={vendor.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{vendor.name}</p>
                    {vendor.email?.trim() ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {vendor.email.trim()}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {vendor.phone}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(vendor.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title="Edit vendor"
                        aria-label="Edit vendor"
                        onClick={() => openEdit(vendor)}
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
                          setDeleteTarget(vendor);
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

      <VendorEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
        userId={userId}
        locationId={selectedLocationId}
        vendor={editing}
        onSaved={() => void refresh()}
      />

      <ConfirmModal
        open={deleteOpen}
        title={
          deleteTarget
            ? `Remove ${deleteTarget.name}?`
            : "Remove vendor?"
        }
        description="Restock history will keep the movement, but this vendor will be cleared from it."
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
