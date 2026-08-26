import {
  OFFLINE_NETWORK_TIMEOUT_MS,
  ONLINE_FETCH_TIMEOUT_MS,
} from '@/lib/offline/constants'

export class NetworkTimeoutError extends Error {
  constructor(message = 'Network request timed out') {
    super(message)
    this.name = 'NetworkTimeoutError'
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = OFFLINE_NETWORK_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkTimeoutError()
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function runWithNetworkTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = OFFLINE_NETWORK_TIMEOUT_MS
): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new NetworkTimeoutError()), timeoutMs)
  })

  try {
    return await Promise.race([fn(), timeoutPromise])
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
  }
}

let lastConnectivityCheck = 0
let lastConnectivityResult = true

/**
 * Connectivity for offline UX.
 * - navigator.onLine === false → offline
 * - navigator.onLine === true → online (probe may confirm, never overrides to offline)
 */
export async function checkConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    lastConnectivityResult = false
    return false
  }

  const now = Date.now()
  if (now - lastConnectivityCheck < 5000) {
    return lastConnectivityResult
  }
  lastConnectivityCheck = now

  // Browser reports online — treat as online immediately.
  // A failed probe during page reload must not flash the Offline banner.
  lastConnectivityResult = true
  return true
}

export async function runOnlineFetch<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    return runWithNetworkTimeout(fn, ONLINE_FETCH_TIMEOUT_MS)
  }
  return runWithNetworkTimeout(fn, OFFLINE_NETWORK_TIMEOUT_MS)
}
