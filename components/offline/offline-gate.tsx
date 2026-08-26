'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { WifiOff } from 'lucide-react'
import { useConnectivity } from '@/components/offline/offline-provider'
import {
  isGracefulOfflineRoute,
  isOfflineCapableRoute,
} from '@/lib/offline/constants'
import { ROUTES } from '@/lib/routes'

export function OfflineGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { online } = useConnectivity()
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  )

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true)
    const onOffline = () => setBrowserOnline(false)
    setBrowserOnline(navigator.onLine)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (online || browserOnline) return children
  if (isOfflineCapableRoute(pathname)) return children

  const needsReconnect =
    isGracefulOfflineRoute(pathname) || pathname === ROUTES.dashboard
  if (!needsReconnect) return children

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-warning/40 bg-warning/10 text-warning">
        <WifiOff className="size-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">You&apos;re offline</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Reconnect to view this page. POS, Tables, Cash drawer, and KDS remain
        available while offline.
      </p>
    </div>
  )
}
