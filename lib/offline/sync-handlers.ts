import type { SupabaseClient } from '@supabase/supabase-js'
import {
  WriteQueueType,
  type QueuedWriteRecord,
  type OfflineOrderRecord,
} from '@/types/interfaces'
import { KdsStatus, OrderStatus, TableStatus, CashSessionStatus } from '@/types/enums'
import {
  awardLoyaltyPoints,
  deductRecipeStockForOrder,
} from '@/lib/inventory/deduct'
import { resolveCashSessionIdForPayment } from '@/lib/cash-drawer/catalog'
import {
  openCashSession,
  closeCashSession,
  addCashMovement,
} from '@/lib/cash-drawer/catalog'
import {
  bumpTicket,
  bumpItem,
  markPaidTicketServed,
  settleTicketAsPaid,
} from '@/lib/kds/tickets'
import type { KdsTicket, KdsTicketItem } from '@/types/interfaces'
import type { PaymentMethod } from '@/types/enums'
import { CashMovementType } from '@/types/enums'

export async function syncQueuedWrite(
  supabase: SupabaseClient,
  item: QueuedWriteRecord
) {
  switch (item.type) {
    case WriteQueueType.ORDER:
      return syncOrderWrite(supabase, item.payload as OfflineOrderRecord)
    case WriteQueueType.CASH_SESSION_OPEN:
      return openCashSession(supabase, item.payload as Parameters<typeof openCashSession>[1])
    case WriteQueueType.CASH_SESSION_CLOSE:
      return syncCashSessionClose(supabase, item.payload as CashSessionClosePayload)
    case WriteQueueType.CASH_MOVEMENT:
      return syncCashMovement(supabase, item.payload as CashMovementPayload)
    case WriteQueueType.TABLE_CREATE:
      return syncTableCreate(supabase, item.payload as TableCreatePayload)
    case WriteQueueType.TABLE_UPDATE_STATUS:
      return syncTableUpdateStatus(supabase, item.payload as TableUpdateStatusPayload)
    case WriteQueueType.TABLE_DELETE:
      return syncTableDelete(supabase, item.payload as TableDeletePayload)
    case WriteQueueType.TABLE_TRANSFER:
      return syncTableTransfer(supabase, item.payload as TableTransferPayload)
    case WriteQueueType.TABLE_MERGE:
      return syncTableMerge(supabase, item.payload as TableMergePayload)
    case WriteQueueType.KDS_BUMP_TICKET:
      return bumpTicket(
        supabase,
        (item.payload as KdsBumpTicketPayload).userId,
        (item.payload as KdsBumpTicketPayload).ticket
      )
    case WriteQueueType.KDS_BUMP_ITEM:
      return bumpItem(
        supabase,
        (item.payload as KdsBumpItemPayload).userId,
        (item.payload as KdsBumpItemPayload).item,
        (item.payload as KdsBumpItemPayload).ticket
      )
    case WriteQueueType.KDS_MARK_SERVED:
      return markPaidTicketServed(
        supabase,
        (item.payload as KdsMarkServedPayload).userId,
        (item.payload as KdsMarkServedPayload).orderId
      )
    case WriteQueueType.KDS_SETTLE:
      return settleTicketAsPaid(
        supabase,
        (item.payload as KdsSettlePayload).userId,
        (item.payload as KdsSettlePayload).ticket,
        (item.payload as KdsSettlePayload).paymentMethod
      )
    default:
      throw new Error(`Unknown write queue type: ${item.type}`)
  }
}

interface TableCreatePayload {
  userId: string
  locationId: string
  label: string
  seats: number
}

interface TableUpdateStatusPayload {
  userId: string
  tableId: string
  locationId: string
  status: string
  tableLabel: string
  previousStatus: string
}

interface TableDeletePayload {
  userId: string
  tableId: string
}

interface TableTransferPayload {
  userId: string
  locationId: string
  sourceTableId: string
  sourceTableLabel: string
  targetTableId: string
  orderId: string
}

interface TableMergePayload {
  userId: string
  locationId: string
  targetTableId: string
  sourceTableId: string
  sourceOrderId: string
  targetOrderId: string
}

interface KdsBumpTicketPayload {
  userId: string
  ticket: KdsTicket
}

interface KdsBumpItemPayload {
  userId: string
  item: KdsTicketItem
  ticket: KdsTicket
}

interface KdsMarkServedPayload {
  userId: string
  orderId: string
}

interface KdsSettlePayload {
  userId: string
  ticket: KdsTicket
  paymentMethod: PaymentMethod
}

