export interface DateRange {
    from: string
    to: string
    label: string
    allTime: boolean
}

export type RankBy = 'orders' | 'spend'

export interface QueryParams {
    dateRange: DateRange
    limit: number
    nameHint: string | null
    statuses: string[]
    wantsContact: boolean
    rankBy: RankBy
}

const ALL_TIME_PHRASES = [
    'all time', 'all-time', 'ever', 'overall', 'since beginning', 'all orders',
    'everything', 'historically', 'total ever', 'of all time', 'till now',
    'till date', 'to date', 'so far', 'from start', 'from beginning',
    'all of my', 'complete history',
]

const STATUS_KEYWORD_MAP: Record<string, string> = {
    paid: 'paid',
    payment: 'paid',
    completed: 'paid',
    complete: 'paid',
    done: 'paid',
    successful: 'paid',
    success: 'paid',
    cancelled: 'void',
    canceled: 'void',
    cancel: 'void',
    void: 'void',
    voided: 'void',
    refunded: 'refunded',
    refund: 'refunded',
    pending: 'pending',
    'sent to kitchen': 'sent_to_kitchen',
    kitchen: 'sent_to_kitchen',
    open: 'open',
}

const CONTACT_KEYWORDS = [
    'email', 'phone', 'contact number', 'contact detail', 'contact info',
    'mobile', 'whatsapp', 'number',
]

const SPEND_RANK_KEYWORDS = [
    'spent the most', 'spent most', 'biggest spender', 'highest spending',
    'highest paying', 'most money', 'most spend', 'top spender',
]

function startOfDay(date: Date): Date {
    const d = new Date(date); d.setHours(0, 0, 0, 0); return d
}
function endOfDay(date: Date): Date {
    const d = new Date(date); d.setHours(23, 59, 59, 999); return d
}
function startOfWeek(date: Date): Date {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
}
function startOfMonth(date: Date): Date {
    const d = new Date(date); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}
function toISO(date: Date): string { return date.toISOString() }

function extractRollingDays(lower: string): number | null {
    const m = lower.match(/last\s+(\d+)\s+days?/)
    return m ? parseInt(m[1], 10) : null
}

function extractStatuses(lower: string): string[] {
    const found = new Set<string>()


    for (const [kw, dbStatus] of Object.entries(STATUS_KEYWORD_MAP)) {
        if (lower.includes(kw)) found.add(dbStatus)
    }


    return found.size > 0 ? Array.from(found) : ['paid']
}

function extractWantsContact(lower: string): boolean {
    return CONTACT_KEYWORDS.some((kw) => lower.includes(kw))
}

function extractRankBy(lower: string): RankBy {
    return SPEND_RANK_KEYWORDS.some((kw) => lower.includes(kw)) ? 'spend' : 'orders'
}

export function extractParams(message: string): QueryParams {
    const lower = message.toLowerCase()
    const now = new Date()

    let dateRange: DateRange


    if (ALL_TIME_PHRASES.some((phrase) => lower.includes(phrase))) {
        dateRange = { from: '', to: '', label: 'all time', allTime: true }
    }

    else if (extractRollingDays(lower) !== null) {
        const days = extractRollingDays(lower)!
        const from = new Date(now)
        from.setDate(now.getDate() - days)
        dateRange = {
            from: toISO(startOfDay(from)),
            to: toISO(endOfDay(now)),
            label: `last ${days} days`,
            allTime: false,
        }
    }
    else if (lower.includes('yesterday')) {
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        dateRange = {
            from: toISO(startOfDay(yesterday)),
            to: toISO(endOfDay(yesterday)),
            label: 'yesterday',
            allTime: false,
        }
    }
    else if (lower.includes('last week')) {
        const weekStart = startOfWeek(now)
        weekStart.setDate(weekStart.getDate() - 7)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)
        dateRange = {
            from: toISO(weekStart),
            to: toISO(weekEnd),
            label: 'last week',
            allTime: false,
        }
    }
    else if (lower.includes('this week')) {
        dateRange = {
            from: toISO(startOfWeek(now)),
            to: toISO(endOfDay(now)),
            label: 'this week',
            allTime: false,
        }
    }
    else if (lower.includes('last month')) {
        const firstOfThisMonth = startOfMonth(now)
        const lastMonthEnd = new Date(firstOfThisMonth)
        lastMonthEnd.setSeconds(-1)
        const lastMonthStart = startOfMonth(lastMonthEnd)
        dateRange = {
            from: toISO(lastMonthStart),
            to: toISO(lastMonthEnd),
            label: 'last month',
            allTime: false,
        }
    }
    else if (lower.includes('this month')) {
        dateRange = {
            from: toISO(startOfMonth(now)),
            to: toISO(endOfDay(now)),
            label: 'this month',
            allTime: false,
        }
    }
    else if (lower.includes('today')) {
        dateRange = {
            from: toISO(startOfDay(now)),
            to: toISO(endOfDay(now)),
            label: 'today',
            allTime: false,
        }
    }
    else {

        dateRange = {
            from: toISO(startOfDay(now)),
            to: toISO(endOfDay(now)),
            label: 'today',
            allTime: false,
        }
    }


    const limitMatch = lower.match(/top\s+(\d+)|last\s+(\d+)\s+order|(\d+)\s+item/)
    const limit = limitMatch
        ? parseInt(limitMatch[1] ?? limitMatch[2] ?? limitMatch[3] ?? '5', 10)
        : 5


    const nameMatch = message.match(/"([^"]+)"|'([^']+)'/)
        ?? message.match(/(?:called|named)\s+([A-Za-z0-9 ]+)/i)
    const nameHint = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? null) : null

    return {
        dateRange,
        limit,
        nameHint,
        statuses: extractStatuses(lower),
        wantsContact: extractWantsContact(lower),
        rankBy: extractRankBy(lower),
    }
}