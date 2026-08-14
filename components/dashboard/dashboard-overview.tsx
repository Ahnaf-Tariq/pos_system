'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { fetchDashboardOverview } from '@/lib/dashboard/overview'
import type { DashboardOverview } from '@/types/interfaces'
import { useLocationContext } from '@/components/dashboard/location-provider'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { StatCard } from '@/components/dashboard/stat-card'
import { Button } from '@/components/ui/button'
import { AppLoader } from '@/components/ui/app-loader'
import { formatMoney } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

interface DashboardOverviewPanelProps {
  userId: string
  currency: string
  businessName: string
  lowStockCount: number
}

export function DashboardOverviewPanel({
  userId,
  currency,
  businessName,
  lowStockCount,
}: DashboardOverviewPanelProps) {
  const { selectedLocationId, selectedLocation, locations } = useLocationContext()
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    // Wait until location picker has hydrated so we don't flash wrong totals
    if (locations.length > 0 && !selectedLocationId) return

    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const data = await fetchDashboardOverview(
        supabase,
        userId,
        selectedLocationId
      )
      setOverview(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load overview')
    } finally {
      setLoading(false)
    }
  }, [userId, selectedLocationId, locations.length])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtimeRefresh({
    userId,
    tables: ['orders', 'order_items', 'inventory_items'],
    onChange: () => void refresh({ silent: true }),
    enabled: Boolean(selectedLocationId) || locations.length === 0,
  })

  if (loading && !overview) return <AppLoader fullPage />

  const sales = overview?.salesToday ?? 0
  const orders = overview?.ordersToday ?? 0
  const avg = overview?.averageTicket ?? 0
  const topItems = overview?.topItems ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Today at {businessName}
          {selectedLocation ? ` · ${selectedLocation.name}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Today's sales"
          value={formatMoney(sales, currency)}
          hint={
            orders > 0
              ? `${orders} paid order${orders === 1 ? '' : 's'} today`
              : 'No paid orders yet today'
          }
        />
        <StatCard
          label="Orders"
          value={String(orders)}
          hint={
            selectedLocation
              ? `Paid at ${selectedLocation.name}`
              : 'Paid across selected location'
          }
        />
        <StatCard
          label="Avg order value"
          value={formatMoney(avg, currency)}
          hint="Paid tickets today"
        />
        <StatCard
          label="Low stock alerts"
          value={String(lowStockCount)}
          hint="Inventory below reorder threshold"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={ROUTES.pos}>Open POS</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.kds}>Kitchen display</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.menu}>Manage menu</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={ROUTES.reports}>View reports</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Top-selling items today
          </h2>
          {topItems.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No paid item sales yet today.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {topItems.map((item, index) => (
                <li
                  key={item.menu_item_id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>
                    {index + 1}. {item.name}{' '}
                    <span className="text-muted-foreground">×{item.quantity}</span>
                  </span>
                  <span className="money text-xs">
                    {formatMoney(item.revenue, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
