import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Platform',
}

export default function PlatformIndexPage() {
  redirect(ROUTES.platformShops)
}
