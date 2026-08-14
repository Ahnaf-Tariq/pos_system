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
  setSelectedLocationId: (id: string) => void
}

const LocationContext = createContext<LocationContextValue | null>(null)

const STORAGE_KEY = 'auric_selected_location_id'

export function LocationProvider({
  locations,
  staffLocationId,
  children,
}: {
  locations: Location[]
  staffLocationId: string | null
  children: ReactNode
}) {
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(null)

  const syncInitialLocation = useEffectEvent(() => {
    const stored =
      typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    const storedValid = locations.some((location) => location.id === stored)
    const staffValid = locations.some((location) => location.id === staffLocationId)
    const nextId = storedValid
      ? stored
      : staffValid
        ? staffLocationId
        : (locations[0]?.id ?? null)
    setSelectedLocationIdState(nextId)
  })

  useEffect(() => {
    syncInitialLocation()
  }, [locations, staffLocationId])

  function setSelectedLocationId(id: string) {
    setSelectedLocationIdState(id)
    window.localStorage.setItem(STORAGE_KEY, id)
  }

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null

  return (
    <LocationContext.Provider
      value={{
        locations,
        selectedLocationId,
        selectedLocation,
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
