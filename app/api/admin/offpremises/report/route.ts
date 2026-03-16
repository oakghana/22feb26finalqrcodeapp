import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const departmentId = searchParams.get("departmentId")
    const staffSearch = searchParams.get("staffSearch")
    const status = searchParams.get("status") || "all"
    const page = parseInt(searchParams.get("page") || "0")
    const pageSize = 50

    const supabase = await createAdminClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Only admins, department heads, and regional managers can view reports
    if (!["admin", "department_head", "regional_manager"].includes(userProfile.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Only managers can view reports" },
        { status: 403 }
      )
    }

    // Build query
    let query = supabase
      .from("pending_offpremises_checkins")
      .select(
        `
        id,
        status,
        created_at,
        approved_at,
        rejection_reason,
        reason,
        current_location_name,
        google_maps_name,
        user_id,
        approved_by_id,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          first_name,
          last_name,
          email,
          employee_id,
          department_id
        ),
        approvers:user_profiles!approved_by_id (
          id,
          first_name,
          last_name
        )
      `,
        { count: "exact" }
      )

    // Apply date filters
    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`)
    }

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status)
    }

    // Apply department filter
    if (userProfile.role === "department_head" && userProfile.department_id) {
      query = query.eq("user_profiles.department_id", userProfile.department_id)
    } else if (departmentId && userProfile.role === "admin") {
      query = query.eq("user_profiles.department_id", departmentId)
    }

    // Apply pagination
    const offset = page * pageSize
    query = query.range(offset, offset + pageSize - 1)

    // Order and execute
    const { data: records, count, error: queryError } = await query.order("created_at", {
      ascending: false,
    })

    if (queryError) {
      console.error("[v0] Report query error:", queryError)
      return NextResponse.json(
        { error: "Failed to fetch report data", details: queryError.message },
        { status: 500 }
      )
    }

    // Filter by staff search if provided (client-side since we need fuzzy matching)
    let filteredRecords = records || []
    if (staffSearch) {
      const search = staffSearch.toLowerCase()
      filteredRecords = filteredRecords.filter((record: any) => {
        const staffName = `${record.user_profiles?.first_name || ""} ${record.user_profiles?.last_name || ""}`.toLowerCase()
        const email = record.user_profiles?.email?.toLowerCase() || ""
        const employeeId = record.user_profiles?.employee_id?.toLowerCase() || ""
        return (
          staffName.includes(search) ||
          email.includes(search) ||
          employeeId.includes(search)
        )
      })
    }

    // Calculate metrics
    const totalRecords = count || 0
    const approvedCount = (records || []).filter((r: any) => r.status === "approved").length
    const rejectedCount = (records || []).filter((r: any) => r.status === "rejected").length
    const approvalRate = approvedCount + rejectedCount > 0
      ? Math.round((approvedCount / (approvedCount + rejectedCount)) * 100)
      : 0

    // Calculate average approval time
    let totalApprovalTimeMs = 0
    let processedCount = 0
    (records || []).forEach((record: any) => {
      if ((record.status === "approved" || record.status === "rejected") && 
          record.approved_at && 
          record.created_at) {
        const approvalTime = new Date(record.approved_at).getTime() - new Date(record.created_at).getTime()
        totalApprovalTimeMs += approvalTime
        processedCount++
      }
    })
    const avgApprovalTimeMinutes = processedCount > 0 
      ? Math.round(totalApprovalTimeMs / processedCount / 60000)
      : 0

    // Format response records
    const formattedRecords = filteredRecords.map((record: any) => ({
      id: record.id,
      staff_name: `${record.user_profiles?.first_name || ""} ${record.user_profiles?.last_name || ""}`.trim(),
      email: record.user_profiles?.email,
      employee_id: record.user_profiles?.employee_id,
      department_id: record.user_profiles?.department_id,
      location: record.google_maps_name || record.current_location_name,
      reason: record.reason,
      status: record.status,
      created_at: record.created_at,
      approved_at: record.approved_at,
      rejection_reason: record.rejection_reason,
      approved_by: record.approvers
        ? `${record.approvers[0]?.first_name || ""} ${record.approvers[0]?.last_name || ""}`.trim()
        : "N/A",
    }))

    return NextResponse.json({
      records: formattedRecords,
      total: totalRecords,
      page: page,
      pageSize: pageSize,
      metrics: {
        approval_rate: approvalRate,
        avg_approval_time_minutes: avgApprovalTimeMinutes,
        approved_count: approvedCount,
        rejected_count: rejectedCount,
        pending_count: Math.max(0, totalRecords - approvedCount - rejectedCount),
      },
    })
  } catch (error) {
    console.error("[v0] Report error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
