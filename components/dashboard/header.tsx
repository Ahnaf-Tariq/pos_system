'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Dropdown } from 'antd'
import type { MenuProps } from 'antd'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ROUTES } from '@/lib/routes'
import { roleLabel } from '@/lib/navigation'
import type { StaffRole } from '@/types/enums'
import { useLocationContext } from '@/components/dashboard/location-provider'
import { NotificationsBell } from '@/components/dashboard/notifications-bell'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  staffName: string
  role: StaffRole
  userId: string
  isSuperAdmin?: boolean
}

export function DashboardHeader({
  staffName,
  role,
  userId,
  isSuperAdmin = false,
}: DashboardHeaderProps) {
  const router = useRouter()
  const { locations, selectedLocation, setSelectedLocationId } =
    useLocationContext()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Logged out')
      setLogoutOpen(false)
      router.replace(ROUTES.login)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log out')
    } finally {
      setLoggingOut(false)
    }
  }

  const locationItems: MenuProps['items'] =
    locations.length === 0
      ? [{ key: 'empty', label: 'No locations yet', disabled: true }]
      : locations.map((location) => ({
          key: location.id,
          label: (
            <span className="flex items-center justify-between gap-3">
              <span>{location.name}</span>
              {selectedLocation?.id === location.id ? (
                <span className="text-xs text-primary">Active</span>
              ) : null}
            </span>
          ),
          onClick: () => setSelectedLocationId(location.id),
        }))

  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur">
        <div className="min-w-0">
          <Dropdown
            menu={{
              items: [
                {
                  key: 'label',
                  label: 'Locations',
                  disabled: true,
                  style: { opacity: 0.65, cursor: 'default' },
                },
                { type: 'divider' },
                ...locationItems,
              ],
            }}
            trigger={['click']}
          >
            <Button variant="outline" className="min-h-11 gap-2">
              <MapPin className="size-4 text-primary" />
              <span className="max-w-[180px] truncate">
                {selectedLocation?.name ?? 'Select location'}
              </span>
            </Button>
          </Dropdown>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isSuperAdmin ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => router.push(ROUTES.platformShops)}
            >
              Platform
            </Button>
          ) : null}

          <NotificationsBell userId={userId} />

          <div className="hidden sm:flex">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-2.5 py-1.5">
              <span className="max-w-[140px] truncate text-sm font-medium text-foreground">
                {staffName}
              </span>
              <Badge
                variant="outline"
                className="rounded-full border-primary/40 bg-primary/10 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                {roleLabel(role)}
              </Badge>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="hover:bg-red-500 hover:text-white"
            onClick={() => setLogoutOpen(true)}
          >
            Logout
          </Button>
        </div>
      </header>

      <ConfirmModal
        open={logoutOpen}
        title="Log out?"
        description="You will need to sign in again to access your shop dashboard."
        confirmText="Logout"
        cancelText="Cancel"
        danger
        confirmLoading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loggingOut) setLogoutOpen(false)
        }}
      />
    </>
  )
}
