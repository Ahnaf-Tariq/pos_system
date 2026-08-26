import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { fetchMenuCatalog } from '@/lib/menu/catalog'
import { fetchCustomersList } from '@/lib/customers/catalog'
import { fetchTablesWithOrders } from '@/lib/tables/floor'
import { fetchCashDrawerPage } from '@/lib/cash-drawer/catalog'
import { fetchKdsTickets } from '@/lib/kds/tickets'
import {
  allTablesCacheKey,
  cacheKeysForLocation,
  cashDrawerCacheKey,
  customersCacheKey,
  kdsCacheKey,
  menuCacheKey,
  tablesCacheKey,
} from '@/lib/offline/cache-keys'
import { setReadCache } from '@/lib/offline/read-cache'
import { runOnlineFetch } from '@/lib/offline/network'
import type { RestaurantTable } from '@/types/interfaces'

export interface WarmCacheInput {
  userId: string
  locationIds: string[]
}

export interface WarmCacheResult {
  warmed: string[]
  errors: Array<{ key: string; message: string }>
}

async function warmKey<T>(
  key: string,
  fetcher: () => Promise<T>,
  warmed: string[],
  errors: WarmCacheResult['errors']
) {
  try {
    const data = await runOnlineFetch(fetcher)
    await setReadCache(key, data)
    warmed.push(key)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Warm failed'
    errors.push({ key, message })
    console.error(`[offline] Cache warm failed for ${key}:`, message)
  }
}

export async function warmOfflineCache(
  input: WarmCacheInput
): Promise<WarmCacheResult> {
  const supabase = createClient()
  const warmed: string[] = []
  const errors: WarmCacheResult['errors'] = []

  const tasks: Array<Promise<void>> = [
    warmKey(
      allTablesCacheKey(input.userId),
      async () => {
        const { data, error } = await supabase
          .from('restaurant_tables')
          .select('*')
          .eq('user_id', input.userId)
          .order('label', { ascending: true })
        if (error) throw new Error(error.message)
        return (data as RestaurantTable[]) ?? []
      },
      warmed,
      errors
    ),
  ]

  for (const locationId of input.locationIds) {
    tasks.push(
      warmKey(
        menuCacheKey(input.userId, locationId),
        () => fetchMenuCatalog(supabase, input.userId, locationId),
        warmed,
        errors
      ),
      warmKey(
        customersCacheKey(input.userId, locationId),
        () => fetchCustomersList(supabase, input.userId, locationId),
        warmed,
        errors
      ),
      warmKey(
        tablesCacheKey(input.userId, locationId),
        () => fetchTablesWithOrders(supabase, input.userId, locationId),
        warmed,
        errors
      ),
      warmKey(
        cashDrawerCacheKey(input.userId, locationId),
        () => fetchCashDrawerPage(supabase, input.userId, locationId),
        warmed,
        errors
      ),
      warmKey(
        kdsCacheKey(input.userId, locationId),
        () => fetchKdsTickets(supabase, input.userId, locationId),
        warmed,
        errors
      )
    )
  }

  await Promise.all(tasks)

  if (errors.length > 0) {
    console.error(
      `[offline] Cache warm finished with ${errors.length} error(s):`,
      errors
    )
  }

  return { warmed, errors }
}

export function invalidateKeysForLocation(userId: string, locationId: string) {
  return cacheKeysForLocation(userId, locationId)
}

export async function warmLocationCache(
  supabase: SupabaseClient,
  userId: string,
  locationId: string
) {
  const keys = cacheKeysForLocation(userId, locationId)
  const errors: string[] = []

  const tasks: Array<[string, () => Promise<unknown>]> = [
    [keys[0], () => fetchMenuCatalog(supabase, userId, locationId)],
    [keys[1], () => fetchCustomersList(supabase, userId, locationId)],
    [keys[2], () => fetchTablesWithOrders(supabase, userId, locationId)],
    [keys[3], () => fetchCashDrawerPage(supabase, userId, locationId)],
    [keys[4], () => fetchKdsTickets(supabase, userId, locationId)],
  ]

  await Promise.all(
    tasks.map(async ([key, fetcher]) => {
      try {
        const data = await runOnlineFetch(fetcher)
        await setReadCache(key, data)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Refresh failed'
        errors.push(`${key}: ${message}`)
        console.error(`[offline] Cache refresh failed for ${key}:`, message)
      }
    })
  )

  return errors
}
