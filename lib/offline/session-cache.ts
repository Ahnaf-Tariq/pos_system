import type { DashboardSession } from '@/types/interfaces'
import { getReadCache, setReadCache } from '@/lib/offline/read-cache'

const SESSION_CACHE_KEY = 'dashboard-session'

export async function getCachedDashboardSession(): Promise<DashboardSession | null> {
  const cached = await getReadCache<DashboardSession>(SESSION_CACHE_KEY)
  return cached?.data ?? null
}

export async function setCachedDashboardSession(session: DashboardSession) {
  await setReadCache(SESSION_CACHE_KEY, session)
}

export async function clearCachedDashboardSession() {
  const { invalidateReadCache } = await import('@/lib/offline/read-cache')
  await invalidateReadCache(SESSION_CACHE_KEY)
}
