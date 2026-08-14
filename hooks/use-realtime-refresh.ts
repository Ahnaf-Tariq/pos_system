'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribe to postgres_changes on shop-scoped tables and re-fetch UI.
 * Debounced so bursts of writes (order + items + table) only refetch once.
 */
export function useRealtimeRefresh({
  userId,
  tables,
  onChange,
  enabled = true,
  debounceMs = 250,
}: {
  userId: string
  tables: string[]
  onChange: () => void
  enabled?: boolean
  debounceMs?: number
}) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!enabled || !userId || tables.length === 0) return

    const supabase = createClient()
    const channelName = `rt:${userId}:${tables.join(',')}`
    let timer: ReturnType<typeof setTimeout> | null = null

    function schedule() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        onChangeRef.current()
      }, debounceMs)
    }

    let channel = supabase.channel(channelName)
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `user_id=eq.${userId}`,
        },
        () => schedule()
      )
    }

    channel.subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [userId, tables.join('|'), enabled, debounceMs])
}
