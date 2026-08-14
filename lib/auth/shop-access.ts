import type { SupabaseClient } from '@supabase/supabase-js'
import type { ShopAccessRow } from '@/types/interfaces'
import { slugify } from '@/lib/utils'

export async function getShopAccessForAuth(
  supabase: SupabaseClient,
  authId: string
): Promise<ShopAccessRow | null> {
  const { data: owned } = await supabase
    .from('users')
    .select('user_id, status, business_name')
    .eq('owner_auth_id', authId)
    .maybeSingle()

  if (owned) return owned as ShopAccessRow

  const { data: membership } = await supabase
    .from('staff_members')
    .select('user_id, users!inner(user_id, status, business_name)')
    .eq('auth_id', authId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!membership) return null

  const shop = membership.users as unknown as ShopAccessRow
  return shop
}

export async function isPlatformAdmin(
  supabase: SupabaseClient,
  authId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('platform_admins')
    .select('auth_id')
    .eq('auth_id', authId)
    .maybeSingle()

  return Boolean(data)
}

export function buildShopSlug(businessName: string): string {
  const base = slugify(businessName) || 'shop'
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

export async function provisionShopAccount({
  supabase,
  authId,
  businessName,
  ownerName,
  businessType,
  email,
}: {
  supabase: SupabaseClient
  authId: string
  businessName: string
  ownerName: string
  businessType: string
  email?: string | null
}) {
  const existing = await getShopAccessForAuth(supabase, authId)
  if (existing) return { shop: existing, created: false as const }

  await supabase.from('profiles').upsert({
    id: authId,
    full_name: ownerName,
    email: email?.trim().toLowerCase() || null,
  })

  const { data: shop, error } = await supabase
    .from('users')
    .insert({
      owner_auth_id: authId,
      business_name: businessName,
      slug: buildShopSlug(businessName),
      business_type: businessType,
    })
    .select('user_id, status, business_name')
    .single()

  if (error) throw new Error(error.message)

  return { shop: shop as ShopAccessRow, created: true as const }
}