interface CashSessionClosePayload {
  userId: string
  locationId: string
  sessionId?: string
  closedBy: string
  expected: number
  actual: number
  notes?: string
}

interface CashMovementPayload {
  userId: string
  locationId: string
  sessionId?: string
  type: string
  amount: number
  reason?: string
}

async function resolveOpenSessionId(
  supabase: SupabaseClient,
  userId: string,
  locationId: string,
  sessionId?: string
) {
  if (sessionId) {
    const { data } = await supabase
      .from('cash_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  const { data, error } = await supabase
    .from('cash_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .eq('status', CashSessionStatus.OPEN)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error('No open cash session found for this location')
  return data.id as string
}

async function syncCashSessionClose(
  supabase: SupabaseClient,
  payload: CashSessionClosePayload
) {
  const sessionId = await resolveOpenSessionId(
    supabase,
    payload.userId,
    payload.locationId,
    payload.sessionId
  )

  await closeCashSession(supabase, {
    userId: payload.userId,
    sessionId,
    closedBy: payload.closedBy,
    expected: payload.expected,
    actual: payload.actual,
    notes: payload.notes,
  })
}

async function syncCashMovement(
  supabase: SupabaseClient,
  payload: CashMovementPayload
) {
  const sessionId = await resolveOpenSessionId(
    supabase,
    payload.userId,
    payload.locationId,
    payload.sessionId
  )

  await addCashMovement(supabase, {
    userId: payload.userId,
    sessionId,
    type: payload.type as Parameters<typeof addCashMovement>[1]['type'],
    amount: payload.amount,
    reason: payload.reason,
  })
}

async function syncOrderWrite(
  supabase: SupabaseClient,
  order: OfflineOrderRecord
) {
  const status =
    order.action === 'pay' ? OrderStatus.PAID : OrderStatus.SENT_TO_KITCHEN

  const payload: Record<string, unknown> = {
    user_id: order.user_id,
    location_id: order.location_id,
    table_id: order.table_id,
    customer_id: order.customer_id,
    order_type: order.order_type,
    status,
    opened_by: order.opened_by,
    subtotal: order.subtotal,
    discount_total: order.discount_total,
    tax_total: order.tax_total,
    grand_total: order.grand_total,
    payment_method: order.payment_method,
    client_generated_id: order.client_generated_id,
    closed_at: order.action === 'pay' ? new Date().toISOString() : null,
  }

  const { data: existing } = await supabase
    .from('orders')
    .select('id, status')
    .eq('user_id', order.user_id)
    .eq('client_generated_id', order.client_generated_id)
    .maybeSingle()

  let orderId = existing?.id as string | undefined
  const wasAlreadyPaid = existing?.status === OrderStatus.PAID

  if (order.action === 'pay' && !wasAlreadyPaid) {
    payload.cash_session_id = await resolveCashSessionIdForPayment(
      supabase,
      order.user_id,
      order.location_id,
      order.payment_method
    )
  }

  if (orderId) {
    const { error } = await supabase.from('orders').update(payload).eq('id', orderId)
    if (error) throw new Error(error.message)
  } else {
    const { data: created, error } = await supabase
      .from('orders')
      .insert(payload)
      .select('id')
      .single()
    if (error || !created) throw new Error(error?.message ?? 'Order insert failed')
    orderId = created.id
  }

  await supabase.from('order_items').delete().eq('order_id', orderId)

  const { error: itemsError } = await supabase.from('order_items').insert(
    order.items.map((item) => ({
      user_id: order.user_id,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      selected_modifiers: item.selected_modifiers,
      notes: item.notes ?? null,
      kds_status: KdsStatus.PENDING,
    }))
  )

  if (itemsError) throw new Error(itemsError.message)

  if (order.table_id) {
    await supabase
      .from('restaurant_tables')
      .update({
        status: order.action === 'pay' ? TableStatus.DIRTY : TableStatus.OCCUPIED,
      })
      .eq('id', order.table_id)
      .eq('user_id', order.user_id)
  }

  if (order.action === 'pay' && orderId) {
    await deductRecipeStockForOrder({
      supabase,
      userId: order.user_id,
      locationId: order.location_id,
      orderId,
      items: order.items,
    })

    if (!wasAlreadyPaid) {
      const { notifySaleCompleted } = await import('@/lib/notifications/create')
      await notifySaleCompleted(supabase, {
        userId: order.user_id,
        locationId: order.location_id,
        orderId,
        grandTotal: order.grand_total,
      })

      if (order.customer_id) {
        await awardLoyaltyPoints({
          supabase,
          userId: order.user_id,
          customerId: order.customer_id,
          grandTotal: order.grand_total,
        })
      }
    }
  }
}

async function syncTableCreate(
  supabase: SupabaseClient,
  payload: TableCreatePayload
) {
  const { error } = await supabase.from('restaurant_tables').insert({
    user_id: payload.userId,
    location_id: payload.locationId,
    label: payload.label,
    seats: payload.seats,
    status: TableStatus.AVAILABLE,
  })
  if (error) throw new Error(error.message)
}

async function syncTableUpdateStatus(
  supabase: SupabaseClient,
  payload: TableUpdateStatusPayload
) {
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ status: payload.status })
    .eq('id', payload.tableId)
    .eq('user_id', payload.userId)
  if (error) throw new Error(error.message)

  if (
    payload.status === TableStatus.AVAILABLE &&
    payload.previousStatus !== TableStatus.AVAILABLE
  ) {
    const { notifyTableFreed } = await import('@/lib/notifications/create')
    await notifyTableFreed(supabase, {
      userId: payload.userId,
      locationId: payload.locationId,
      tableId: payload.tableId,
      tableLabel: payload.tableLabel,
    })
  }
}

async function syncTableDelete(
  supabase: SupabaseClient,
  payload: TableDeletePayload
) {
  const { error } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('id', payload.tableId)
    .eq('user_id', payload.userId)
  if (error) throw new Error(error.message)
}

async function syncTableTransfer(
  supabase: SupabaseClient,
  payload: TableTransferPayload
) {
  const { error: orderError } = await supabase
    .from('orders')
    .update({ table_id: payload.targetTableId })
    .eq('id', payload.orderId)
    .eq('user_id', payload.userId)
  if (orderError) throw new Error(orderError.message)

  await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.AVAILABLE })
    .eq('id', payload.sourceTableId)
    .eq('user_id', payload.userId)

  await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.OCCUPIED })
    .eq('id', payload.targetTableId)
    .eq('user_id', payload.userId)

  const { notifyTableFreed } = await import('@/lib/notifications/create')
  await notifyTableFreed(supabase, {
    userId: payload.userId,
    locationId: payload.locationId,
    tableId: payload.sourceTableId,
    tableLabel: payload.sourceTableLabel,
  })
}

