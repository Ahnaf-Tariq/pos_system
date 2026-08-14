import type { SupabaseClient } from '@supabase/supabase-js'
import type { CartLineItem } from '@/types/interfaces'
import { InventoryMovementReason } from '@/types/enums'

export class RecipeStockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecipeStockError'
  }
}

interface RecipeStockLine {
  id: string
  name: string
  unit: string
  required: number
  onHand: number
  reorderThreshold: number
}

function formatQty(value: number) {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(2)))
}

async function loadRecipeStockLines({
  supabase,
  userId,
  locationId,
  items,
}: {
  supabase: SupabaseClient
  userId: string
  locationId: string
  items: CartLineItem[]
}): Promise<RecipeStockLine[]> {
  const menuItemIds = [...new Set(items.map((item) => item.menu_item_id))]
  if (menuItemIds.length === 0) return []

  const { data: menuRows, error: menuError } = await supabase
    .from('menu_items')
    .select('id, track_inventory')
    .eq('user_id', userId)
    .in('id', menuItemIds)

  if (menuError) throw new Error(menuError.message)

  const trackedIds = new Set(
    (menuRows ?? [])
      .filter((row) => row.track_inventory)
      .map((row) => row.id as string)
  )
  if (trackedIds.size === 0) return []

  const { data: recipes, error: recipeError } = await supabase
    .from('recipe_items')
    .select('menu_item_id, inventory_item_id, quantity_required')
    .eq('user_id', userId)
    .in('menu_item_id', [...trackedIds])

  if (recipeError) throw new Error(recipeError.message)
  if (!recipes?.length) return []

  const qtyByMenu = new Map<string, number>()
  for (const item of items) {
    if (!trackedIds.has(item.menu_item_id)) continue
    qtyByMenu.set(
      item.menu_item_id,
      (qtyByMenu.get(item.menu_item_id) ?? 0) + item.quantity
    )
  }

  const deductionByInventory = new Map<string, number>()
  for (const recipe of recipes) {
    const soldQty = qtyByMenu.get(recipe.menu_item_id) ?? 0
    if (soldQty <= 0) continue
    const deduct = soldQty * Number(recipe.quantity_required)
    deductionByInventory.set(
      recipe.inventory_item_id,
      (deductionByInventory.get(recipe.inventory_item_id) ?? 0) + deduct
    )
  }

  if (deductionByInventory.size === 0) return []

  const inventoryIds = [...deductionByInventory.keys()]
  const { data: inventoryRows, error: inventoryError } = await supabase
    .from('inventory_items')
    .select('id, name, quantity_on_hand, reorder_threshold, location_id, unit')
    .eq('user_id', userId)
    .in('id', inventoryIds)

  if (inventoryError) throw new Error(inventoryError.message)

  return (inventoryRows ?? [])
    .filter((row) => row.location_id === locationId)
    .map((row) => ({
      id: row.id as string,
      name: (row.name as string) || 'Ingredient',
      unit: (row.unit as string) || '',
      required: deductionByInventory.get(row.id as string) ?? 0,
      onHand: Number(row.quantity_on_hand),
      reorderThreshold: Number(row.reorder_threshold),
    }))
    .filter((line) => line.required > 0)
}

export async function assertRecipeStockForCart({
  supabase,
  userId,
  locationId,
  items,
}: {
  supabase: SupabaseClient
  userId: string
  locationId: string
  items: CartLineItem[]
}) {
  const lines = await loadRecipeStockLines({
    supabase,
    userId,
    locationId,
    items,
  })
  const short = lines.filter((line) => line.onHand < line.required)
  if (short.length === 0) return

  const names = short.map((line) => line.name).join(', ')
  const details = short
    .map(
      (line) =>
        `${line.name}: need ${formatQty(line.required)} ${line.unit}, have ${formatQty(line.onHand)} ${line.unit}`.trim()
    )
    .join('; ')

  throw new RecipeStockError(
    `Can't complete this order — restock ${names} in Inventory (${details}).`
  )
}

/**
 * Deduct recipe ingredients for paid cart lines.
 * Skips if sale movements already exist for this order (idempotent).
 */
export async function deductRecipeStockForOrder({
  supabase,
  userId,
  locationId,
  orderId,
  items,
}: {
  supabase: SupabaseClient
  userId: string
  locationId: string
  orderId: string
  items: CartLineItem[]
}) {
  const { count } = await supabase
    .from('inventory_movements')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('reference_order_id', orderId)
    .eq('reason', InventoryMovementReason.SALE)

  if ((count ?? 0) > 0) return

  await assertRecipeStockForCart({ supabase, userId, locationId, items })

  const lines = await loadRecipeStockLines({
    supabase,
    userId,
    locationId,
    items,
  })
  if (lines.length === 0) return

  const { notifyLowStockIfCrossed } = await import('@/lib/notifications/create')

  for (const line of lines) {
    const previousQty = line.onHand
    const nextQty = previousQty - line.required
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity_on_hand: nextQty })
      .eq('id', line.id)
      .eq('user_id', userId)

    if (updateError) throw new Error(updateError.message)

    const { error: movementError } = await supabase.from('inventory_movements').insert({
      user_id: userId,
      inventory_item_id: line.id,
      change_qty: -line.required,
      reason: InventoryMovementReason.SALE,
      reference_order_id: orderId,
    })

    if (movementError) throw new Error(movementError.message)

    await notifyLowStockIfCrossed(supabase, {
      userId,
      locationId,
      inventoryItemId: line.id,
      name: line.name,
      previousQty,
      nextQty,
      reorderThreshold: line.reorderThreshold,
      unit: line.unit || undefined,
    })
  }
}

export async function awardLoyaltyPoints({
  supabase,
  userId,
  customerId,
  grandTotal,
}: {
  supabase: SupabaseClient
  userId: string
  customerId: string
  grandTotal: number
}) {
  // 1 point per 100 currency units spent
  const points = Math.floor(grandTotal / 100)
  if (points <= 0) return

  const { data: customer } = await supabase
    .from('customers')
    .select('loyalty_points')
    .eq('id', customerId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!customer) return

  await supabase
    .from('customers')
    .update({
      loyalty_points: Number(customer.loyalty_points) + points,
    })
    .eq('id', customerId)
    .eq('user_id', userId)
}
