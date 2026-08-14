'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useShopRealtime({
  userId,
  locationId,
  onChange,
  includeOrderItems = false,
}: {
  userId: string
  locationId: string | null
  onChange: () => void
  includeOrderItems?: boolean
}) {
  useEffect(() => {
    if (!userId || !locationId) return

    const supabase = createClient()
    let channel = supabase
      .channel(`floor-${userId}-${locationId}-${includeOrderItems ? 'kds' : 'floor'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_tables',
          filter: `user_id=eq.${userId}`,
        },
        () => onChange()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        () => onChange()
      )

    if (includeOrderItems) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `user_id=eq.${userId}`,
        },
        () => onChange()
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, locationId, onChange, includeOrderItems])
}
