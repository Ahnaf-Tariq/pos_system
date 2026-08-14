import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  KdsTicket,
  KdsTicketItem,
  Order,
  OrderItem,
  SelectedModifier,
} from '@/types/interfaces'
import {
  KdsStatus,
  OrderStatus,
  TableStatus,
  type PaymentMethod,
} from '@/types/enums'
import {
  awardLoyaltyPoints,
  deductRecipeStockForOrder,
} from '@/lib/inventory/deduct'

export async function fetchKdsTickets(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
): Promise<KdsTicket[]> {
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(
      'id, user_id, location_id, table_id, customer_id, order_type, status, created_at, grand_total'
    )
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .in('status', [
      OrderStatus.SENT_TO_KITCHEN,
      OrderStatus.READY,
      OrderStatus.SERVED,
    ])
    .order('created_at', { ascending: true })

  if (ordersError) throw new Error(ordersError.message)
  if (!orders?.length) return []

  const orderIds = orders.map((order) => order.id)
  const tableIds = orders
    .map((order) => order.table_id)
    .filter((id): id is string => Boolean(id))

  const [{ data: items, error: itemsError }, { data: tables }] = await Promise.all([
    supabase
      .from('order_items')
      .select('*, menu_items(name)')
      .eq('user_id', userId)
      .in('order_id', orderIds),
    tableIds.length
      ? supabase
          .from('restaurant_tables')
          .select('id, label')
          .eq('user_id', userId)
          .in('id', tableIds)
      : Promise.resolve({ data: [] as { id: string; label: string }[] }),
  ])

  if (itemsError) throw new Error(itemsError.message)

  const tableLabelById = new Map((tables ?? []).map((table) => [table.id, table.label]))

  const itemsByOrder = new Map<string, KdsTicketItem[]>()
  for (const row of items ?? []) {
    const menuName =
      (row.menu_items as { name?: string } | null)?.name ?? 'Item'
    const ticketItem: KdsTicketItem = {
      id: row.id,
      user_id: row.user_id,
      order_id: row.order_id,
      menu_item_id: row.menu_item_id,
      quantity: row.quantity,
      unit_price: Number(row.unit_price),
      selected_modifiers: (row.selected_modifiers as SelectedModifier[]) ?? [],
      notes: row.notes,
      kds_status: row.kds_status,
      menu_item_name: menuName,
    }
    const list = itemsByOrder.get(row.order_id) ?? []
    list.push(ticketItem)
    itemsByOrder.set(row.order_id, list)
  }

  return orders
    .map((order) => {
      const ticketItems = itemsByOrder.get(order.id) ?? []
      const activeItems = ticketItems.filter(
        (item) => item.kds_status !== KdsStatus.SERVED
      )
      if (activeItems.length === 0 && order.status === OrderStatus.SERVED) return null

      return {
        order: {
          ...order,
          customer_id: (order.customer_id as string | null) ?? null,
          grand_total: Number(order.grand_total),
          table_label: order.table_id
            ? tableLabelById.get(order.table_id) ?? null
            : null,
        },
        items: ticketItems,
        stage: deriveTicketStage(ticketItems),
      } satisfies KdsTicket
    })
    .filter((ticket): ticket is KdsTicket => ticket !== null)
}

export function deriveTicketStage(items: KdsTicketItem[]): KdsStatus {
  if (items.length === 0) return KdsStatus.PENDING
  const statuses = items.map((item) => item.kds_status)
  if (statuses.every((status) => status === KdsStatus.SERVED)) return KdsStatus.SERVED
  if (statuses.every((status) => status === KdsStatus.READY || status === KdsStatus.SERVED))
    return KdsStatus.READY
  if (statuses.some((status) => status === KdsStatus.PREPARING || status === KdsStatus.READY))
    return KdsStatus.PREPARING
  return KdsStatus.PENDING
}

export function nextKdsStatus(current: KdsStatus): KdsStatus | null {
  if (current === KdsStatus.PENDING) return KdsStatus.PREPARING
  if (current === KdsStatus.PREPARING) return KdsStatus.READY
  if (current === KdsStatus.READY) return KdsStatus.SERVED
  return null
}