async function syncTableMerge(
  supabase: SupabaseClient,
  payload: TableMergePayload
) {
  const { error: itemsError } = await supabase
    .from('order_items')
    .update({ order_id: payload.targetOrderId })
    .eq('order_id', payload.sourceOrderId)
    .eq('user_id', payload.userId)
  if (itemsError) throw new Error(itemsError.message)

  const { data: targetOrder, error: targetError } = await supabase
    .from('orders')
    .select('grand_total, subtotal')
    .eq('id', payload.targetOrderId)
    .eq('user_id', payload.userId)
    .single()
  if (targetError) throw new Error(targetError.message)

  const { data: sourceOrder, error: sourceOrderError } = await supabase
    .from('orders')
    .select('grand_total')
    .eq('id', payload.sourceOrderId)
    .eq('user_id', payload.userId)
    .single()
  if (sourceOrderError) throw new Error(sourceOrderError.message)

  const mergedTotal =
    Number(targetOrder.grand_total) + Number(sourceOrder.grand_total)

  await supabase
    .from('orders')
    .update({
      grand_total: mergedTotal,
      subtotal: mergedTotal,
    })
    .eq('id', payload.targetOrderId)
    .eq('user_id', payload.userId)

  await supabase
    .from('orders')
    .update({
      status: OrderStatus.VOID,
      table_id: null,
      closed_at: new Date().toISOString(),
    })
    .eq('id', payload.sourceOrderId)
    .eq('user_id', payload.userId)

  await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.AVAILABLE })
    .eq('id', payload.sourceTableId)
    .eq('user_id', payload.userId)

  await supabase
    .from('restaurant_tables')
    .update({ status: TableStatus.OCCUPIED })
    .eq('id', payload.targetTableId)
    .eq('user_id', payload.userId)
}

export function cacheKeysForWrite(item: QueuedWriteRecord): string[] {
  const payload = item.payload as Record<string, unknown>
  const userId = (payload.user_id as string) ?? (payload.userId as string)
  const locationId =
    (payload.location_id as string) ?? (payload.locationId as string)

  if (!userId || !locationId) return []

  return [
    `menu:${userId}:${locationId}`,
    `customers:${userId}:${locationId}`,
    `tables:${userId}:${locationId}`,
    `tables-all:${userId}`,
    `cash-drawer:${userId}:${locationId}`,
    `kds:${userId}:${locationId}`,
  ]
}
