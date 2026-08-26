'use client'

import { useEffect } from 'react'
import { SW_CACHE_VERSION } from '@/lib/offline/constants'
import { prefetchOfflineShellRoutes } from '@/lib/offline/prefetch-shell'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let cancelled = false

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          `/sw.js?v=${SW_CACHE_VERSION}`,
          { scope: '/' }
        )
        if (cancelled) return

        await navigator.serviceWorker.ready
        if (cancelled) return

        // After SW is controlling the page, warm HTML shells.
        if (navigator.onLine) {
          prefetchOfflineShellRoutes()
        }

        registration.update().catch(() => undefined)
      } catch (error) {
        console.error('[offline] Service worker registration failed:', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