export async function bumpTicket(
  supabase: SupabaseClient,
  userId: string,
  ticket: KdsTicket
) {
  const next = nextKdsStatus(ticket.stage)
  if (!next) return

  if (next === KdsStatus.SERVED) {
    throw new Error('Use settleTicketAsPaid to serve and take payment')
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .update({ kds_status: next })
    .eq('user_id', userId)
    .eq('order_id', ticket.order.id)
    .neq('kds_status', KdsStatus.SERVED)

  if (itemsError) throw new Error(itemsError.message)

  if (next === KdsStatus.READY) {
    const { error } = await supabase
      .from('orders')
      .update({ status: OrderStatus.READY })
      .eq('id', ticket.order.id)
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
  }
}

export async function bumpItem(
  supabase: SupabaseClient,
  userId: string,
  item: KdsTicketItem,
  ticket: KdsTicket
) {
  const current = item.kds_status as KdsStatus
  const next = nextKdsStatus(current)
  if (!next) return

  const refreshedItems = ticket.items.map((row) =>
    row.id === item.id ? { ...row, kds_status: next } : row
  )
  const stage = deriveTicketStage(refreshedItems)

  if (stage === KdsStatus.SERVED) {
    throw new Error('Use settleTicketAsPaid to serve and take payment')
  }

  const { error } = await supabase
    .from('order_items')
    .update({ kds_status: next })
    .eq('id', item.id)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)

  if (stage === KdsStatus.READY) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: OrderStatus.READY })
      .eq('id', ticket.order.id)
      .eq('user_id', userId)
    if (orderError) throw new Error(orderError.message)
  }
}

/**
 * Marks kitchen ticket served and records payment (same side-effects as POS Pay).
 */
export async function settleTicketAsPaid(
  supabase: SupabaseClient,
  userId: string,
  ticket: KdsTicket,
  paymentMethod: PaymentMethod
) {
  const { data: existing, error: existingError } = await supabase
    .from('orders')
    .select('id, status, customer_id, location_id, table_id, grand_total')
    .eq('id', ticket.order.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (!existing) throw new Error('Order not found')

  const { error: itemsError } = await supabase
    .from('order_items')
    .update({ kds_status: KdsStatus.SERVED })
    .eq('user_id', userId)
    .eq('order_id', ticket.order.id)

  if (itemsError) throw new Error(itemsError.message)

  if (existing.status === OrderStatus.PAID) return

  const { error: orderError } = await supabase
    .from('orders')
    .update({
      status: OrderStatus.PAID,
      payment_method: paymentMethod,
      closed_at: new Date().toISOString(),
    })
    .eq('id', ticket.order.id)
    .eq('user_id', userId)

  if (orderError) throw new Error(orderError.message)

  const locationId = (existing.location_id as string) ?? ticket.order.location_id
  const cartItems = ticket.items.map((item) => ({
    localId: item.id,
    menu_item_id: item.menu_item_id,
    name: item.menu_item_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    selected_modifiers: item.selected_modifiers,
    notes: item.notes ?? undefined,
  }))

  await deductRecipeStockForOrder({
    supabase,
    userId,
    locationId,
    orderId: ticket.order.id,
    items: cartItems,
  })

  const customerId =
    (existing.customer_id as string | null) ?? ticket.order.customer_id
  if (customerId) {
    await awardLoyaltyPoints({
      supabase,
      userId,
      customerId,
      grandTotal: Number(existing.grand_total ?? ticket.order.grand_total),
    })
  }

  const tableId = (existing.table_id as string | null) ?? ticket.order.table_id
  if (tableId) {
    await supabase
      .from('restaurant_tables')
      .update({ status: TableStatus.DIRTY })
      .eq('id', tableId)
      .eq('user_id', userId)
  }

  const { notifyOrderServed } = await import('@/lib/notifications/create')
  await notifyOrderServed(supabase, {
    userId,
    locationId,
    orderId: ticket.order.id,
    grandTotal: Number(existing.grand_total ?? ticket.order.grand_total),
  })
}

export function formatElapsed(fromIso: string, nowMs: number): string {
  const started = new Date(fromIso).getTime()
  const seconds = Math.max(0, Math.floor((nowMs - started) / 1000))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}h ${remMins}m`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
