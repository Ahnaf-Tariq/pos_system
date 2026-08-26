'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { DashboardSession } from '@/types/interfaces'
import { SessionProvider } from '@/components/dashboard/session-context'
import { getCachedDashboardSession } from '@/lib/offline/session-cache'
import { AppLoader } from '@/components/ui/app-loader'

export function OfflineCapablePage({
  children,
}: {
  children: (session: DashboardSession) => ReactNode
}) {
  const [session, setSession] = useState<DashboardSession | null>(null)
  const [loading, setLoading] = useState(true)
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

  useEffect(() => {
    let cancelled = false
    void getCachedDashboardSession().then((cached) => {
      if (cancelled) return
      setSession(cached)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [browserOnline])

  if (loading || ((browserOnline || navigator.onLine) && !session)) {
    return <AppLoader fullPage />
  }

  if (!session) {
    return (
      <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
        No cached session yet. Connect once while online, then try again.
      </p>
    )
  }

  return <SessionProvider session={session}>{children(session)}</SessionProvider>
}
