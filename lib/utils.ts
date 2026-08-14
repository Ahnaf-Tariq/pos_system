import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatMoney(amount: number, currency = 'PKR'): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Consistent app date: DD-MM-YY */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toValidDate(value)
  if (!date) return '—'
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${String(date.getFullYear()).slice(-2)}`
}

/** Date + time using the same day format: DD-MM-YY HH:mm */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toValidDate(value)
  if (!date) return '—'
  return `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatOrderStatus(status: string): string {
  if (status === 'void') return 'cancel'
  return status.replaceAll('_', ' ')
}
