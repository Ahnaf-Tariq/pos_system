'use client'

import type { KdsTicket } from '@/types/interfaces'
import type { KdsStatus } from '@/types/enums'
import { OrderCard } from '@/components/kds/order-card'

interface StationColumnProps {
  title: string
  stage: KdsStatus
  tickets: KdsTicket[]
  userId: string
  currency: string
  highlightedIds: Set<string>
  onChanged: () => void
}

export function StationColumn({
  title,
  tickets,
  userId,
  currency,
  highlightedIds,
  onChanged,
}: StationColumnProps) {
  return (
    <section className="flex min-h-0 min-w-[280px] flex-1 flex-col rounded-lg border border-border bg-secondary/10">
      <header className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
          {tickets.length}
        </span>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tickets.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No tickets</p>
        ) : (
          tickets.map((ticket) => (
            <OrderCard
              key={ticket.order.id}
              ticket={ticket}
              userId={userId}
              currency={currency}
              onChanged={onChanged}
              highlight={highlightedIds.has(ticket.order.id)}
            />
          ))
        )}
      </div>
    </section>
  )
}
