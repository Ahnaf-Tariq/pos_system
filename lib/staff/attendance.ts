import type { SupabaseClient } from '@supabase/supabase-js'
import type { AttendancePeriodSummary, StaffAttendance } from '@/types/interfaces'
import { AttendanceStatus, SalaryPayBasis } from '@/types/enums'

export const ATTENDANCE_OPTIONS: Array<{
  status: AttendanceStatus
  label: string
}> = [
  { status: AttendanceStatus.PRESENT, label: 'Present' },
  { status: AttendanceStatus.ABSENT, label: 'Absent' },
  { status: AttendanceStatus.LEAVE, label: 'Leave' },
  { status: AttendanceStatus.HALF_DAY, label: 'Half-day' },
]

export function shopTodayKey(timezone: string, date = new Date()) {
  return shopDateKey(timezone, date)
}

export function shopDateKey(timezone: string, value: string | Date) {
  return new Date(value).toLocaleDateString('en-CA', {
    timeZone: timezone || 'Asia/Karachi',
  })
}

export function formatWorkDate(workDate: string) {
  const [year, month, day] = workDate.split('-')
  if (!year || !month || !day) return workDate
  return `${day}-${month}-${year.slice(-2)}`
}

export function attendanceStatusLabel(status: AttendanceStatus | string | null | undefined) {
  if (status === AttendanceStatus.PRESENT) return 'Present'
  if (status === AttendanceStatus.ABSENT) return 'Absent'
  if (status === AttendanceStatus.LEAVE) return 'Leave'
  if (status === AttendanceStatus.HALF_DAY) return 'Half-day'
  return 'Not marked'
}

export function attendanceStatusClass(status: AttendanceStatus | string | null | undefined) {
  if (status === AttendanceStatus.PRESENT)
    return 'border-primary/60 bg-primary/15 text-foreground'
  if (status === AttendanceStatus.ABSENT)
    return 'border-destructive/50 bg-destructive/15 text-foreground'
  if (status === AttendanceStatus.LEAVE)
    return 'border-warning/50 bg-warning/15 text-foreground'
  if (status === AttendanceStatus.HALF_DAY)
    return 'border-border bg-secondary text-foreground'
  return 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
}

export function monthRange(year: number, monthIndex: number) {
  const start = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const end = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end, lastDay }
}

export function monthsInRange(fromDate: string, toDate: string) {
  const months: Array<{ year: number; monthIndex: number }> = []
  let year = Number(fromDate.slice(0, 4))
  let monthIndex = Number(fromDate.slice(5, 7)) - 1
  const endYear = Number(toDate.slice(0, 4))
  const endMonthIndex = Number(toDate.slice(5, 7)) - 1
  while (year < endYear || (year === endYear && monthIndex <= endMonthIndex)) {
    months.push({ year, monthIndex })
    monthIndex += 1
    if (monthIndex > 11) {
      monthIndex = 0
      year += 1
    }
  }
  return months
}

export function summarizeAttendance({
  rows,
  fromDate,
  toDate,
}: {
  rows: StaffAttendance[]
  fromDate: string
  toDate: string
}): AttendancePeriodSummary {
  const byDate = new Map(rows.map((row) => [row.work_date, row.status]))
  let present = 0
  let halfDay = 0
  let absent = 0
  let leave = 0
  let unmarked = 0

  const cursor = new Date(`${fromDate}T00:00:00.000Z`)
  const end = new Date(`${toDate}T00:00:00.000Z`)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const status = byDate.get(key)
    if (status === AttendanceStatus.PRESENT) present += 1
    else if (status === AttendanceStatus.HALF_DAY) halfDay += 1
    else if (status === AttendanceStatus.ABSENT) absent += 1
    else if (status === AttendanceStatus.LEAVE) leave += 1
    else unmarked += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return {
    present,
    halfDay,
    absent,
    leave,
    unmarked,
    presentEquivalent: present + halfDay * 0.5,
  }
}

export function periodAttendanceWindow({
  payBasis,
  periodKey,
  todayKey,
  joinedKey,
}: {
  payBasis: SalaryPayBasis | string
  periodKey: string
  todayKey: string
  joinedKey?: string
}) {
  if (payBasis === SalaryPayBasis.DAILY)
    return { fromDate: periodKey, toDate: periodKey }

  const [year, month] = periodKey.split('-').map(Number)
  const { start, end } = monthRange(year, month - 1)
  const toDate = end > todayKey ? todayKey : end
  let fromDate = start > toDate ? toDate : start
  if (joinedKey && joinedKey > fromDate) fromDate = joinedKey
  return { fromDate, toDate }
}

export async function fetchAttendanceForDate(
  supabase: SupabaseClient,
  userId: string,
  workDate: string
) {
  const { data, error } = await supabase
    .from('staff_attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('work_date', workDate)

  if (error) throw new Error(error.message)
  return ((data as StaffAttendance[]) ?? []).map((row) => ({
    ...row,
    work_date: String(row.work_date).slice(0, 10),
  }))
}

export async function fetchAttendanceForStaffRange(
  supabase: SupabaseClient,
  userId: string,
  staffMemberId: string,
  fromDate: string,
  toDate: string
) {
  const { data, error } = await supabase
    .from('staff_attendance')
    .select('*')
    .eq('user_id', userId)
    .eq('staff_member_id', staffMemberId)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
    .order('work_date', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data as StaffAttendance[]) ?? []).map((row) => ({
    ...row,
    work_date: String(row.work_date).slice(0, 10),
  }))
}

export async function setStaffAttendance(
  supabase: SupabaseClient,
  input: {
    userId: string
    staffMemberId: string
    workDate: string
    status: AttendanceStatus
    markedBy: string
    currentStatus?: AttendanceStatus | null
    timezone: string
  }
) {
  const todayKey = shopTodayKey(input.timezone)
  if (input.workDate > todayKey)
    throw new Error('Cannot mark attendance for a future date')

  if (input.currentStatus === input.status) {
    const { error } = await supabase
      .from('staff_attendance')
      .delete()
      .eq('user_id', input.userId)
      .eq('staff_member_id', input.staffMemberId)
      .eq('work_date', input.workDate)

    if (error) throw new Error(error.message)
    return { cleared: true as const }
  }

  const { error } = await supabase.from('staff_attendance').upsert(
    {
      user_id: input.userId,
      staff_member_id: input.staffMemberId,
      work_date: input.workDate,
      status: input.status,
      marked_by: input.markedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,staff_member_id,work_date' }
  )

  if (error) throw new Error(error.message)
  return { cleared: false as const }
}

export async function markRemainingPresent(
  supabase: SupabaseClient,
  input: {
    userId: string
    staffMemberIds: string[]
    workDate: string
    markedBy: string
    timezone: string
  }
) {
  const todayKey = shopTodayKey(input.timezone)
  if (input.workDate > todayKey)
    throw new Error('Cannot mark attendance for a future date')
  if (input.staffMemberIds.length === 0) return

  const { error } = await supabase.from('staff_attendance').upsert(
    input.staffMemberIds.map((staffMemberId) => ({
      user_id: input.userId,
      staff_member_id: staffMemberId,
      work_date: input.workDate,
      status: AttendanceStatus.PRESENT,
      marked_by: input.markedBy,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'user_id,staff_member_id,work_date' }
  )

  if (error) throw new Error(error.message)
}
