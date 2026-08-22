import { z } from 'zod'
import { InventoryMovementReason } from '@/types/enums'

export const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  unit: z.string().min(1, 'Unit is required').max(40),
  quantity_on_hand: z.number().min(0),
  reorder_threshold: z.number().min(0),
  cost_per_unit: z.number().min(0),
  vendor_id: z.string().uuid().optional().or(z.literal('')),
})

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>

export const stockAdjustSchema = z.object({
  change_qty: z.number().refine((value) => value !== 0, 'Change cannot be zero'),
  reason: z.enum([
    InventoryMovementReason.RESTOCK,
    InventoryMovementReason.WASTE,
    InventoryMovementReason.ADJUSTMENT,
  ]),
  vendor_id: z.string().uuid().optional().or(z.literal('')),
})

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>

export const recipeLineSchema = z.object({
  inventory_item_id: z.string().uuid('Pick an ingredient'),
  quantity_required: z.number().positive('Quantity must be greater than 0'),
})

export type RecipeLineInput = z.infer<typeof recipeLineSchema>
