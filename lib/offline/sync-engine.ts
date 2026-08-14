import type { SupabaseClient } from '@supabase/supabase-js'
import { KdsStatus, OrderStatus, TableStatus } from '@/types/enums'
import {
  getPendingOfflineOrders,
  markOfflineOrderFailed,
  markOfflineOrderSynced,
} from '@/lib/offline/db'
import type { OfflineOrderRecord } from '@/types/interfaces'
import {
  awardLoyaltyPoints,
  deductRecipeStockForOrder,
} from '@/lib/inventory/deduct'

export async function syncPendingOrders(supabase: SupabaseClient) {
  const pending = await getPendingOfflineOrders()
  let synced = 0

  for (const order of pending) {
    try {
      await upsertOfflineOrder(supabase, order)
      if (order.id != null) await markOfflineOrderSynced(order.id)
      synced += 1
    } catch (error) {
      if (order.id != null) {
        await markOfflineOrderFailed(
          order.id,
          error instanceof Error ? error.message : 'Sync failed'
        )
      }
    }
  }

  return { synced, failed: pending.length - synced, remaining: pending.length - synced }
}

async function upsertOfflineOrder(
  supabase: SupabaseClient,
  order: OfflineOrderRecord
) {
  const status =
    order.action === 'pay' ? OrderStatus.PAID : OrderStatus.SENT_TO_KITCHEN

  const payload = {
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

export function startOfflineSyncLoop(supabase: SupabaseClient) {
  let stopped = false

  async function tick() {
    if (stopped) return
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await syncPendingOrders(supabase)
    }
  }

  void tick()
  const intervalId = window.setInterval(() => {
    void tick()
  }, 8000)

  const onOnline = () => {
    void tick()
  }
  window.addEventListener('online', onOnline)

  return () => {
    stopped = true
    window.clearInterval(intervalId)
    window.removeEventListener('online', onOnline)
  }
}
