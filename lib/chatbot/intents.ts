export type Intent =
    | 'revenue_today'
    | 'revenue_range'
    | 'order_count'
    | 'top_items'
    | 'low_stock'
    | 'customer_count'
    | 'customer_loyalty'
    | 'staff_overview'
    | 'menu_performance'
    | 'avg_ticket'
    | 'inventory_overview'
    | 'vendor_overview'
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
        keywords: ['staff', 'employee', 'team', 'worker', 'who is working', 'on shift', 'attendance', 'active staff'],
    },
    {
        intent: 'menu_performance',
        keywords: ['menu', 'item', 'dish', 'product', 'price', 'category', 'active item', 'inactive'],
    },
    {
        intent: 'vendor_overview',
        keywords: ['vendor', 'supplier', 'vendor list', 'supplier list'],
    },
]

export function detectIntent(message: string, source: DataSource): Intent {
    const lower = message.toLowerCase()

    // Try message keyword matching first
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some((kw) => lower.includes(kw))) {
            return rule.intent
        }
    }

    // Fallback: infer from selected source
    const sourceIntentMap: Record<DataSource, Intent> = {
        orders: 'revenue_today',
        inventory: 'inventory_overview',
        customers: 'customer_count',
        staff: 'staff_overview',
        menu: 'menu_performance',
        reports: 'revenue_range',
        vendors: 'vendor_overview',
    }

    return sourceIntentMap[source] ?? 'fallback'
}