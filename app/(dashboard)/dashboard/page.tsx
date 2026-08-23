import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSession } from '@/lib/auth/session'
import { DashboardChat } from '@/components/dashboard/dashboard-overview'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const session = await getDashboardSession(supabase, user.id)
  if (!session) redirect(ROUTES.pendingApproval)

  // Get first active location as default
  const { data: locations } = await supabase
    .from('locations')
    .select('id')
    .eq('user_id', session.shop.user_id)
    .eq('is_active', true)
    .limit(1)

  const defaultLocationId = locations?.[0]?.id ?? null

  return (
    <DashboardChat
      businessName={session.shop.business_name}
      locationId={defaultLocationId}
    />
  )
}