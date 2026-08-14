import { z } from 'zod'
import { StaffRole } from '@/types/enums'

export const inviteStaffSchema = z.object({
  email: z.string().email('Enter a valid email'),
  fullName: z.string().min(2, 'Name is required'),
  phone: z.string().trim().max(30, 'Phone is too long').optional().or(z.literal('')),
  role: z.enum([
    StaffRole.OWNER,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
  ]),
  locationId: z.string().uuid('Pick one location'),
  salary: z.number().min(0, 'Salary cannot be negative'),
})

export type InviteStaffInput = z.output<typeof inviteStaffSchema>
export type InviteStaffFormValues = z.input<typeof inviteStaffSchema>

export const editStaffSchema = z.object({
  fullName: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  phone: z.string().trim().max(30, 'Phone is too long').optional().or(z.literal('')),
  role: z.enum([
    StaffRole.OWNER,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
  ]),
  locationId: z.string().uuid('Pick one location'),
  salary: z.number().min(0, 'Salary cannot be negative'),
})

export type EditStaffInput = z.infer<typeof editStaffSchema>

export const updateStaffSchema = z.object({
  staffMemberId: z.string().uuid(),
  role: z.enum([
    StaffRole.OWNER,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
  ]),
  locationId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  salary: z.number().min(0).optional(),
})

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>

