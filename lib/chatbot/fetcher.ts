import type { SupabaseClient } from '@supabase/supabase-js'
import type { Intent, DataSource } from './intents'
import type { QueryParams } from './extractor'

export interface FetchedData {
    intent: Intent
    source: DataSource
    rows: Record<string, unknown>[]
    meta: Record<string, unknown>
}

export async function fetchData(
    supabase: SupabaseClient,
    userId: string,
    locationId: string | null,
    intent: Intent,
    params: QueryParams,
    source: DataSource,
): Promise<FetchedData> {
    const { dateRange, limit } = params

    switch (intent) {

        // ── Orders / Revenue ──────────────────────────────────────────────────────
        case 'revenue_today':
        case 'revenue_range':
        case 'order_count':
        case 'avg_ticket': {
            let query = supabase
                .from('orders')
                .select('id, order_type, status, subtotal, discount_total, tax_total, grand_total, payment_method, created_at, closed_at')
                .eq('user_id', userId)
                .eq('status', 'paid')
                .gte('created_at', dateRange.from)
                .lte('created_at', dateRange.to)
                .order('created_at', { ascending: false })

            if (locationId) query = query.eq('location_id', locationId)

            const { data } = await query
            return {
                intent,
                source,
                rows: (data ?? []) as Record<string, unknown>[],
                meta: { dateRange },
            }
        }

        // ── Top Items ─────────────────────────────────────────────────────────────
        case 'top_items': {
            let query = supabase
                .from('order_items')
                .select('menu_item_id, quantity, unit_price, order:orders!inner(status, created_at, location_id, user_id)')
                .eq('order.user_id', userId)
                .eq('order.status', 'paid')
                .gte('order.created_at', dateRange.from)
                .lte('order.created_at', dateRange.to)

            if (locationId) query = query.eq('order.location_id', locationId)

            const { data: itemRows } = await query

            // Also fetch menu item names
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('id, name, price')
                .eq('user_id', userId)

            const nameMap = Object.fromEntries((menuItems ?? []).map((m) => [m.id, m.name]))

            // Aggregate by menu_item_id
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

        // ── Inventory ─────────────────────────────────────────────────────────────
        case 'low_stock': {
            let query = supabase
                .from('inventory_items')
                .select('id, name, unit, quantity_on_hand, reorder_threshold, cost_per_unit')
                .eq('user_id', userId)
                .filter('quantity_on_hand', 'lte', supabase.rpc) // handled below

            // Supabase doesn't support column comparison directly in filter,
            // so we fetch all and filter in JS
            let allQuery = supabase
                .from('inventory_items')
                .select('id, name, unit, quantity_on_hand, reorder_threshold, cost_per_unit')
                .eq('user_id', userId)

            if (locationId) allQuery = allQuery.eq('location_id', locationId)

            const { data } = await allQuery
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

        // ── Customers ─────────────────────────────────────────────────────────────
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

        // ── Staff ─────────────────────────────────────────────────────────────────
        case 'staff_overview': {
            const { data } = await supabase
                .from('staff_members')
                .select('id, full_name, role, is_active, phone, email, salary, location_id')
                .eq('user_id', userId)
                .order('full_name', { ascending: true })

            // Fetch today's attendance
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

            return { intent, source, rows: enriched as Record<string, unknown>[], meta: {} }
        }

        // ── Menu ──────────────────────────────────────────────────────────────────
        case 'menu_performance': {
            let query = supabase
                .from('menu_items')
                .select('id, name, price, is_active, category_id')
                .eq('user_id', userId)
                .order('name', { ascending: true })

            if (locationId) query = query.eq('location_id', locationId)

            const { data: menuItems } = await query

            // Get sales for this period
            let ordersQuery = supabase
                .from('order_items')
                .select('menu_item_id, quantity, unit_price, order:orders!inner(status, created_at, user_id)')
                .eq('order.user_id', userId)
                .eq('order.status', 'paid')
                .gte('order.created_at', dateRange.from)
                .lte('order.created_at', dateRange.to)

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

        // ── Vendors ───────────────────────────────────────────────────────────────
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