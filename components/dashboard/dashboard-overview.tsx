'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, Send, Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

type DataSource = 'orders' | 'inventory' | 'customers' | 'staff' | 'menu' | 'reports'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  source?: DataSource
}

// ── Static demo responses ────────────────────────────────────────────────────

const STATIC_RESPONSES: Record<string, string> = {
  default: `Based on your current data, here's what I found:

**Today's Overview**
You've received **3 orders** today with a total revenue of **Rs 310**. Your average order value sits at **Rs 103.33**, which is slightly above last week's average of Rs 95.

**Top Performers**
- Biryani (Mid tier) — sold 1 unit → Rs 210
- Samosa — sold 2 units → Rs 100

**Quick Insight**
Your dine-in orders are outperforming takeaway by 2:1 today. Consider promoting your takeaway option during off-peak hours to balance the load.`,

  orders: `Here's a breakdown of your **Orders** data:

**Today's Summary**
- Total orders received: **3**
- Paid orders: **3** (100% conversion)
- Pending/kitchen orders: **0**

**Revenue Breakdown**
- Gross subtotal: Rs 610
- Discounts applied: -Rs 300
- Net revenue: **Rs 310**
- Tax collected (0%): Rs 0

**Order Types**
- Dine-in: 2 orders
- Takeaway: 1 order
- Delivery: 0 orders

**Busiest time:** 1:00 PM – 2:00 PM
Your kitchen handled all orders within an average of **8 minutes** — great performance!`,

  inventory: `Here's your **Inventory** status:

⚠️ **1 Low Stock Alert**
- Flour — current stock: 2 kg, reorder level: 5 kg → *needs restocking*

**Healthy Stock**
- Rice: 12 kg ✓
- Oil: 8 L ✓
- Tomatoes: 6 kg ✓

**Estimated days remaining at current usage:**
- Flour: ~1.5 days
- Rice: ~6 days

**Recommendation:** Place a reorder for Flour immediately. At current consumption you'll run out before tomorrow's service.`,

  customers: `Here's a summary of your **Customers**:

**Total Registered Customers:** 4
**New this month:** 2
**Walk-in (unregistered) orders today:** 2

**Loyalty Leaders**
1. Ahmed Khan — 340 points
2. Sara Malik — 210 points
3. Raza Ali — 80 points

**Engagement**
- Repeat customers this week: 2
- Average orders per customer: 1.8

**Tip:** Ahmed Khan is close to a 400-point milestone. A small reward could bring him back this week.`,

  staff: `Here's your **Staff** overview:

**Active Staff Members:** 3
- Usman (Manager) — on shift today
- Fatima (Cashier) — on shift today
- Bilal (Kitchen) — day off

**Today's Activity**
- Orders processed by Fatima: 3
- Average processing time: 4 minutes per order

**This Week**
- Total staff hours logged: 42 hrs
- Overtime: 2 hrs (Usman)

No pending payroll actions. All staff records are up to date.`,

  menu: `Here's your **Menu** analysis:

**Total Active Items:** 3
- Samosa — Rs 50 (Low tier)
- Biryani — Rs 200 (Mid tier)
- Burger — Rs 400 (Top tier)

**Today's Sales by Item**
| Item | Units | Revenue |
|------|-------|---------|
| Biryani | 1 | Rs 210 |
| Samosa | 2 | Rs 100 |
| Burger | 0 | Rs 0 |

**Insight:** Burger has had 0 sales today. You may want to feature it in a promotion or check if it needs a price adjustment.`,

  reports: `Here's your **Reports** snapshot:

**This Week vs Last Week**
- Revenue: Rs 1,240 vs Rs 980 → **+26.5% ↑**
- Orders: 18 vs 14 → **+4 orders**
- Avg ticket: Rs 68.9 vs Rs 70 → **-1.6%**

**Best Day This Week:** Friday — Rs 420 in sales
**Slowest Day:** Monday — Rs 95 in sales

**Monthly Trend**
You're on track to hit **Rs 5,200** this month, which would be a **18% improvement** over last month (Rs 4,400).

**Recommendation:** Your Friday peak suggests strong weekend demand. Consider extending hours or adding weekend staff.`,
}

function getStaticResponse(message: string, source: DataSource): string {
  const lower = message.toLowerCase()
  if (lower.includes('order') || source === 'orders') return STATIC_RESPONSES.orders
  if (lower.includes('stock') || lower.includes('inventory') || source === 'inventory') return STATIC_RESPONSES.inventory
  if (lower.includes('customer') || source === 'customers') return STATIC_RESPONSES.customers
  if (lower.includes('staff') || lower.includes('employee') || source === 'staff') return STATIC_RESPONSES.staff
  if (lower.includes('menu') || lower.includes('item') || source === 'menu') return STATIC_RESPONSES.menu
  if (lower.includes('report') || lower.includes('revenue') || lower.includes('sales') || source === 'reports') return STATIC_RESPONSES.reports
  return STATIC_RESPONSES.default
}

// ── Formatters ───────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

/** Very basic markdown renderer — bold + table + bullet */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  const parseLine = (line: string): React.ReactNode => {
    const parts = line.split(/\*\*(.*?)\*\*/g)
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : part
    )
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('**') && line.endsWith('**') && !line.slice(2, -2).includes('**')) {
      elements.push(
        <p key={key++} className="mt-4 mb-1 text-xs font-semibold uppercase tracking-widest text-primary/70 first:mt-0">
          {line.slice(2, -2)}
        </p>
      )
    } else if (line.startsWith('| ')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('| ')) {
        if (!lines[i].includes('---')) rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean))
        i++
      }
      elements.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-md border border-border/50">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                {rows[0]?.map((h, j) => <th key={j} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, j) => (
                <tr key={j} className="border-b border-border/30 last:border-0">
                  {row.map((cell, k) => <td key={k} className="px-3 py-2 text-foreground/80">{parseLine(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={key++} className="ml-3 flex gap-2 text-sm leading-relaxed text-foreground/80">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{parseLine(line.slice(2))}</span>
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />)
    } else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed text-foreground/80">
          {parseLine(line)}
        </p>
      )
    }
    i++
  }

  return elements
}

