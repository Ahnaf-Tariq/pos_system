'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Controller, useForm } from 'react-hook-form'
import { Select } from 'antd'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import {
  inventoryItemSchema,
  type InventoryItemInput,
} from '@/lib/validations/inventory'
import { fetchVendors } from '@/lib/vendors/catalog'
import type { InventoryItem, Vendor } from '@/types/interfaces'
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

interface InventoryItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  locationId: string
  item: InventoryItem | null
  onSaved: () => void
}

export function InventoryItemDialog({
  open,
  onOpenChange,
  userId,
  locationId,
  item,
  onSaved,
}: InventoryItemDialogProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: '',
      unit: 'kg',
      quantity_on_hand: 0,
      reorder_threshold: 0,
      cost_per_unit: 0,
      vendor_id: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (item) {
      reset({
        name: item.name,
        unit: item.unit,
        quantity_on_hand: Number(item.quantity_on_hand),
        reorder_threshold: Number(item.reorder_threshold),
        cost_per_unit: Number(item.cost_per_unit),
        vendor_id: item.vendor_id ?? '',
      })
    } else {
      reset({
        name: '',
        unit: 'kg',
        quantity_on_hand: 0,
        reorder_threshold: 0,
        cost_per_unit: 0,
        vendor_id: '',
      })
    }

    void (async () => {
      const supabase = createClient()
      setVendors(await fetchVendors(supabase, userId, locationId))
    })()
  }, [open, item, reset, userId, locationId])

  async function onSubmit(values: InventoryItemInput) {
    const supabase = createClient()
    const vendorId = values.vendor_id || null
    const payload = {
      user_id: userId,
      location_id: locationId,
      vendor_id: vendorId,
      name: values.name.trim(),
      unit: values.unit.trim(),
      quantity_on_hand: values.quantity_on_hand,
      reorder_threshold: values.reorder_threshold,
      cost_per_unit: values.cost_per_unit,
    }

    if (item) {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update(payload)
        .eq('id', item.id)
        .eq('user_id', userId)
      if (updateError) {
        toast.error(updateError.message)
        return
      }
      toast.success('Ingredient updated')
    } else {
      const { data: created, error: createError } = await supabase
        .from('inventory_items')
        .insert(payload)
        .select('id')
        .single()
      if (createError || !created) {
        const message = createError?.message ?? 'Could not create item'
        toast.error(message)
        return
      }
      if (values.quantity_on_hand > 0) {
        await supabase.from('inventory_movements').insert({
          user_id: userId,
          inventory_item_id: created.id,
          change_qty: values.quantity_on_hand,
          reason: 'restock',
          vendor_id: vendorId,
        })
      }
      toast.success('Ingredient created')
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Edit ingredient' : 'Add ingredient'}</DialogTitle>
          <DialogDescription>
            Track quantity, reorder threshold, and unit cost for this location.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Chicken breast" {...register('name')} />
            {errors.name ? (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" placeholder="kg / L / pcs" {...register('unit')} />
              {errors.unit ? (
                <p className="text-sm text-destructive">{errors.unit.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_per_unit">Cost / unit</Label>
              <Input
                id="cost_per_unit"
                type="number"
                step="0.0001"
                {...register('cost_per_unit', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_on_hand">Qty on hand</Label>
              <Input
                id="quantity_on_hand"
                type="number"
                step="0.001"
                {...register('quantity_on_hand', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder_threshold">Reorder at</Label>
              <Input
                id="reorder_threshold"
                type="number"
                step="0.001"
                {...register('reorder_threshold', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor_id">Preferred vendor</Label>
            <Controller
              name="vendor_id"
              control={control}
              render={({ field }) => (
                <Select
                  id="vendor_id"
                  className="w-full"
                  allowClear
                  placeholder="Optional — used on restock"
                  value={field.value || undefined}
                  onChange={(value) => field.onChange(value ?? '')}
                  options={vendors.map((vendor) => ({
                    value: vendor.id,
                    label: vendor.name,
                  }))}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : item ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
