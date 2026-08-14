'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  fetchPlatformShops,
  updateShopStatus,
} from '@/lib/platform/catalog'
import type { PlatformShopRow } from '@/types/interfaces'
import { AccountStatus } from '@/types/enums'
import { Select } from 'antd'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AppLoader } from '@/components/ui/app-loader'
import { TablePagination } from '@/components/ui/table-pagination'

export function ShopsAdmin() {
  const [shops, setShops] = useState<PlatformShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const rows = await fetchPlatformShops(supabase)
      setShops(rows)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load shops'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Platform view spans all shops — soft poll while tab is visible
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return shops.filter((shop) => {
      if (statusFilter !== 'all' && shop.status !== statusFilter) return false
      if (!q) return true
      return (
        shop.business_name.toLowerCase().includes(q) ||
        shop.slug.toLowerCase().includes(q) ||
        (shop.owner_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [shops, search, statusFilter])

  const {
    pageItems: pagedShops,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(visible, {
    resetKey: `${search}|${statusFilter}`,
  })

  async function setStatus(
    shop: PlatformShopRow,
    status: (typeof AccountStatus)[keyof typeof AccountStatus]
  ) {
    setBusyId(shop.user_id)
    try {
      const supabase = createClient()
      await updateShopStatus(supabase, shop.user_id, status)
      const successMessage = `${shop.business_name} marked ${status}`
      toast.success(successMessage)
      await refresh({ silent: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status update failed'
      toast.error(message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shops</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve, reject, or suspend shop accounts across the platform.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search business, slug, owner…"
          className="max-w-sm"
        />
        <Select
          className="w-full max-w-[200px]"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: AccountStatus.PENDING, label: 'Pending' },
            { value: AccountStatus.APPROVED, label: 'Approved' },
            { value: AccountStatus.REJECTED, label: 'Rejected' },
            { value: AccountStatus.SUSPENDED, label: 'Suspended' },
          ]}
        />
      </div>

      {loading && shops.length === 0 ? (
        <AppLoader fullPage />
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No shops match these filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Business</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedShops.map((shop) => (
                <tr key={shop.user_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium">{shop.business_name}</p>
                    <p className="text-xs text-muted-foreground">{shop.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {shop.owner_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatDate(shop.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{shop.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {shop.status !== AccountStatus.APPROVED ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === shop.user_id}
                          onClick={() =>
                            void setStatus(shop, AccountStatus.APPROVED)
                          }
                        >
                          Approve
                        </Button>
                      ) : null}
                      {shop.status !== AccountStatus.REJECTED ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === shop.user_id}
                          onClick={() =>
                            void setStatus(shop, AccountStatus.REJECTED)
                          }
                        >
                          Reject
                        </Button>
                      ) : null}
                      {shop.status !== AccountStatus.SUSPENDED ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busyId === shop.user_id}
                          onClick={() =>
                            void setStatus(shop, AccountStatus.SUSPENDED)
                          }
                        >
                          Suspend
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            from={from}
            to={to}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
