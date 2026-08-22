'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Controller, useForm } from 'react-hook-form'
import { Select } from 'antd'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { adjustStock, fetchRecentMovements } from '@/lib/inventory/catalog'
import { fetchVendors } from '@/lib/vendors/catalog'
import {
  stockAdjustSchema,
  type StockAdjustInput,
} from '@/lib/validations/inventory'
import type { InventoryItem, InventoryMovement, Vendor } from '@/types/interfaces'
import { InventoryMovementReason } from '@/types/enums'
import { ROUTES } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface StockAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  item: InventoryItem | null
  onSaved: () => void
}

export function StockAdjustDialog({
  open,
  onOpenChange,
  userId,
  item,
  onSaved,
}: StockAdjustDialogProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustInput>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      change_qty: 0,
      reason: InventoryMovementReason.RESTOCK,
      vendor_id: '',
    },
  })

  const reason = watch('reason')

  useEffect(() => {
    if (!open || !item) return
    reset({
      change_qty: 0,
      reason: InventoryMovementReason.RESTOCK,
      vendor_id: item.vendor_id ?? '',
    })

    void (async () => {
      const supabase = createClient()
      const [rows, vendorRows] = await Promise.all([
        fetchRecentMovements(supabase, userId, item.id),
        fetchVendors(supabase, userId, item.location_id),
      ])
      setMovements(rows)
      setVendors(vendorRows)
    })()
  }, [open, item, userId, reset])

  async function onSubmit(values: StockAdjustInput) {
    if (!item) return
    try {
      const supabase = createClient()
      let changeQty = values.change_qty
      if (values.reason === InventoryMovementReason.WASTE && changeQty > 0) {
        changeQty = -Math.abs(changeQty)
      }
      if (values.reason === InventoryMovementReason.RESTOCK && changeQty < 0) {
        changeQty = Math.abs(changeQty)
      }

      await adjustStock({
        supabase,
        userId,
        item,
        changeQty,
        reason: values.reason,
        vendorId:
          values.reason === InventoryMovementReason.RESTOCK
            ? values.vendor_id || null
            : null,
      })
      toast.success('Stock adjusted')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Adjustment failed'
      toast.error(message)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust {item.name}</DialogTitle>
          <DialogDescription>
            On hand: {item.quantity_on_hand} {item.unit}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="change_qty">Change quantity</Label>
            <Input
              id="change_qty"
              type="number"
              step="0.001"
              {...register('change_qty', { valueAsNumber: true })}
            />
            {errors.change_qty ? (
              <p className="text-sm text-destructive">{errors.change_qty.message}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Restock uses positive amounts. Waste uses positive amounts and subtracts
              automatically.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Select
                  id="reason"
                  className="w-full"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: InventoryMovementReason.RESTOCK, label: 'Restock' },
                    { value: InventoryMovementReason.WASTE, label: 'Waste' },
                    { value: InventoryMovementReason.ADJUSTMENT, label: 'Adjustment' },
                  ]}
                />
              )}
            />
          </div>

          {reason === InventoryMovementReason.RESTOCK ? (
            <div className="space-y-2">
              <Label htmlFor="vendor_id">Vendor</Label>
              <Controller
                name="vendor_id"
                control={control}
                render={({ field }) => (
                  <Select
                    id="vendor_id"
                    className="w-full"
                    allowClear
                    placeholder={
                      vendors.length === 0
                        ? 'No vendors for this location'
                        : 'Who did you buy from?'
                    }
                    value={field.value || undefined}
                    onChange={(value) => field.onChange(value ?? '')}
                    options={vendors.map((vendor) => ({
                      value: vendor.id,
                      label: vendor.name,
                    }))}
                  />
                )}
              />
              {vendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add suppliers on the{' '}
                  <Link
                    href={ROUTES.vendors}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Vendors
                  </Link>{' '}
                  page, then restock in seconds.
                </p>
              ) : null}
            </div>
          ) : null}

          {movements.length > 0 ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent movements
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {movements.map((movement) => (
                  <li key={movement.id} className="flex justify-between gap-2">
                    <span className="capitalize">
                      {movement.reason}
                      {movement.vendor_name ? ` · ${movement.vendor_name}` : ''}
                    </span>
                    <span className="tabular-nums text-foreground">
                      {movement.change_qty > 0 ? '+' : ''}
                      {movement.change_qty}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Apply'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
