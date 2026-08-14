'use client'

import { useState, type ReactNode } from 'react'
import type { DashboardSession } from '@/types/interfaces'
import { LocationProvider } from '@/components/dashboard/location-provider'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export function DashboardShell({
  session,
  isSuperAdmin = false,
  children,
}: {
  session: DashboardSession
  isSuperAdmin?: boolean
  children: ReactNode
}) {
  const [collapsed, setCollapsed] = useState(false)
  const staffName = session.profile?.full_name?.trim() || session.email || 'Staff'

  return (
    <LocationProvider
      locations={session.locations}
      staffLocationId={session.staffMember.location_id}
    >
      <div className="flex h-svh overflow-hidden bg-background">
        <DashboardSidebar
          businessName={session.shop.business_name}
          role={session.staffMember.role}
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardHeader
            staffName={staffName}
            role={session.staffMember.role}
            userId={session.shop.user_id}
            isSuperAdmin={isSuperAdmin}
          />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </LocationProvider>
  )
}
