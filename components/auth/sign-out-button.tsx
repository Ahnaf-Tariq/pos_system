'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/lib/routes'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Button } from '@/components/ui/button'

export function SignOutButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Logged out')
      setOpen(false)
      router.replace(ROUTES.login)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log out')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Logout
      </Button>
      <ConfirmModal
        open={open}
        title="Log out?"
        description="You will need to sign in again to continue."
        confirmText="Logout"
        cancelText="Cancel"
        danger
        confirmLoading={loading}
        onConfirm={handleLogout}
        onCancel={() => {
          if (!loading) setOpen(false)
        }}
      />
    </>
  )
}
