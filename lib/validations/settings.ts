import { z } from 'zod'
import { BusinessType, SalaryPayBasis } from '@/types/enums'

export const businessProfileSchema = z.object({
  business_name: z.string().min(2, 'Business name is required').max(120),
  business_type: z.enum([BusinessType.RESTAURANT, BusinessType.RETAIL]),
  timezone: z.string().min(1, 'Timezone is required'),
  currency: z.string().min(3).max(3),
  tax_rate: z.number().min(0).max(100),
  salary_pay_basis: z.enum([SalaryPayBasis.MONTHLY, SalaryPayBasis.DAILY]),
})

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>

export const receiptSettingsSchema = z.object({
  receipt_footer: z.string().max(500).optional().or(z.literal('')),
  receipt_logo_url: z.string().url().nullable().optional().or(z.literal('')),
})

export type ReceiptSettingsInput = z.infer<typeof receiptSettingsSchema>

export const locationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(80),
  address: z.string().max(200).optional().or(z.literal('')),
  is_active: z.boolean(),
  printer_name: z.string().max(80).optional().or(z.literal('')),
  printer_connection: z.enum(['browser', 'network', 'usb']),
  printer_address: z.string().max(120).optional().or(z.literal('')),
})

export type LocationInput = z.infer<typeof locationSchema>

export const TIMEZONES = [
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Riyadh',
  'Europe/London',
  'America/New_York',
  'UTC',
] as const

export const CURRENCIES = ['PKR', 'USD', 'AED', 'SAR', 'INR', 'EUR', 'GBP'] as const
