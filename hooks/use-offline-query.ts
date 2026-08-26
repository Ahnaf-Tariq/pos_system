'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { checkConnectivity, runOnlineFetch } from '@/lib/offline/network'
import { getReadCache, setReadCache } from '@/lib/offline/read-cache'

export interface OfflineQueryState<T> {
  data: T | null
  loading: boolean
  error: string | null
  fromCache: boolean
  noCachedData: boolean
  lastSyncedAt: string | null
  refresh: (opts?: { force?: boolean }) => Promise<void>
}

export function useOfflineQuery<T>({
  cacheKey,
  fetchFn,
  enabled = true,
}: {
  cacheKey: string
  fetchFn: () => Promise<T>
  enabled?: boolean
}): OfflineQueryState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [noCachedData, setNoCachedData] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const fetchFnRef = useRef(fetchFn)
  fetchFnRef.current = fetchFn

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      setNoCachedData(false)

      const browserOnline =
        opts?.force === true ||
        (typeof navigator !== 'undefined' && navigator.onLine) ||
        (await checkConnectivity())

      if (browserOnline) {
        try {
          const fresh = await runOnlineFetch(() => fetchFnRef.current())
          await setReadCache(cacheKey, fresh)
          setData(fresh)
          setFromCache(false)
          setLastSyncedAt(new Date().toISOString())
          setLoading(false)
          return
        } catch (networkError) {
          const cached = await getReadCache<T>(cacheKey)
          if (cached) {
            setData(cached.data)
            setFromCache(true)
            setLastSyncedAt(cached.lastSyncedAt)
            setLoading(false)
            return
          }

          setError(
            networkError instanceof Error
              ? networkError.message
              : 'Could not load data'
          )
          setNoCachedData(true)
          setLoading(false)
          return
        }
      }

      const cached = await getReadCache<T>(cacheKey)
      if (cached) {
        setData(cached.data)
        setFromCache(true)
        setLastSyncedAt(cached.lastSyncedAt)
        setLoading(false)
        return
      }

      setNoCachedData(true)
      setError('No cached data yet. Connect once while online to download.')
      setLoading(false)
    },
    [cacheKey, enabled]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    data,
    loading,
    error,
    fromCache,
    noCachedData,
    lastSyncedAt,
    refresh,
  }
}
