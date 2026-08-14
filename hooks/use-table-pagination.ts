'use client'

import { useEffect, useMemo, useState } from 'react'

export const TABLE_PAGE_SIZE = 10

export function useTablePagination<T>(
  items: T[],
  options?: {
    pageSize?: number
    /** Change this when filters/search change so page resets to 1. */
    resetKey?: string | number
  }
) {
  const pageSize = options?.pageSize ?? TABLE_PAGE_SIZE
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [options?.resetKey])

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const to = Math.min(safePage * pageSize, totalItems)

  return {
    page: safePage,
    setPage,
    pageItems,
    pageSize,
    totalItems,
    totalPages,
    from,
    to,
  }
}
