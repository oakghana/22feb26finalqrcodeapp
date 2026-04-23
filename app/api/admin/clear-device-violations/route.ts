import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { getGhanaServerTimeISO } from "@/lib/server-time"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start_date, end_date } = body

    if (!start_date || !end_date) {
      return NextResponse.json(
        { error: "start_date and end_date are required" },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.data.user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can clear violation data" },
        { status: 403 }
      )
    }

    // Delete device sessions in the specified date range
    const { count, error } = await supabase
      .from("device_sessions")
      .delete()
      .gte("created_at", start_date)
      .lte("created_at", end_date)

    if (error) {
      throw error
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.data.user.id,
      action: "clear_device_violation_data",
      details: {
        start_date,
        end_date,
        records_deleted: count,
        timestamp: getGhanaServerTimeISO(),
      },
      created_at: getGhanaServerTimeISO(),
    })

    return NextResponse.json(
      {
        success: true,
        message: `Cleared ${count} device session records from ${start_date} to ${end_date}`,
        records_deleted: count,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("[v0] Clear device data error:", error)
    return NextResponse.json(
      {
        error: "Failed to clear device violation data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
