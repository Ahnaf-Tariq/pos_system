'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardSession } from '@/lib/auth/session'
import { inviteStaffSchema } from '@/lib/validations/staff'
import { canAssignRole } from '@/lib/staff/catalog'
import { StaffRole } from '@/types/enums'
import type { AddStaffResult } from '@/types/interfaces'

/** @deprecated Use addStaffAction */
export async function inviteStaffAction(input: {
  email: string
  fullName: string
  phone?: string
  role: string
  locationId: string | null
  salary?: number
}): Promise<AddStaffResult> {
  return addStaffAction({
    ...input,
    salary: input.salary ?? 0,
  })
}

export async function addStaffAction(input: {
  email: string
  fullName: string
  phone?: string
  role: string
  locationId: string | null
  salary: number
}): Promise<AddStaffResult> {
  const parsed = inviteStaffSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, message: 'Not signed in' }

  const session = await getDashboardSession(supabase, user.id)
  if (!session) return { ok: false, message: 'Shop session not found' }

  const actorRole = session.staffMember.role
  if (actorRole !== StaffRole.OWNER && actorRole !== StaffRole.MANAGER) {
    return { ok: false, message: 'Only owners and managers can add staff' }
  }

  if (!canAssignRole(actorRole, parsed.data.role)) {
    return { ok: false, message: 'You cannot assign that role' }
  }

  const phone = parsed.data.phone?.trim() || null
  const email = parsed.data.email.trim().toLowerCase()
  const fullName = parsed.data.fullName.trim()

  try {
    const admin = createAdminClient()
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
          phone,
        },
        redirectTo: `${origin}/login`,
      }
    )

    let authId = invited?.user?.id
    let linkedExisting = false

    if (inviteError || !authId) {
      const { data: listed, error: listError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      })
      if (listError) {
        return { ok: false, message: inviteError?.message ?? listError.message }
      }

      const existing = listed.users.find(
        (row) => row.email?.toLowerCase() === email
      )
      if (!existing) {
        return {
          ok: false,
          message: inviteError?.message ?? 'Could not add staff',
        }
      }
      authId = existing.id
      linkedExisting = true
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: authId,
      full_name: fullName,
      phone,
      email,
    })

    // profiles.email may not exist until migration 008 — still save name/phone
    if (profileError?.message?.toLowerCase().includes('email')) {
      const { error: profileFallbackError } = await admin.from('profiles').upsert({
        id: authId,
        full_name: fullName,
        phone,
      })
      if (profileFallbackError) {
        return { ok: false, message: profileFallbackError.message }
      }
    } else if (profileError) {
      return { ok: false, message: profileError.message }
    }

    const staffFields = {
      role: parsed.data.role,
      location_id: parsed.data.locationId,
      is_active: true,
      full_name: fullName,
      phone,
      email,
      salary: Number(parsed.data.salary) || 0,
    }

    const { data: existingStaff } = await admin
      .from('staff_members')
      .select('id')
      .eq('user_id', session.shop.user_id)
      .eq('auth_id', authId)
      .maybeSingle()

    if (existingStaff) {
      const { error: updateError } = await admin
        .from('staff_members')
        .update(staffFields)
        .eq('id', existingStaff.id)

      if (updateError) return { ok: false, message: updateError.message }
      return { ok: true, message: 'Staff updated on this shop' }
    }

    const { data: insertedStaff, error: staffError } = await admin
      .from('staff_members')
      .insert({
        user_id: session.shop.user_id,
        auth_id: authId,
        ...staffFields,
      })
      .select('id')
      .single()

    if (staffError) return { ok: false, message: staffError.message }

    const { notifyStaffAdded } = await import('@/lib/notifications/create')
    await notifyStaffAdded(admin, {
      userId: session.shop.user_id,
      locationId: parsed.data.locationId,
      staffMemberId: insertedStaff?.id ?? null,
      staffName: fullName,
      role: parsed.data.role,
    })

    return {
      ok: true,
      message: linkedExisting
        ? 'Staff added (linked existing account)'
        : 'Staff added successfully',
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not add staff',
    }
  }
}
