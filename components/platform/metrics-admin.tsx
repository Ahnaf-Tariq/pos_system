'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { fetchPlatformMetrics } from '@/lib/platform/catalog'
import type { PlatformMetrics } from '@/types/interfaces'
import { StatCard } from '@/components/dashboard/stat-card'
import { formatMoney } from '@/lib/utils'
import { AppLoader } from '@/components/ui/app-loader'

export function MetricsAdmin() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const data = await fetchPlatformMetrics(supabase)
      setMetrics(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh({ silent: true })
    }, 12_000)
    function onVisible() {
      if (document.visibilityState === 'visible') void refresh({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const maxSignups = useMemo(
    () => Math.max(1, ...(metrics?.signupsByDay.map((point) => point.count) ?? [1])),
    [metrics]
  )
  const maxRevenue = useMemo(
    () => Math.max(1, ...(metrics?.revenueByDay.map((point) => point.revenue) ?? [1])),
    [metrics]
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Platform metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aggregate growth and revenue across all shops.
        </p>
      </div>

      {loading && !metrics ? (
        <AppLoader fullPage />
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total shops" value={String(metrics.totalShops)} />
            <StatCard
              label="Pending approval"
              value={String(metrics.pendingShops)}
              hint={`${metrics.approvedShops} approved`}
            />
            <StatCard
              label="Paid orders"
              value={String(metrics.totalPaidOrders)}
            />
            <StatCard
              label="Platform revenue"
              value={formatMoney(metrics.totalRevenue, 'PKR')}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">New signups (30d)</h2>
              <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto">
                {metrics.signupsByDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No signups yet.</p>
                ) : (
                  metrics.signupsByDay.map((point) => (
                    <div
                      key={point.date}
                      className="flex min-w-5 flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{
                          height: `${Math.max(8, (point.count / maxSignups) * 100)}%`,
                        }}
                        title={`${point.count} signups`}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Revenue growth (30d)</h2>
              <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto">
                {metrics.revenueByDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paid revenue yet.</p>
                ) : (
                  metrics.revenueByDay.map((point) => (
                    <div
                      key={point.date}
                      className="flex min-w-5 flex-1 flex-col items-center gap-2"
                    >
                      <div
                        className="w-full rounded-t bg-accent/80"
                        style={{
                          height: `${Math.max(8, (point.revenue / maxRevenue) * 100)}%`,
                        }}
                        title={formatMoney(point.revenue, 'PKR')}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {point.date.slice(5)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <StatusTile label="Approved" value={metrics.approvedShops} />
            <StatusTile label="Pending" value={metrics.pendingShops} />
            <StatusTile label="Rejected" value={metrics.rejectedShops} />
            <StatusTile label="Suspended" value={metrics.suspendedShops} />
          </div>
        </>
      ) : null}
    </div>
  )
}

function StatusTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-primary">{value}</p>
    </div>
  )
}
