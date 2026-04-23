/**
 * Server Time Utility - PURE SERVER TIME (No Device Time Dependency)
 * All time operations use ONLY the server as the source of truth
 * Zero reliance on device clock - even if device time is wrong, app time stays correct
 */

"use client"

import * as React from "react"

export interface ServerTimeData {
  timestamp: string // ISO 8601 string in Ghana time
  serverTime: number // milliseconds since epoch in Ghana time
  timezone: "GMT" // Ghana timezone
}

// Cache for server time - stores the last fetched server timestamp and when we fetched it
let cachedServerTime: Date | null = null
let lastFetchTime: number | null = null
const CACHE_DURATION = 1000 // Keep cache for 1 second, then refetch
const FETCH_TIMEOUT = 5000 // 5 second timeout for fetch

/**
 * Get current Ghana server time (for use in API routes - server-side only)
 * Returns time in Ghana timezone (GMT/UTC+0)
 */
export function getGhanaServerTime(): Date {
  // Get current UTC time and convert to Ghana time (GMT/UTC+0 - no offset)
  const now = new Date()
  return new Date(now.toLocaleString("en-US", { timeZone: "Africa/Accra" }))
}

/**
 * Get Ghana server time as ISO string
 */
export function getGhanaServerTimeISO(): string {
  return getGhanaServerTime().toISOString()
}

/**
 * Fetch Ghana server time from API endpoint
 * This should be called from client-side code to get the authoritative server time
 * NO device time dependency - purely server-based
 */
async function fetchServerTime(): Promise<ServerTimeData> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch("/api/server-time", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch server time: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("[v0] Error fetching server time:", error)
    throw error
  }
}

/**
 * Get the current Ghana server time
 * This function handles caching and fetching from the server
 * Returns the pure server time with NO device time calculations
 */
export async function getServerTime(): Promise<Date> {
  try {
    // Check if we have a recent cache
    if (cachedServerTime && lastFetchTime && Date.now() - lastFetchTime < CACHE_DURATION) {
      // Return cached server time (cache is valid)
      const elapsedMs = Date.now() - lastFetchTime
      return new Date(cachedServerTime.getTime() + elapsedMs)
    }

    // Fetch fresh server time from the API
    const serverData = await fetchServerTime()
    cachedServerTime = new Date(serverData.timestamp)
    lastFetchTime = Date.now()

    console.log("[v0] Server time fetched:", serverData.timestamp)

    return new Date(cachedServerTime)
  } catch (error) {
    console.error("[v0] Failed to get server time, using cached value if available")
    if (cachedServerTime) {
      const elapsedMs = lastFetchTime ? Date.now() - lastFetchTime : 0
      return new Date(cachedServerTime.getTime() + elapsedMs)
    }
    throw error
  }
}

/**
 * Get current Ghana time as ISO string (server-based, no device time)
 */
export async function getServerTimeISO(): Promise<string> {
  const time = await getServerTime()
  return time.toISOString()
}

/**
 * React hook for using Ghana server time (pure server-based)
 * Automatically fetches from server and updates every second
 * ZERO device time dependency
 */
export function useServerTime() {
  const [ghanaTime, setGhanaTime] = React.useState<Date>(new Date())
  const [isSynced, setIsSynced] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let updateInterval: NodeJS.Timeout
    let fetchInterval: NodeJS.Timeout

    const fetchAndUpdate = async () => {
      try {
        const serverTime = await getServerTime()
        setGhanaTime(serverTime)
        setIsSynced(true)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch server time")
        setIsSynced(false)
      }
    }

    // Initial fetch
    fetchAndUpdate()

    // Update display every second (visual tick)
    updateInterval = setInterval(() => {
      try {
        if (cachedServerTime && lastFetchTime) {
          const elapsedMs = Date.now() - lastFetchTime
          setGhanaTime(new Date(cachedServerTime.getTime() + elapsedMs))
        }
      } catch (err) {
        console.error("[v0] Error updating time:", err)
      }
    }, 1000)

    // Refetch from server every 30 seconds to stay in sync
    fetchInterval = setInterval(fetchAndUpdate, 30 * 1000)

    return () => {
      clearInterval(updateInterval)
      clearInterval(fetchInterval)
    }
  }, [])

  return {
    ghanaTime,
    isSynced,
    error,
    refetch: async () => {
      try {
        const serverTime = await getServerTime()
        setGhanaTime(serverTime)
        setIsSynced(true)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch server time")
        setIsSynced(false)
      }
    },
  }
}
