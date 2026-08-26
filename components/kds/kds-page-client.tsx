'use client'

import { useDashboardSession } from '@/components/dashboard/session-context'
import { KdsBoard } from '@/components/kds/kds-board'
import { ROUTES } from '@/lib/routes'
import { useConnectivity } from '@/components/offline/offline-provider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function KdsPageClient() {
  const session = useDashboardSession()
  const { online } = useConnectivity()
  const router = useRouter()

  useEffect(() => {
    if (online && session.shop.kds_enabled === false) {
      router.replace(ROUTES.dashboard)
    }
  }, [online, session.shop.kds_enabled, router])

  if (session.shop.kds_enabled === false) {
    return (
      <p className="text-sm text-muted-foreground">
        Kitchen display is disabled for this shop.
      </p>
    )
  }

  return (
    <KdsBoard userId={session.shop.user_id} currency={session.shop.currency} />
  )
}
