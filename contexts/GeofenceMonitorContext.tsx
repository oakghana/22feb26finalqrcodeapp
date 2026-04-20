'use client'

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react'
import { useGeofenceMonitor, type GeofenceLocation } from '@/hooks/useGeofenceMonitor'
import { useAutoLogin } from '@/hooks/useAutoLogin'

interface GeofenceContextType {
  isMonitoring: boolean
  currentLocation: { latitude: number; longitude: number } | null
  withinGeofence: boolean
  nearestLocation: GeofenceLocation | null
  geofenceLocations: GeofenceLocation[]
  error: string | null
  isAutoLoginEnabled: boolean
  isAutoCheckinEnabled: boolean
  startMonitoring: () => void
  stopMonitoring: () => void
  performAutoCheckin: () => Promise<boolean>
}

const GeofenceContext = createContext<GeofenceContextType | undefined>(undefined)

interface GeofenceMonitorProviderProps {
  children: React.ReactNode
  enableAutoLogin?: boolean
  enableAutoCheckin?: boolean
}

export function GeofenceMonitorProvider({
  children,
  enableAutoLogin = true,
  enableAutoCheckin = true,
}: GeofenceMonitorProviderProps) {
  const [geofenceLocations, setGeofenceLocations] = useState<GeofenceLocation[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)
  const { performAutoLogin } = useAutoLogin()

  // Fetch geofence locations on mount
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await fetch('/api/attendance/geofence-locations')
        if (response.ok) {
          const data = await response.json()
          setGeofenceLocations(data.locations || [])
          console.log('[v0] Geofence locations loaded:', data.locations?.length || 0)
        }
      } catch (error) {
        console.error('[v0] Failed to fetch geofence locations:', error)
      } finally {
        setLoadingLocations(false)
      }
    }

    fetchLocations()
  }, [])

  const handleGeofenceEnter = useCallback(
    async (location: GeofenceLocation) => {
      console.log('[v0] Geofence entered:', location.name)

      // Trigger auto-login if enabled
      if (enableAutoLogin && currentLocation) {
        console.log('[v0] Attempting auto-login for location:', location.name)
        await performAutoLogin(currentLocation.latitude, currentLocation.longitude)
      }

      // Trigger auto-checkin if enabled
      if (enableAutoCheckin && currentLocation) {
        console.log('[v0] Attempting auto-checkin for location:', location.name)
        await performAutoCheckin()
      }
    },
    [enableAutoLogin, enableAutoCheckin, performAutoLogin]
  )

  const monitor = useGeofenceMonitor({
    geofenceLocations,
    interval: 5000, // Check every 5 seconds
    onGeofenceEnter: handleGeofenceEnter,
    enableHighAccuracy: true,
  })

  const { currentLocation } = monitor

  // Update the callback when currentLocation changes
  useEffect(() => {
    monitor.currentLocation // This ensures the callback has access to current location
  }, [currentLocation, monitor])

  const performAutoCheckin = useCallback(async (): Promise<boolean> => {
    if (!currentLocation) {
      console.log('[v0] No current location available for auto-checkin')
      return false
    }

    try {
      console.log('[v0] Auto-checkin: Starting...')

      const response = await fetch('/api/attendance/auto-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          device_info: {
            type: 'mobile_web',
            timestamp: Date.now(),
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[v0] Auto-checkin: API error:', data.error)
        return false
      }

      if (!data.success) {
        console.log('[v0] Auto-checkin: Not performed -', data.reason, ':', data.message)
        return false
      }

      console.log('[v0] Auto-checkin: Success at', data.data.location.name)
      return true
    } catch (error) {
      console.error('[v0] Auto-checkin: Error:', error)
      return false
    }
  }, [currentLocation])

  return (
    <GeofenceContext.Provider
      value={{
        isMonitoring: monitor.isMonitoring,
        currentLocation: monitor.currentLocation,
        withinGeofence: monitor.withinGeofence,
        nearestLocation: monitor.nearestLocation,
        geofenceLocations,
        error: monitor.error,
        isAutoLoginEnabled: enableAutoLogin,
        isAutoCheckinEnabled: enableAutoCheckin,
        startMonitoring: monitor.startMonitoring,
        stopMonitoring: monitor.stopMonitoring,
        performAutoCheckin,
      }}
    >
      {children}
    </GeofenceContext.Provider>
  )
}

export function useGeofenceMonitorContext(): GeofenceContextType {
  const context = useContext(GeofenceContext)
  if (!context) {
    throw new Error('useGeofenceMonitorContext must be used within GeofenceMonitorProvider')
  }
  return context
}
