import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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

    if (profileError) {
      return NextResponse.json(
        {
          error: "Failed to fetch user profile",
          details: profileError.message,
        },
        { status: 500 },
      )
    }

    if (!profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 })
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

    const { data: users, error } = await supabase
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
      .range(0, 2999) // Fetch up to 3000 records to support larger organizations

    if (error) {
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
        debug: {
          currentUser: {
            id: user.id,
            role: profile.role,
            name: `${profile.first_name} ${profile.last_name}`,
          },
          totalUsers: filteredUsers.length,
        },
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
