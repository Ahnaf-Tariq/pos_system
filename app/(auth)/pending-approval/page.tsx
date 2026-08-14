import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShopAccessForAuth } from '@/lib/auth/shop-access'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AccountStatus } from '@/types/enums'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Pending approval',
}

export default async function PendingApprovalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const shop = await getShopAccessForAuth(supabase, user.id)

  if (shop?.status === AccountStatus.APPROVED) redirect(ROUTES.dashboard)

  const status = shop?.status ?? AccountStatus.PENDING
  const statusLabel =
    status === AccountStatus.REJECTED
      ? 'Rejected'
      : status === AccountStatus.SUSPENDED
        ? 'Suspended'
        : 'Pending approval'

  const statusVariant =
    status === AccountStatus.REJECTED || status === AccountStatus.SUSPENDED
      ? 'destructive'
      : 'warning'

  return (
    <Card className="border-border/80 bg-card/80 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Account awaiting approval</CardTitle>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>
        <CardDescription>
          {shop?.business_name
            ? `${shop.business_name} is not active yet.`
            : 'Your shop account is not active yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {status === AccountStatus.REJECTED
            ? 'This shop application was rejected. Contact support if you believe this is a mistake.'
            : status === AccountStatus.SUSPENDED
              ? 'This shop has been suspended. Contact support for help restoring access.'
              : 'Your account is awaiting approval. We’ll notify you once it’s active. You can’t open the dashboard until a platform admin approves your shop.'}
        </p>
        <SignOutButton />
      </CardContent>
    </Card>
  )
}
