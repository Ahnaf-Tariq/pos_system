import type { SupabaseClient } from '@supabase/supabase-js'
import { OrderStatus } from '@/types/enums'
import type { DashboardOverview } from '@/types/interfaces'

function localDateKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Local calendar day bounds as ISO (UTC) for timestamptz filters. */
function localDayBoundsISO(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const start = new Date(year, month - 1, day, 0, 0, 0, 0)
  const end = new Date(year, month - 1, day, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function fetchDashboardOverview(
  supabase: SupabaseClient,
  userId: string,
  locationId?: string | null
): Promise<DashboardOverview> {
  const today = localDateKey()
  const { start, end } = localDayBoundsISO(today)
  let query = supabase
    .from('orders')
    .select('id, grand_total, status, created_at')
    .eq('user_id', userId)
    .eq('status', OrderStatus.PAID)
    .gte('created_at', start)
    .lte('created_at', end)

  if (locationId) query = query.eq('location_id', locationId)

  const { data: orders, error } = await query
  if (error) throw new Error(error.message)

  const paid = orders ?? []
  const salesToday = paid.reduce((sum, order) => sum + Number(order.grand_total), 0)
  const ordersToday = paid.length
  const averageTicket = ordersToday ? salesToday / ordersToday : 0

  const topItems: DashboardOverview['topItems'] = []
  if (paid.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('menu_item_id, quantity, unit_price, menu_items(name)')
      .eq('user_id', userId)
      .in(
        'order_id',
        paid.map((order) => order.id)
      )

    const ranking = new Map<string, DashboardOverview['topItems'][number]>()
    for (const item of items ?? []) {
      const id = item.menu_item_id as string
      const name = (item.menu_items as { name?: string } | null)?.name ?? 'Item'
      const current = ranking.get(id) ?? {
        menu_item_id: id,
        name,
        quantity: 0,
        revenue: 0,
      }
      current.quantity += Number(item.quantity)
      current.revenue += Number(item.quantity) * Number(item.unit_price)
      ranking.set(id, current)
    }
    topItems.push(
      ...[...ranking.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    )
  }

  return {
    salesToday,
    ordersToday,
    averageTicket,
    topItems,
  }
}
