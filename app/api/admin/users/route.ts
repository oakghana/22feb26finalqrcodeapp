import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Admin client uses service role key to bypass RLS for full user list
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, is_active, first_name, last_name")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 })
    }

    if (!["admin", "department_head", "it-admin"].includes(profile.role)) {
      return NextResponse.json(
        {
          error: "Insufficient permissions",
          userRole: profile.role,
          requiredRoles: ["admin", "department_head", "it-admin"],
        },
        { status: 403 },
      )
    }

    // Use admin client to bypass RLS and fetch ALL active users
    const { data: users, error } = await adminClient
      .from("user_profiles")
      .select(`
        id,
        first_name,
        last_name,
        email,
        employee_id,
        role,
        is_active
      `)
      .eq("is_active", true)
      .order("first_name")

    if (error) {
      console.error("[v0] Users fetch error:", error)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch users",
          details: error.message,
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        },
      )
    }

    let filteredUsers = users || []
    if (profile.role === "it-admin") {
      filteredUsers = users?.filter((u) => u.role !== "admin" && u.role !== "it-admin") || []
    }

    return NextResponse.json(
      {
        success: true,
        users: filteredUsers,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Users API error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
