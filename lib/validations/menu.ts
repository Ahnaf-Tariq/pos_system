import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(80),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const menuItemSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(120),
  description: z.string().max(500).optional().or(z.literal('')),
  price: z.number().min(0, 'Price must be 0 or greater'),
  category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean(),
  track_inventory: z.boolean(),
  image_url: z.string().url().nullable().optional().or(z.literal('')),
})

export type MenuItemInput = z.infer<typeof menuItemSchema>

export const modifierGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(80),
  is_required: z.boolean(),
  min_select: z.number().int().min(0),
  max_select: z.number().int().min(1),
})

export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>

export const modifierSchema = z.object({
  name: z.string().min(1, 'Option name is required').max(80),
  price_delta: z.number(),
})

export type ModifierInput = z.infer<typeof modifierSchema>
