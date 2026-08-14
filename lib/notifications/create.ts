import type { SupabaseClient } from '@supabase/supabase-js'
import { ROUTES } from '@/lib/routes'
import type { NotificationType, ShopNotification } from '@/types/interfaces'

/** Same-tab refresh when a notification is written from this browser. */
export const NOTIFICATIONS_CHANGED_EVENT = 'auric:notifications-changed'

export function emitNotificationsChanged(userId?: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, {
      detail: { userId: userId ?? null },
    })
  )
}

export async function createNotification(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    type: NotificationType
    title: string
    body?: string | null
    href?: string | null
    entityId?: string | null
    metadata?: Record<string, unknown>
  }
) {
  const { error } = await supabase.from('notifications').insert({
    user_id: input.userId,
    location_id: input.locationId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    is_read: false,
  })

  // Never fail the primary action because of a notification write
  if (error) {
    console.error('[notifications]', error.message)
    return
  }

  emitNotificationsChanged(input.userId)
}

export async function fetchNotifications(
  supabase: SupabaseClient,
  userId: string,
  limit = 40
): Promise<ShopNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data as ShopNotification[]) ?? []
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  userId: string
) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (error) throw new Error(error.message)
}

export async function notifySaleCompleted(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    orderId: string
    grandTotal: number
    currency?: string
  }
) {
  const money = formatSimpleMoney(input.grandTotal, input.currency)
  await createNotification(supabase, {
    userId: input.userId,
    locationId: input.locationId,
    type: 'sale_completed',
    title: 'Sale completed',
    body: `POS payment recorded · ${money}`,
    href: ROUTES.orders,
    entityId: input.orderId,
    metadata: { order_id: input.orderId, grand_total: input.grandTotal },
  })
}

export async function notifyOrderServed(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    orderId: string
    grandTotal: number
    currency?: string
  }
) {
  const money = formatSimpleMoney(input.grandTotal, input.currency)
  await createNotification(supabase, {
    userId: input.userId,
    locationId: input.locationId,
    type: 'order_served',
    title: 'Order served',
    body: `Kitchen ticket settled · ${money}`,
    href: ROUTES.orders,
    entityId: input.orderId,
    metadata: { order_id: input.orderId, grand_total: input.grandTotal },
  })
}

export async function notifyTableFreed(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    tableId: string
    tableLabel: string
  }
) {
  await createNotification(supabase, {
    userId: input.userId,
    locationId: input.locationId,
    type: 'table_freed',
    title: 'Table free',
    body: `${input.tableLabel} is available`,
    href: ROUTES.tables,
    entityId: input.tableId,
    metadata: { table_id: input.tableId },
  })
}

export async function notifyStaffAdded(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    staffMemberId?: string | null
    staffName: string
    role: string
  }
) {
  await createNotification(supabase, {
    userId: input.userId,
    locationId: input.locationId,
    type: 'staff_added',
    title: 'Staff added',
    body: `${input.staffName} joined as ${input.role}`,
    href: ROUTES.staff,
    entityId: input.staffMemberId ?? null,
    metadata: { role: input.role },
  })
}

export async function notifyLowStockIfCrossed(
  supabase: SupabaseClient,
  input: {
    userId: string
    locationId?: string | null
    inventoryItemId: string
    name: string
    previousQty: number
    nextQty: number
    reorderThreshold: number
    unit?: string
  }
) {
  const wasOk = input.previousQty > input.reorderThreshold
  const isLow = input.nextQty <= input.reorderThreshold
  if (!wasOk || !isLow) return

  const unit = input.unit ? ` ${input.unit}` : ''
  await createNotification(supabase, {
    userId: input.userId,
    locationId: input.locationId,
    type: 'low_stock',
    title: 'Low stock',
    body: `${input.name} is at ${input.nextQty}${unit} (reorder at ${input.reorderThreshold}${unit})`,
    href: ROUTES.inventory,
    entityId: input.inventoryItemId,
    metadata: {
      inventory_item_id: input.inventoryItemId,
      quantity_on_hand: input.nextQty,
      reorder_threshold: input.reorderThreshold,
    },
  })
}

function formatSimpleMoney(amount: number, currency = 'PKR') {
  const value = Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  if (currency === 'PKR') return `Rs ${value}`
  return `${currency} ${value}`
}
