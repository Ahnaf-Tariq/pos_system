import type { SupabaseClient } from '@supabase/supabase-js'
import type { StaffMember, StaffMemberView } from '@/types/interfaces'
import type { StaffRole } from '@/types/enums'

export async function fetchStaffMembers(
  supabase: SupabaseClient,
  userId: string,
  locationId?: string | null
): Promise<StaffMemberView[]> {
  const { data: staff, error } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const members = (staff as StaffMember[]) ?? []
  if (members.length === 0) return []

  const locationIds = members
    .map((member) => member.location_id)
    .filter((id): id is string => Boolean(id))

  const needsProfileFallback = members.some(
    (member) => !member.full_name?.trim() || !member.email?.trim()
  )

  const [{ data: locations }, profileById] = await Promise.all([
    locationIds.length
      ? supabase.from('locations').select('id, name').in('id', locationIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    needsProfileFallback
      ? loadProfilesByAuthId(
          supabase,
          members
            .map((member) => member.auth_id)
            .filter((id): id is string => Boolean(id))
        )
      : Promise.resolve(
          new Map<
            string,
            { full_name: string | null; phone: string | null; email: string | null }
          >()
        ),
  ])

  const locationNameById = new Map(
    (locations ?? []).map((location) => [location.id, location.name])
  )

  const views = members.map((member) => {
    const profile = member.auth_id ? profileById.get(member.auth_id) : undefined
    return {
      ...member,
      salary: Number(member.salary ?? 0),
      full_name: member.full_name?.trim() || profile?.full_name || null,
      phone: member.phone?.trim() || profile?.phone || null,
      email: member.email?.trim() || profile?.email || null,
      location_name: member.location_id
        ? locationNameById.get(member.location_id) ?? null
        : null,
    }
  })

  if (!locationId) return views
  return views.filter(
    (member) => !member.location_id || member.location_id === locationId
  )
}

async function loadProfilesByAuthId(
  supabase: SupabaseClient,
  authIds: string[]
) {
  // Prefer email when migration added it; fall back if the column is missing.
  const withEmail = await supabase
    .from('profiles')
    .select('id, full_name, phone, email')
    .in('id', authIds)

  const rows =
    withEmail.error && /email/i.test(withEmail.error.message)
      ? (
          await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .in('id', authIds)
        ).data
      : withEmail.data

  return new Map(
    (rows ?? []).map((profile) => [
      profile.id as string,
      {
        full_name: (profile.full_name as string | null) ?? null,
        phone: (profile.phone as string | null) ?? null,
        email:
          'email' in profile
            ? ((profile.email as string | null) ?? null)
            : null,
      },
    ])
  )
}

export function canAssignRole(actorRole: StaffRole, targetRole: StaffRole): boolean {
  if (actorRole === 'owner') return true
  if (actorRole === 'manager') return targetRole !== 'owner'
  return false
}
