import type { SupabaseClient } from '@supabase/supabase-js'
import type { Location, Shop } from '@/types/interfaces'

export async function fetchShopSettings(
  supabase: SupabaseClient,
  userId: string
): Promise<{ shop: Shop; locations: Location[] }> {
  const [{ data: shop, error: shopError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabase.from('users').select('*').eq('user_id', userId).single(),
      supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ])

  if (shopError || !shop) throw new Error(shopError?.message ?? 'Shop not found')
  if (locationsError) throw new Error(locationsError.message)

  return {
    shop: {
      ...(shop as Shop),
      tax_rate: Number((shop as Shop).tax_rate ?? 0),
    },
    locations: ((locations as Location[]) ?? []).map((location) => ({
      ...location,
      printer_connection: location.printer_connection || 'browser',
    })),
  }
}

export async function uploadReceiptLogo({
  supabase,
  userId,
  file,
}: {
  supabase: SupabaseClient
  userId: string
  file: File
}) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${userId}/receipt-logo-${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('menu-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}
