import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSession } from '@/lib/auth/session'
import { ReportsDashboard } from '@/components/reports/reports-dashboard'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Reports',
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const session = await getDashboardSession(supabase, user.id)
  if (!session) redirect(ROUTES.pendingApproval)

  return (
    <ReportsDashboard
      userId={session.shop.user_id}
      currency={session.shop.currency}
    />
  )
}
