import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlatformMetrics, PlatformShopRow, Shop } from '@/types/interfaces'
import { AccountStatus, OrderStatus } from '@/types/enums'

export async function fetchPlatformShops(
  supabase: SupabaseClient
): Promise<PlatformShopRow[]> {
  const { data: shops, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = (shops as Shop[]) ?? []
  if (rows.length === 0) return []

  const ownerIds = rows.map((shop) => shop.owner_auth_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', ownerIds)

  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.full_name])
  )

  return rows.map((shop) => ({
    ...shop,
    tax_rate: Number(shop.tax_rate ?? 0),
    kds_enabled: shop.kds_enabled !== false,
    owner_name: nameById.get(shop.owner_auth_id) ?? null,
    owner_email: null,
  }))
}

export async function updateShopStatus(
  supabase: SupabaseClient,
  userId: string,
  status: (typeof AccountStatus)[keyof typeof AccountStatus]
) {
  const { error } = await supabase
    .from('users')
    .update({ status })
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function fetchPlatformMetrics(
  supabase: SupabaseClient
): Promise<PlatformMetrics> {
  const [{ data: shops, error: shopsError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase.from('users').select('user_id, status, created_at'),
      supabase
        .from('orders')
        .select('grand_total, status, created_at, user_id')
        .eq('status', OrderStatus.PAID)
        .order('created_at', { ascending: true }),
    ])

  if (shopsError) throw new Error(shopsError.message)
  if (ordersError) throw new Error(ordersError.message)

  const allShops = shops ?? []
  const paidOrders = orders ?? []

  const signupsByDayMap = new Map<string, number>()
  for (const shop of allShops) {
    const date = new Date(shop.created_at).toISOString().slice(0, 10)
    signupsByDayMap.set(date, (signupsByDayMap.get(date) ?? 0) + 1)
  }

  const revenueByDayMap = new Map<string, { revenue: number; orders: number }>()
  for (const order of paidOrders) {
    const date = new Date(order.created_at).toISOString().slice(0, 10)
    const current = revenueByDayMap.get(date) ?? { revenue: 0, orders: 0 }
    current.revenue += Number(order.grand_total)
    current.orders += 1
    revenueByDayMap.set(date, current)
  }

  const totalRevenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.grand_total),
    0
  )

  return {
    totalShops: allShops.length,
    pendingShops: allShops.filter((shop) => shop.status === AccountStatus.PENDING)
      .length,
    approvedShops: allShops.filter((shop) => shop.status === AccountStatus.APPROVED)
      .length,
    rejectedShops: allShops.filter((shop) => shop.status === AccountStatus.REJECTED)
      .length,
    suspendedShops: allShops.filter(
      (shop) => shop.status === AccountStatus.SUSPENDED
    ).length,
    totalPaidOrders: paidOrders.length,
    totalRevenue,
    signupsByDay: [...signupsByDayMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
    revenueByDay: [...revenueByDayMap.entries()]
      .map(([date, value]) => ({
        date,
        revenue: value.revenue,
        orders: value.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
  }
}
