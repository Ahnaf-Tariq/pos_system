'use client'

import { useDashboardSession } from '@/components/dashboard/session-context'
import { CashDrawerManager } from '@/components/cash-drawer/cash-drawer-manager'

export function CashDrawerPageClient() {
  const session = useDashboardSession()

  return (
    <CashDrawerManager
      userId={session.shop.user_id}
      authId={session.authId}
      currency={session.shop.currency}
    />
  )
}
