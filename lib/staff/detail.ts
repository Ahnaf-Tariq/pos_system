import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SalaryPayment,
  StaffDetailData,
  StaffMemberView,
  StaffSalaryRow,
} from "@/types/interfaces";
import {
  currentSalaryPeriodKey,
  salaryPeriodLabel,
} from "@/lib/staff/salary";
import { SalaryPayBasis } from "@/types/enums";

export async function fetchStaffMemberById(
  supabase: SupabaseClient,
  userId: string,
  staffId: string,
): Promise<StaffMemberView | null> {
  const { data, error } = await supabase
    .from("staff_members")
    .select("*")
    .eq("user_id", userId)
    .eq("id", staffId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  let locationName: string | null = null;
  if (data.location_id) {
    const { data: location } = await supabase
      .from("locations")
      .select("name")
      .eq("id", data.location_id)
      .maybeSingle();
    locationName = location?.name ?? null;
  }

  let fullName = (data.full_name as string | null)?.trim() || null;
  let phone = (data.phone as string | null)?.trim() || null;
  let email = (data.email as string | null)?.trim() || null;

  if (!fullName || !email) {
    const withEmail = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", data.auth_id)
      .maybeSingle();

    const profile =
      withEmail.error && /email/i.test(withEmail.error.message)
        ? (
            await supabase
              .from("profiles")
              .select("full_name, phone")
              .eq("id", data.auth_id)
              .maybeSingle()
          ).data
        : withEmail.data;

    fullName = fullName || profile?.full_name || null;
    phone = phone || profile?.phone || null;
    email =
      email ||
      ("email" in (profile ?? {})
        ? ((profile as { email?: string | null }).email ?? null)
        : null);
  }

  return {
    ...(data as StaffMemberView),
    salary: Number(data.salary ?? 0),
    full_name: fullName,
    phone,
    email,
    location_name: locationName,
  };
}

export function buildStaffSalaryRows({
  payments,
  payBasis,
  now = new Date(),
}: {
  payments: SalaryPayment[];
  payBasis: SalaryPayBasis | string;
  now?: Date;
}): StaffSalaryRow[] {
  const currentKey = currentSalaryPeriodKey(payBasis, now);
  const paidByPeriod = new Map(
    payments.map((payment) => [payment.period_key, payment]),
  );

  const rows: StaffSalaryRow[] = payments.map((payment) => ({
    key: payment.id,
    periodKey: payment.period_key,
    periodLabel: salaryPeriodLabel(payment.pay_basis, payment.period_key),
    amount: Number(payment.amount),
    createdAt: payment.created_at,
    status: "paid",
    notes: payment.notes,
    paymentId: payment.id,
  }));

  if (!paidByPeriod.has(currentKey)) {
    rows.unshift({
      key: `pending-${currentKey}`,
      periodKey: currentKey,
      periodLabel: salaryPeriodLabel(payBasis, currentKey),
      amount: null,
      createdAt: null,
      status: "pending",
      notes: null,
      paymentId: null,
    });
  }

  rows.sort((a, b) => {
    if (a.periodKey === b.periodKey) return 0;
    return a.periodKey < b.periodKey ? 1 : -1;
  });

  return rows;
}

export async function fetchStaffDetail(
  supabase: SupabaseClient,
  userId: string,
  staffId: string,
  payBasis: SalaryPayBasis | string = SalaryPayBasis.MONTHLY,
): Promise<StaffDetailData | null> {
  const member = await fetchStaffMemberById(supabase, userId, staffId);
  if (!member) return null;

  const { data: payments, error: paymentsError } = await supabase
    .from("salary_payments")
    .select("*")
    .eq("user_id", userId)
    .eq("staff_member_id", staffId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (paymentsError) throw new Error(paymentsError.message);

  const salaryPayments: SalaryPayment[] = (
    (payments as SalaryPayment[]) ?? []
  ).map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  const currentPeriodKey = currentSalaryPeriodKey(payBasis);
  const salaryRows = buildStaffSalaryRows({
    payments: salaryPayments,
    payBasis,
  });
  const currentPeriodPaid = salaryPayments.some(
    (payment) => payment.period_key === currentPeriodKey,
  );
  const salaryPaidTotal = salaryPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );

  return {
    member,
    salaryPayments,
    salaryRows,
    salaryPaidTotal,
    currentPeriodKey,
    currentPeriodPaid,
  };
}
