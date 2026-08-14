'use client'

import { cn } from '@/lib/utils'

interface AppLoaderProps {
  label?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  fullPage?: boolean
}

const dotSize = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3.5 w-3.5',
} as const

const gapSize = {
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
} as const

export function AppLoader({
  label,
  className,
  size = 'md',
  fullPage = false,
}: AppLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullPage && 'min-h-[50vh] w-full',
        className
      )}
    >
      <div className={cn('flex items-center', gapSize[size])} aria-hidden>
        <span className={cn('app-loader-dot', dotSize[size])} />
        <span className={cn('app-loader-dot app-loader-dot-2', dotSize[size])} />
        <span className={cn('app-loader-dot app-loader-dot-3', dotSize[size])} />
      </div>
      {label ? (
        <p className="text-sm text-muted-foreground">{label}</p>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  )
}
