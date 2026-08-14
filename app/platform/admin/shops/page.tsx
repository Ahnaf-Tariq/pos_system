import type { Metadata } from 'next'
import { ShopsAdmin } from '@/components/platform/shops-admin'

export const metadata: Metadata = {
  title: 'Platform shops',
}

export default function PlatformShopsPage() {
  return <ShopsAdmin />
}
