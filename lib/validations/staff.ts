import { z } from "zod";
import { StaffRole } from "@/types/enums";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\d{1,13}$/, "Enter a phone number");

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal(""));

const salarySchema = z
  .union([z.number(), z.nan(), z.undefined(), z.null(), z.literal("")])
  .transform((value) => {
    if (value === "" || value == null || Number.isNaN(value)) return undefined;
    return value;
  })
  .pipe(
    z
      .number({ error: "Enter salary" })
      .min(0, "Salary cannot be negative"),
  );

export const inviteStaffSchema = z.object({
  email: emailSchema,
  fullName: z.string().min(2, "Name is required"),
  phone: phoneSchema,
  role: z.enum([
    StaffRole.OWNER,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
  ]),
  locationId: z.string().uuid("Pick one location"),
  salary: salarySchema,
});

export type InviteStaffInput = z.output<typeof inviteStaffSchema>;
export type InviteStaffFormValues = z.input<typeof inviteStaffSchema>;

export const editStaffSchema = z.object({
  fullName: z.string().min(2, "Name is required"),
  email: emailSchema,
  phone: phoneSchema,
  role: z.enum([
    StaffRole.OWNER,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
  ]),
  locationId: z.string().uuid("Pick one location"),
  salary: salarySchema,
});

export type EditStaffInput = z.infer<typeof editStaffSchema>;

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
});

export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
