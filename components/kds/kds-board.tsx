'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { BellRing } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { fetchKdsTickets } from '@/lib/kds/tickets'
import type { KdsTicket } from '@/types/interfaces'
import { playNewOrderChime } from '@/lib/kds/chime'
import { useShopRealtime } from '@/hooks/use-shop-realtime'
import { useLocationContext } from '@/components/dashboard/location-provider'
import { StationColumn } from '@/components/kds/station-column'
import { KdsStatus } from '@/types/enums'
import { Badge } from '@/components/ui/badge'
import { AppLoader } from '@/components/ui/app-loader'

interface KdsBoardProps {
  userId: string
  currency: string
}

export function KdsBoard({ userId, currency }: KdsBoardProps) {
  const { selectedLocationId, selectedLocation } = useLocationContext()
  const [tickets, setTickets] = useState<KdsTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [alertVisible, setAlertVisible] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const knownIdsRef = useRef<Set<string> | null>(null)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!selectedLocationId) {
      setTickets([])
      setLoading(false)
      return
    }

    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const nextTickets = await fetchKdsTickets(supabase, userId, selectedLocationId)

      const nextIds = new Set(nextTickets.map((ticket) => ticket.order.id))
      if (knownIdsRef.current) {
        const newcomers = [...nextIds].filter((id) => !knownIdsRef.current!.has(id))
        if (newcomers.length > 0) {
          playNewOrderChime()
          setAlertVisible(true)
          setHighlightedIds(new Set(newcomers))
          window.setTimeout(() => {
            setAlertVisible(false)
            setHighlightedIds(new Set())
          }, 4000)
        }
      }
      knownIdsRef.current = nextIds
      setTickets(nextTickets)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load kitchen tickets'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [selectedLocationId, userId])

  useEffect(() => {
    knownIdsRef.current = null
    void refresh()
  }, [refresh])

  useShopRealtime({
    userId,
    locationId: selectedLocationId,
    onChange: () => void refresh({ silent: true }),
    includeOrderItems: true,
  })

  const columns = useMemo(() => {
    const pending = tickets.filter((ticket) => ticket.stage === KdsStatus.PENDING)
    const preparing = tickets.filter((ticket) => ticket.stage === KdsStatus.PREPARING)
    const ready = tickets.filter(
      (ticket) => ticket.stage === KdsStatus.READY || ticket.stage === KdsStatus.SERVED
    )
    return { pending, preparing, ready }
  }, [tickets])

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[640px] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kitchen Display</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live tickets for {selectedLocation?.name ?? 'your location'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {alertVisible ? (
            <Badge variant="default" className="gap-1">
              <BellRing className="size-3.5" />
              New order
            </Badge>
          ) : null}
        </div>
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">Select a location in the header.</p>
      ) : loading && tickets.length === 0 ? (
        <AppLoader fullPage />
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto">
          <StationColumn
            title="Pending"
            stage={KdsStatus.PENDING}
            tickets={columns.pending}
            userId={userId}
            currency={currency}
            highlightedIds={highlightedIds}
            onChanged={refresh}
          />
          <StationColumn
            title="Preparing"
            stage={KdsStatus.PREPARING}
            tickets={columns.preparing}
            userId={userId}
            currency={currency}
            highlightedIds={highlightedIds}
            onChanged={refresh}
          />
          <StationColumn
            title="Ready"
            stage={KdsStatus.READY}
            tickets={columns.ready}
            userId={userId}
            currency={currency}
            highlightedIds={highlightedIds}
            onChanged={refresh}
          />
        </div>
      )}
    </div>
  )
}
