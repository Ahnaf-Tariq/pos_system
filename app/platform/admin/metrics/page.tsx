import type { Metadata } from 'next'
import { MetricsAdmin } from '@/components/platform/metrics-admin'

export const metadata: Metadata = {
  title: 'Platform metrics',
}

export default function PlatformMetricsPage() {
  return <MetricsAdmin />
}
