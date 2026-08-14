'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  fetchTablesWithOrders,
  tableStatusStyles,
} from '@/lib/tables/floor'
import type { TableWithOrder } from '@/types/interfaces'
import { useShopRealtime } from '@/hooks/use-shop-realtime'
import { useLocationContext } from '@/components/dashboard/location-provider'
import { OrderStatus, TableStatus } from '@/types/enums'
import { ROUTES } from '@/lib/routes'
import { formatMoney, cn } from '@/lib/utils'
import { Select } from 'antd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AppLoader } from '@/components/ui/app-loader'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmModal } from '@/components/ui/confirm-modal'

interface TablesFloorProps {
  userId: string
  currency: string
}

const STATUS_OPTIONS: TableStatus[] = [
  TableStatus.AVAILABLE,
  TableStatus.OCCUPIED,
  TableStatus.RESERVED,
  TableStatus.DIRTY,
]

export function TablesFloor({ userId, currency }: TablesFloorProps) {
  const router = useRouter()
  const { selectedLocationId, selectedLocation } = useLocationContext()
  const [tables, setTables] = useState<TableWithOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TableWithOrder | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [seats, setSeats] = useState('4')
  const [targetTableId, setTargetTableId] = useState('')
  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!selectedLocationId) {
      setTables([])
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const supabase = createClient()
      const rows = await fetchTablesWithOrders(supabase, userId, selectedLocationId)
      setTables(rows)
      setSelected((current) =>
        current ? rows.find((row) => row.id === current.id) ?? null : null
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load tables'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [selectedLocationId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useShopRealtime({
    userId,
    locationId: selectedLocationId,
    onChange: () => void refresh({ silent: true }),
  })

  const otherOccupied = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.id !== selected?.id &&
          (table.activeOrder || table.status === TableStatus.OCCUPIED)
      ),
    [tables, selected]
  )

  const transferTargets = useMemo(
    () =>
      tables.filter(
        (table) =>
          table.id !== selected?.id &&
          (table.status === TableStatus.AVAILABLE || !table.activeOrder)
      ),
    [tables, selected]
  )

  async function createTable() {
    if (!selectedLocationId || !label.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error: insertError } = await supabase.from('restaurant_tables').insert({
      user_id: userId,
      location_id: selectedLocationId,
      label: label.trim(),
      seats: Math.max(1, Number(seats) || 4),
      status: TableStatus.AVAILABLE,
    })
    setBusy(false)
    if (insertError) {
      toast.error(insertError.message)
      return
    }
    setCreateOpen(false)
    setLabel('')
    setSeats('4')
    toast.success('Table created')
    await refresh()
  }

  async function updateStatus(status: TableStatus) {
    if (!selected) return
    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({ status })
      .eq('id', selected.id)
      .eq('user_id', userId)
    setBusy(false)
    if (updateError) {
      toast.error(updateError.message)
      return
    }

    if (
      status === TableStatus.AVAILABLE &&
      selected.status !== TableStatus.AVAILABLE
    ) {
      const { notifyTableFreed } = await import('@/lib/notifications/create')
      await notifyTableFreed(supabase, {
        userId,
        locationId: selected.location_id,
        tableId: selected.id,
        tableLabel: selected.label,
      })
    }

    toast.success('Table status updated')
    await refresh()
  }

  async function confirmDeleteTable() {
    if (!selected) return
    setDeleteLoading(true)
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', selected.id)
      .eq('user_id', userId)
    if (deleteError) {
      toast.error(deleteError.message)
    } else {
      setSelected(null)
      toast.success('Table deleted')
      setDeleteOpen(false)
      await refresh()
    }
    setDeleteLoading(false)
  }

  function openInPos(table: TableWithOrder) {
    router.push(`${ROUTES.pos}?tableId=${table.id}`)
  }

  async function transferOrder() {
    if (!selected?.activeOrder || !targetTableId) return
    setBusy(true)
    const supabase = createClient()

    const { error: orderError } = await supabase
      .from('orders')
      .update({ table_id: targetTableId })
      .eq('id', selected.activeOrder.id)
      .eq('user_id', userId)

    if (orderError) {
      setBusy(false)
      toast.error(orderError.message)
      return
    }

    await supabase
      .from('restaurant_tables')
      .update({ status: TableStatus.AVAILABLE })
      .eq('id', selected.id)
      .eq('user_id', userId)

    await supabase
      .from('restaurant_tables')
      .update({ status: TableStatus.OCCUPIED })
      .eq('id', targetTableId)
      .eq('user_id', userId)

    const { notifyTableFreed } = await import('@/lib/notifications/create')
    await notifyTableFreed(supabase, {
      userId,
      locationId: selected.location_id,
      tableId: selected.id,
      tableLabel: selected.label,
    })

    setBusy(false)
    setTransferOpen(false)
    setTargetTableId('')
    toast.success('Order transferred')
    await refresh()
  }

  async function mergeOrders() {
    if (!selected?.activeOrder || !targetTableId) return
    const source = otherOccupied.find((table) => table.id === targetTableId)
    if (!source?.activeOrder) {
      const message = 'Pick an occupied table with an active order to merge from'
      toast.error(message)
      return
    }

    setBusy(true)
    const supabase = createClient()

    const { error: itemsError } = await supabase
      .from('order_items')
      .update({ order_id: selected.activeOrder.id })
      .eq('order_id', source.activeOrder.id)
      .eq('user_id', userId)

    if (itemsError) {
      setBusy(false)
      toast.error(itemsError.message)
      return
    }

    const mergedTotal =
      Number(selected.activeOrder.grand_total) + Number(source.activeOrder.grand_total)

    await supabase
      .from('orders')
      .update({
        grand_total: mergedTotal,
        subtotal: mergedTotal,
      })
      .eq('id', selected.activeOrder.id)
      .eq('user_id', userId)

    await supabase
      .from('orders')
      .update({ status: OrderStatus.VOID, table_id: null, closed_at: new Date().toISOString() })
      .eq('id', source.activeOrder.id)
      .eq('user_id', userId)

    await supabase
      .from('restaurant_tables')
      .update({ status: TableStatus.AVAILABLE })
      .eq('id', source.id)
      .eq('user_id', userId)

    await supabase
      .from('restaurant_tables')
      .update({ status: TableStatus.OCCUPIED })
      .eq('id', selected.id)
      .eq('user_id', userId)

    const { notifyTableFreed } = await import('@/lib/notifications/create')
    await notifyTableFreed(supabase, {
      userId,
      locationId: source.location_id,
      tableId: source.id,
      tableLabel: source.label,
    })

    setBusy(false)
    setMergeOpen(false)
    setTargetTableId('')
    toast.success('Orders merged')
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tables</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Floor plan for {selectedLocation?.name ?? 'your location'} · live via Realtime
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => setCreateOpen(true)} disabled={!selectedLocationId}>
            <Plus className="size-4" />
            Add table
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend color="bg-card border-border" label="Available" />
        <Legend color="bg-primary/15 border-primary/60" label="Occupied" />
        <Legend color="bg-warning/15 border-warning/50" label="Reserved" />
        <Legend color="bg-destructive/15 border-destructive/50" label="Dirty" />
      </div>

      {!selectedLocationId ? (
        <p className="text-sm text-muted-foreground">Select a location in the header.</p>
      ) : loading ? (
        <AppLoader fullPage />
      ) : tables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No tables yet for this location.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Add first table
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelected(table)}
              className={cn(
                'min-h-[120px] rounded-xl border-2 p-4 text-left transition',
                tableStatusStyles(table.status),
                selected?.id === table.id && 'ring-2 ring-primary',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-lg font-semibold tracking-tight">{table.label}</p>
                <Badge variant="outline" className="capitalize">
                  {table.status}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{table.seats} seats</p>
              {table.activeOrder ? (
                <p className="money mt-3 text-sm">
                  {formatMoney(Number(table.activeOrder.grand_total), currency)}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No open order</p>
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Table {selected?.label}</DialogTitle>
            <DialogDescription>
              {selected?.seats} seats · status{' '}
              <span className="capitalize">{selected?.status}</span>
            </DialogDescription>
          </DialogHeader>

          {selected?.activeOrder ? (
            <div className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm">
              <p className="text-muted-foreground">Active order</p>
              <p className="money mt-1">
                {formatMoney(Number(selected.activeOrder.grand_total), currency)}
              </p>
              <p className="mt-1 text-xs capitalize text-muted-foreground">
                {selected.activeOrder.status.replaceAll('_', ' ')}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status}
                type="button"
                variant={selected?.status === status ? 'default' : 'outline'}
                className="min-h-11 capitalize"
                disabled={busy}
                onClick={() => void updateStatus(status)}
              >
                {status}
              </Button>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="min-h-11 w-full"
              onClick={() => selected && openInPos(selected)}
            >
              Open in POS
            </Button>
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!selected?.activeOrder || busy}
                onClick={() => {
                  setTargetTableId('')
                  setTransferOpen(true)
                }}
              >
                <ArrowRightLeft className="size-4" />
                Transfer
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!selected?.activeOrder || otherOccupied.length === 0 || busy}
                onClick={() => {
                  setTargetTableId('')
                  setMergeOpen(true)
                }}
              >
                Merge
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={busy}
              onClick={() => setDeleteOpen(true)}
            >
              Delete table
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add table</DialogTitle>
            <DialogDescription>Create a table for the current location.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="T1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seats">Seats</Label>
              <Input
                id="seats"
                type="number"
                min={1}
                value={seats}
                onChange={(event) => setSeats(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy || !label.trim()} onClick={() => void createTable()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer order</DialogTitle>
            <DialogDescription>
              Move the active order from {selected?.label} to another table.
            </DialogDescription>
          </DialogHeader>
          <Select
            className="w-full"
            value={targetTableId || undefined}
            placeholder="Select target table"
            onChange={(value) => setTargetTableId(value)}
            options={transferTargets.map((table) => ({
              value: table.id,
              label: table.label,
            }))}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!targetTableId || busy}
              onClick={() => void transferOrder()}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into {selected?.label}</DialogTitle>
            <DialogDescription>
              Pull another table’s open order items into this table, then void the source order.
            </DialogDescription>
          </DialogHeader>
          <Select
            className="w-full"
            value={targetTableId || undefined}
            placeholder="Select source table"
            onChange={(value) => setTargetTableId(value)}
            options={otherOccupied.map((table) => ({
              value: table.id,
              label: `${table.label}${
                table.activeOrder
                  ? ` · ${formatMoney(Number(table.activeOrder.grand_total), currency)}`
                  : ''
              }`,
            }))}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!targetTableId || busy}
              onClick={() => void mergeOrders()}
            >
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteOpen}
        title={selected ? `Delete table ${selected.label}?` : 'Delete table?'}
        confirmText="Delete"
        cancelText="Cancel"
        danger
        confirmLoading={deleteLoading}
        onConfirm={() => void confirmDeleteTable()}
        onCancel={() => {
          if (!deleteLoading) setDeleteOpen(false)
        }}
      />
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-sm border ${color}`} />
      {label}
    </span>
  )
}
