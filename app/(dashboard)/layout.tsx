import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSession } from '@/lib/auth/session'
import { isPlatformAdmin } from '@/lib/auth/shop-access'
import { DashboardShell } from '@/components/dashboard/shell'
import { RoleRouteGuard } from '@/components/dashboard/role-route-guard'
import { ROUTES } from '@/lib/routes'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const session = await getDashboardSession(supabase, user.id)
  if (!session) redirect(ROUTES.pendingApproval)

  session.email = user.email ?? null
  const superAdmin = await isPlatformAdmin(supabase, user.id)

  return (
    <DashboardShell session={session} isSuperAdmin={superAdmin}>
      <RoleRouteGuard
        role={session.staffMember.role}
        kdsEnabled={session.shop.kds_enabled !== false}
      >
        {children}
      </RoleRouteGuard>
    </DashboardShell>
  )
}
