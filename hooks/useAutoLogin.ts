'use client'

import { useCallback, useState, useEffect } from 'react'

export interface UseAutoLoginReturn {
  isAutoLoggedIn: boolean
  isChecking: boolean
  error: string | null
  performAutoLogin: (latitude: number, longitude: number) => Promise<boolean>
}

export function useAutoLogin(): UseAutoLoginReturn {
  const [isAutoLoggedIn, setIsAutoLoggedIn] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performAutoLogin = useCallback(
    async (latitude: number, longitude: number): Promise<boolean> => {
      try {
        setIsChecking(true)
        setError(null)

        console.log('[v0] Auto-Login: Performing auto-login check...')

        const response = await fetch('/api/auth/auto-login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latitude,
            longitude,
            device_info: {
              type: 'mobile_web',
              timestamp: Date.now(),
            },
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('[v0] Auto-Login: API error:', data.error)
          setError(data.error || 'Auto-login validation failed')
          setIsAutoLoggedIn(false)
          return false
        }

        if (!data.success) {
          console.log('[v0] Auto-Login: Validation failed -', data.reason, ':', data.message)
          setIsAutoLoggedIn(false)
          return false
        }

        console.log('[v0] Auto-Login: Successfully validated within geofence:', data.data.location.name)
        setIsAutoLoggedIn(true)
        return true
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Auto-login check failed'
        console.error('[v0] Auto-Login: Error:', errorMessage)
        setError(errorMessage)
        setIsAutoLoggedIn(false)
        return false
      } finally {
        setIsChecking(false)
      }
    },
    []
  )

  return {
    isAutoLoggedIn,
    isChecking,
    error,
    performAutoLogin,
  }
}
