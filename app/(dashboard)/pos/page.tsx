import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PosPageClient } from '@/components/pos/pos-page-client'
import { AppLoader } from '@/components/ui/app-loader'

export const metadata: Metadata = {
  title: 'POS',
}

export default function PosPage() {
  return (
    <Suspense fallback={<AppLoader fullPage />}>
      <PosPageClient />
    </Suspense>
  )
}
