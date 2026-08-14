'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const

interface NumpadProps {
  value: string
  onChange: (value: string) => void
  onEnter?: () => void
  className?: string
}

export function Numpad({ value, onChange, onEnter, className }: NumpadProps) {
  function press(key: (typeof KEYS)[number]) {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
      return
    }
    if (key === '.' && value.includes('.')) return
    if (value === '0' && key !== '.') {
      onChange(key)
      return
    }
    onChange(`${value}${key}`)
  }

  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {KEYS.map((key) => (
        <Button
          key={key}
          type="button"
          variant="secondary"
          className="min-h-12 text-lg font-semibold"
          onClick={() => press(key)}
        >
          {key}
        </Button>
      ))}
      {onEnter ? (
        <Button
          type="button"
          className="col-span-3 min-h-12 text-base"
          onClick={onEnter}
        >
          Apply
        </Button>
      ) : null}
    </div>
  )
}
