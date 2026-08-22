import { z } from 'zod'

export const vendorSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\d{1,13}$/, 'Enter a phone number'),
  email: z
    .string()
    .trim()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
})

export type VendorInput = z.infer<typeof vendorSchema>
