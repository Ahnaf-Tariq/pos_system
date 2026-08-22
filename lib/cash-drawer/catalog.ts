import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CashMovementType,
  CashSessionStatus,
  OrderStatus,
  PaymentMethod,
} from "@/types/enums";
import type {
  CashDrawerPageData,
  CashMovement,
  CashSession,
  CashSessionHistoryRow,
} from "@/types/interfaces";

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function asSession(row: Record<string, unknown>): CashSession {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    location_id: row.location_id as string,
    opened_by: row.opened_by as string,
    closed_by: (row.closed_by as string | null) ?? null,
    opened_at: row.opened_at as string,
    closed_at: (row.closed_at as string | null) ?? null,
    opening_balance: Number(row.opening_balance ?? 0),
    closing_balance_expected:
      row.closing_balance_expected == null
        ? null
        : Number(row.closing_balance_expected),
    closing_balance_actual:
      row.closing_balance_actual == null
        ? null
        : Number(row.closing_balance_actual),
    variance: row.variance == null ? null : Number(row.variance),
    notes: (row.notes as string | null) ?? null,
    status: (row.status as string) ?? CashSessionStatus.OPEN,
  };
}

export function expectedInDrawer(input: {
  openingBalance: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
}) {
  return roundMoney(
    input.openingBalance + input.cashSales + input.cashIn - input.cashOut,
  );
}

export async function getOpenCashSessionId(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .eq("status", CashSessionStatus.OPEN)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.id as string | undefined) ?? null;
}

export async function resolveCashSessionIdForPayment(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
  paymentMethod: string | null,
): Promise<string | null> {
  if (
    paymentMethod !== PaymentMethod.CASH &&
    paymentMethod !== PaymentMethod.CARD
  ) {
    return null;
  }
  return getOpenCashSessionId(supabase, userId, locationId);
}

async function staffLookupByAuthId(
  supabase: SupabaseClient,
  userId: string,
  authIds: string[],
) {
  const unique = [...new Set(authIds.filter(Boolean))];
  const names = new Map<string, string>();
  const staffIds = new Map<string, string>();
  if (unique.length === 0) return { names, staffIds };

  const { data: staff } = await supabase
    .from("staff_members")
    .select("id, auth_id, full_name")
    .eq("user_id", userId)
    .in("auth_id", unique);

  for (const member of staff ?? []) {
    const authId = member.auth_id as string | null;
    if (!authId) continue;
    staffIds.set(authId, member.id as string);
    const name = (member.full_name as string | null)?.trim();
    if (name) names.set(authId, name);
  }

  const missing = unique.filter((id) => !names.has(id));
  if (missing.length === 0) return { names, staffIds };

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", missing);

  for (const profile of profiles ?? []) {
    const name = (profile.full_name as string | null)?.trim();
    if (name) names.set(profile.id as string, name);
  }

  return { names, staffIds };
}

async function cashSalesBySession(
  supabase: SupabaseClient,
  userId: string,
  sessionIds: string[],
) {
  const totals = new Map<string, number>();
  if (sessionIds.length === 0) return totals;

  const { data, error } = await supabase
    .from("orders")
    .select("cash_session_id, grand_total, status, payment_method")
    .eq("user_id", userId)
    .in("cash_session_id", sessionIds)
    .in("payment_method", [PaymentMethod.CASH, PaymentMethod.CARD])
    .neq("status", OrderStatus.VOID);

  if (error) throw new Error(error.message);

  for (const order of data ?? []) {
    const sessionId = order.cash_session_id as string | null;
    if (!sessionId) continue;
    totals.set(
      sessionId,
      roundMoney(
        (totals.get(sessionId) ?? 0) + Number(order.grand_total ?? 0),
      ),
    );
  }

  return totals;
}

async function movementTotalsBySession(
  supabase: SupabaseClient,
  sessionIds: string[],
) {
  const totals = new Map<string, { cashIn: number; cashOut: number }>();
  if (sessionIds.length === 0) return totals;

  const { data, error } = await supabase
    .from("cash_movements")
    .select("session_id, type, amount")
    .in("session_id", sessionIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const sessionId = row.session_id as string;
    const current = totals.get(sessionId) ?? { cashIn: 0, cashOut: 0 };
    const amount = Number(row.amount ?? 0);
    if (row.type === CashMovementType.CASH_IN) current.cashIn += amount;
    if (row.type === CashMovementType.CASH_OUT) current.cashOut += amount;
    totals.set(sessionId, {
      cashIn: roundMoney(current.cashIn),
      cashOut: roundMoney(current.cashOut),
    });
  }

  return totals;
}

