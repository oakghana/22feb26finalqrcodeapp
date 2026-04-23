"use client"

/**
 * Client Time Utility - PURE SERVER TIME (No Device Time Dependency)
 * Uses React hooks to fetch and display server time on the client
 * Zero reliance on device clock
 */

import * as React from "react"

export interface ServerTimeData {
  timestamp: string
  serverTime: number
  timezone: "GMT"
}

// Cache for server time
let cachedServerTime: Date | null = null
let lastFetchTime: number | null = null
const CACHE_DURATION = 1000
const FETCH_TIMEOUT = 5000

/**
 * Fetch Ghana server time from API endpoint
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
 * Get the current Ghana server time (async, for client components)
 */
export async function getServerTime(): Promise<Date> {
  try {
    if (cachedServerTime && lastFetchTime && Date.now() - lastFetchTime < CACHE_DURATION) {
      const elapsedMs = Date.now() - lastFetchTime
      return new Date(cachedServerTime.getTime() + elapsedMs)
    }

    const serverData = await fetchServerTime()
    cachedServerTime = new Date(serverData.timestamp)
    lastFetchTime = Date.now()

    return new Date(cachedServerTime)
  } catch (error) {
    if (cachedServerTime) {
      const elapsedMs = lastFetchTime ? Date.now() - lastFetchTime : 0
      return new Date(cachedServerTime.getTime() + elapsedMs)
    }
    throw error
  }
}

/**
 * React hook for using Ghana server time (pure server-based)
 * Automatically fetches from server and updates every second
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

    // Update display every second
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

    // Refetch from server every 30 seconds
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
