import type { SupabaseClient } from '@supabase/supabase-js'
import type { SalaryPayment } from '@/types/interfaces'
import { SalaryPayBasis } from '@/types/enums'

export function currentSalaryPeriodKey(
  basis: SalaryPayBasis | string,
  date = new Date()
): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  if (basis === SalaryPayBasis.DAILY) {
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return `${year}-${month}`
}

export function salaryPeriodLabel(
  basis: SalaryPayBasis | string,
  periodKey: string
): string {
  if (basis === SalaryPayBasis.DAILY) {
    const [y, m, d] = periodKey.split('-')
    return `${d}-${m}-${String(y).slice(-2)}`
  }
  const [y, m] = periodKey.split('-')
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const monthIndex = Number(m) - 1
  return `${monthNames[monthIndex] ?? m} ${y}`
}

export async function fetchShopSalaryPayBasis(
  supabase: SupabaseClient,
  userId: string
): Promise<SalaryPayBasis> {
  const { data, error } = await supabase
    .from('users')
    .select('salary_pay_basis')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const basis = data?.salary_pay_basis
  return basis === SalaryPayBasis.DAILY
    ? SalaryPayBasis.DAILY
    : SalaryPayBasis.MONTHLY
}

export async function fetchSalaryPaymentsForPeriod(
  supabase: SupabaseClient,
  userId: string,
  periodKey: string
): Promise<SalaryPayment[]> {
  const { data, error } = await supabase
    .from('salary_payments')
    .select('*')
    .eq('user_id', userId)
    .eq('period_key', periodKey)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data as SalaryPayment[]) ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount),
  }))
}

export async function payStaffSalary(
  supabase: SupabaseClient,
  input: {
    userId: string
    staffMemberId: string
    amount: number
    payBasis: SalaryPayBasis | string
    periodKey: string
    paidBy: string
    notes?: string | null
  }
) {
  if (input.amount <= 0) throw new Error('Salary amount must be greater than zero')

  const notes = input.notes?.trim() || null

  const { error } = await supabase.from('salary_payments').insert({
    user_id: input.userId,
    staff_member_id: input.staffMemberId,
    amount: input.amount,
    pay_basis: input.payBasis,
    period_key: input.periodKey,
    paid_by: input.paidBy,
    notes,
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error(
        input.payBasis === SalaryPayBasis.DAILY
          ? 'This staff member is already paid for today'
          : 'This staff member is already paid for this month'
      )
    }
    throw new Error(error.message)
  }
}
