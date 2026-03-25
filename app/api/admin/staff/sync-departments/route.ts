import { createClient } from "@/lib/supabase/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

// GET - Fetch users missing department_id
export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Sync Departments API - GET request")
    
    const supabase = await createClient()
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }
    
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check admin role
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    
    if (!profile || !["admin", "it-admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    
    // Get all users with null department_id
    const { data: usersWithoutDept, error: fetchError } = await adminSupabase
      .from("user_profiles")
      .select("id, email, first_name, last_name, employee_id, department_id, is_active")
      .is("department_id", null)
      .eq("is_active", true)
      .order("first_name", { ascending: true })
    
    if (fetchError) {
      console.error("[v0] Sync Departments API - Fetch error:", fetchError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }
    
    // Get all departments for reference
    const { data: departments } = await adminSupabase
      .from("departments")
      .select("id, name, code")
      .order("name", { ascending: true })
    
    console.log("[v0] Sync Departments API - Found", usersWithoutDept?.length || 0, "users without department")
    
    return NextResponse.json({
      success: true,
      users_without_department: usersWithoutDept || [],
      total_count: usersWithoutDept?.length || 0,
      departments: departments || [],
    })
  } catch (error) {
    console.error("[v0] Sync Departments API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST - Bulk update department_id for multiple users
export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Sync Departments API - POST request")
    
    const supabase = await createClient()
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }
    
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Check admin role
    const { data: profile } = await adminSupabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()
    
    if (!profile || !["admin", "it-admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }
    
    const body = await request.json()
    const { updates } = body // Array of { user_id, department_id }
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }
    
    console.log("[v0] Sync Departments API - Processing", updates.length, "updates")
    
    let successCount = 0
    let failCount = 0
    const errors: string[] = []
    
    for (const update of updates) {
      if (!update.user_id || !update.department_id) {
        failCount++
        errors.push(`Missing user_id or department_id`)
        continue
      }
      
      const { error: updateError } = await adminSupabase
        .from("user_profiles")
        .update({ 
          department_id: update.department_id,
          updated_at: new Date().toISOString()
        })
        .eq("id", update.user_id)
      
      if (updateError) {
        failCount++
        errors.push(`User ${update.user_id}: ${updateError.message}`)
      } else {
        successCount++
      }
    }
    
    // Log the bulk action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "bulk_sync_departments",
      table_name: "user_profiles",
      new_values: { 
        total_updates: updates.length, 
        successful: successCount, 
        failed: failCount 
      },
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      user_agent: request.headers.get("user-agent"),
    })
    
    console.log("[v0] Sync Departments API - Completed:", successCount, "success,", failCount, "failed")
    
    return NextResponse.json({
      success: true,
      message: `Updated ${successCount} users, ${failCount} failed`,
      successCount,
      failCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors
    })
  } catch (error) {
    console.error("[v0] Sync Departments API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
