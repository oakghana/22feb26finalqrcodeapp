import { createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get("range") || "30d"
    const departmentId = searchParams.get("departmentId")

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

    // Only admins, department heads, and regional managers can view stats
    if (!["admin", "department_head", "regional_manager"].includes(userProfile.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Only managers can view statistics" },
        { status: 403 }
      )
    }

    // Calculate date range
    const now = new Date()
    let startDate = new Date()

    if (range === "7d") startDate.setDate(now.getDate() - 7)
    else if (range === "30d") startDate.setDate(now.getDate() - 30)
    else if (range === "90d") startDate.setDate(now.getDate() - 90)
    else startDate.setDate(now.getDate() - 30) // default to 30d

    const startDateStr = startDate.toISOString().split("T")[0]

    // Build query based on role
    let query = supabase
      .from("pending_offpremises_checkins")
      .select(`
        id,
        status,
        created_at,
        approved_at,
        user_id,
        user_profiles!pending_offpremises_checkins_user_id_fkey (
          id,
          department_id,
          first_name,
          last_name
        ),
        departments:user_profiles!pending_offpremises_checkins_user_id_fkey (
          id
        )
      `)
      .gte("created_at", `${startDateStr}T00:00:00`)

    // Apply department filter if department head
    if (userProfile.role === "department_head") {
      query = query.eq("user_profiles.department_id", userProfile.department_id)
    }

    const { data: requests, error: queryError } = await query.order("created_at", { ascending: false })

    if (queryError) {
      console.error("[v0] Query error:", queryError)
      return NextResponse.json(
        { error: "Failed to fetch statistics", details: queryError.message },
        { status: 500 }
      )
    }

    // Process statistics
    const metrics = {
      pending_count: 0,
      approved_count: 0,
      rejected_count: 0,
      avg_approval_time_minutes: 0,
    }

    const dailyTrends: Record<string, { date: string; pending: number; approved: number; rejected: number }> = {}
    const departmentStats: Record<string, { name: string; approved: number; pending: number; rejected: number }> = {}
    let totalApprovalTimeMs = 0
    let approvedCount = 0

    // Initialize daily trends
    for (let i = 0; i < (range === "7d" ? 7 : range === "30d" ? 30 : 90); i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      dailyTrends[dateStr] = { date: dateStr, pending: 0, approved: 0, rejected: 0 }
    }

    // Process each request
    requests?.forEach((req: any) => {
      const createdDate = req.created_at?.split("T")[0]
      const status = req.status || "pending"

      // Update metrics
      if (status === "pending") metrics.pending_count++
      else if (status === "approved") {
        metrics.approved_count++
        approvedCount++

        // Calculate approval time
        if (req.approved_at && req.created_at) {
          const approvalTimeMs = new Date(req.approved_at).getTime() - new Date(req.created_at).getTime()
          totalApprovalTimeMs += approvalTimeMs
        }
      } else if (status === "rejected") metrics.rejected_count++

      // Update daily trends
      if (createdDate && dailyTrends[createdDate]) {
        if (status === "pending") dailyTrends[createdDate].pending++
        else if (status === "approved") dailyTrends[createdDate].approved++
        else if (status === "rejected") dailyTrends[createdDate].rejected++
      }

      // Update department stats - get department from nested profile
      const staffProfile = req.user_profiles
      if (staffProfile?.department_id) {
        if (!departmentStats[staffProfile.department_id]) {
          departmentStats[staffProfile.department_id] = {
            name: `Department ${staffProfile.department_id.substring(0, 8)}`,
            approved: 0,
            pending: 0,
            rejected: 0,
          }
        }

        if (status === "approved") departmentStats[staffProfile.department_id].approved++
        else if (status === "pending") departmentStats[staffProfile.department_id].pending++
        else if (status === "rejected") departmentStats[staffProfile.department_id].rejected++
      }
    })

    // Calculate average approval time
    if (approvedCount > 0) {
      metrics.avg_approval_time_minutes = Math.round(totalApprovalTimeMs / approvedCount / 60000)
    }

    // Calculate approval rate
    const totalProcessed = metrics.approved_count + metrics.rejected_count
    const approvalRate = totalProcessed > 0 ? Math.round((metrics.approved_count / totalProcessed) * 100) : 0

    // Convert to arrays and sort
    const trendsArray = Object.values(dailyTrends)
      .sort((a, b) => a.date.localeCompare(b.date))
      .reverse()

    const departmentArray = Object.values(departmentStats).sort(
      (a, b) => b.approved + b.pending - (a.approved + a.pending)
    )

    return NextResponse.json({
      metrics: {
        ...metrics,
        approval_rate: approvalRate,
        total_processed: totalProcessed,
      },
      trends: trendsArray,
      by_department: departmentArray,
      range: range,
    })
  } catch (error) {
    console.error("[v0] Statistics error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
