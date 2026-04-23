import { NextResponse } from "next/server"
import type { ServerTimeData } from "@/lib/server-time"

/**
 * Server Time API Endpoint
 * Returns authoritative Ghana server time (GMT/UTC+0)
 * Used by client to sync and prevent clock manipulation
 */
export async function GET() {
  try {
    // Get current time and convert to Ghana timezone (GMT/UTC+0)
    const now = new Date()
    const ghanaTimeString = now.toLocaleString("en-US", { timeZone: "Africa/Accra" })
    const ghanaTime = new Date(ghanaTimeString)

    const response: ServerTimeData = {
      timestamp: ghanaTime.toISOString(),
      serverTime: ghanaTime.getTime(),
      timezone: "GMT",
    }

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
      },
    })
  } catch (error) {
    console.error("[v0] Error in server-time endpoint:", error)
    return NextResponse.json({ error: "Failed to get server time" }, { status: 500 })
  }
}