function toHistoryRow(
  session: CashSession,
  names: Map<string, string>,
  staffIds: Map<string, string>,
  cashSales: number,
  cashIn: number,
  cashOut: number,
): CashSessionHistoryRow {
  const liveExpected = expectedInDrawer({
    openingBalance: session.opening_balance,
    cashSales,
    cashIn,
    cashOut,
  });
  const expected =
    session.status === CashSessionStatus.CLOSED &&
    session.closing_balance_expected != null
      ? session.closing_balance_expected
      : liveExpected;

  return {
    ...session,
    opened_by_name: names.get(session.opened_by) ?? "Staff",
    opened_by_staff_id: staffIds.get(session.opened_by) ?? null,
    closed_by_name: session.closed_by
      ? (names.get(session.closed_by) ?? "Staff")
      : null,
    closed_by_staff_id: session.closed_by
      ? (staffIds.get(session.closed_by) ?? null)
      : null,
    cash_sales: cashSales,
    cash_in_total: cashIn,
    cash_out_total: cashOut,
    expected_in_drawer: expected,
  };
}

export async function fetchCashDrawerPage(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
): Promise<CashDrawerPageData> {
  const { data: sessionRows, error: sessionError } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("location_id", locationId)
    .order("opened_at", { ascending: false });

  if (sessionError) throw new Error(sessionError.message);

  const sessions = ((sessionRows as Record<string, unknown>[]) ?? []).map(
    asSession,
  );
  const sessionIds = sessions.map((session) => session.id);
  const authIds = sessions.flatMap((session) =>
    [session.opened_by, session.closed_by].filter(
      (id): id is string => Boolean(id),
    ),
  );

  const [lookup, sales, movementsTotals] = await Promise.all([
    staffLookupByAuthId(supabase, userId, authIds),
    cashSalesBySession(supabase, userId, sessionIds),
    movementTotalsBySession(supabase, sessionIds),
  ]);

  const history = sessions.map((session) => {
    const movement = movementsTotals.get(session.id) ?? {
      cashIn: 0,
      cashOut: 0,
    };
    return toHistoryRow(
      session,
      lookup.names,
      lookup.staffIds,
      sales.get(session.id) ?? 0,
      movement.cashIn,
      movement.cashOut,
    );
  });

  const openSession =
    history.find((session) => session.status === CashSessionStatus.OPEN) ??
    null;

  let movements: CashMovement[] = [];
  if (openSession) {
    const { data: movementRows, error: movementError } = await supabase
      .from("cash_movements")
      .select("*")
      .eq("session_id", openSession.id)
      .order("created_at", { ascending: false });

    if (movementError) throw new Error(movementError.message);
    movements = ((movementRows as CashMovement[]) ?? []).map((row) => ({
      ...row,
      amount: Number(row.amount ?? 0),
    }));
  }

  return { openSession, movements, history };
}

export async function openCashSession(
  supabase: SupabaseClient,
  input: {
    userId: string;
    locationId: string;
    openedBy: string;
    openingBalance: number;
  },
) {
  const existing = await getOpenCashSessionId(
    supabase,
    input.userId,
    input.locationId,
  );
  if (existing) {
    throw new Error("A cash drawer is already open for this location");
  }

  const { error } = await supabase.from("cash_sessions").insert({
    user_id: input.userId,
    location_id: input.locationId,
    opened_by: input.openedBy,
    opening_balance: roundMoney(input.openingBalance),
    status: CashSessionStatus.OPEN,
  });

  if (error) throw new Error(error.message);
}

export async function closeCashSession(
  supabase: SupabaseClient,
  input: {
    userId: string;
    sessionId: string;
    closedBy: string;
    expected: number;
    actual: number;
    notes?: string;
  },
) {
  const { data: session, error: loadError } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!session) throw new Error("Session not found");
  if (session.status !== CashSessionStatus.OPEN) {
    throw new Error("This session is already closed");
  }

  const expected = roundMoney(input.expected);
  const actual = roundMoney(input.actual);
  const { error } = await supabase
    .from("cash_sessions")
    .update({
      status: CashSessionStatus.CLOSED,
      closed_by: input.closedBy,
      closed_at: new Date().toISOString(),
      closing_balance_expected: expected,
      closing_balance_actual: actual,
      variance: roundMoney(actual - expected),
      notes: input.notes?.trim() || null,
    })
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .eq("status", CashSessionStatus.OPEN);

  if (error) throw new Error(error.message);
}

export async function addCashMovement(
  supabase: SupabaseClient,
  input: {
    userId: string;
    sessionId: string;
    type: CashMovementType;
    amount: number;
    reason?: string;
  },
) {
  const { data: session, error: loadError } = await supabase
    .from("cash_sessions")
    .select("id, status")
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!session) throw new Error("Session not found");
  if (session.status !== CashSessionStatus.OPEN) {
    throw new Error("Closed sessions cannot take cash movements");
  }

  const { error } = await supabase.from("cash_movements").insert({
    session_id: input.sessionId,
    user_id: input.userId,
    type: input.type,
    amount: roundMoney(input.amount),
    reason: input.reason?.trim() || null,
  });

  if (error) throw new Error(error.message);
}
