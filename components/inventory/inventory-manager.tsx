"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchInventoryItems,
  fetchMenuItemsForRecipes,
} from "@/lib/inventory/catalog";
import type { InventoryItemView } from "@/types/interfaces";
import { useLocationContext } from "@/components/dashboard/location-provider";
import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { InventoryItemDialog } from "@/components/inventory/inventory-item-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { RecipeEditorDialog } from "@/components/inventory/recipe-editor-dialog";
import type { MenuItem } from "@/types/interfaces";
import { formatDate, formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AppLoader } from "@/components/ui/app-loader";
import { TablePagination } from "@/components/ui/table-pagination";

interface InventoryManagerProps {
  userId: string;
  currency: string;
}

export function InventoryManager({ userId, currency }: InventoryManagerProps) {
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [items, setItems] = useState<InventoryItemView[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemView | null>(
    null,
  );
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItemView | null>(null);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [recipeMenuItem, setRecipeMenuItem] = useState<MenuItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemView | null>(
    null,
  );

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!selectedLocationId) {
      setItems([]);
      setMenuItems([]);
      setLoading(false);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const supabase = createClient();
      const [inventory, menus] = await Promise.all([
        fetchInventoryItems(supabase, userId, selectedLocationId),
        fetchMenuItemsForRecipes(supabase, userId, selectedLocationId),
      ]);
      setItems(inventory);
      setMenuItems(menus);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load inventory";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtimeRefresh({
    userId,
    tables: ["inventory_items", "inventory_movements", "recipe_items"],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId),
  });

  const lowCount = useMemo(
    () => items.filter((item) => item.is_low).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (lowOnly && !item.is_low) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q)
      );
    });
  }, [items, lowOnly, query]);

  const {
    pageItems: pagedItems,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(visibleItems, {
    resetKey: `${query}|${lowOnly ? "low" : "all"}`,
  });

  async function confirmDeleteItem() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", userId);
    if (deleteError) {
      toast.error(deleteError.message);
    } else {
      toast.success("Ingredient deleted");
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
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stock for {selectedLocation?.name ?? "your location"} · recipes
            linked to menu items
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setItemDialogOpen(true);
            }}
            disabled={!selectedLocationId}
            size={"sm"}
          >
            <Plus className="size-4" />
            Add ingredient
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ingredients…"
          className="max-w-xs"
        />
        <Button
          type="button"
          variant={lowOnly ? "default" : "outline"}
          onClick={() => setLowOnly((value) => !value)}
        >
          <AlertTriangle className="size-4" />
          Low stock ({lowCount})
        </Button>
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">
          Select a location in the header.
        </p>
      ) : loading ? (
        <AppLoader fullPage />
      ) : visibleItems.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "No ingredients yet. Add your first stock item."
              : "No ingredients match this filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Ingredient</th>
                <th className="px-4 py-3 font-medium">On hand</th>
                <th className="px-4 py-3 font-medium">Reorder</th>
                <th className="px-4 py-3 font-medium">Cost/unit</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{item.name}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.quantity_on_hand} {item.unit}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {item.reorder_threshold} {item.unit}
                  </td>
                  <td className="px-4 py-3 money text-sm">
                    {formatMoney(item.cost_per_unit, currency)}
                  </td>
                  <td className="px-4 py-3">
                    {item.is_low ? (
                      <Badge variant="destructive">Low</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-8"
                        title="Adjust stock"
                        aria-label="Adjust stock"
                        onClick={() => {
                          setAdjustItem(item);
                          setAdjustOpen(true);
                        }}
                      >
                        <SlidersHorizontal className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title="Edit ingredient"
                        aria-label="Edit ingredient"
                        onClick={() => {
                          setEditingItem(item);
                          setItemDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        title="Delete ingredient"
                        aria-label="Delete ingredient"
                        onClick={() => {
                          setDeleteTarget(item);
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

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Recipes / BOM
          </h2>
          <p className="text-sm text-muted-foreground">
            Link ingredients to menu items so each sale can deduct stock later.
          </p>
        </div>

        {menuItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No menu items yet. Create items in Menu first.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((menuItem) => (
              <button
                key={menuItem.id}
                type="button"
                onClick={() => {
                  setRecipeMenuItem(menuItem);
                  setRecipeOpen(true);
                }}
                className="rounded-lg border border-border bg-card p-4 text-left transition hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{menuItem.name}</p>
                  {menuItem.track_inventory ? (
                    <Badge variant="outline">Tracking</Badge>
                  ) : (
                    <Badge variant="secondary">Off</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Tap to edit recipe ingredients
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedLocationId ? (
        <InventoryItemDialog
          open={itemDialogOpen}
          onOpenChange={setItemDialogOpen}
          userId={userId}
          locationId={selectedLocationId}
          item={editingItem}
          onSaved={() => void refresh()}
        />
      ) : null}

      <StockAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        userId={userId}
        item={adjustItem}
        onSaved={() => void refresh()}
      />

      <RecipeEditorDialog
        open={recipeOpen}
        onOpenChange={setRecipeOpen}
        userId={userId}
        menuItem={recipeMenuItem}
        inventoryItems={items}
        onSaved={() => void refresh()}
      />

      <ConfirmModal
        open={deleteOpen}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : "Delete item?"}
        description="Recipe links will be removed."
        confirmText="Delete"
        cancelText="Cancel"
        danger
        confirmLoading={deleteLoading}
        onConfirm={() => void confirmDeleteItem()}
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
