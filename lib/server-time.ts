/**
 * Server Time Utility
 * Provides Ghana timezone (GMT/UTC+0) server time to prevent device clock manipulation
 * Syncs client with server and maintains time offset for accurate attendance tracking
 */

import * as React from "react"

export interface ServerTimeData {
  timestamp: string // ISO 8601 string in Ghana time
  serverTime: number // milliseconds since epoch in Ghana time
  timezone: "GMT" // Ghana timezone
}

// Cache for server time sync
let timeOffset: number | null = null
let lastSyncTime: number | null = null
const SYNC_INTERVAL = 5 * 60 * 1000 // Resync every 5 minutes

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
 */
async function fetchServerTime(): Promise<ServerTimeData> {
  try {
    const response = await fetch("/api/server-time", {
      method: "GET",
      cache: "no-store",
    })

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
 * Sync client time with server and calculate offset
 * Should be called on app initialization and periodically
 */
export async function syncServerTime(): Promise<ServerTimeData> {
  try {
    const serverData = await fetchServerTime()

    // Calculate offset between server time and device time
    const deviceTime = Date.now()
    const serverTimeMs = new Date(serverData.timestamp).getTime()
    timeOffset = serverTimeMs - deviceTime

    lastSyncTime = Date.now()

    console.log(
      "[v0] Server time synced. Offset:",
      timeOffset,
      "ms. Server time:",
      serverData.timestamp
    )

    return serverData
  } catch (error) {
    console.error("[v0] Failed to sync server time:", error)
    throw error
  }
}

/**
 * Get current Ghana time (client-side, uses synced offset)
 * Returns a Date object adjusted by the server offset
 */
export function getGhanaTime(): Date {
  if (timeOffset === null) {
    console.warn("[v0] Server time not synced yet, using device time")
    return new Date()
  }

  return new Date(Date.now() + timeOffset)
}

/**
 * Get current Ghana time as ISO string
 */
export function getGhanaTimeISO(): string {
  return getGhanaTime().toISOString()
}

/**
 * Check if server time needs to be resynced
 */
export function needsResync(): boolean {
  if (lastSyncTime === null) return true
  return Date.now() - lastSyncTime > SYNC_INTERVAL
}

/**
 * React hook for using Ghana server time
 * Automatically syncs on mount and periodically
 */
export function useServerTime() {
  const [ghanaTime, setGhanaTime] = React.useState<Date>(new Date())
  const [isSynced, setIsSynced] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let syncTimer: NodeJS.Timeout
    let updateTimer: NodeJS.Timeout

    const performSync = async () => {
      try {
        if (needsResync()) {
          await syncServerTime()
        }
        setIsSynced(true)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sync server time")
        setIsSynced(false)
      }
    }

    const updateTime = () => {
      setGhanaTime(getGhanaTime())
    }

    // Initial sync
    performSync()

    // Update time every second
    updateTimer = setInterval(updateTime, 1000)

    // Resync periodically
    syncTimer = setInterval(performSync, SYNC_INTERVAL)

    return () => {
      clearInterval(updateTimer)
      clearInterval(syncTimer)
    }
  }, [])

  return {
    ghanaTime,
    isSynced,
    error,
    resync: syncServerTime,
  }
}

/**
 * Export Ghana time getters for use in server-side APIs
 * These should be imported and used in /app/api routes
 */
export { getGhanaServerTime as getServerTime }
