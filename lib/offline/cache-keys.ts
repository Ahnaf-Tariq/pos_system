export function menuCacheKey(userId: string, locationId: string) {
  return `menu:${userId}:${locationId}`
}

export function customersCacheKey(userId: string, locationId: string) {
  return `customers:${userId}:${locationId}`
}

export function tablesCacheKey(userId: string, locationId: string) {
  return `tables:${userId}:${locationId}`
}

export function allTablesCacheKey(userId: string) {
  return `tables-all:${userId}`
}

export function cashDrawerCacheKey(userId: string, locationId: string) {
  return `cash-drawer:${userId}:${locationId}`
}

export function kdsCacheKey(userId: string, locationId: string) {
  return `kds:${userId}:${locationId}`
}

export function cacheKeysForLocation(userId: string, locationId: string) {
  return [
    menuCacheKey(userId, locationId),
    customersCacheKey(userId, locationId),
    tablesCacheKey(userId, locationId),
    cashDrawerCacheKey(userId, locationId),
    kdsCacheKey(userId, locationId),
  ]
}
