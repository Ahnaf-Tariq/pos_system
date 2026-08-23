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

const ALL_TIME_PHRASES = ['all time', 'ever', 'total', 'overall', 'since beginning', 'all orders', 'everything', 'historically']

const STATUS_KEYWORDS: Record<string, string> = {
    cancelled: 'cancelled',
    canceled: 'cancelled',
    pending: 'pending',
    refunded: 'refunded',
    paid: 'paid',
}

const CONTACT_KEYWORDS = ['email', 'phone', 'contact number', 'contact detail', 'contact info']

const SPEND_RANK_KEYWORDS = ['spent the most', 'spent most', 'biggest spender', 'highest spending', 'highest paying']

function startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

function endOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
}

function startOfWeek(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    d.setHours(0, 0, 0, 0)
    return d
}

function startOfMonth(date: Date): Date {
    const d = new Date(date)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
}

function toISO(date: Date): string {
    return date.toISOString()
}

function extractStatuses(lower: string): string[] {
    const found = new Set<string>()
    for (const [kw, status] of Object.entries(STATUS_KEYWORDS)) {
        if (lower.includes(kw)) found.add(status)
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

    if (lower.includes('yesterday')) {
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        dateRange = {
            from: toISO(startOfDay(yesterday)),
            to: toISO(endOfDay(yesterday)),
            label: 'yesterday',
            allTime: false,
        }
    } else if (lower.includes('last week')) {
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
    } else if (lower.includes('this week')) {
        dateRange = {
            from: toISO(startOfWeek(now)),
            to: toISO(endOfDay(now)),
            label: 'this week',
            allTime: false,
        }
    } else if (lower.includes('last month')) {
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
    } else if (lower.includes('this month')) {
        dateRange = {
            from: toISO(startOfMonth(now)),
            to: toISO(endOfDay(now)),
            label: 'this month',
            allTime: false,
        }
    } else if (lower.includes('today')) {
        dateRange = {
            from: toISO(startOfDay(now)),
            to: toISO(endOfDay(now)),
            label: 'today',
            allTime: false,
        }
    } else if (ALL_TIME_PHRASES.some((phrase) => lower.includes(phrase))) {
        dateRange = {
            from: '',
            to: '',
            label: 'all time',
            allTime: true,
        }
    } else {
        dateRange = {
            from: toISO(startOfDay(now)),
            to: toISO(endOfDay(now)),
            label: 'today',
            allTime: false,
        }
    }

    const limitMatch = lower.match(/top\s+(\d+)|last\s+(\d+)|(\d+)\s+item|(\d+)\s+order/)
    const limit = limitMatch
        ? parseInt(limitMatch[1] ?? limitMatch[2] ?? limitMatch[3] ?? limitMatch[4] ?? '5', 10)
        : 5

    const nameMatch = message.match(/"([^"]+)"|'([^']+)'/)
        ?? message.match(/(?:for|about|called|named)\s+([A-Za-z0-9 ]+)/i)
    const nameHint = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? null) : null

    const statuses = extractStatuses(lower)
    const wantsContact = extractWantsContact(lower)
    const rankBy = extractRankBy(lower)

    return { dateRange, limit, nameHint, statuses, wantsContact, rankBy }
}