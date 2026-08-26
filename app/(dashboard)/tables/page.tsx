import type { Metadata } from 'next'
import { TablesPageClient } from '@/components/tables/tables-page-client'

export const metadata: Metadata = {
  title: 'Tables',
}

export default function TablesPage() {
  return <TablesPageClient />
}
