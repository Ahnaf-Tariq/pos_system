"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchRecipeLines } from "@/lib/inventory/catalog";
import type { InventoryItem, MenuItem, RecipeLineView } from "@/types/interfaces";
import { Select } from "antd";
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

interface RecipeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  menuItem: MenuItem | null;
  inventoryItems: InventoryItem[];
  onSaved: () => void;
}

export function RecipeEditorDialog({
  open,
  onOpenChange,
  userId,
  menuItem,
  inventoryItems,
  onSaved,
}: RecipeEditorDialogProps) {
  const [lines, setLines] = useState<RecipeLineView[]>([]);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantityRequired, setQuantityRequired] = useState("1");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !menuItem) return;
    setInventoryItemId(inventoryItems[0]?.id ?? "");
    setQuantityRequired("1");

    void (async () => {
      const supabase = createClient();
      const rows = await fetchRecipeLines(supabase, userId, menuItem.id);
      setLines(rows);
    })();
  }, [open, menuItem, userId, inventoryItems]);

  async function addLine() {
    if (!menuItem || !inventoryItemId) return;
    const qty = Number(quantityRequired);
    if (!qty || qty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("recipe_items").insert({
      user_id: userId,
      menu_item_id: menuItem.id,
      inventory_item_id: inventoryItemId,
      quantity_required: qty,
    });
    setBusy(false);

    if (insertError) {
      toast.error(insertError.message);
      return;
    }

    const rows = await fetchRecipeLines(supabase, userId, menuItem.id);
    setLines(rows);
    toast.success("Recipe line added");
    onSaved();
  }

  async function removeLine(id: string) {
    if (!menuItem) return;
    setBusy(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("recipe_items")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    setBusy(false);
    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }
    const rows = await fetchRecipeLines(supabase, userId, menuItem.id);
    setLines(rows);
    toast.success("Recipe line removed");
    onSaved();
  }

  async function enableTracking() {
    if (!menuItem) return;
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({ track_inventory: true })
      .eq("id", menuItem.id)
      .eq("user_id", userId);
    setBusy(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    toast.success("Stock tracking enabled");
    onSaved();
  }

  if (!menuItem) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recipe · {menuItem.name}</DialogTitle>
          <DialogDescription>
            Ingredients consumed per sale. Used when stock tracking is enabled.
          </DialogDescription>
        </DialogHeader>

        {!menuItem.track_inventory ? (
          <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
            <p className="text-muted-foreground">
              This menu item does not track inventory yet.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              disabled={busy}
              onClick={() => void enableTracking()}
            >
              Enable stock tracking
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recipe lines yet.
            </p>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{line.inventory_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.quantity_required} {line.inventory_unit} per sale
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => void removeLine(line.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_100px_auto]">
          <div className="space-y-2">
            <Label htmlFor="ingredient">Ingredient</Label>
            <Select
              id="ingredient"
              className="w-full"
              value={inventoryItemId || undefined}
              placeholder="No ingredients yet"
              disabled={inventoryItems.length === 0}
              onChange={(value) => setInventoryItemId(value)}
              options={inventoryItems.map((item) => ({
                value: item.id,
                label: `${item.name} (${item.unit})`,
              }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Qty</Label>
            <Input
              id="qty"
              type="number"
              step="0.001"
              min="0"
              value={quantityRequired}
              onChange={(event) => setQuantityRequired(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={busy || !inventoryItemId}
              onClick={() => void addLine()}
              size={"sm"}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
