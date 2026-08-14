import type { SupabaseClient } from '@supabase/supabase-js'
import type { Order, RestaurantTable, TableWithOrder } from '@/types/interfaces'
import { OrderStatus, TableStatus } from '@/types/enums'

export async function fetchTablesWithOrders(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
): Promise<TableWithOrder[]> {
  const [{ data: tables, error: tablesError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('*')
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .order('label', { ascending: true }),
      supabase
        .from('orders')
        .select('id, status, grand_total, created_at, order_type, table_id')
        .eq('user_id', userId)
        .eq('location_id', locationId)
        .not('table_id', 'is', null)
        .in('status', [
          OrderStatus.OPEN,
          OrderStatus.SENT_TO_KITCHEN,
          OrderStatus.READY,
          OrderStatus.SERVED,
        ]),
    ])

  if (tablesError) throw new Error(tablesError.message)
  if (ordersError) throw new Error(ordersError.message)

  const activeByTable = new Map<string, TableWithOrder['activeOrder']>()
  for (const order of orders ?? []) {
    if (!order.table_id) continue
    if (!activeByTable.has(order.table_id)) {
      activeByTable.set(order.table_id, {
        id: order.id,
        status: order.status,
        grand_total: Number(order.grand_total),
        created_at: order.created_at,
        order_type: order.order_type,
      })
    }
  }

  return ((tables as RestaurantTable[]) ?? []).map((table) => ({
    ...table,
    activeOrder: activeByTable.get(table.id) ?? null,
  }))
}

export function tableStatusStyles(status: string) {
  switch (status) {
    case TableStatus.OCCUPIED:
      return 'border-primary/60 bg-primary/15 text-foreground'
    case TableStatus.RESERVED:
      return 'border-warning/50 bg-warning/15 text-foreground'
    case TableStatus.DIRTY:
      return 'border-destructive/50 bg-destructive/15 text-foreground'
    case TableStatus.AVAILABLE:
    default:
      return 'border-border bg-card text-foreground hover:border-primary/40'
  }
}
