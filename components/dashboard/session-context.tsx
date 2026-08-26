'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { DashboardSession } from '@/types/interfaces'

const SessionContext = createContext<DashboardSession | null>(null)

export function SessionProvider({
  session,
  children,
}: {
  session: DashboardSession
  children: ReactNode
}) {
  return (
    <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
  )
}

export function useDashboardSession() {
  const session = useContext(SessionContext)
  if (!session) {
    throw new Error('useDashboardSession must be used within SessionProvider')
  }
  return session
}
