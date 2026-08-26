import type { Metadata } from 'next'
import { KdsPageClient } from '@/components/kds/kds-page-client'

export const metadata: Metadata = {
  title: 'KDS',
}

export default function KdsPage() {
  return <KdsPageClient />
}
