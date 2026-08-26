'use client'

import { CloudOff, RefreshCw, Upload } from 'lucide-react'
import { useOfflineContext } from '@/components/offline/offline-provider'
import { createClient } from '@/lib/supabase/client'
import { syncPendingWrites } from '@/lib/offline/sync-engine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

export function OfflineBanner() {
  const { online, pendingWrites, refreshPendingCount } = useOfflineContext()
  const [syncing, setSyncing] = useState(false)

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const supabase = createClient()
      await syncPendingWrites(supabase)
      await refreshPendingCount()
    } finally {
      setSyncing(false)
    }
  }

  if (online && pendingWrites === 0) return null

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5">
      {!online ? (
        <Badge variant="warning" className="gap-1">
          <CloudOff className="size-3" />
          Offline — showing cached data
        </Badge>
      ) : null}
      {pendingWrites > 0 ? (
        <>
          <Badge variant="secondary" className="gap-1">
            <Upload className="size-3" />
            {pendingWrites} pending upload{pendingWrites === 1 ? '' : 's'}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!online || syncing}
            onClick={handleSyncNow}
          >
            <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} />
            Sync now
          </Button>
        </>
      ) : null}
    </div>
  )
}
