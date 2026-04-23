"use client"

import type React from "react"
import { NotificationProvider } from "@/components/ui/notification-system"
import { TimeBasedThemeProvider } from "@/components/theme/time-based-theme-provider"
import { TimeSyncProvider } from "@/components/providers/time-sync-provider"
import { PWAComponents } from "./pwa-components"
import { Toaster } from "@/components/ui/toaster"

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TimeSyncProvider>
      <TimeBasedThemeProvider>
        <NotificationProvider>{children}</NotificationProvider>
        <PWAComponents />
        <Toaster />
      </TimeBasedThemeProvider>
    </TimeSyncProvider>
  )
}
