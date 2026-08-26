'use client'

import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Clock } from 'lucide-react'

dayjs.extend(relativeTime)

export function CacheSyncNote({
  fromCache,
  lastSyncedAt,
}: {
  fromCache: boolean
  lastSyncedAt: string | null
}) {
  if (!fromCache || !lastSyncedAt) return null

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3" />
      Last synced {dayjs(lastSyncedAt).fromNow()}
    </p>
  )
}
