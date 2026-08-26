'use client'

import { useSearchParams } from 'next/navigation'
import { useDashboardSession } from '@/components/dashboard/session-context'
import { PosTerminal } from '@/components/pos/pos-terminal'

export function PosPageClient() {
  const session = useDashboardSession()
  const searchParams = useSearchParams()
  const tableId = searchParams.get('tableId')

  return (
    <PosTerminal
      userId={session.shop.user_id}
      authId={session.authId}
      currency={session.shop.currency}
      taxRatePercent={Number(session.shop.tax_rate ?? 0)}
      categories={[]}
      items={[]}
      tables={[]}
      customers={[]}
      initialTableId={tableId}
      kdsEnabled={session.shop.kds_enabled !== false}
    />
  )
}
