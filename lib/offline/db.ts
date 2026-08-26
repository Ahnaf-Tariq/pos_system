import Dexie, { type EntityTable } from 'dexie'
import type {
  OfflineOrderRecord,
  QueuedWriteRecord,
  ReadCacheRecord,
} from '@/types/interfaces'

class OfflineDatabase extends Dexie {
  orders!: EntityTable<OfflineOrderRecord, 'id'>
  readCache!: EntityTable<ReadCacheRecord, 'key'>
  writeQueue!: EntityTable<QueuedWriteRecord, 'id'>

  constructor() {
    super('auric_pos_offline')

    this.version(1).stores({
      orders: '++id, client_generated_id, pending_sync, created_at',
    })

    this.version(2)
      .stores({
        orders: '++id, client_generated_id, pending_sync, created_at',
        readCache: 'key, lastSyncedAt',
        writeQueue:
          '++id, client_generated_id, type, pending_sync, created_at',
      })
      .upgrade(async (tx) => {
        const pendingOrders = await tx
          .table('orders')
          .filter((order: OfflineOrderRecord) => order.pending_sync)
          .toArray()

        for (const order of pendingOrders) {
          const existing = await tx
            .table('writeQueue')
            .where('client_generated_id')
            .equals(order.client_generated_id)
            .count()

          if (existing > 0) continue

          await tx.table('writeQueue').add({
            client_generated_id: order.client_generated_id,
            type: 'order',
            payload: order,
            pending_sync: true,
            created_at: order.created_at,
            last_error: order.last_error,
          })
        }
      })
  }
}

export const offlineDb = new OfflineDatabase()

export async function enqueueOfflineOrder(
  record: Omit<OfflineOrderRecord, 'id' | 'pending_sync' | 'last_error' | 'created_at'> & {
    created_at?: string
  }
) {
  const createdAt = record.created_at ?? new Date().toISOString()

  const id = await offlineDb.orders.add({
    ...record,
    pending_sync: true,
    last_error: null,
    created_at: createdAt,
  })

  await offlineDb.writeQueue.add({
    client_generated_id: record.client_generated_id,
    type: 'order',
    payload: record,
    pending_sync: true,
    last_error: null,
    created_at: createdAt,
  })

  return id
}

export async function getPendingOfflineOrders() {
  return offlineDb.orders.filter((order) => order.pending_sync).sortBy('created_at')
}

export async function countPendingOfflineOrders() {
  return offlineDb.orders.filter((order) => order.pending_sync).count()
}

export async function countPendingWrites() {
  return offlineDb.writeQueue.filter((item) => item.pending_sync).count()
}

export async function getPendingWrites() {
  return offlineDb.writeQueue
    .filter((item) => item.pending_sync)
    .sortBy('created_at')
}

export async function markOfflineOrderSynced(id: number) {
  await offlineDb.orders.update(id, { pending_sync: false, last_error: null })
}

export async function markOfflineOrderFailed(id: number, message: string) {
  await offlineDb.orders.update(id, { last_error: message })
}

export async function markWriteSynced(id: number) {
  await offlineDb.writeQueue.update(id, { pending_sync: false, last_error: null })
}

export async function markWriteFailed(id: number, message: string) {
  await offlineDb.writeQueue.update(id, { last_error: message })
}

export async function enqueueWrite(
  record: Omit<QueuedWriteRecord, 'id' | 'pending_sync' | 'last_error' | 'created_at'> & {
    created_at?: string
  }
) {
  return offlineDb.writeQueue.add({
    ...record,
    pending_sync: true,
    last_error: null,
    created_at: record.created_at ?? new Date().toISOString(),
  })
}
