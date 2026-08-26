'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { countPendingWrites } from '@/lib/offline/db'
import { startOfflineSyncLoop } from '@/lib/offline/sync-engine'
import { warmOfflineCache } from '@/lib/offline/warm-cache'
import {
  cacheShellRoute,
  prefetchOfflineShellRoutes,
} from '@/lib/offline/prefetch-shell'
import type { WarmCacheResult } from '@/lib/offline/warm-cache'

interface OfflineContextValue {
  online: boolean
  pendingWrites: number
  warmCacheErrors: WarmCacheResult['errors']
  refreshConnectivity: () => Promise<void>
  refreshPendingCount: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

export function OfflineProvider({
  userId,
  locationIds,
  children,
}: {
  userId: string
  locationIds: string[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const [online, setOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  )
  const [pendingWrites, setPendingWrites] = useState(0)
  const [warmCacheErrors, setWarmCacheErrors] = useState<
    WarmCacheResult['errors']
  >([])
  const warmedRef = useRef(false)

  const refreshConnectivity = useCallback(async () => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
  }, [])

  const refreshPendingCount = useCallback(async () => {
    setPendingWrites(await countPendingWrites())
  }, [])

  useEffect(() => {
    void refreshConnectivity()
    void refreshPendingCount()

    const onOnline = () => {
      setOnline(true)
      warmedRef.current = false
      void refreshPendingCount()
      prefetchOfflineShellRoutes()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const pendingInterval = window.setInterval(() => {
      void refreshPendingCount()
    }, 4000)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(pendingInterval)
    }
  }, [refreshConnectivity, refreshPendingCount])

  useEffect(() => {
    const supabase = createClient()
    return startOfflineSyncLoop(supabase)
  }, [])

  useEffect(() => {
    if (!online || !userId || locationIds.length === 0) return
    if (warmedRef.current) return
    warmedRef.current = true

    void warmOfflineCache({ userId, locationIds }).then((result) => {
      if (result.errors.length > 0) setWarmCacheErrors(result.errors)
    })
    prefetchOfflineShellRoutes()
  }, [online, userId, locationIds.join('|')])

  // Every visit to an offline-capable page while online refreshes its HTML shell.
  useEffect(() => {
    if (!online) return
    cacheShellRoute(pathname)
  }, [online, pathname])

  const value = useMemo(
    () => ({
      online,
      pendingWrites,
      warmCacheErrors,
      refreshConnectivity,
      refreshPendingCount,
    }),
    [
      online,
      pendingWrites,
      warmCacheErrors,
      refreshConnectivity,
      refreshPendingCount,
    ]
  )

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  const ctx = useContext(OfflineContext)
  if (!ctx) {
    throw new Error('useOfflineContext must be used within OfflineProvider')
  }
  return ctx
}

export function useConnectivity() {
  const { online, refreshConnectivity, refreshPendingCount } = useOfflineContext()
  return { online, refreshConnectivity, refreshPendingCount }
}
