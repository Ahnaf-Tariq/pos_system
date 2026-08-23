import type { SupabaseClient } from '@supabase/supabase-js'
import type { Intent, DataSource } from './intents'
import type { QueryParams } from './extractor'

export interface FetchedData {
    intent: Intent
    source: DataSource
    rows: Record<string, unknown>[]
    meta: Record<string, unknown>
}

const STAFF_ROLES = ['cashier', 'manager', 'kitchen', 'owner', 'waiter', 'chef', 'barista', 'server', 'cook']

function extractRole(rawMessage: string | undefined): string | null {
    if (!rawMessage) return null
    const lower = rawMessage.toLowerCase()
    return STAFF_ROLES.find((role) => lower.includes(role)) ?? null
}

export async function fetchData(
    supabase: SupabaseClient,
    userId: string,
    locationId: string | null,
    intent: Intent,
    params: QueryParams,
    source: DataSource,
    rawMessage?: string,
): Promise<FetchedData> {
    const { dateRange, limit, statuses, rankBy } = params

    switch (intent) {


        case 'revenue_today':
        case 'revenue_range':
        case 'avg_ticket': {
            let query = supabase
                .from('orders')
                .select('id, order_type, status, subtotal, discount_total, tax_total, grand_total, payment_method, created_at, closed_at')
                .eq('user_id', userId)
                .eq('status', 'paid')
                .order('created_at', { ascending: false })

            if (!dateRange.allTime) {
                query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to)
            }
            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: { dateRange } }
        }


        case 'order_count': {

            const effectiveStatuses = statuses.length > 0 ? statuses : ['paid']

            let query = supabase
                .from('orders')
                .select('id, order_type, status, subtotal, discount_total, tax_total, grand_total, payment_method, created_at, closed_at')
                .eq('user_id', userId)
                .in('status', effectiveStatuses)
                .order('created_at', { ascending: false })

            if (!dateRange.allTime) {
                query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to)
            }
            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return {
                intent,
                source,
                rows: (data ?? []) as Record<string, unknown>[],
                meta: { dateRange, statuses: effectiveStatuses },
            }
        }


        case 'highest_order': {
            const effectiveStatuses = statuses.length > 0 ? statuses : ['paid']

            let query = supabase
                .from('orders')
                .select('id, order_type, status, subtotal, discount_total, tax_total, grand_total, payment_method, created_at, closed_at')
                .eq('user_id', userId)
                .in('status', effectiveStatuses)
                .order('grand_total', { ascending: false })
                .limit(1)

            if (!dateRange.allTime) {
                query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to)
            }
            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: { dateRange } }
        }


        case 'top_customers_by_orders': {
            const effectiveStatuses = statuses.length > 0 ? statuses : ['paid']

            let query = supabase
                .from('orders')
                .select('customer_id, grand_total, created_at, customer:customers(full_name, phone, email)')
                .eq('user_id', userId)
                .in('status', effectiveStatuses)
                .not('customer_id', 'is', null)

            if (!dateRange.allTime) {
                query = query.gte('created_at', dateRange.from).lte('created_at', dateRange.to)
            }
            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query

            const agg: Record<string, { name: string; orders: number; total: number }> = {}
            for (const row of data ?? []) {
                const id = row.customer_id as string
                if (!id) continue
                const cust = (row as { customer?: { full_name?: string } }).customer
                const name = cust?.full_name ?? 'Unknown'
                if (!agg[id]) agg[id] = { name, orders: 0, total: 0 }
                agg[id].orders += 1
                agg[id].total += Number(row.grand_total)
            }

            const sorted = Object.values(agg)
                .sort((a, b) => rankBy === 'spend' ? b.total - a.total : b.orders - a.orders)
                .slice(0, limit)

            return { intent, source, rows: sorted as Record<string, unknown>[], meta: { dateRange, rankBy } }
        }


        case 'top_items': {
            let query = supabase
                .from('order_items')
                .select('menu_item_id, quantity, unit_price, order:orders!inner(status, created_at, location_id, user_id)')
                .eq('order.user_id', userId)
                .eq('order.status', 'paid')

            if (!dateRange.allTime) {
                query = query.gte('order.created_at', dateRange.from).lte('order.created_at', dateRange.to)
            }
            if (locationId) query = query.eq('order.location_id', locationId)

            const { data: itemRows } = await query

            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('id, name, price')
                .eq('user_id', userId)

            const nameMap = Object.fromEntries((menuItems ?? []).map((m) => [m.id, m.name]))

            const agg: Record<string, { name: string; quantity: number; revenue: number }> = {}
            for (const row of itemRows ?? []) {
                const id = row.menu_item_id as string
                if (!agg[id]) agg[id] = { name: nameMap[id] ?? 'Unknown', quantity: 0, revenue: 0 }
                agg[id].quantity += Number(row.quantity)
                agg[id].revenue += Number(row.quantity) * Number(row.unit_price)
            }

            const sorted = Object.values(agg)
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, limit)

            return { intent, source, rows: sorted as Record<string, unknown>[], meta: { dateRange, limit } }
        }


        case 'low_stock': {
            let query = supabase
                .from('inventory_items')
                .select('id, name, unit, quantity_on_hand, reorder_threshold, cost_per_unit')
                .eq('user_id', userId)

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            const lowStock = (data ?? []).filter(
                (item) => Number(item.quantity_on_hand) <= Number(item.reorder_threshold),
            )
            return { intent, source, rows: lowStock as Record<string, unknown>[], meta: {} }
        }


        case 'inventory_overview': {
            let query = supabase
                .from('inventory_items')
                .select('id, name, unit, quantity_on_hand, reorder_threshold, cost_per_unit')
                .eq('user_id', userId)
                .order('name', { ascending: true })
                .limit(50)

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: {} }
        }


        case 'customer_count': {
            let query = supabase
                .from('customers')
                .select('id, full_name, phone, email, loyalty_points, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(100)

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: { dateRange } }
        }

        case 'customer_loyalty': {
            let query = supabase
                .from('customers')
                .select('id, full_name, loyalty_points, phone')
                .eq('user_id', userId)
                .order('loyalty_points', { ascending: false })
                .limit(limit)

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: { limit } }
        }


        case 'staff_overview': {
            const role = extractRole(rawMessage)

            let query = supabase
                .from('staff_members')
                .select('id, full_name, role, is_active, phone, email, salary, location_id')
                .eq('user_id', userId)
                .order('full_name', { ascending: true })

            if (role) query = query.eq('role', role)

            const { data } = await query

            const today = new Date().toISOString().split('T')[0]
            const { data: attendance } = await supabase
                .from('staff_attendance')
                .select('staff_member_id, status')
                .eq('user_id', userId)
                .eq('work_date', today)

            const attendanceMap = Object.fromEntries(
                (attendance ?? []).map((a) => [a.staff_member_id, a.status]),
            )

            const enriched = (data ?? []).map((s) => ({
                ...s,
                today_status: attendanceMap[s.id] ?? 'not_marked',
            }))

            return { intent, source, rows: enriched as Record<string, unknown>[], meta: { role } }
        }


        case 'menu_performance': {
            let query = supabase
                .from('menu_items')
                .select('id, name, price, is_active, category_id')
                .eq('user_id', userId)
                .order('name', { ascending: true })

            if (locationId) query = query.eq('location_id', locationId)

            const { data: menuItems } = await query

            let ordersQuery = supabase
                .from('order_items')
                .select('menu_item_id, quantity, unit_price, order:orders!inner(status, created_at, user_id)')
                .eq('order.user_id', userId)
                .eq('order.status', 'paid')

            if (!dateRange.allTime) {
                ordersQuery = ordersQuery
                    .gte('order.created_at', dateRange.from)
                    .lte('order.created_at', dateRange.to)
            }

            const { data: soldItems } = await ordersQuery

            const salesMap: Record<string, { qty: number; revenue: number }> = {}
            for (const row of soldItems ?? []) {
                const id = row.menu_item_id as string
                if (!salesMap[id]) salesMap[id] = { qty: 0, revenue: 0 }
                salesMap[id].qty += Number(row.quantity)
                salesMap[id].revenue += Number(row.quantity) * Number(row.unit_price)
            }

            const enriched = (menuItems ?? []).map((item) => ({
                ...item,
                units_sold: salesMap[item.id]?.qty ?? 0,
                revenue: salesMap[item.id]?.revenue ?? 0,
            }))

            return { intent, source, rows: enriched as Record<string, unknown>[], meta: { dateRange } }
        }


        case 'vendor_overview': {
            let query = supabase
                .from('vendors')
                .select('id, name, phone, email, created_at')
                .eq('user_id', userId)
                .order('name', { ascending: true })

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return { intent, source, rows: (data ?? []) as Record<string, unknown>[], meta: {} }
        }

        default:
            return { intent: 'fallback', source, rows: [], meta: {} }
    }
}