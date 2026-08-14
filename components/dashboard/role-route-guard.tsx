'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  getDefaultRouteForRole,
  getNavItemsForRole,
} from '@/lib/navigation'
import type { StaffRole } from '@/types/enums'

export function RoleRouteGuard({
  role,
  kdsEnabled = true,
  children,
}: {
  role: StaffRole
  kdsEnabled?: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const allowedHrefs = useMemo(
    () => getNavItemsForRole(role, { kdsEnabled }).map((item) => item.href),
    [role, kdsEnabled]
  )

  const isAllowed = allowedHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )

  useEffect(() => {
    if (!isAllowed) router.replace(getDefaultRouteForRole(role, { kdsEnabled }))
  }, [isAllowed, role, kdsEnabled, router])

  if (!isAllowed) {
    return (
      <div className="text-sm text-muted-foreground">Redirecting to your workspace…</div>
    )
  }

  return children
}
