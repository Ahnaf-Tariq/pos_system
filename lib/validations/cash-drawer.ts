import { z } from "zod";
import { CashMovementType } from "@/types/enums";

function toMoneyNumber(value: unknown) {
  if (value === "" || value == null) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

const moneyField = (label: string) =>
  z.preprocess(
    toMoneyNumber,
    z
      .number({ error: `Enter ${label}` })
      .min(0, `${label} cannot be negative`),
  );

const amountField = z.preprocess(
  toMoneyNumber,
  z
    .number({ error: "Enter amount" })
    .positive("Amount must be greater than 0"),
);

export const openDrawerSchema = z.object({
  opening_balance: moneyField("opening balance"),
});

export const closeDrawerSchema = z.object({
  closing_balance_actual: moneyField("actual cash counted"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const cashMovementSchema = z.object({
  type: z.enum([CashMovementType.CASH_IN, CashMovementType.CASH_OUT]),
  amount: amountField,
  reason: z.string().trim().max(240).optional().or(z.literal("")),
});

export type OpenDrawerInput = z.output<typeof openDrawerSchema>;
export type CloseDrawerInput = z.output<typeof closeDrawerSchema>;
export type CashMovementInput = z.output<typeof cashMovementSchema>;
export type OpenDrawerFormValues = z.input<typeof openDrawerSchema>;
export type CloseDrawerFormValues = z.input<typeof closeDrawerSchema>;
export type CashMovementFormValues = z.input<typeof cashMovementSchema>;
