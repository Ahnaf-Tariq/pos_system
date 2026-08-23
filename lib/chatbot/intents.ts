export type Intent =
    | 'revenue_today'
    | 'revenue_range'
    | 'order_count'
    | 'top_items'
    | 'low_stock'
    | 'customer_count'
    | 'customer_loyalty'
    | 'top_customers_by_orders'
    | 'staff_overview'
    | 'menu_performance'
    | 'avg_ticket'
    | 'inventory_overview'
    | 'vendor_overview'
    | 'highest_order'
    | 'fallback'

export type DataSource =
    | 'orders'
    | 'inventory'
    | 'customers'
    | 'staff'
    | 'menu'
    | 'reports'
    | 'vendors'

interface IntentRule {
    intent: Intent
    keywords: string[]
}

const INTENT_RULES: IntentRule[] = [
    {
        intent: 'revenue_today',
        keywords: ['revenue today', 'sales today', 'how much today', 'earned today', 'made today', 'income today', 'money today'],
    },
    {
        intent: 'revenue_range',
        keywords: ['revenue', 'sales', 'earned', 'income', 'how much', 'total money', 'gross', 'net'],
    },
    {
        intent: 'highest_order',
        keywords: ['highest order', 'highest paid order', 'highest value order', 'biggest order', 'largest order', 'most expensive order', 'max order'],
    },
    {
        intent: 'top_customers_by_orders',
        keywords: ['most orders', 'did the most orders', 'ordered the most', 'who ordered the most', 'highest number of orders', 'most frequent customer', 'most active customer', 'busiest customer', 'spent the most', 'biggest spender', 'highest spending customer', 'highest paying customer', 'top customer by orders'],
    },
    {
        intent: 'top_items',
        keywords: ['top', 'best selling', 'best item', 'popular', 'most ordered', 'most sold', 'highest selling', 'top selling', 'favourite', 'favorite'],
    },
    {
        intent: 'order_count',
        keywords: ['how many orders', 'order count', 'number of orders', 'orders received', 'total orders', 'orders today', 'orders this'],
    },
    {
        intent: 'avg_ticket',
        keywords: ['average order', 'avg order', 'average ticket', 'avg ticket', 'average value', 'order value', 'ticket size'],
    },
    {
        intent: 'low_stock',
        keywords: ['low stock', 'running out', 'reorder', 'out of stock', 'shortage', 'need to restock', 'below threshold', 'stock alert'],
    },
    {
        intent: 'inventory_overview',
        keywords: ['inventory', 'stock', 'supplies', 'ingredients', 'raw material', 'quantity'],
    },
    {
        intent: 'customer_loyalty',
        keywords: ['loyalty', 'points', 'reward', 'top customer', 'best customer', 'loyal'],
    },
    {
        intent: 'customer_count',
        keywords: ['customer', 'client', 'how many customer', 'registered', 'walk-in', 'new customer'],
    },
    {
        intent: 'staff_overview',
        keywords: ['staff', 'employee', 'team', 'worker', 'who is working', 'on shift', 'attendance', 'active staff', 'cashier', 'manager', 'kitchen', 'waiter', 'chef', 'owner'],
    },
    {
        intent: 'menu_performance',
        keywords: ['menu', 'item', 'items sold', 'items are sold', 'dish', 'product', 'price', 'category', 'active item', 'inactive'],
    },
    {
        intent: 'vendor_overview',
        keywords: ['vendor', 'supplier', 'vendor list', 'supplier list'],
    },
]

const SOURCE_INTENT_MAP: Record<DataSource, Intent> = {
    orders: 'revenue_today',
    inventory: 'inventory_overview',
    customers: 'customer_count',
    staff: 'staff_overview',
    menu: 'menu_performance',
    reports: 'revenue_range',
    vendors: 'vendor_overview',
}

interface ScoredIntent {
    intent: Intent
    score: number
    matchedChars: number
}

function scoreIntents(message: string, source: DataSource): ScoredIntent[] {
    const lower = message.toLowerCase()
    const sourceDefaultIntent = SOURCE_INTENT_MAP[source]

    return INTENT_RULES.map((rule) => {
        let score = 0
        let matchedChars = 0

        for (const kw of rule.keywords) {
            if (lower.includes(kw)) {
                score += 1
                matchedChars += kw.length
            }
        }

        if (rule.intent === sourceDefaultIntent && score > 0) {
            score += 3
        }

        return { intent: rule.intent, score, matchedChars }
    })
}

export function detectIntent(message: string, source: DataSource): Intent {
    const scored = scoreIntents(message, source)
    const maxScore = Math.max(...scored.map((s) => s.score))

    if (maxScore === 0) {
        return SOURCE_INTENT_MAP[source] ?? 'fallback'
    }

    const topScored = scored.filter((s) => s.score === maxScore)
    if (topScored.length === 1) return topScored[0].intent

    topScored.sort((a, b) => b.matchedChars - a.matchedChars)
    return topScored[0].intent
}

export function detectAllIntents(message: string, source: DataSource): Intent[] {
    const scored = scoreIntents(message, source)
    const strong = scored
        .filter((s) => s.score >= 2)
        .sort((a, b) => (b.score - a.score) || (b.matchedChars - a.matchedChars))

    if (strong.length === 0) {
        return [detectIntent(message, source)]
    }

    return strong.slice(0, 2).map((s) => s.intent)
}