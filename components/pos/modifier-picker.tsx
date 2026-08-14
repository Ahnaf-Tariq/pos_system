'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { MenuItemWithGroups } from '@/types/interfaces'
import type { SelectedModifier } from '@/types/interfaces'
import { formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModifierPickerProps {
  open: boolean
  item: MenuItemWithGroups | null
  currency: string
  onOpenChange: (open: boolean) => void
  onConfirm: (selected: SelectedModifier[]) => void
}

export function ModifierPicker({
  open,
  item,
  currency,
  onOpenChange,
  onConfirm,
}: ModifierPickerProps) {
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({})

  const groups = item?.modifier_groups ?? []

  useEffect(() => {
    if (!open || !item) return
    const initial: Record<string, string[]> = {}
    for (const group of item.modifier_groups) initial[group.id] = []
    setSelectedByGroup(initial)
  }, [open, item])

  function toggleModifier(groupId: string, modifierId: string, maxSelect: number) {
    setSelectedByGroup((current) => {
      const existing = current[groupId] ?? []
      if (existing.includes(modifierId)) {
        return { ...current, [groupId]: existing.filter((id) => id !== modifierId) }
      }
      if (maxSelect <= 1) return { ...current, [groupId]: [modifierId] }
      if (existing.length >= maxSelect) return current
      return { ...current, [groupId]: [...existing, modifierId] }
    })
  }

  function handleConfirm() {
    if (!item) return
    for (const group of groups) {
      const selected = selectedByGroup[group.id] ?? []
      const min = group.is_required ? Math.max(group.min_select, 1) : group.min_select
      if (selected.length < min) {
        toast.error(`Select at least ${min} option(s) for ${group.name}`)
        return
      }
      if (selected.length > group.max_select) {
        toast.error(`${group.name} allows max ${group.max_select}`)
        return
      }
    }

    const selected: SelectedModifier[] = []
    for (const group of groups) {
      for (const modifierId of selectedByGroup[group.id] ?? []) {
        const modifier = group.modifiers.find((row) => row.id === modifierId)
        if (modifier) {
          selected.push({
            id: modifier.id,
            name: modifier.name,
            price_delta: Number(modifier.price_delta),
          })
        }
      }
    }

    onConfirm(selected)
    onOpenChange(false)
  }

  if (!item) return null

  const extras = Object.values(selectedByGroup)
    .flat()
    .reduce((sum, modifierId) => {
      const modifier = groups
        .flatMap((group) => group.modifiers)
        .find((row) => row.id === modifierId)
      return sum + Number(modifier?.price_delta ?? 0)
    }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            Base {formatMoney(Number(item.price), currency)}
            {extras ? ` · extras ${formatMoney(extras, currency)}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{group.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {group.is_required ? 'Required' : 'Optional'} · max {group.max_select}
                </p>
              </div>
              <div className="space-y-2">
                {group.modifiers.map((modifier) => {
                  const checked = (selectedByGroup[group.id] ?? []).includes(modifier.id)
                  return (
                    <label
                      key={modifier.id}
                      className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <span className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            toggleModifier(group.id, modifier.id, group.max_select)
                          }
                        />
                        {modifier.name}
                      </span>
                      <span className="money text-xs">
                        {Number(modifier.price_delta) >= 0 ? '+' : ''}
                        {formatMoney(Number(modifier.price_delta), currency)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Add · {formatMoney(Number(item.price) + extras, currency)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
