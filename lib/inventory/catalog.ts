import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryItem,
  InventoryItemView,
  InventoryMovement,
  MenuItem,
  RecipeItem,
  RecipeLineView,
} from "@/types/interfaces";

export async function fetchInventoryItems(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<InventoryItemView[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data as InventoryItem[]) ?? []).map((item) => ({
    ...item,
    quantity_on_hand: Number(item.quantity_on_hand),
    reorder_threshold: Number(item.reorder_threshold),
    cost_per_unit: Number(item.cost_per_unit),
    is_low: Number(item.quantity_on_hand) <= Number(item.reorder_threshold),
  }));
}

export async function fetchRecentMovements(
  supabase: SupabaseClient,
  userId: string,
  inventoryItemId: string,
  limit = 8,
): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("user_id", userId)
    .eq("inventory_item_id", inventoryItemId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data as InventoryMovement[]) ?? []).map((row) => ({
    ...row,
    change_qty: Number(row.change_qty),
  }));
}

export async function adjustStock({
  supabase,
  userId,
  item,
  changeQty,
  reason,
}: {
  supabase: SupabaseClient;
  userId: string;
  item: InventoryItem;
  changeQty: number;
  reason: string;
}) {
  const previousQty = Number(item.quantity_on_hand);
  const nextQty = previousQty + changeQty;
  if (nextQty < 0) throw new Error("Stock cannot go below zero");

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ quantity_on_hand: nextQty })
    .eq("id", item.id)
    .eq("user_id", userId);

  if (updateError) throw new Error(updateError.message);

  const { error: movementError } = await supabase
    .from("inventory_movements")
    .insert({
      user_id: userId,
      inventory_item_id: item.id,
      change_qty: changeQty,
      reason,
      reference_order_id: null,
    });

  if (movementError) throw new Error(movementError.message);

  const { notifyLowStockIfCrossed } =
    await import("@/lib/notifications/create");
  await notifyLowStockIfCrossed(supabase, {
    userId,
    locationId: item.location_id,
    inventoryItemId: item.id,
    name: item.name,
    previousQty,
    nextQty,
    reorderThreshold: Number(item.reorder_threshold),
    unit: item.unit,
  });

  return nextQty;
}

export async function fetchMenuItemsForRecipes(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data as MenuItem[]) ?? []).map((item) => ({
    ...item,
    price: Number(item.price),
  }));
}

export async function fetchRecipeLines(
  supabase: SupabaseClient,
  userId: string,
  menuItemId: string,
): Promise<RecipeLineView[]> {
  const { data, error } = await supabase
    .from("recipe_items")
    .select("*, inventory_items(name, unit)")
    .eq("user_id", userId)
    .eq("menu_item_id", menuItemId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const inventory = row.inventory_items as {
      name?: string;
      unit?: string;
    } | null;
    return {
      id: row.id,
      user_id: row.user_id,
      menu_item_id: row.menu_item_id,
      inventory_item_id: row.inventory_item_id,
      quantity_required: Number(row.quantity_required),
      inventory_name: inventory?.name ?? "Ingredient",
      inventory_unit: inventory?.unit ?? "",
      created_at: row.created_at,
    };
  });
}
