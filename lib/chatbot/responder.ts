import type { Intent } from './intents'
import type { FetchedData } from './fetcher'
import type { QueryParams } from './extractor'

function fmt(amount: number, currency: string): string {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function buildResponse(
    data: FetchedData,
    params: QueryParams,
    currency: string,
): string {
    const { intent, rows, meta } = data
    const { dateRange, wantsContact } = params
    const period = dateRange.label

    switch (intent) {

        case 'revenue_today':
        case 'revenue_range': {
            if (rows.length === 0) {
                return `No paid orders found for **${period}**. Looks like a quiet stretch — things may pick up soon!`
            }

            const totalRevenue = rows.reduce((s, r) => s + Number(r.grand_total), 0)
            const totalDiscount = rows.reduce((s, r) => s + Number(r.discount_total), 0)
            const totalTax = rows.reduce((s, r) => s + Number(r.tax_total), 0)
            const count = rows.length

            const byType: Record<string, number> = {}
            for (const r of rows) {
                const type = String(r.order_type)
                byType[type] = (byType[type] ?? 0) + 1
            }
            const typeLines = Object.entries(byType)
                .map(([type, c]) => `- ${type.replace('_', ' ')}: ${c} order${c === 1 ? '' : 's'}`)
                .join('\n')

            return `Here's your revenue summary for **${period}**:

**Revenue Breakdown**
- Orders completed: **${count}**
- Gross revenue: ${fmt(totalRevenue + totalDiscount, currency)}
- Discounts applied: -${fmt(totalDiscount, currency)}
- Tax collected: ${fmt(totalTax, currency)}
- **Net revenue: ${fmt(totalRevenue, currency)}**

**Order Types**
${typeLines}`
        }

        case 'order_count': {
            if (rows.length === 0) {
                return `No orders found for **${period}**. Nothing recorded in that time window yet.`
            }

            const count = rows.length
            const statuses = Array.isArray(meta.statuses) ? (meta.statuses as string[]) : ['paid']

            const byType: Record<string, number> = {}
            for (const r of rows) {
                const type = String(r.order_type)
                byType[type] = (byType[type] ?? 0) + 1
            }
            const typeLines = Object.entries(byType)
                .map(([type, c]) => `- ${type.replace('_', ' ')}: **${c}**`)
                .join('\n')

            let statusBlock = ''
            if (statuses.length > 1) {
                const byStatus: Record<string, number> = {}
                for (const r of rows) {
                    const status = String(r.status)
                    byStatus[status] = (byStatus[status] ?? 0) + 1
                }
                const statusLines = Object.entries(byStatus)
                    .map(([status, c]) => `- ${status}: **${c}**`)
                    .join('\n')
                statusBlock = `\n\n**By status**\n${statusLines}`
            }

            return `Order count for **${period}**: **${count} total**.\n\n**By type**\n${typeLines}${statusBlock}`
        }

        case 'highest_order': {
            if (rows.length === 0) {
                return `No orders found for **${period}**, so there's no highest order to show yet.`
            }

            const order = rows[0]
            const date = new Date(String(order.created_at)).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            })

            return `The highest order for **${period}** was **${fmt(Number(order.grand_total), currency)}** — a ${String(order.order_type).replace('_', ' ')} order placed on ${date}.

Status: **${String(order.status)}**
Payment method: ${String(order.payment_method ?? 'N/A')}`
        }

        case 'top_customers_by_orders': {
            if (rows.length === 0) {
                return `No customer order history found for **${period}**. Orders may not be linked to registered customers yet.`
            }

            const rankBy = meta.rankBy === 'spend' ? 'spend' : 'orders'
            const lines = rows
                .map((r, i) => `${i + 1}. **${r.name}** — ${r.orders} order${Number(r.orders) === 1 ? '' : 's'} · ${fmt(Number(r.total), currency)} spent`)
                .join('\n')

            const winnerLine = rankBy === 'spend'
                ? `**Top spender: ${rows[0].name}** with ${fmt(Number(rows[0].total), currency)} spent.`
                : `**Most frequent: ${rows[0].name}** with ${rows[0].orders} orders.`

            return `Customers ranked for **${period}**:

${lines}

${winnerLine}`
        }

        case 'avg_ticket': {
            if (rows.length === 0) {
                return `No paid orders for **${period}**, so the average ticket can't be calculated yet.`
            }

            const amounts = rows.map((r) => Number(r.grand_total))
            const total = amounts.reduce((s, a) => s + a, 0)
            const avg = total / rows.length
            const min = Math.min(...amounts)
            const max = Math.max(...amounts)

            return `Average ticket for **${period}**: **${fmt(avg, currency)}** across ${rows.length} paid order${rows.length === 1 ? '' : 's'}.

Smallest order: ${fmt(min, currency)}
Largest order: ${fmt(max, currency)}`
        }

        case 'top_items': {
            if (rows.length === 0) {
                return `No item sales found for **${period}**. No paid orders with items in that window.`
            }

            const tableRows = rows
                .map((r, i) => `| ${i + 1}. ${r.name} | ${r.quantity} | ${fmt(Number(r.revenue), currency)} |`)
                .join('\n')

            return `Here are your top-selling items for **${period}**:

| Item | Units Sold | Revenue |
|------|-----------|---------|
${tableRows}

**#1 winner: ${rows[0].name}** with ${rows[0].quantity} units sold.`
        }

        case 'low_stock': {
            if (rows.length === 0) {
                return `All inventory items are above their reorder threshold. Stock levels look healthy! ✓`
            }

            const lines = rows
                .map((r) => `- **${r.name}** — ${r.quantity_on_hand} ${r.unit} remaining (reorder at ${r.reorder_threshold} ${r.unit})`)
                .join('\n')

            return `⚠️ **${rows.length} item${rows.length === 1 ? '' : 's'} need restocking:**

${lines}

Place orders for these soon to avoid running out mid-service.`
        }

        case 'inventory_overview': {
            if (rows.length === 0) {
                return `No inventory items found. Add your ingredients and supplies in the Inventory section.`
            }

            const lowCount = rows.filter((r) => Number(r.quantity_on_hand) <= Number(r.reorder_threshold)).length

            const lines = rows
                .slice(0, 10)
                .map((r) => {
                    const isLow = Number(r.quantity_on_hand) <= Number(r.reorder_threshold)
                    return `- ${r.name}: **${r.quantity_on_hand} ${r.unit}**${isLow ? ' ⚠️' : ' ✓'}`
                })
                .join('\n')

            const extra = rows.length > 10 ? `\n\n...and ${rows.length - 10} more items.` : ''

            return `Here's your inventory snapshot:

**${rows.length} total items** — ${lowCount > 0 ? `⚠️ ${lowCount} below reorder level` : '✓ all stocked'}

${lines}${extra}`
        }

        case 'customer_count': {
            if (rows.length === 0) {
                return `No registered customers yet. Start adding them through the Customers section or the POS.`
            }

            if (wantsContact) {
                const lines = rows
                    .map((r) => `- **${r.full_name}** — ${r.email ?? 'no email'} · ${r.phone ?? 'no phone'} · ${r.loyalty_points} pts`)
                    .join('\n')

                return `**Customer Directory**

${lines}`
            }

            const total = rows.length
            const thisMonth = rows.filter((r) => {
                const d = new Date(String(r.created_at))
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length

            return `**Customer Overview**

- Total registered customers: **${total}**
- New this month: **${thisMonth}**

Use the Customers page to view loyalty points and contact details.`
        }

        case 'customer_loyalty': {
            if (rows.length === 0) {
                return `No customers with loyalty points found yet.`
            }

            const lines = rows
                .map((r, i) => `${i + 1}. **${r.full_name}** — ${r.loyalty_points} pts${r.phone ? ` · ${r.phone}` : ''}`)
                .join('\n')

            return `**Top loyal customers:**

${lines}

Consider rewarding your top customers with a discount or free item to keep them coming back.`
        }

        case 'staff_overview': {
            const role = typeof meta.role === 'string' ? meta.role : null

            if (rows.length === 0) {
                return role
                    ? `No staff members found with the role **${role}**.`
                    : `No staff members found. Add your team in the Staff section.`
            }

            if (wantsContact) {
                const lines = rows
                    .map((r) => `- **${r.full_name}** (${String(r.role).replace('_', ' ')}) — ${r.email ?? 'no email'} · ${r.phone ?? 'no phone'}`)
                    .join('\n')

                return `**Staff Directory**${role ? ` — role: ${role}` : ''}

${lines}`
            }

            const active = rows.filter((r) => r.is_active)
            const inactive = rows.filter((r) => !r.is_active)

            const lines = active
                .slice(0, 10)
                .map((r) => {
                    const status = r.today_status === 'present'
                        ? '🟢 present'
                        : r.today_status === 'absent'
                            ? '🔴 absent'
                            : '⚪ not marked'
                    return `- **${r.full_name}** (${String(r.role).replace('_', ' ')}) — ${status}`
                })
                .join('\n')

            return `**Staff Overview**${role ? ` — role: ${role}` : ''}

- Active staff: **${active.length}**
- Inactive: **${inactive.length}**

**Today's attendance:**
${lines}`
        }

        case 'menu_performance': {
            const activeItems = rows.filter((r) => r.is_active)
            const inactiveItems = rows.filter((r) => !r.is_active)
            const topSellers = [...rows]
                .sort((a, b) => Number(b.units_sold) - Number(a.units_sold))
                .filter((r) => Number(r.units_sold) > 0)

            const zeroSales = activeItems.filter((r) => Number(r.units_sold) === 0)

            if (topSellers.length === 0) {
                return `No item sales found for **${period}**. ${activeItems.length} active item${activeItems.length === 1 ? '' : 's'} on your menu, none sold yet.`
            }

            const topLines = topSellers
                .slice(0, 5)
                .map((r, i) => `${i + 1}. **${r.name}** — ${r.units_sold} sold · ${fmt(Number(r.revenue), currency)}`)
                .join('\n')

            return `**Menu Performance for ${period}**

- Active items: **${activeItems.length}**
- Inactive items: **${inactiveItems.length}**

**Top sellers:**
${topLines}

${zeroSales.length > 0 ? `**No sales yet:** ${zeroSales.map((r) => r.name).join(', ')} — consider a promotion.` : '✓ All active items had at least one sale.'}`
        }

        case 'vendor_overview': {
            if (rows.length === 0) {
                return `No vendors found. Add your suppliers in the Vendors section.`
            }

            const lines = rows
                .slice(0, 10)
                .map((r) => `- **${r.name}**${r.phone ? ` · ${r.phone}` : ''}${r.email ? ` · ${r.email}` : ''}`)
                .join('\n')

            return `**Your Vendors (${rows.length} total):**

${lines}`
        }

        default:
            return `I'm not sure how to answer that yet. Here are things I can help you with:

- **Revenue & sales** — "How much did I earn today?" / "Revenue this week"
- **Orders** — "How many orders today?" / "Average order value" / "Highest paid order"
- **Top items** — "What are my top 5 selling items?"
- **Customers** — "How many customers do I have?" / "Which customer ordered the most?" / "Who's my biggest spender?"
- **Inventory** — "What's low on stock?" / "Show me inventory"
- **Staff** — "Show me staff overview" / "Who is active today?"
- **Menu** — "How is my menu performing?"
- **Vendors** — "Show me my vendors"

Try selecting the right data source from the dropdown and rephrasing your question.`
    }
}