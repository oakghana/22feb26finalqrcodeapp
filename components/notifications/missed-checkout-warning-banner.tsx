"use client"

import { useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MissedCheckoutWarning {
  id?: string
  type: string
  date: string
  message: string
  missedCheckInTime?: string
}

interface MissedCheckoutWarningBannerProps {
  warning: MissedCheckoutWarning
  onDismiss?: (warningId?: string) => void
}

export function MissedCheckoutWarningBanner({ warning, onDismiss }: MissedCheckoutWarningBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.(warning.id)
  }

  const checkInTime = warning.missedCheckInTime ? new Date(warning.missedCheckInTime).toLocaleTimeString() : "unknown"
  const warningDate = new Date(warning.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="w-full bg-amber-50 border-l-4 border-amber-400 rounded-sm p-4 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 text-sm">Incomplete Check-out</h3>
            <p className="text-amber-800 text-sm mt-1">
              You did not check out on <strong>{warningDate}</strong> before 11:59 PM. Your check-in was recorded at{" "}
              <strong>{checkInTime}</strong>.
            </p>
            <p className="text-amber-700 text-xs mt-2 opacity-75">
              Please remember to check out before the end of each day to maintain accurate attendance records.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 p-1 rounded transition-colors flex-shrink-0"
          aria-label="Dismiss warning"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
