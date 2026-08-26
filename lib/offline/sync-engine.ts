import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getPendingWrites,
  markWriteSynced,
  markWriteFailed,
  markOfflineOrderSynced,
  offlineDb,
} from '@/lib/offline/db'
import { warmLocationCache } from '@/lib/offline/warm-cache'
import { checkConnectivity } from '@/lib/offline/network'
import { syncQueuedWrite } from '@/lib/offline/sync-handlers'
import { WriteQueueType } from '@/types/interfaces'

export async function syncPendingWrites(supabase: SupabaseClient) {
  const online = await checkConnectivity()
  if (!online) return { synced: 0, failed: 0, remaining: 0 }

  const pending = await getPendingWrites()
  let synced = 0
  let failed = 0
  const refreshedLocations = new Set<string>()

  for (const item of pending) {
    try {
      await syncQueuedWrite(supabase, item)
      if (item.id != null) {
        await markWriteSynced(item.id)

        if (item.type === WriteQueueType.ORDER) {
          const order = await offlineDb.orders
            .where('client_generated_id')
            .equals(item.client_generated_id)
            .first()
          if (order?.id != null) {
            await markOfflineOrderSynced(order.id)
          }
        }
      }

      const payload = item.payload as Record<string, unknown>
      const userId = (payload.user_id as string) ?? (payload.userId as string)
      const locationId =
        (payload.location_id as string) ?? (payload.locationId as string)
      if (userId && locationId) {
        refreshedLocations.add(`${userId}:${locationId}`)
      }

      synced += 1
    } catch (error) {
      failed += 1
      if (item.id != null) {
        await markWriteFailed(
          item.id,
          error instanceof Error ? error.message : 'Sync failed'
        )
      }
    }
  }

  for (const key of refreshedLocations) {
    const [userId, locationId] = key.split(':')
    await warmLocationCache(supabase, userId, locationId)
  }

  const remaining = pending.length - synced
  return { synced, failed, remaining }
}

/** @deprecated Use syncPendingWrites */
export async function syncPendingOrders(supabase: SupabaseClient) {
  return syncPendingWrites(supabase)
}

export function startOfflineSyncLoop(supabase: SupabaseClient) {
  let stopped = false

  async function tick() {
    if (stopped) return
    await syncPendingWrites(supabase)
  }

  void tick()
  const intervalId = window.setInterval(() => {
    void tick()
  }, 8000)

  const onOnline = () => {
    void tick()
  }
  window.addEventListener('online', onOnline)

  return () => {
    stopped = true
    window.clearInterval(intervalId)
    window.removeEventListener('online', onOnline)
  }
}
