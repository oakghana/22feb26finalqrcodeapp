import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Check for missed checkout from previous day and create a warning if needed.
 * Called when user logs in/loads dashboard.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = user.id
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    // Format dates for comparison
    const yesterdayStart = new Date(yesterday)
    yesterdayStart.setHours(0, 0, 0, 0)

    const yesterdayEnd = new Date(yesterday)
    yesterdayEnd.setHours(23, 59, 59, 999)

    // Check if there's an unfinished attendance record from yesterday
    // (check-in exists but no check-out)
    const { data: unfinishedRecords, error: recordError } = await supabase
      .from("attendance_records")
      .select("id, check_in_time, check_out_time, created_at")
      .eq("user_id", userId)
      .gte("created_at", yesterdayStart.toISOString())
      .lte("created_at", yesterdayEnd.toISOString())
      .is("check_out_time", null) // No check-out

    if (recordError) {
      console.error("[v0] Error checking attendance records:", recordError)
      return NextResponse.json({ hasWarning: false, warning: null })
    }

    if (!unfinishedRecords || unfinishedRecords.length === 0) {
      // No missed checkout, return success
      return NextResponse.json({ hasWarning: false, warning: null })
    }

    // There's a missed checkout from yesterday
    const missedRecord = unfinishedRecords[0]
    const warningDate = yesterday.toISOString().split("T")[0]

    // Check if warning already exists for today
    const { data: existingWarning } = await supabase
      .from("staff_warnings")
      .select("id")
      .eq("user_id", userId)
      .eq("warning_type", "no_checkout")
      .gte("created_at", new Date(today).toISOString().split("T")[0])
      .limit(1)

    if (existingWarning && existingWarning.length > 0) {
      // Warning already created, just return it
      return NextResponse.json({
        hasWarning: true,
        warning: {
          id: existingWarning[0].id,
          type: "no_checkout",
          date: warningDate,
          message: "You did not check out yesterday before 11:59 PM",
          missedCheckInTime: missedRecord.check_in_time,
        },
      })
    }

    // Create a new warning for the user
    const { data: newWarning, error: insertError } = await supabase
      .from("staff_warnings")
      .insert({
        user_id: userId,
        warning_type: "no_checkout",
        description: `Did not complete checkout on ${warningDate}. Check-in was at ${new Date(missedRecord.check_in_time).toLocaleTimeString()}`,
        is_dismissed: false,
      })
      .select("id, warning_type, description, created_at")
      .single()

    if (insertError) {
      console.error("[v0] Error creating warning:", insertError)
      // Even if warning creation fails, return info about the missed checkout
      return NextResponse.json({
        hasWarning: true,
        warning: {
          type: "no_checkout",
          date: warningDate,
          message: "You did not check out yesterday before 11:59 PM",
          missedCheckInTime: missedRecord.check_in_time,
          createdFromSystem: true,
        },
      })
    }

    return NextResponse.json({
      hasWarning: true,
      warning: {
        id: newWarning.id,
        type: "no_checkout",
        date: warningDate,
        message: "You did not check out yesterday before 11:59 PM",
        missedCheckInTime: missedRecord.check_in_time,
      },
    })
  } catch (error) {
    console.error("[v0] Unexpected error in check-missed-checkout:", error)
    return NextResponse.json({ hasWarning: false, warning: null, error: "Internal server error" }, { status: 500 })
  }
}
