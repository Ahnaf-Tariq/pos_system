import Dexie, { type EntityTable } from 'dexie'
import type { OfflineOrderRecord } from '@/types/interfaces'

class OfflineDatabase extends Dexie {
  orders!: EntityTable<OfflineOrderRecord, 'id'>

  constructor() {
    super('auric_pos_offline')
    this.version(1).stores({
      orders: '++id, client_generated_id, pending_sync, created_at',
    })
  }
}

export const offlineDb = new OfflineDatabase()

export async function enqueueOfflineOrder(
  record: Omit<OfflineOrderRecord, 'id' | 'pending_sync' | 'last_error' | 'created_at'> & {
    created_at?: string
  }
) {
  const id = await offlineDb.orders.add({
    ...record,
    pending_sync: true,
    last_error: null,
    created_at: record.created_at ?? new Date().toISOString(),
  })
  return id
}

export async function getPendingOfflineOrders() {
  return offlineDb.orders.filter((order) => order.pending_sync).sortBy('created_at')
}

export async function countPendingOfflineOrders() {
  return offlineDb.orders.filter((order) => order.pending_sync).count()
}

export async function markOfflineOrderSynced(id: number) {
  await offlineDb.orders.update(id, { pending_sync: false, last_error: null })
}

export async function markOfflineOrderFailed(id: number, message: string) {
  await offlineDb.orders.update(id, { last_error: message })
}
