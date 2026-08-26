import { offlineDb } from '@/lib/offline/db'

function assertNoBase64Images(data: unknown, key: string) {
  const json = JSON.stringify(data)
  if (json.includes('data:image')) {
    throw new Error(
      `[offline] Refusing to cache base64 image data for key "${key}". Store URLs only.`
    )
  }
}

export async function getReadCache<T>(key: string): Promise<{
  data: T
  lastSyncedAt: string
} | null> {
  const row = await offlineDb.readCache.get(key)
  if (!row) return null
  return { data: row.data as T, lastSyncedAt: row.lastSyncedAt }
}

export async function setReadCache<T>(key: string, data: T) {
  assertNoBase64Images(data, key)
  await offlineDb.readCache.put({
    key,
    data,
    lastSyncedAt: new Date().toISOString(),
  })
}

export async function invalidateReadCache(key: string) {
  await offlineDb.readCache.delete(key)
}

export async function invalidateReadCacheKeys(keys: string[]) {
  await offlineDb.readCache.bulkDelete(keys)
}

export async function invalidateReadCachePrefix(prefix: string) {
  const keys = await offlineDb.readCache
    .where('key')
    .startsWith(prefix)
    .primaryKeys()
  await offlineDb.readCache.bulkDelete(keys)
}
