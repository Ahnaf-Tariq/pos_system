import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DashboardSession,
  Location,
  Profile,
  Shop,
  StaffMember,
} from '@/types/interfaces'
import type { StaffRole } from '@/types/enums'
import { getShopAccessForAuth } from '@/lib/auth/shop-access'

export async function getDashboardSession(
  supabase: SupabaseClient,
  authId: string
): Promise<DashboardSession | null> {
  const access = await getShopAccessForAuth(supabase, authId)
  if (!access) return null

  const [{ data: shop }, { data: staffMember }, { data: profile }, { data: locations }, { data: inventory }] =
    await Promise.all([
      supabase.from('users').select('*').eq('user_id', access.user_id).single(),
      supabase
        .from('staff_members')
        .select('*')
        .eq('user_id', access.user_id)
        .eq('auth_id', authId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle(),
      supabase.from('profiles').select('*').eq('id', authId).maybeSingle(),
      supabase
        .from('locations')
        .select('*')
        .eq('user_id', access.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true }),
      supabase
        .from('inventory_items')
        .select('quantity_on_hand, reorder_threshold')
        .eq('user_id', access.user_id),
    ])

  if (!shop || !staffMember) return null

  const lowStockCount = (inventory ?? []).filter(
    (item) => Number(item.quantity_on_hand) <= Number(item.reorder_threshold)
  ).length

  return {
    authId,
    email: null,
    shop: {
      ...(shop as Shop),
      tax_rate: Number((shop as Shop).tax_rate ?? 0),
      kds_enabled: (shop as Shop).kds_enabled !== false,
    },
    staffMember: staffMember as StaffMember,
    profile: (profile as Profile | null) ?? null,
    locations: (locations as Location[]) ?? [],
    lowStockCount,
  }
}

export function withStaffRole(session: DashboardSession): StaffRole {
  return session.staffMember.role
}
