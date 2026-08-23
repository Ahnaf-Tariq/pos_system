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

    minScore?: number
}

const INTENT_RULES: IntentRule[] = [
    {
        intent: 'highest_order',
        keywords: [
            'highest order', 'highest paid order', 'highest value order',
            'biggest order', 'largest order', 'most expensive order',
            'max order', 'biggest bill', 'largest bill', 'highest bill',
        ],
    },
    {
        intent: 'top_customers_by_orders',
        keywords: [
            'most orders', 'did the most orders', 'ordered the most',
            'who ordered the most', 'highest number of orders',
            'most frequent customer', 'most active customer', 'busiest customer',
            'spent the most', 'biggest spender', 'highest spending customer',
            'highest paying customer', 'top customer by orders',
            'customer who ordered', 'which customer',
        ],
    },
    {
        intent: 'revenue_today',
        keywords: [
            'revenue today', 'sales today', 'how much today',
            'earned today', 'made today', 'income today', 'money today',
            'earning today', 'profit today',
        ],
    },
    {
        intent: 'revenue_range',
        keywords: [
            'revenue', 'sales', 'earned', 'income', 'how much', 'total money',
            'gross', 'net', 'profit', 'earning', 'total sales', 'total revenue',
            'how much money', 'how much did', 'how much have',
        ],
    },
    {
        intent: 'top_items',
        keywords: [
            'top', 'best selling', 'best item', 'popular', 'most ordered',
            'most sold', 'highest selling', 'top selling', 'favourite', 'favorite',
            'which item sells', 'what sells', 'what item', 'items sold',
            'sold the most', 'most popular item', 'best product',
        ],
    },
    {
        intent: 'order_count',
        keywords: [
            'how many orders', 'order count', 'number of orders',
            'orders received', 'total orders', 'orders today', 'orders this',
            'count orders', 'orders paid', 'orders cancelled', 'orders canceled',
            'orders void', 'give me my orders', 'show me my orders',
            'show orders', 'list orders', 'my orders', 'all orders',
            'paid and cancelled', 'cancelled and paid', 'paid and canceled',
        ],
    },
    {
        intent: 'avg_ticket',
        keywords: [
            'average order', 'avg order', 'average ticket', 'avg ticket',
            'average value', 'order value', 'ticket size', 'average bill',
            'mean order', 'typical order',
        ],
    },
    {
        intent: 'low_stock',
        keywords: [
            'low stock', 'running out', 'reorder', 'out of stock', 'shortage',
            'need to restock', 'below threshold', 'stock alert', 'finish soon',
            'almost out', 'nearly out', 'need to order',
        ],
    },
    {
        intent: 'inventory_overview',
        keywords: [
            'inventory', 'stock', 'supplies', 'ingredients', 'raw material',
            'quantity', 'what do i have', 'what stock', 'current stock',
            'stock level', 'how much stock',
        ],
    },
    {
        intent: 'customer_loyalty',
        keywords: [
            'loyalty', 'points', 'reward', 'top customer', 'best customer',
            'loyal', 'loyalty points', 'who has most points', 'most points',
        ],
    },
    {
        intent: 'customer_count',
        keywords: [
            'customer', 'client', 'how many customer', 'registered',
            'walk-in', 'new customer', 'total customers', 'my customers',
            'show customers', 'list customers', 'all customers',
        ],
    },
    {
        intent: 'staff_overview',
        keywords: [
            'staff', 'employee', 'team', 'worker', 'who is working',
            'on shift', 'attendance', 'active staff', 'cashier', 'manager',
            'kitchen', 'waiter', 'chef', 'my staff', 'show staff',
            'staff details', 'staff list', 'staff members', 'how many staff',
            'staff count', 'who is present', 'who came today',
        ],
    },
    {
        intent: 'menu_performance',
        keywords: [
            'menu', 'how many items', 'items are sold', 'items sold from my menu',
            'dish', 'product', 'price', 'category', 'active item', 'inactive',
            'menu items', 'my menu', 'show menu', 'what is on my menu',
            'menu performance', 'which dish',
        ],
    },
    {
        intent: 'vendor_overview',
        keywords: [
            'vendor', 'supplier', 'vendor list', 'supplier list',
            'my vendors', 'show vendors', 'all vendors',
        ],
    },
]

const SOURCE_INTENT_MAP: Record<DataSource, Intent> = {
    orders: 'order_count',
    inventory: 'inventory_overview',
    customers: 'customer_count',
    staff: 'staff_overview',
    menu: 'menu_performance',
    reports: 'revenue_range',
    vendors: 'vendor_overview',
}

const INTENT_SOURCE_AFFINITY: Partial<Record<Intent, DataSource[]>> = {
    revenue_today: ['orders', 'reports'],
    revenue_range: ['orders', 'reports'],
    order_count: ['orders'],
    top_items: ['orders', 'menu'],
    avg_ticket: ['orders', 'reports'],
    highest_order: ['orders'],
    top_customers_by_orders: ['customers', 'orders'],
    low_stock: ['inventory'],
    inventory_overview: ['inventory'],
    customer_count: ['customers'],
    customer_loyalty: ['customers'],
    staff_overview: ['staff'],
    menu_performance: ['menu'],
    vendor_overview: ['vendors'],
}

interface ScoredIntent {
    intent: Intent
    score: number
    matchedChars: number
}

function scoreIntents(message: string, source: DataSource): ScoredIntent[] {
    const lower = message.toLowerCase()

    return INTENT_RULES.map((rule) => {
        let score = 0
        let matchedChars = 0

        for (const kw of rule.keywords) {
            if (lower.includes(kw)) {

                const kwScore = kw.split(' ').length
                score += kwScore
                matchedChars += kw.length
            }
        }


        const affineSources = INTENT_SOURCE_AFFINITY[rule.intent] ?? []
        if (affineSources.includes(source) && score > 0) {
            score += 2
        }

        return { intent: rule.intent, score, matchedChars }
    })
}

export function detectIntent(message: string, source: DataSource): Intent {
    const scored = scoreIntents(message, source)
    const maxScore = Math.max(...scored.map((s) => s.score))


    if (maxScore === 0) return SOURCE_INTENT_MAP[source] ?? 'fallback'

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

    if (strong.length === 0) return [detectIntent(message, source)]


    return strong.slice(0, 2).map((s) => s.intent)
}