// ── Sub-components ───────────────────────────────────────────────────────────

const SOURCE_OPTIONS: { value: DataSource; label: string; emoji: string }[] = [
  { value: 'orders', label: 'Orders', emoji: '🧾' },
  { value: 'inventory', label: 'Inventory', emoji: '📦' },
  { value: 'customers', label: 'Customers', emoji: '👥' },
  { value: 'staff', label: 'Staff', emoji: '👤' },
  { value: 'menu', label: 'Menu', emoji: '🍽️' },
  { value: 'reports', label: 'Reports', emoji: '📊' },
]

const SUGGESTIONS = [
  { label: 'Revenue today', source: 'orders' as DataSource, message: 'How much revenue did I generate today?' },
  { label: 'Low stock', source: 'inventory' as DataSource, message: 'Which items are running low on stock?' },
  { label: 'Top items', source: 'orders' as DataSource, message: 'What are my top selling items today?' },
  { label: 'Staff activity', source: 'staff' as DataSource, message: 'Give me a summary of staff activity today.' },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-primary/50 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
        />
      ))}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function DashboardChat({
  businessName,
  locationId = null,
}: {
  businessName: string
  locationId?: string | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [source, setSource] = useState<DataSource>('orders')
  const [loading, setLoading] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`
  }

  async function send(overrideMessage?: string, overrideSource?: DataSource) {
    const text = (overrideMessage ?? input).trim()
    if (!text || loading) return

    const usedSource = overrideSource ?? source

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      source: usedSource,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, source: usedSource, locationId }),
      })

      const json = await res.json() as { reply?: string; error?: string }
      const reply = json.reply ?? json.error ?? 'Something went wrong. Please try again.'

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: new Date() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Network error. Please check your connection and try again.', timestamp: new Date() },
      ])
    } finally {
      setLoading(false)
    }
  }

  const selectedSourceOption = SOURCE_OPTIONS.find((o) => o.value === source)!
  const isEmpty = messages.length === 0

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col gap-3">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Ask anything about {businessName}</p>
          </div>
        </div>
      </div>

      {/* ── Input bar ── */}
      <div className="shrink-0">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm focus-within:border-primary/50 transition-colors">
          {/* Source selector */}
          <div className="relative mb-2 inline-block" onBlur={() => setTimeout(() => setSourceOpen(false), 150)}>
            <button
              type="button"
              onClick={() => setSourceOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/70 transition hover:bg-secondary hover:text-foreground"
            >
              <span>{selectedSourceOption.emoji}</span>
              <span>{selectedSourceOption.label}</span>
              <ChevronDown className={cn('size-3 transition-transform', sourceOpen && 'rotate-180')} />
            </button>

            {sourceOpen && (
              <div className="absolute top-full left-0 mt-1.5 z-50 w-40 rounded-lg border border-border bg-popover shadow-lg">
                {SOURCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setSource(opt.value); setSourceOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-secondary first:rounded-t-lg last:rounded-b-lg',
                      source === opt.value ? 'text-primary font-medium' : 'text-foreground/70'
                    )}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Textarea + send */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              className="min-h-[36px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
              placeholder={`Ask about your ${selectedSourceOption.label.toLowerCase()}…`}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="size-3.5" />
            </button>
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground/40">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ── Chat area ── */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card">
        {isEmpty ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="size-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">Hey! What would you like to ask?</h2>
              <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
                Ask me about your orders, revenue, inventory, customers, or staff. I'll pull the data and break it down for you.
              </p>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setSource(s.source)
                    void send(s.message, s.source)
                  }}
                  className="rounded-full border border-border bg-secondary/40 px-4 py-2 text-sm font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-secondary hover:text-foreground"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="space-y-1 p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'mt-1 flex size-7 shrink-0 items-center justify-center rounded-full',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary border border-border'
                )}>
                  {msg.role === 'user'
                    ? <User className="size-3.5" />
                    : <Bot className="size-3.5 text-primary" />
                  }
                </div>

                {/* Bubble */}
                <div className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-3',
                  msg.role === 'user'
                    ? 'rounded-tr-sm bg-primary text-primary-foreground'
                    : 'rounded-tl-sm bg-secondary/50 border border-border/50'
                )}>
                  {msg.role === 'user' ? (
                    <div className="space-y-1">
                      {msg.source && (
                        <span className="block text-[10px] font-medium uppercase tracking-widest text-primary-foreground/60">
                          {SOURCE_OPTIONS.find(o => o.value === msg.source)?.emoji}{' '}
                          {SOURCE_OPTIONS.find(o => o.value === msg.source)?.label}
                        </span>
                      )}
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ) : (
                    <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                  )}
                  <p className={cn(
                    'mt-2 text-[10px]',
                    msg.role === 'user' ? 'text-right text-primary-foreground/50' : 'text-muted-foreground/60'
                  )}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3">
                <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary">
                  <Bot className="size-3.5 text-primary" />
                </div>
                <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-secondary/50 px-4">
                  <TypingIndicator />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

    </div>
  )
}