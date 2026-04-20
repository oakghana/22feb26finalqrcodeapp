import { createAdminClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

// Configuration
const AUTO_CHECKOUT_HOUR = 17 // 5 PM
const AUTO_CHECKOUT_MINUTE = 30 // 5:30 PM
const MIN_HOURS_WORKED = 7 // More than 7 hours
const CRON_SECRET = process.env.CRON_SECRET || "test-secret"

interface AutoCheckoutResult {
  user_id: string
  user_email: string
  check_in_time: string
  check_out_time: string
  hours_worked: number
  was_in_geofence: boolean
  checkout_reason: string
  success: boolean
  error?: string
}

async function wasUserInGeofence(
  userId: string,
  checkoutTime: Date,
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
): Promise<boolean> {
  try {
    const { data: locations, error: locError } = await supabase
      .from("geofence_locations")
      .select("id, latitude, longitude, radius_meters")
      .eq("is_active", true)

    if (locError || !locations || locations.length === 0) {
      console.log("[v0] No active geofence locations found")
      return false
    }

    const fifteenMinutesAgo = new Date(checkoutTime.getTime() - 15 * 60000)

    const { data: entries } = await supabase
      .from("geofence_entry_log")
      .select("location_id, entry_time, exit_time")
      .eq("user_id", userId)
      .gte("entry_time", fifteenMinutesAgo.toISOString())
      .lt("entry_time", checkoutTime.toISOString())
      .order("entry_time", { ascending: false })
      .limit(1)

    if (entries && entries.length > 0) {
      const lastEntry = entries[0]
      if (!lastEntry.exit_time) {
        console.log("[v0] User still in geofence at checkout time")
        return true
      }

      if (lastEntry.exit_time && new Date(lastEntry.exit_time) > checkoutTime) {
        console.log("[v0] User in geofence until after checkout time")
        return true
      }
    }

    return false
  } catch (error) {
    console.error("[v0] Error checking geofence status:", error)
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("x-cron-secret")
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn("[v0] Unauthorized cron request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createAdminClient()

    const now = new Date()
    const checkoutTime = new Date()
    checkoutTime.setHours(AUTO_CHECKOUT_HOUR, AUTO_CHECKOUT_MINUTE, 0, 0)

    const timeDiff = Math.abs(now.getTime() - checkoutTime.getTime())
    if (timeDiff > 5 * 60 * 1000 && process.env.NODE_ENV === "production") {
      console.warn(`[v0] Cron triggered outside allowed window. Current: ${now.toISOString()}`)
      return NextResponse.json({
        success: false,
        error: "Cron triggered outside allowed window",
      })
    }

    const today = new Date().toISOString().split("T")[0]
    console.log(`[v0] Starting auto-checkout cron at ${now.toISOString()}`)

    const { data: eligibleRecords, error: queryError } = await supabase
      .from("attendance_records")
      .select(`
        id,
        user_id,
        check_in_time,
        user_profiles!inner (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .is("check_out_time", null)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)

    if (queryError) {
      console.error("[v0] Error querying attendance records:", queryError)
      throw queryError
    }

    console.log(`[v0] Found ${eligibleRecords?.length || 0} records with no checkout`)

    const results: AutoCheckoutResult[] = []

    if (eligibleRecords && eligibleRecords.length > 0) {
      for (const record of eligibleRecords) {
        try {
          const checkInTime = new Date(record.check_in_time)
          const hoursWorked = (checkoutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

          console.log(`[v0] Checking user ${record.user_id}: ${hoursWorked.toFixed(2)} hours worked`)

          if (hoursWorked <= MIN_HOURS_WORKED) {
            console.log(`[v0] User ${record.user_id} only worked ${hoursWorked.toFixed(2)} hours, skipping`)
            results.push({
              user_id: record.user_id,
              user_email: record.user_profiles.email,
              check_in_time: record.check_in_time,
              check_out_time: checkoutTime.toISOString(),
              hours_worked: Math.round(hoursWorked * 100) / 100,
              was_in_geofence: false,
              checkout_reason: "insufficient_hours",
              success: false,
              error: `Only ${hoursWorked.toFixed(2)} hours worked`,
            })
            continue
          }

          const inGeofence = await wasUserInGeofence(record.user_id, checkoutTime, supabase)

          if (inGeofence) {
            console.log(`[v0] User ${record.user_id} is still in geofence, skipping`)
            results.push({
              user_id: record.user_id,
              user_email: record.user_profiles.email,
              check_in_time: record.check_in_time,
              check_out_time: checkoutTime.toISOString(),
              hours_worked: Math.round(hoursWorked * 100) / 100,
              was_in_geofence: true,
              checkout_reason: "still_in_location",
              success: false,
              error: "User is still within geofence",
            })
            continue
          }

          const { error: updateError } = await supabase
            .from("attendance_records")
            .update({
              check_out_time: checkoutTime.toISOString(),
              auto_checked_out: true,
              auto_checkout_reason: "7h_work_outside_location",
              notes: `Auto-checked out at 5:30 PM after ${Math.round(hoursWorked * 100) / 100} hours`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", record.id)

          if (updateError) {
            console.error(`[v0] Failed to auto-checkout user ${record.user_id}:`, updateError)
            results.push({
              user_id: record.user_id,
              user_email: record.user_profiles.email,
              check_in_time: record.check_in_time,
              check_out_time: checkoutTime.toISOString(),
              hours_worked: Math.round(hoursWorked * 100) / 100,
              was_in_geofence: false,
              checkout_reason: "system_error",
              success: false,
              error: updateError.message,
            })
            continue
          }

          console.log(`[v0] Successfully auto-checked out user ${record.user_id}`)

          await supabase
            .from("auto_checkout_logs")
            .insert({
              user_id: record.user_id,
              attendance_record_id: record.id,
              checkout_time: checkoutTime.toISOString(),
              hours_worked: Math.round(hoursWorked * 100) / 100,
              reason: "7h_work_outside_location",
              was_in_geofence: false,
              created_at: new Date().toISOString(),
            })
            .catch((err) => {
              console.warn("[v0] Could not log auto-checkout:", err.message)
            })

          results.push({
            user_id: record.user_id,
            user_email: record.user_profiles.email,
            check_in_time: record.check_in_time,
            check_out_time: checkoutTime.toISOString(),
            hours_worked: Math.round(hoursWorked * 100) / 100,
            was_in_geofence: false,
            checkout_reason: "7h_work_outside_location",
            success: true,
          })
        } catch (error) {
          console.error(`[v0] Error processing user ${record.user_id}:`, error)
          results.push({
            user_id: record.user_id,
            user_email: record.user_profiles.email,
            check_in_time: record.check_in_time,
            check_out_time: checkoutTime.toISOString(),
            hours_worked: 0,
            was_in_geofence: false,
            checkout_reason: "error",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      }
    }

    const successCount = results.filter((r) => r.success).length
    console.log(`[v0] Auto-checkout completed: ${successCount}/${results.length} successful`)

    return NextResponse.json({
      success: true,
      message: `Auto-checkout completed: ${successCount} users auto-checked out`,
      timestamp: new Date().toISOString(),
      checkoutTime: checkoutTime.toISOString(),
      totalProcessed: results.length,
      successCount,
      results,
    })
  } catch (error) {
    console.error("[v0] Auto-checkout cron error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
