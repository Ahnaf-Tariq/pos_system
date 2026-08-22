import type { SupabaseClient } from '@supabase/supabase-js'
import type { Vendor } from '@/types/interfaces'

export async function fetchVendors(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('user_id', userId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data as Vendor[]) ?? []
}
