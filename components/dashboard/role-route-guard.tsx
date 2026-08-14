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
  children,
}: {
  role: StaffRole
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const allowedHrefs = useMemo(
    () => getNavItemsForRole(role).map((item) => item.href),
    [role]
  )

  const isAllowed = allowedHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )

  useEffect(() => {
    if (!isAllowed) router.replace(getDefaultRouteForRole(role))
  }, [isAllowed, role, router])

  if (!isAllowed) {
    return (
      <div className="text-sm text-muted-foreground">Redirecting to your workspace…</div>
    )
  }

  return children
}
