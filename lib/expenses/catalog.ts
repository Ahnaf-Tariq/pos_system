import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CashMovementType,
  CashSessionStatus,
  ExpenseCategory,
  ExpensePaymentMethod,
} from "@/types/enums";
import type { Expense, ExpenseListRow } from "@/types/interfaces";
import type { ExpenseInput } from "@/lib/validations/expense";
import {
  getOpenCashSessionId,
} from "@/lib/cash-drawer/catalog";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.RENT]: "Rent",
  [ExpenseCategory.UTILITIES]: "Utilities",
  [ExpenseCategory.SUPPLIES]: "Supplies",
  [ExpenseCategory.PAYROLL]: "Payroll",
  [ExpenseCategory.MARKETING]: "Marketing",
  [ExpenseCategory.MAINTENANCE]: "Maintenance",
  [ExpenseCategory.FOOD_COST]: "Food cost",
  [ExpenseCategory.TRANSPORT]: "Transport",
  [ExpenseCategory.OTHER]: "Other",
};

export const EXPENSE_PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  [ExpensePaymentMethod.CASH]: "Cash",
  [ExpensePaymentMethod.CARD]: "Card",
  [ExpensePaymentMethod.BANK_TRANSFER]: "Bank transfer",
};

export function formatExpenseCategory(category: string): string {
  return (
    EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ??
    category.replaceAll("_", " ")
  );
}

