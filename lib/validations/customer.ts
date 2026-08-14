import { z } from 'zod'

export const customerSchema = z.object({
  full_name: z.string().min(2, 'Name is required').max(120),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  loyalty_points: z.number().min(0),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type CustomerInput = z.infer<typeof customerSchema>
