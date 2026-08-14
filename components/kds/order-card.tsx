'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  bumpItem,
  bumpTicket,
  deriveTicketStage,
  formatElapsed,
  nextKdsStatus,
  settleTicketAsPaid,
} from '@/lib/kds/tickets'
import type { KdsTicket, KdsTicketItem } from '@/types/interfaces'
import { KdsStatus, type PaymentMethod } from '@/types/enums'
import { PaymentModal } from '@/components/pos/payment-modal'
import { openThermalReceipt } from '@/lib/receipts/open-thermal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatMoney } from '@/lib/utils'

interface OrderCardProps {
  ticket: KdsTicket
  userId: string
  currency: string
  onChanged: () => void
  highlight?: boolean
}

export function OrderCard({
  ticket,
  userId,
  currency,
  onChanged,
  highlight,
}: OrderCardProps) {
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const next = nextKdsStatus(ticket.stage)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = formatElapsed(ticket.order.created_at, now)
  const minutes = Math.floor(
    (now - new Date(ticket.order.created_at).getTime()) / 60000
  )
  const isLate = minutes >= 12

  async function handleBumpTicket() {
    if (!next) return

    if (next === KdsStatus.SERVED) {
      setPaymentOpen(true)
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      await bumpTicket(supabase, userId, ticket)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not bump ticket')
    } finally {
      setBusy(false)
    }
  }

  async function handleBumpItem(item: KdsTicketItem) {
    const itemNext = nextKdsStatus(item.kds_status as KdsStatus)
    if (!itemNext) return

    const previewItems = ticket.items.map((row) =>
      row.id === item.id ? { ...row, kds_status: itemNext } : row
    )
    if (deriveTicketStage(previewItems) === KdsStatus.SERVED) {
      setPaymentOpen(true)
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      await bumpItem(supabase, userId, item, ticket)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not bump item')
    } finally {
      setBusy(false)
    }
  }

  async function handlePaymentConfirm({
    paymentMethod,
  }: {
    paymentMethod: PaymentMethod
    amountTendered: number
  }) {
    setBusy(true)
    try {
      const supabase = createClient()
      await settleTicketAsPaid(supabase, userId, ticket, paymentMethod)
      toast.success('Payment recorded. Receipt ready to print.')
      onChanged()
      openThermalReceipt(ticket.order.id, { print: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <article
        className={cn(
          'rounded-lg border border-border bg-card p-3 shadow-sm transition',
          highlight && 'ring-2 ring-primary animate-pulse',
          isLate && 'border-destructive/60'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">
              {ticket.order.table_label
                ? /^table\b/i.test(ticket.order.table_label.trim())
                  ? ticket.order.table_label
                  : `Table ${ticket.order.table_label}`
                : ticket.order.order_type.replace('_', ' ')}
            </p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {ticket.order.order_type.replace('_', ' ')} · {ticket.items.length}{' '}
              items
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge
              variant={isLate ? 'destructive' : 'secondary'}
              className="tabular-nums"
            >
              {elapsed}
            </Badge>
            <p className="money text-sm font-semibold">
              {formatMoney(ticket.order.grand_total, currency)}
            </p>
          </div>
        </div>

        <ul className="mt-3 space-y-2">
          {ticket.items.map((item) => (
            <li
              key={item.id}
              className="rounded-md border border-border/70 bg-secondary/20 px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium">
                      {item.quantity}× {item.menu_item_name}
                    </p>
                    <span className="money shrink-0 text-xs">
                      {formatMoney(item.unit_price * item.quantity, currency)}
                    </span>
                  </div>
                  {item.selected_modifiers.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.selected_modifiers
                        .map((modifier) => modifier.name)
                        .join(', ')}
                    </p>
                  ) : null}
                  {item.notes ? (
                    <p className="mt-0.5 text-xs text-primary">
                      Note: {item.notes}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="outline" className="capitalize">
                    {item.kds_status}
                  </Badge>
                  {item.kds_status !== KdsStatus.SERVED ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={busy}
                      onClick={() => void handleBumpItem(item)}
                    >
                      Bump
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="money font-semibold">
            {formatMoney(ticket.order.grand_total, currency)}
          </span>
        </div>

        {next ? (
          <Button
            type="button"
            className="mt-3 min-h-11 w-full capitalize"
            disabled={busy}
            onClick={() => void handleBumpTicket()}
          >
            {next === KdsStatus.SERVED
              ? 'Serve & take payment'
              : `Bump ticket → ${next}`}
          </Button>
        ) : (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Ticket complete
          </p>
        )}
      </article>

      <PaymentModal
        open={paymentOpen}
        currency={currency}
        grandTotal={ticket.order.grand_total}
        onOpenChange={setPaymentOpen}
        onConfirm={(input) => {
          void handlePaymentConfirm(input)
        }}
      />
    </>
  )
}
