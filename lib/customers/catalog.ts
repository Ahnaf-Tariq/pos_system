import type { SupabaseClient } from '@supabase/supabase-js'
import type { Customer, CustomerStats, Order } from '@/types/interfaces'
import { OrderStatus } from '@/types/enums'

export async function fetchCustomersWithStats(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
): Promise<CustomerStats[]> {
  const [{ data: customers, error }, { data: orders }] = await Promise.all([
    supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('customer_id, grand_total, status')
      .eq('user_id', userId)
      .eq('location_id', locationId)
      .not('customer_id', 'is', null),
  ])

  if (error) throw new Error(error.message)

  const stats = new Map<string, { order_count: number; total_spend: number }>()
  for (const order of orders ?? []) {
    if (!order.customer_id) continue
    const current = stats.get(order.customer_id) ?? { order_count: 0, total_spend: 0 }
    if (order.status === OrderStatus.PAID) {
      current.order_count += 1
      current.total_spend += Number(order.grand_total)
    }
    stats.set(order.customer_id, current)
  }

  return ((customers as Customer[]) ?? []).map((customer) => {
    const row = stats.get(customer.id)
    return {
      ...customer,
      loyalty_points: Number(customer.loyalty_points),
      order_count: row?.order_count ?? 0,
      total_spend: row?.total_spend ?? 0,
    }
  })
}

export async function fetchCustomerOrders(
  supabase: SupabaseClient,
  userId: string,
  customerId: string,
  locationId?: string | null
): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data as Order[]) ?? []).map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
    discount_total: Number(order.discount_total),
    tax_total: Number(order.tax_total),
    grand_total: Number(order.grand_total),
  }))
}

export async function fetchCustomersList(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .order('full_name', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data as Customer[]) ?? []).map((customer) => ({
    ...customer,
    loyalty_points: Number(customer.loyalty_points),
  }))
}
