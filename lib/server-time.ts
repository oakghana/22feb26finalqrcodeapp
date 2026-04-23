/**
 * Server Time Utility - PURE SERVER TIME (No Device Time Dependency)
 * All time operations use ONLY the server as the source of truth
 * Zero reliance on device clock - even if device time is wrong, app time stays correct
 * 
 * NOTE: This file is for SERVER-SIDE use only (API routes, Server Components).
 * For client-side time display, use lib/client-time.ts
 */

export interface ServerTimeData {
  timestamp: string // ISO 8601 string in Ghana time
  serverTime: number // milliseconds since epoch in Ghana time
  timezone: "GMT" // Ghana timezone
}

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
 * Format Ghana time for display
 */
export function formatGhanaTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Africa/Accra",
  })
}

/**
 * Format Ghana date for display
 */
export function formatGhanaDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Accra",
  })
}
