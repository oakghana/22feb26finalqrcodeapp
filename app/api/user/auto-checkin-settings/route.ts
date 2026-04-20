import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("auto_checkin_enabled, auto_login_enabled")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json({
      auto_checkin_enabled: profile?.auto_checkin_enabled ?? true,
      auto_login_enabled: profile?.auto_login_enabled ?? true,
    })
  } catch (error) {
    console.error("[v0] Error fetching auto-checkin settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { auto_checkin_enabled, auto_login_enabled } = body

    const updateData: any = {}
    if (auto_checkin_enabled !== undefined) {
      updateData.auto_checkin_enabled = auto_checkin_enabled
    }
    if (auto_login_enabled !== undefined) {
      updateData.auto_login_enabled = auto_login_enabled
    }

    const { error: updateError } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Error updating auto-checkin settings:", updateError)
      return NextResponse.json(
        { error: "Failed to update settings" },
        { status: 500 }
      )
    }

    // Log the setting change
    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "auto_checkin_settings_updated",
        table_name: "user_profiles",
        record_id: user.id,
        new_values: updateData,
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        user_agent: request.headers.get("user-agent"),
      })
      .catch(() => {}) // Ignore audit log errors

    return NextResponse.json({
      success: true,
      message: "Settings updated",
      auto_checkin_enabled: updateData.auto_checkin_enabled,
      auto_login_enabled: updateData.auto_login_enabled,
    })
  } catch (error) {
    console.error("[v0] Error in auto-checkin settings API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
