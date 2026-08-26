import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveAuthUser } from '@/lib/auth/resolve-user'
import { getDashboardSession } from '@/lib/auth/session'
import { isPlatformAdmin } from '@/lib/auth/shop-access'
import { DashboardShell } from '@/components/dashboard/shell'
import { OfflineDashboardBootstrap } from '@/components/offline/offline-dashboard-bootstrap'
import { SessionCacheWriter } from '@/components/offline/session-cache-writer'
import { RoleRouteGuard } from '@/components/dashboard/role-route-guard'
import { ROUTES } from '@/lib/routes'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { user, usedCookieFallback } = await resolveAuthUser(supabase)

  if (!user) redirect(ROUTES.login)

  if (usedCookieFallback) {
    return (
      <OfflineDashboardBootstrap authId={user.id} email={user.email ?? null}>
        {children}
      </OfflineDashboardBootstrap>
    )
  }

  const session = await getDashboardSession(supabase, user.id)
  if (!session) redirect(ROUTES.pendingApproval)

  session.email = user.email ?? null
  const superAdmin = await isPlatformAdmin(supabase, user.id)

  return (
    <DashboardShell session={session} isSuperAdmin={superAdmin}>
      <SessionCacheWriter session={session} />
      <RoleRouteGuard
        role={session.staffMember.role}
        kdsEnabled={session.shop.kds_enabled !== false}
      >
        {children}
      </RoleRouteGuard>
    </DashboardShell>
  )
}
