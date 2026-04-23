"use client"

import { useServerTime } from "@/lib/server-time"
import { useState, useEffect } from "react"
import { Clock } from "lucide-react"

export function GhanaTimeDisplay() {
  const { ghanaTime, isSynced } = useServerTime()
  const [displayTime, setDisplayTime] = useState<string>("")
  const [displayDate, setDisplayDate] = useState<string>("")

  useEffect(() => {
    // Format time: HH:MM:SS
    const hours = ghanaTime.getHours().toString().padStart(2, "0")
    const minutes = ghanaTime.getMinutes().toString().padStart(2, "0")
    const seconds = ghanaTime.getSeconds().toString().padStart(2, "0")
    setDisplayTime(`${hours}:${minutes}:${seconds}`)

    // Format date: Mon, Apr 23, 2026
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }
    const formatted = ghanaTime.toLocaleDateString("en-US", options)
    setDisplayDate(formatted)
  }, [ghanaTime])

  return (
    <div className="px-4 py-3 border-t border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground">GHANA TIME (GMT)</span>
      </div>
      <div className="space-y-0.5">
        <div className="text-lg font-mono font-bold text-foreground">
          {displayTime || "--:--:--"}
        </div>
        <div className="text-xs text-muted-foreground">
          {displayDate || "Loading..."}
        </div>
      </div>
      {!isSynced && (
        <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
          Syncing with server...
        </div>
      )}
    </div>
  )
}
