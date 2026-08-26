import { OFFLINE_CAPABLE_ROUTES } from '@/lib/offline/constants'

/**
 * Warm the service-worker HTML shell for every offline-capable route.
 * Must request real HTML (not RSC) so soft-refresh / offline navigation work.
 */
export function prefetchOfflineShellRoutes() {
  if (typeof window === 'undefined') return

  const routes = [...OFFLINE_CAPABLE_ROUTES]

  void (async () => {
    await Promise.all(
      routes.map((route) =>
        fetch(route, {
          credentials: 'include',
          cache: 'no-store',
          headers: { Accept: 'text/html' },
        }).catch(() => undefined)
      )
    )

    const registration = await navigator.serviceWorker?.ready
    registration?.active?.postMessage({
      type: 'PRECACHE_SHELL',
      routes,
    })
  })()
}

/** Cache the HTML shell for the route the user is viewing (or just opened). */
export function cacheShellRoute(pathname: string) {
  if (typeof window === 'undefined') return
  if (!OFFLINE_CAPABLE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return
  }

  void fetch(pathname, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'text/html' },
  }).catch(() => undefined)
}
