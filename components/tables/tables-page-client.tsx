'use client'

import { useDashboardSession } from '@/components/dashboard/session-context'
import { TablesFloor } from '@/components/tables/tables-floor'

export function TablesPageClient() {
  const session = useDashboardSession()

  return (
    <TablesFloor
      userId={session.shop.user_id}
      currency={session.shop.currency}
    />
  )
}
