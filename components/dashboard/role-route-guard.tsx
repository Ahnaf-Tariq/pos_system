'use client'

import { useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  getDefaultRouteForRole,
  getNavItemsForRole,
} from '@/lib/navigation'
import { isOfflineCapableRoute } from '@/lib/offline/constants'
import { useConnectivity } from '@/components/offline/offline-provider'
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
  const { online } = useConnectivity()
  const allowedHrefs = useMemo(
    () => getNavItemsForRole(role, { kdsEnabled }).map((item) => item.href),
    [role, kdsEnabled]
  )

  const isAllowed = allowedHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )

  const offlineCapable = isOfflineCapableRoute(pathname)

  useEffect(() => {
    if (!online && offlineCapable) return
    if (!isAllowed) router.replace(getDefaultRouteForRole(role, { kdsEnabled }))
  }, [isAllowed, role, kdsEnabled, router, online, offlineCapable])

  if (!isAllowed) {
    if (!online && offlineCapable) {
      return children
    }

    return (
      <div className="text-sm text-muted-foreground">Redirecting to your workspace…</div>
    )
  }

  return children
}