export function formatExpensePaymentMethod(method: string): string {
  return (
    EXPENSE_PAYMENT_LABELS[method as ExpensePaymentMethod] ??
    method.replaceAll("_", " ")
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function asExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    location_id: row.location_id as string,
    recorded_by: row.recorded_by as string,
    vendor_id: (row.vendor_id as string | null) ?? null,
    title: row.title as string,
    amount: Number(row.amount ?? 0),
    category: row.category as string,
    payment_method: row.payment_method as string,
    expense_date: row.expense_date as string,
    notes: (row.notes as string | null) ?? null,
    cash_session_id: (row.cash_session_id as string | null) ?? null,
    cash_movement_id: (row.cash_movement_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

async function staffNameByAuthId(
  supabase: SupabaseClient,
  userId: string,
  authIds: string[],
) {
  const unique = [...new Set(authIds.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const { data: staff } = await supabase
    .from("staff_members")
    .select("auth_id, full_name")
    .eq("user_id", userId)
    .in("auth_id", unique);

  for (const member of staff ?? []) {
    const authId = member.auth_id as string | null;
    const name = (member.full_name as string | null)?.trim();
    if (authId && name) names.set(authId, name);
  }

  const missing = unique.filter((id) => !names.has(id));
  if (missing.length === 0) return names;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", missing);

  for (const profile of profiles ?? []) {
    const name = (profile.full_name as string | null)?.trim();
    if (name) names.set(profile.id as string, name);
  }

  return names;
}

export async function fetchExpenses(
  supabase: SupabaseClient,
  userId: string,
  filters: {
    locationId: string;
    category?: ExpenseCategory | "all";
    paymentMethod?: ExpensePaymentMethod | "all";
    fromDate?: string;
    toDate?: string;
    search?: string;
  },
): Promise<ExpenseListRow[]> {
  let query = supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("location_id", filters.locationId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.paymentMethod && filters.paymentMethod !== "all") {
    query = query.eq("payment_method", filters.paymentMethod);
  }
  if (filters.fromDate) query = query.gte("expense_date", filters.fromDate);
  if (filters.toDate) query = query.lte("expense_date", filters.toDate);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const expenses = ((data as Record<string, unknown>[]) ?? []).map(asExpense);
  if (expenses.length === 0) return [];

  const vendorIds = [
    ...new Set(
      expenses
        .map((expense) => expense.vendor_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const authIds = expenses.map((expense) => expense.recorded_by);

  const [{ data: vendors }, names] = await Promise.all([
    vendorIds.length
      ? supabase.from("vendors").select("id, name").in("id", vendorIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    staffNameByAuthId(supabase, userId, authIds),
  ]);

  const vendorNameById = new Map(
    (vendors ?? []).map((vendor) => [vendor.id, vendor.name]),
  );

  let rows: ExpenseListRow[] = expenses.map((expense) => ({
    ...expense,
    vendor_name: expense.vendor_id
      ? (vendorNameById.get(expense.vendor_id) ?? null)
      : null,
    recorded_by_name: names.get(expense.recorded_by) ?? "Staff",
  }));

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.title.toLowerCase().includes(search) ||
        (row.notes ?? "").toLowerCase().includes(search) ||
        (row.vendor_name ?? "").toLowerCase().includes(search) ||
        formatExpenseCategory(row.category).toLowerCase().includes(search),
    );
  }

  return rows;
}

async function createCashOutForExpense(
  supabase: SupabaseClient,
  input: {
    userId: string;
    locationId: string;
    amount: number;
    title: string;
  },
): Promise<{ sessionId: string; movementId: string } | null> {
  const sessionId = await getOpenCashSessionId(
    supabase,
    input.userId,
    input.locationId,
  );
  if (!sessionId) return null;

  const { data: session, error: sessionError } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", sessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.status !== CashSessionStatus.OPEN) return null;

  const { data: movement, error } = await supabase
    .from("cash_movements")
    .insert({
      session_id: sessionId,
      user_id: input.userId,
      type: CashMovementType.CASH_OUT,
      amount: roundMoney(input.amount),
      reason: `Expense: ${input.title}`,
    })
    .select("id")
    .single();

  if (error || !movement) throw new Error(error?.message ?? "Cash out failed");

  return { sessionId, movementId: movement.id as string };
}

export async function createExpense(
  supabase: SupabaseClient,
  input: {
    userId: string;
    locationId: string;
    recordedBy: string;
    values: ExpenseInput;
  },
) {
  const amount = roundMoney(Number(input.values.amount));
  let cashSessionId: string | null = null;
  let cashMovementId: string | null = null;

  if (input.values.payment_method === ExpensePaymentMethod.CASH) {
    const linked = await createCashOutForExpense(supabase, {
      userId: input.userId,
      locationId: input.locationId,
      amount,
      title: input.values.title.trim(),
    });
    if (linked) {
      cashSessionId = linked.sessionId;
      cashMovementId = linked.movementId || null;
    }
  }

  const { error } = await supabase.from("expenses").insert({
    user_id: input.userId,
    location_id: input.locationId,
    recorded_by: input.recordedBy,
    vendor_id: input.values.vendor_id || null,
    title: input.values.title.trim(),
    amount,
    category: input.values.category,
    payment_method: input.values.payment_method,
    expense_date: input.values.expense_date,
    notes: input.values.notes?.trim() || null,
    cash_session_id: cashSessionId,
    cash_movement_id: cashMovementId,
  });

  if (error) throw new Error(error.message);
}

export async function updateExpense(
  supabase: SupabaseClient,
  input: {
    userId: string;
    expenseId: string;
    values: ExpenseInput;
  },
) {
  const { data: existing, error: loadError } = await supabase
    .from("expenses")
    .select("id, cash_movement_id, payment_method")
    .eq("id", input.expenseId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Expense not found");

  if (existing.cash_movement_id) {
    throw new Error(
      "Cash expenses linked to the drawer cannot be edited. Delete and re-add instead.",
    );
  }

  const { error } = await supabase
    .from("expenses")
    .update({
      vendor_id: input.values.vendor_id || null,
      title: input.values.title.trim(),
      amount: roundMoney(Number(input.values.amount)),
      category: input.values.category,
      payment_method: input.values.payment_method,
      expense_date: input.values.expense_date,
      notes: input.values.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.expenseId)
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
}

export async function deleteExpense(
  supabase: SupabaseClient,
  input: { userId: string; expenseId: string },
) {
  const { data: existing, error: loadError } = await supabase
    .from("expenses")
    .select("id, cash_movement_id, cash_session_id")
    .eq("id", input.expenseId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error("Expense not found");

  if (existing.cash_movement_id && existing.cash_session_id) {
    const { data: session } = await supabase
      .from("cash_sessions")
      .select("status")
      .eq("id", existing.cash_session_id)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (session?.status === CashSessionStatus.OPEN) {
      await supabase
        .from("cash_movements")
        .delete()
        .eq("id", existing.cash_movement_id)
        .eq("user_id", input.userId);
    }
  }

  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", input.expenseId)
    .eq("user_id", input.userId);

  if (error) throw new Error(error.message);
}
