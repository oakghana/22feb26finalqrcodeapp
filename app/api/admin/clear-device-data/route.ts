import { createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGhanaServerTimeISO } from "@/lib/server-time"

export async function DELETE() {
  try {
    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // Verify the requesting user is an admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Delete all device_security_violations
    const { error: violationsError, count: violationsCount } = await adminSupabase
      .from("device_security_violations")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000") // delete all rows

    if (violationsError) {
      console.error("[v0] Error clearing device_security_violations:", violationsError)
    }

    // Delete all device_sessions
    const { error: sessionsError, count: sessionsCount } = await adminSupabase
      .from("device_sessions")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (sessionsError) {
      console.error("[v0] Error clearing device_sessions:", sessionsError)
    }

    // Delete all device_user_bindings if table exists
    const { error: bindingsError, count: bindingsCount } = await adminSupabase
      .from("device_user_bindings")
      .delete({ count: "exact" })
      .neq("id", "00000000-0000-0000-0000-000000000000")

    if (bindingsError) {
      console.error("[v0] device_user_bindings may not exist or error:", bindingsError.message)
    }

    // Log the action in audit_logs
    await adminSupabase.from("audit_logs").insert({
      user_id: user.id,
      action: "clear_device_data",
      table_name: "device_sessions",
      new_values: {
        cleared_by: user.id,
        cleared_at: getGhanaServerTimeISO(),
        violations_cleared: violationsCount ?? 0,
        sessions_cleared: sessionsCount ?? 0,
        bindings_cleared: bindingsCount ?? 0,
        reason: "Admin reset - fresh start for accurate device monitoring",
      },
    })

    return NextResponse.json({
      success: true,
      message: "All device monitoring data has been cleared. Starting fresh with accurate tracking.",
      cleared: {
        violations: violationsCount ?? 0,
        sessions: sessionsCount ?? 0,
        bindings: bindingsCount ?? 0,
      },
    })
  } catch (error) {
    console.error("[v0] Error in clear-device-data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
