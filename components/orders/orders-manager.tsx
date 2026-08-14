'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import {
  fetchOrderDetail,
  fetchOrders,
  fetchStaffOptions,
  voidOrder,
} from '@/lib/orders/history'
import type { OrderDetail, OrderListRow } from '@/types/interfaces'
import { useLocationContext } from '@/components/dashboard/location-provider'
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh'
import { useTablePagination } from '@/hooks/use-table-pagination'
import {
  OrderStatus,
  OrderType,
  StaffRole,
} from '@/types/enums'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { openThermalReceipt } from '@/lib/receipts/open-thermal'
import { DatePicker, Select } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TablePagination } from '@/components/ui/table-pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { AppLoader } from '@/components/ui/app-loader'

interface OrdersManagerProps {
  userId: string
  currency: string
  role: StaffRole
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoInput(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export function OrdersManager({ userId, currency, role }: OrdersManagerProps) {
  const { selectedLocationId } = useLocationContext()
  const canVoid = role === StaffRole.OWNER || role === StaffRole.MANAGER

  const [orders, setOrders] = useState<OrderListRow[]>([])
  const [staffOptions, setStaffOptions] = useState<{ auth_id: string; full_name: string }[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [orderType, setOrderType] = useState<OrderType | 'all'>('all')
  const [staffAuthId, setStaffAuthId] = useState<string | 'all'>('all')
  const [fromDate, setFromDate] = useState(daysAgoInput(7))
  const [toDate, setToDate] = useState(todayInput())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const [rows, staff] = await Promise.all([
        fetchOrders(supabase, userId, {
          locationId: selectedLocationId,
          status,
          orderType,
          staffAuthId,
          search,
          fromDate,
          toDate,
        }),
        fetchStaffOptions(supabase, userId),
      ])
      setOrders(rows)
      setStaffOptions(staff)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load orders'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [
    userId,
    selectedLocationId,
    status,
    orderType,
    staffAuthId,
    search,
    fromDate,
    toDate,
  ])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useRealtimeRefresh({
    userId,
    tables: ['orders', 'order_items'],
    onChange: () => void refresh({ silent: true }),
  })

  const {
    pageItems: pagedOrders,
    page,
    setPage,
    totalPages,
    totalItems,
    from,
    to,
  } = useTablePagination(orders, {
    resetKey: `${status}|${orderType}|${staffAuthId}|${search}|${fromDate}|${toDate}|${selectedLocationId ?? ''}`,
  })

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void (async () => {
      const supabase = createClient()
      const row = await fetchOrderDetail(supabase, userId, selectedId)
      setDetail(row)
    })()
  }, [selectedId, userId])

  async function handleVoid() {
    if (!detail || !canVoid) return
    setBusy(true)
    try {
      const supabase = createClient()
      await voidOrder(supabase, userId, detail.id)
      setSelectedId(null)
      setVoidOpen(false)
      toast.success('Order voided')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Void failed'
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search history, open receipts, and void when permitted.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3 xl:grid-cols-6">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search table, staff, id…"
          className="md:col-span-2"
        />
        <Select
          className="w-full"
          value={status}
          onChange={(value) => setStatus(value as OrderStatus | 'all')}
          options={[
            { value: 'all', label: 'All statuses' },
            ...Object.values(OrderStatus).map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            })),
          ]}
        />
        <Select
          className="w-full"
          value={orderType}
          onChange={(value) => setOrderType(value as OrderType | 'all')}
          options={[
            { value: 'all', label: 'All types' },
            ...Object.values(OrderType).map((value) => ({
              value,
              label: value.replaceAll('_', ' '),
            })),
          ]}
        />
        <Select
          className="w-full"
          value={staffAuthId}
          onChange={(value) => setStaffAuthId(value)}
          options={[
            { value: 'all', label: 'All staff' },
            ...staffOptions.map((staff) => ({
              value: staff.auth_id,
              label: staff.full_name,
            })),
          ]}
        />
        <div className="flex gap-2 xl:col-span-2">
          <DatePicker
            className="w-full"
            value={fromDate ? dayjs(fromDate) : null}
            onChange={(value: Dayjs | null) =>
              setFromDate(value ? value.format('YYYY-MM-DD') : '')
            }
            placeholder="From date"
            allowClear
          />
          <DatePicker
            className="w-full"
            value={toDate ? dayjs(toDate) : null}
            onChange={(value: Dayjs | null) =>
              setToDate(value ? value.format('YYYY-MM-DD') : '')
            }
            placeholder="To date"
            allowClear
          />
        </div>
      </div>

      {loading ? (
        <AppLoader fullPage />
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No orders match these filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Table</th>
                <th className="px-4 py-3 font-medium">Staff</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer border-t border-border hover:bg-secondary/30"
                  onClick={() => setSelectedId(order.id)}
                >
                  <td className="px-4 py-3 tabular-nums">
                    {formatDateTime(order.created_at)}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {order.order_type.replaceAll('_', ' ')}
                  </td>
                  <td className="px-4 py-3">{order.table_label ?? '—'}</td>
                  <td className="px-4 py-3">{order.opened_by_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        order.status === OrderStatus.VOID
                          ? 'destructive'
                          : order.status === OrderStatus.PAID
                            ? 'success'
                            : 'secondary'
                      }
                      className="capitalize"
                    >
                      {order.status.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 money text-sm">
                    {formatMoney(order.grand_total, currency)}
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

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order receipt</DialogTitle>
            <DialogDescription>
              {detail
                ? `${formatDateTime(detail.created_at)} · ${detail.order_type.replaceAll('_', ' ')}`
                : 'Fetching receipt details'}
            </DialogDescription>
          </DialogHeader>

          {detail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Table: {detail.table_label ?? '—'}</span>
                <span>Staff: {detail.opened_by_name ?? '—'}</span>
                <span className="capitalize">Status: {detail.status.replaceAll('_', ' ')}</span>
              </div>

              <ul className="space-y-2">
                {detail.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {item.quantity}× {item.menu_item_name}
                      </p>
                      {item.selected_modifiers.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {item.selected_modifiers.map((modifier) => modifier.name).join(', ')}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="text-xs text-primary">Note: {item.notes}</p>
                      ) : null}
                    </div>
                    <span className="money text-xs">
                      {formatMoney(item.unit_price * item.quantity, currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-1 border-t border-border pt-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatMoney(detail.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span>
                  <span>-{formatMoney(detail.discount_total, currency)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="money">{formatMoney(detail.grand_total, currency)}</span>
                </div>
              </div>
            </div>
          ) : (
            <AppLoader size="sm" />
          )}

          <DialogFooter>
            {detail ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => openThermalReceipt(detail.id, { print: true })}
              >
                <Printer className="size-4" />
                Print thermal
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
              Close
            </Button>
            {canVoid && detail && detail.status !== OrderStatus.VOID ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => setVoidOpen(true)}
              >
                Void order
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={voidOpen}
        title="Void this order?"
        description="This cannot be undone."
        confirmText="Void"
        cancelText="Cancel"
        danger
        confirmLoading={busy}
        onConfirm={() => void handleVoid()}
        onCancel={() => {
          if (!busy) setVoidOpen(false)
        }}
      />
    </div>
  )
}
