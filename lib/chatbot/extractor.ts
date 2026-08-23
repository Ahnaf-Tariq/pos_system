export interface DateRange {
    from: string // ISO string
    to: string   // ISO string
    label: string
}

export interface QueryParams {
    dateRange: DateRange
    limit: number
    nameHint: string | null
}

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
    const day = d.getDay() // 0 = Sunday
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

export function extractParams(message: string): QueryParams {
    const lower = message.toLowerCase()
    const now = new Date()

    // ── Date range extraction ──
    let dateRange: DateRange

    if (lower.includes('yesterday')) {
        const yesterday = new Date(now)
        yesterday.setDate(now.getDate() - 1)
        dateRange = {
            from: toISO(startOfDay(yesterday)),
            to: toISO(endOfDay(yesterday)),
            label: 'yesterday',
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
        }
    } else if (lower.includes('this week')) {
        dateRange = {
            from: toISO(startOfWeek(now)),
            to: toISO(endOfDay(now)),
            label: 'this week',
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
        }
    } else if (lower.includes('this month')) {
        dateRange = {
            from: toISO(startOfMonth(now)),
            to: toISO(endOfDay(now)),
            label: 'this month',
        }
    } else {
        // Default: today
        dateRange = {
            from: toISO(startOfDay(now)),
            to: toISO(endOfDay(now)),
            label: 'today',
        }
    }

    // ── Limit extraction ──
    const limitMatch = lower.match(/top\s+(\d+)|last\s+(\d+)|(\d+)\s+item|(\d+)\s+order/)
    const limit = limitMatch
        ? parseInt(limitMatch[1] ?? limitMatch[2] ?? limitMatch[3] ?? limitMatch[4] ?? '5', 10)
        : 5

    // ── Name hint ──
    // Pull quoted strings or words after "for", "about", "called"
    const nameMatch = message.match(/"([^"]+)"|'([^']+)'/)
        ?? message.match(/(?:for|about|called|named)\s+([A-Za-z0-9 ]+)/i)
    const nameHint = nameMatch ? (nameMatch[1] ?? nameMatch[2] ?? null) : null

    return { dateRange, limit, nameHint }
}