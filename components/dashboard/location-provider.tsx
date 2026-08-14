'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useEffectEvent,
  type ReactNode,
} from 'react'
import type { Location } from '@/types/interfaces'

interface LocationContextValue {
  locations: Location[]
  selectedLocationId: string | null
  selectedLocation: Location | null
  isLocationLocked: boolean
  isReady: boolean
  setSelectedLocationId: (id: string) => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

function storageKey(shopUserId: string) {
  return `auric_selected_location_id:${shopUserId}`
}

export function LocationProvider({
  shopUserId,
  locations,
  staffLocationId,
  children,
}: {
  shopUserId: string
  locations: Location[]
  staffLocationId: string | null
  children: ReactNode
}) {
  const isLocationLocked = Boolean(staffLocationId)
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(
    staffLocationId
  )

  const syncInitialLocation = useEffectEvent(() => {
    if (isLocationLocked && staffLocationId) {
      setSelectedLocationIdState(staffLocationId)
      return
    }

    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(storageKey(shopUserId))
        : null
    const storedValid = locations.some((location) => location.id === stored)
    const nextId = storedValid ? stored : (locations[0]?.id ?? null)
    setSelectedLocationIdState(nextId)
  })

  useEffect(() => {
    syncInitialLocation()
  }, [shopUserId, locations, staffLocationId, isLocationLocked])

  function setSelectedLocationId(id: string) {
    if (isLocationLocked) return
    setSelectedLocationIdState(id)
    window.localStorage.setItem(storageKey(shopUserId), id)
  }

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null

  return (
    <LocationContext.Provider
      value={{
        locations,
        selectedLocationId,
        selectedLocation,
        isLocationLocked,
        isReady: Boolean(selectedLocationId) || locations.length === 0,
        setSelectedLocationId,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}

export function useLocationContext() {
  const context = useContext(LocationContext)
  if (!context) throw new Error('useLocationContext must be used within LocationProvider')
  return context
}

/** Active branch for data fetches. Null until locations hydrate. */
export function useActiveLocationId() {
  const { selectedLocationId, isReady } = useLocationContext()
  return isReady ? selectedLocationId : null
}
