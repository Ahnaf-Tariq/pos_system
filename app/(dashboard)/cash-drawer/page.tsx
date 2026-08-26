import type { Metadata } from 'next'
import { CashDrawerPageClient } from '@/components/cash-drawer/cash-drawer-page-client'

export const metadata: Metadata = {
  title: 'Cash drawer',
}

export default function CashDrawerPage() {
  return <CashDrawerPageClient />
}
