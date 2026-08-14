'use client'

import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { countPendingOfflineOrders } from '@/lib/offline/db'
import { syncPendingOrders } from '@/lib/offline/sync-engine'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineStatusIndicator() {
  const [pendingCount, setPendingCount] = useState(0)
  const [online, setOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function refreshCount() {
    setPendingCount(await countPendingOfflineOrders())
  }

  useEffect(() => {
    void refreshCount()
    const onOnline = () => {
      setOnline(true)
      void refreshCount()
    }
    const onOffline = () => setOnline(false)
    setOnline(navigator.onLine)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const intervalId = window.setInterval(() => {
      void refreshCount()
    }, 3000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.clearInterval(intervalId)
    }
  }, [])

  async function handleSyncNow() {
    setSyncing(true)
    try {
      const supabase = createClient()
      await syncPendingOrders(supabase)
      await refreshCount()
    } finally {
      setSyncing(false)
    }
  }

  if (online && pendingCount === 0) return null

  return (
    <div className="flex items-center gap-2">
      {!online ? (
        <Badge variant="warning" className="gap-1">
          <CloudOff className="size-3" />
          Offline
        </Badge>
      ) : null}
      {pendingCount > 0 ? (
        <>
          <Badge variant="secondary">{pendingCount} orders pending sync</Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!online || syncing}
            onClick={handleSyncNow}
          >
            <RefreshCw className={cn('size-3.5', syncing && 'animate-spin')} />
            Sync
          </Button>
        </>
      ) : null}
    </div>
  )
}
