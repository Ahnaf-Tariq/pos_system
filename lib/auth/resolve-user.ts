import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface ResolvedAuthUser {
  user: User | null
  usedCookieFallback: boolean
}

export async function resolveAuthUser(
  supabase: SupabaseClient
): Promise<ResolvedAuthUser> {
  const { data: userData } = await supabase.auth.getUser()

  if (userData.user) {
    return { user: userData.user, usedCookieFallback: false }
  }

  const { data: sessionData } = await supabase.auth.getSession()
  const sessionUser = sessionData.session?.user ?? null

  if (sessionUser) {
    return { user: sessionUser, usedCookieFallback: true }
  }

  return { user: null, usedCookieFallback: false }
}
