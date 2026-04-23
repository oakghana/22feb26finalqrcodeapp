"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { getServerTime } from "@/lib/server-time"

interface TimeSyncContextType {
  isSynced: boolean
  error: string | null
  ghanaTime: Date
}

const TimeSyncContext = createContext<TimeSyncContextType | undefined>(undefined)

export function TimeSyncProvider({ children }: { children: React.ReactNode }) {
  const [isSynced, setIsSynced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ghanaTime, setGhanaTime] = useState(new Date())

  useEffect(() => {
    let updateTimer: NodeJS.Timeout
    let fetchTimer: NodeJS.Timeout

    const fetchAndUpdate = async () => {
      try {
        const serverTime = await getServerTime()
        setGhanaTime(serverTime)
        setIsSynced(true)
        setError(null)
        console.log("[v0] Server time fetched successfully")
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to fetch server time"
        setError(errorMsg)
        setIsSynced(false)
        console.error("[v0] Server time fetch failed:", errorMsg)
      }
    }

    // Initial fetch on mount
    fetchAndUpdate()

    // Visual tick every second using cached server time
    updateTimer = setInterval(async () => {
      try {
        const serverTime = await getServerTime()
        setGhanaTime(serverTime)
      } catch (err) {
        // Silent fail on tick - fetchAndUpdate will show errors
      }
    }, 1000)

    // Refetch from server every 30 seconds to stay in sync
    fetchTimer = setInterval(fetchAndUpdate, 30 * 1000)

    return () => {
      clearInterval(updateTimer)
      clearInterval(fetchTimer)
    }
  }, [])

  return (
    <TimeSyncContext.Provider value={{ isSynced, error, ghanaTime }}>
      {children}
    </TimeSyncContext.Provider>
  )
}

export function useTimeSync() {
  const context = useContext(TimeSyncContext)
  if (context === undefined) {
    throw new Error("useTimeSync must be used within a TimeSyncProvider")
  }
  return context
}
