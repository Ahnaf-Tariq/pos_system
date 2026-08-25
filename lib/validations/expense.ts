import { z } from "zod";
import { ExpenseCategory, ExpensePaymentMethod } from "@/types/enums";

const amountField = z.preprocess(
  (value) => {
    if (value === "" || value == null) return undefined;
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  },
  z
    .number({ error: "Enter amount" })
    .positive("Amount must be greater than 0"),
);

export const expenseSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(160),
  amount: amountField,
  category: z.enum([
    ExpenseCategory.RENT,
    ExpenseCategory.UTILITIES,
    ExpenseCategory.SUPPLIES,
    ExpenseCategory.PAYROLL,
    ExpenseCategory.MARKETING,
    ExpenseCategory.MAINTENANCE,
    ExpenseCategory.FOOD_COST,
    ExpenseCategory.TRANSPORT,
    ExpenseCategory.OTHER,
  ]),
  payment_method: z.enum([
    ExpensePaymentMethod.CASH,
    ExpensePaymentMethod.CARD,
    ExpensePaymentMethod.BANK_TRANSFER,
  ]),
  expense_date: z.string().trim().min(1, "Pick a date"),
  vendor_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ExpenseInput = z.output<typeof expenseSchema>;
export type ExpenseFormValues = z.input<typeof expenseSchema>;
