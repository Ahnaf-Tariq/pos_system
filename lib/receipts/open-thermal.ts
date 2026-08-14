export function openThermalReceipt(orderId: string, options?: { print?: boolean }) {
  if (typeof window === 'undefined' || !orderId) return
  const print = options?.print !== false
  const url = `/receipt/${orderId}${print ? '?print=1' : ''}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
