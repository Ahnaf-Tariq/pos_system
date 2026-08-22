import type { SupabaseClient } from '@supabase/supabase-js'
import { OrderStatus } from '@/types/enums'
import type {
  DaySalesPoint,
  HourSalesPoint,
  ItemRanking,
  PeriodSalesPoint,
  ReportBundle,
  ReportFilters,
  SalesPeriod,
  StaffPerformance,
} from '@/types/interfaces'

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateInput(date: Date): string {
  return localDateKey(date)
}

/** Local calendar day bounds as ISO (UTC) for timestamptz filters. */
function localDayBoundsISO(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

function startOfWeek(date: Date): Date {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function periodBucket(date: Date, period: SalesPeriod): { key: string; label: string } {
  if (period === 'yearly') {
    const year = String(date.getFullYear())
    return { key: year, label: year }
  }
  if (period === 'monthly') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    return { key, label }
  }
  if (period === 'weekly') {
    const start = startOfWeek(date)
    const key = localDateKey(start)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const label = `${start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
    return { key, label }
  }
  const key = localDateKey(date)
  const label = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  return { key, label }
}

export function defaultReportRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 6)
  return {
    fromDate: toDateInput(from),
    toDate: toDateInput(to),
  }
}

export async function fetchReportBundle(
  supabase: SupabaseClient,
  userId: string,
  filters: ReportFilters & { period?: SalesPeriod }
): Promise<ReportBundle> {
  const period = filters.period ?? 'daily'
  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters.fromDate) {
    const fromBound = localDayBoundsISO(filters.fromDate)
    query = query.gte('created_at', fromBound.start)
  }
  if (filters.toDate) {
    const toBound = localDayBoundsISO(filters.toDate)
    query = query.lte('created_at', toBound.end)
  }

  if (filters.locationId) query = query.eq('location_id', filters.locationId)

  const { data: orders, error } = await query
  if (error) throw new Error(error.message)

  const allOrders = orders ?? []
  const paid = allOrders.filter((order) => order.status === OrderStatus.PAID)
  const voids = allOrders.filter((order) => order.status === OrderStatus.VOID)
  const discounted = paid.filter((order) => Number(order.discount_total) > 0)

  const revenue = paid.reduce((sum, order) => sum + Number(order.grand_total), 0)
  const discountTotal = paid.reduce(
    (sum, order) => sum + Number(order.discount_total),
    0
  )
  const voidTotal = voids.reduce((sum, order) => sum + Number(order.grand_total), 0)

  const byDayMap = new Map<string, DaySalesPoint>()
  const byHourMap = new Map<number, HourSalesPoint>()
  const byPeriodMap = new Map<string, PeriodSalesPoint>()

  for (const order of paid) {
    const created = new Date(order.created_at)
    const date = localDateKey(created)
    const hour = created.getHours()
    const total = Number(order.grand_total)

    const day = byDayMap.get(date) ?? { date, total: 0, orders: 0 }
    day.total += total
    day.orders += 1
    byDayMap.set(date, day)

    const hourPoint = byHourMap.get(hour) ?? { hour, total: 0, orders: 0 }
    hourPoint.total += total
    hourPoint.orders += 1
    byHourMap.set(hour, hourPoint)

    const bucket = periodBucket(created, period)
    const periodPoint = byPeriodMap.get(bucket.key) ?? {
      key: bucket.key,
      label: bucket.label,
      total: 0,
      orders: 0,
    }
    periodPoint.total += total
    periodPoint.orders += 1
    byPeriodMap.set(bucket.key, periodPoint)
  }


  const paidIds = paid.map((order) => order.id)
  const itemRanking: ItemRanking[] = []

  if (paidIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity, unit_price, menu_items(name)')
      .eq('user_id', userId)
      .in('order_id', paidIds)

    const rankingMap = new Map<string, ItemRanking>()
    for (const item of items ?? []) {
      const id = item.menu_item_id as string
      const name =
        (item.menu_items as { name?: string } | null)?.name ?? 'Item'
      const current = rankingMap.get(id) ?? {
        menu_item_id: id,
        name,
        quantity: 0,
        revenue: 0,
      }
      current.quantity += Number(item.quantity)
      current.revenue += Number(item.quantity) * Number(item.unit_price)
      rankingMap.set(id, current)
    }
    itemRanking.push(
      ...[...rankingMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    )
  }

  const staffIds = [
    ...new Set(
      paid
        .map((order) => order.opened_by)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const { data: profiles } = staffIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', staffIds)
    : { data: [] as { id: string; full_name: string | null }[] }

  const nameById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.full_name?.trim() || 'Staff',
    ])
  )

  const staffMap = new Map<string, StaffPerformance>()
  for (const order of paid) {
    if (!order.opened_by) continue
    const current = staffMap.get(order.opened_by) ?? {
      auth_id: order.opened_by,
      name: nameById.get(order.opened_by) ?? 'Staff',
      orders: 0,
      revenue: 0,
      average_ticket: 0,
    }
    current.orders += 1
    current.revenue += Number(order.grand_total)
    current.average_ticket = current.revenue / current.orders
    staffMap.set(order.opened_by, current)
  }

  const voidStaffIds = [
    ...new Set(
      voids
        .map((order) => order.opened_by)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  if (voidStaffIds.length > 0) {
    const { data: voidProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', voidStaffIds)
    for (const profile of voidProfiles ?? []) {
      nameById.set(profile.id, profile.full_name?.trim() || 'Staff')
    }
  }

  return {
    paidOrders: paid.length,
    revenue,
    averageTicket: paid.length ? revenue / paid.length : 0,
    discountTotal,
    voidCount: voids.length,
    voidTotal,
    byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byHour: [...byHourMap.values()].sort((a, b) => a.hour - b.hour),
    byPeriod: [...byPeriodMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    itemRanking,
    staffPerformance: [...staffMap.values()].sort((a, b) => b.revenue - a.revenue),
    voids: voids.map((order) => ({
      id: order.id,
      created_at: order.created_at,
      grand_total: Number(order.grand_total),
      opened_by_name: order.opened_by
        ? nameById.get(order.opened_by) ?? null
        : null,
    })),
    discounts: discounted.map((order) => ({
      id: order.id,
      created_at: order.created_at,
      discount_total: Number(order.discount_total),
      grand_total: Number(order.grand_total),
    })),
  }
}

export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (value: string | number) => {
    const text = String(value)
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`
    }
    return text
  }
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')),
  ].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
