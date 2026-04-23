"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { syncServerTime, needsResync, getGhanaTimeISO } from "@/lib/server-time"

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
    let syncTimer: NodeJS.Timeout
    let updateTimer: NodeJS.Timeout
    let resyncTimer: NodeJS.Timeout

    const performSync = async () => {
      try {
        await syncServerTime()
        setIsSynced(true)
        setError(null)
        console.log("[v0] Server time synced successfully")
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Failed to sync server time"
        setError(errorMsg)
        setIsSynced(false)
        console.error("[v0] Server time sync failed:", errorMsg)
      }
    }

    const updateTime = () => {
      try {
        const isoString = getGhanaTimeISO()
        setGhanaTime(new Date(isoString))
      } catch (err) {
        console.error("[v0] Error updating Ghana time:", err)
      }
    }

    // Initial sync on mount
    performSync()

    // Update display time every second
    updateTimer = setInterval(updateTime, 1000)

    // Resync every 5 minutes
    resyncTimer = setInterval(() => {
      if (needsResync()) {
        console.log("[v0] Performing periodic time resync")
        performSync()
      }
    }, 5 * 60 * 1000)

    return () => {
      clearInterval(updateTimer)
      clearInterval(resyncTimer)
      clearTimeout(syncTimer)
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
