import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Order,
  SelectedModifier,
  ThermalReceiptData,
  ThermalReceiptItem,
} from '@/types/interfaces'

export async function fetchThermalReceiptData(
  supabase: SupabaseClient,
  orderId: string,
  shopUserId: string
): Promise<ThermalReceiptData | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', shopUserId)
    .maybeSingle()

  if (orderError) throw new Error(orderError.message)
  if (!order) return null

  const [{ data: shop }, { data: items }, { data: customer }, { data: table }] =
    await Promise.all([
      supabase
        .from('users')
        .select('business_name, currency, tax_rate, receipt_logo_url, receipt_footer')
        .eq('user_id', shopUserId)
        .single(),
      supabase
        .from('order_items')
        .select('quantity, unit_price, selected_modifiers, notes, menu_items(name)')
        .eq('order_id', orderId)
        .eq('user_id', shopUserId),
      order.customer_id
        ? supabase
            .from('customers')
            .select('full_name, phone')
            .eq('id', order.customer_id)
            .eq('user_id', shopUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      order.table_id
        ? supabase
            .from('restaurant_tables')
            .select('label')
            .eq('id', order.table_id)
            .eq('user_id', shopUserId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

  if (!shop) return null

  const receiptItems: ThermalReceiptItem[] = (items ?? []).map((row) => {
    const modifiers = (row.selected_modifiers as SelectedModifier[]) ?? []
    const name =
      (row.menu_items as { name?: string } | null)?.name ?? 'Item'
    const quantity = Number(row.quantity)
    const unit_price = Number(row.unit_price)
    return {
      name,
      quantity,
      unit_price,
      amount: quantity * unit_price,
      modifiers,
      notes: (row.notes as string | null) ?? null,
    }
  })

  return {
    order: {
      ...(order as Order),
      subtotal: Number(order.subtotal),
      discount_total: Number(order.discount_total),
      tax_total: Number(order.tax_total),
      grand_total: Number(order.grand_total),
    },
    shopName: shop.business_name as string,
    currency: (shop.currency as string) || 'PKR',
    taxRatePercent: Number(shop.tax_rate ?? 0),
    receiptLogoUrl: (shop.receipt_logo_url as string | null) ?? null,
    receiptFooter: (shop.receipt_footer as string | null) ?? null,
    customerName: customer?.full_name ?? null,
    customerPhone: customer?.phone ?? null,
    tableLabel: table?.label ?? null,
    items: receiptItems,
  }
}
