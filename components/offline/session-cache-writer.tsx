'use client'

import { useEffect } from 'react'
import type { DashboardSession } from '@/types/interfaces'
import { setCachedDashboardSession } from '@/lib/offline/session-cache'

export function SessionCacheWriter({ session }: { session: DashboardSession }) {
  useEffect(() => {
    void setCachedDashboardSession(session)
  }, [session])

  return null
}
