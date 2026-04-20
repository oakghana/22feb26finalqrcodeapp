'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export interface GeofenceLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
}

export interface UseGeofenceMonitorReturn {
  isMonitoring: boolean
  currentLocation: { latitude: number; longitude: number } | null
  withinGeofence: boolean
  nearestLocation: GeofenceLocation | null
  error: string | null
  startMonitoring: () => void
  stopMonitoring: () => void
  getDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number
}

const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371e3 // Earth's radius in meters
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lon2 - lon1)
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

interface UseGeofenceMonitorOptions {
  geofenceLocations: GeofenceLocation[]
  interval?: number // milliseconds between location checks (default 5000)
  onGeofenceEnter?: (location: GeofenceLocation) => void
  onGeofenceExit?: () => void
  onLocationUpdate?: (lat: number, lon: number) => void
  enableHighAccuracy?: boolean
}

export function useGeofenceMonitor(options: UseGeofenceMonitorOptions): UseGeofenceMonitorReturn {
  const { 
    geofenceLocations, 
    interval = 5000, 
    onGeofenceEnter, 
    onGeofenceExit, 
    onLocationUpdate,
    enableHighAccuracy = true
  } = options

  const [isMonitoring, setIsMonitoring] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [withinGeofence, setWithinGeofence] = useState(false)
  const [nearestLocation, setNearestLocation] = useState<GeofenceLocation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const watchIdRef = useRef<number | null>(null)
  const monitoringRef = useRef(false)
  const lastGeofenceStateRef = useRef<{ location: GeofenceLocation | null; within: boolean }>({
    location: null,
    within: false,
  })

  const checkGeofence = useCallback(
    (latitude: number, longitude: number) => {
      let closestLocation: GeofenceLocation | null = null
      let minDistance = Infinity
      let anyWithin = false

      for (const location of geofenceLocations) {
        const distance = distanceMeters(latitude, longitude, location.latitude, location.longitude)
        if (distance < minDistance) {
          minDistance = distance
          closestLocation = location
        }

        if (distance <= location.radius_meters) {
          anyWithin = true
          // Call onGeofenceEnter only when entering a new geofence
          if (!lastGeofenceStateRef.current.within || lastGeofenceStateRef.current.location?.id !== location.id) {
            console.log(`[v0] Geofence entered: ${location.name}`)
            onGeofenceEnter?.(location)
          }
        }
      }

      // Call onGeofenceExit only when leaving all geofences
      if (lastGeofenceStateRef.current.within && !anyWithin) {
        console.log(`[v0] Geofence exited`)
        onGeofenceExit?.()
      }

      lastGeofenceStateRef.current = {
        location: anyWithin ? closestLocation : null,
        within: anyWithin,
      }

      setCurrentLocation({ latitude, longitude })
      setWithinGeofence(anyWithin)
      setNearestLocation(closestLocation)
      onLocationUpdate?.(latitude, longitude)
    },
    [geofenceLocations, onGeofenceEnter, onGeofenceExit, onLocationUpdate]
  )

  const startMonitoring = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser')
      return
    }

    if (monitoringRef.current) {
      console.log('[v0] Geofence monitoring already active')
      return
    }

    console.log('[v0] Starting geofence monitoring...')
    monitoringRef.current = true
    setIsMonitoring(true)
    setError(null)

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        console.log('[v0] Initial position obtained:', { latitude, longitude })
        checkGeofence(latitude, longitude)

        // Start periodic monitoring
        watchIdRef.current = window.setInterval(() => {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              checkGeofence(latitude, longitude)
            },
            (error) => {
              console.error('[v0] Geolocation error during monitoring:', error)
              if (error.code === error.PERMISSION_DENIED) {
                setError('Location permission denied')
                stopMonitoring()
              }
            },
            {
              enableHighAccuracy,
              timeout: 5000,
              maximumAge: 0,
            }
          )
        }, interval)
      },
      (error) => {
        console.error('[v0] Initial geolocation error:', error)
        if (error.code === error.PERMISSION_DENIED) {
          setError('Location permission denied. Please enable location access in app settings.')
        } else if (error.code === error.TIMEOUT) {
          setError('Location request timed out. Make sure high accuracy is enabled.')
        } else {
          setError('Unable to get your location. Make sure location services are enabled.')
        }
        monitoringRef.current = false
        setIsMonitoring(false)
      },
      {
        enableHighAccuracy,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [interval, enableHighAccuracy, checkGeofence])

  const stopMonitoring = useCallback(() => {
    if (watchIdRef.current !== null) {
      window.clearInterval(watchIdRef.current)
      watchIdRef.current = null
    }
    monitoringRef.current = false
    setIsMonitoring(false)
    console.log('[v0] Geofence monitoring stopped')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring()
    }
  }, [stopMonitoring])

  return {
    isMonitoring,
    currentLocation,
    withinGeofence,
    nearestLocation,
    error,
    startMonitoring,
    stopMonitoring,
    getDistance: distanceMeters,
  }
}
