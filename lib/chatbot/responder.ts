import type { Intent } from './intents'
import type { FetchedData } from './fetcher'
import type { QueryParams } from './extractor'

function fmt(amount: number, currency: string): string {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]
}

export function buildResponse(
    data: FetchedData,
    params: QueryParams,
    currency: string,
): string {
    const { intent, rows } = data
    const { dateRange } = params
    const period = dateRange.label

    switch (intent) {

        // ── Revenue ───────────────────────────────────────────────────────────────
        case 'revenue_today':
        case 'revenue_range': {
            if (rows.length === 0) {
                return pick([
                    `No paid orders found for **${period}**. Looks like a quiet stretch — things may pick up soon!`,
                    `I couldn't find any completed sales for **${period}**. Nothing paid yet in that window.`,
                ])
            }

            const totalRevenue = rows.reduce((s, r) => s + Number(r.grand_total), 0)
            const totalDiscount = rows.reduce((s, r) => s + Number(r.discount_total), 0)
            const totalTax = rows.reduce((s, r) => s + Number(r.tax_total), 0)
            const count = rows.length

            const byType: Record<string, number> = {}
            for (const r of rows) {
                const t = String(r.order_type)
                byType[t] = (byType[t] ?? 0) + 1
            }

            const typeLines = Object.entries(byType)
                .map(([t, c]) => `- ${t.replace('_', ' ')}: ${c} order${c === 1 ? '' : 's'}`)
                .join('\n')

            return pick([
                `Here's your revenue summary for **${period}**:

**Revenue Breakdown**
- Orders completed: **${count}**
- Gross revenue: ${fmt(totalRevenue + totalDiscount, currency)}
- Discounts applied: -${fmt(totalDiscount, currency)}
- Tax collected: ${fmt(totalTax, currency)}
- **Net revenue: ${fmt(totalRevenue, currency)}**

**Order Types**
${typeLines}`,

                `Revenue report for **${period}**:

**${fmt(totalRevenue, currency)}** total from **${count} paid order${count === 1 ? '' : 's'}**.

- Discounts given: -${fmt(totalDiscount, currency)}
- Tax: ${fmt(totalTax, currency)}

**Breakdown by type**
${typeLines}`,
            ])
        }

        // ── Order Count ───────────────────────────────────────────────────────────
        case 'order_count': {
            const count = rows.length
            if (count === 0) {
                return `No orders found for **${period}**. Nothing recorded in that time window yet.`
            }
            const byType: Record<string, number> = {}
            for (const r of rows) {
                const t = String(r.order_type)
                byType[t] = (byType[t] ?? 0) + 1
            }
            const typeLines = Object.entries(byType)
                .map(([t, c]) => `- ${t.replace('_', ' ')}: **${c}**`)
                .join('\n')

            return pick([
                `You received **${count} order${count === 1 ? '' : 's'}** for **${period}**.\n\n**By type**\n${typeLines}`,
                `Order count for **${period}**: **${count} total**.\n\n${typeLines}`,
            ])
        }

        // ── Average Ticket ────────────────────────────────────────────────────────
        case 'avg_ticket': {
            if (rows.length === 0) {
                return `No paid orders for **${period}**, so the average ticket can't be calculated yet.`
            }
            const total = rows.reduce((s, r) => s + Number(r.grand_total), 0)
            const avg = total / rows.length
            return pick([
                `Your average order value for **${period}** is **${fmt(avg, currency)}** across ${rows.length} orders.`,
                `Average ticket for **${period}**: **${fmt(avg, currency)}** (${rows.length} paid orders).`,
            ])
        }

        // ── Top Items ─────────────────────────────────────────────────────────────
        case 'top_items': {
            if (rows.length === 0) {
                return `No item sales found for **${period}**. No paid orders with items in that window.`
            }

            const tableRows = rows
                .map((r, i) => `| ${i + 1}. ${r.name} | ${r.quantity} | ${fmt(Number(r.revenue), currency)} |`)
                .join('\n')

            return pick([
                `Here are your top-selling items for **${period}**:

| Item | Units Sold | Revenue |
|------|-----------|---------|
${tableRows}

**#1 winner: ${rows[0].name}** with ${rows[0].quantity} units sold.`,

                `Best performers for **${period}**:

| Item | Units Sold | Revenue |
|------|-----------|---------|
${tableRows}

Your star item is **${rows[0].name}** — keep it well stocked!`,
            ])
        }

        // ── Low Stock ─────────────────────────────────────────────────────────────
        case 'low_stock': {
            if (rows.length === 0) {
                return pick([
                    `All inventory items are above their reorder threshold. Stock levels look healthy! ✓`,
                    `No low stock alerts right now. Everything is sufficiently stocked.`,
                ])
            }

            const lines = rows
                .map((r) => `- **${r.name}** — ${r.quantity_on_hand} ${r.unit} remaining (reorder at ${r.reorder_threshold} ${r.unit})`)
                .join('\n')

            return pick([
                `⚠️ **${rows.length} item${rows.length === 1 ? '' : 's'} need restocking:**

${lines}

Place orders for these soon to avoid running out mid-service.`,

                `Low stock alert — **${rows.length} item${rows.length === 1 ? '' : 's'} below threshold:**

${lines}

Recommend restocking before your next peak service.`,
            ])
        }

        // ── Inventory Overview ────────────────────────────────────────────────────
        case 'inventory_overview': {
            if (rows.length === 0) {
                return `No inventory items found. Add your ingredients and supplies in the Inventory section.`
            }

            const lowCount = rows.filter(
                (r) => Number(r.quantity_on_hand) <= Number(r.reorder_threshold),
            ).length

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

        // ── Customers ─────────────────────────────────────────────────────────────
        case 'customer_count': {
            const total = rows.length
            const thisMonth = rows.filter((r) => {
                const d = new Date(String(r.created_at))
                const now = new Date()
                return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
            }).length

            if (total === 0) {
                return `No registered customers yet. Start adding them through the Customers section or the POS.`
            }

            return pick([
                `**Customer Overview**

- Total registered customers: **${total}**
- New this month: **${thisMonth}**

Use the Customers page to view loyalty points and contact details.`,

                `You have **${total} registered customer${total === 1 ? '' : 's'}** in your system. **${thisMonth}** joined this month.`,
            ])
        }

        // ── Customer Loyalty ──────────────────────────────────────────────────────
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

        // ── Staff ─────────────────────────────────────────────────────────────────
        case 'staff_overview': {
            const active = rows.filter((r) => r.is_active)
            const inactive = rows.filter((r) => !r.is_active)

            if (rows.length === 0) {
                return `No staff members found. Add your team in the Staff section.`
            }

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

            return pick([
                `**Staff Overview**

- Active staff: **${active.length}**
- Inactive: **${inactive.length}**

**Today's attendance:**
${lines}`,

                `You have **${active.length} active staff member${active.length === 1 ? '' : 's'}**.

**Today:**
${lines}`,
            ])
        }

        // ── Menu Performance ──────────────────────────────────────────────────────
        case 'menu_performance': {
            const activeItems = rows.filter((r) => r.is_active)
            const inactiveItems = rows.filter((r) => !r.is_active)
            const topSellers = [...rows]
                .sort((a, b) => Number(b.units_sold) - Number(a.units_sold))
                .filter((r) => Number(r.units_sold) > 0)
                .slice(0, 5)

            const zeroSales = activeItems.filter((r) => Number(r.units_sold) === 0)

            const topLines = topSellers.length > 0
                ? topSellers
                    .map((r, i) => `${i + 1}. **${r.name}** — ${r.units_sold} sold · ${fmt(Number(r.revenue), currency)}`)
                    .join('\n')
                : 'No sales recorded for this period.'

            return `**Menu Performance for ${period}**

- Active items: **${activeItems.length}**
- Inactive items: **${inactiveItems.length}**

**Top sellers:**
${topLines}

${zeroSales.length > 0 ? `**No sales yet:** ${zeroSales.map((r) => r.name).join(', ')} — consider a promotion.` : '✓ All active items had at least one sale.'}`
        }

        // ── Vendors ───────────────────────────────────────────────────────────────
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

        // ── Fallback ──────────────────────────────────────────────────────────────
        default:
            return `I'm not sure how to answer that yet. Here are things I can help you with:

- **Revenue & sales** — "How much did I earn today?" / "Revenue this week"
- **Orders** — "How many orders today?" / "Average order value"
- **Top items** — "What are my top 5 selling items?"
- **Inventory** — "What's low on stock?" / "Show me inventory"
- **Customers** — "How many customers do I have?" / "Top loyal customers"
- **Staff** — "Show me staff overview" / "Who is active today?"
- **Menu** — "How is my menu performing?"
- **Vendors** — "Show me my vendors"

Try selecting the right data source from the dropdown and rephrasing your question.`
    }
}