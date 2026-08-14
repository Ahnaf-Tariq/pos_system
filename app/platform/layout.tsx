import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isPlatformAdmin } from '@/lib/auth/shop-access'
import { PlatformShell } from '@/components/platform/platform-shell'
import { ROUTES } from '@/lib/routes'

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const admin = await isPlatformAdmin(supabase, user.id)
  if (!admin) redirect(ROUTES.dashboard)

  return <PlatformShell email={user.email ?? null}>{children}</PlatformShell>
}
