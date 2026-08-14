'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TablePaginationProps {
  page: number
  totalPages: number
  totalItems: number
  from: number
  to: number
  onPageChange: (page: number) => void
  className?: string
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  from,
  to,
  onPageChange,
  className,
}: TablePaginationProps) {
  if (totalItems === 0) return null

  const pages = buildPageList(page, totalPages)

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-border bg-secondary/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <p className="text-xs text-muted-foreground sm:text-sm">
        Showing{' '}
        <span className="font-medium text-foreground tabular-nums">
          {from}–{to}
        </span>{' '}
        of{' '}
        <span className="font-medium text-foreground tabular-nums">
          {totalItems}
        </span>
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 border-border/80 bg-card/60 hover:border-primary/50 hover:bg-primary/10"
          disabled={page <= 1}
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-1">
          {pages.map((entry, index) =>
            entry === '…' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-1.5 text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => onPageChange(entry)}
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-md text-sm font-medium tabular-nums transition-all',
                  entry === page
                    ? 'bg-primary text-primary-foreground shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_35%,transparent)]'
                    : 'border border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground'
                )}
              >
                {entry}
              </button>
            )
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 border-border/80 bg-card/60 hover:border-primary/50 hover:bg-primary/10"
          disabled={page >= totalPages}
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function buildPageList(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)
  for (let i = page - 1; i <= page + 1; i += 1) {
    if (i >= 1 && i <= totalPages) pages.add(i)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const result: Array<number | '…'> = []

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i]
    const prev = sorted[i - 1]
    if (prev != null && current - prev > 1) result.push('…')
    result.push(current)
  }

  return result
}
