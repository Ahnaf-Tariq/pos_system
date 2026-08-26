export const OFFLINE_NETWORK_TIMEOUT_MS = 2500
/** Longer budget for real Supabase fetches while the browser reports online */
export const ONLINE_FETCH_TIMEOUT_MS = 12000

export const SW_CACHE_VERSION = 'shell-v6'

export const OFFLINE_CAPABLE_ROUTES = [
  '/pos',
  '/tables',
  '/cash-drawer',
  '/kds',
] as const

export const GRACEFUL_OFFLINE_ROUTES = [
  '/reports',
  '/vendors',
  '/staff',
  '/customers',
  '/settings',
] as const

export type OfflineCapableRoute = (typeof OFFLINE_CAPABLE_ROUTES)[number]
export type GracefulOfflineRoute = (typeof GRACEFUL_OFFLINE_ROUTES)[number]

export function isOfflineCapableRoute(pathname: string): boolean {
  return OFFLINE_CAPABLE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export function isGracefulOfflineRoute(pathname: string): boolean {
  return GRACEFUL_OFFLINE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}
