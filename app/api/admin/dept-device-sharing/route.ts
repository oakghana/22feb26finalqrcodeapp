import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getGhanaServerTime, getGhanaServerTimeISO } from "@/lib/server-time"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile with department
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id, departments(id, name, code)")
      .eq("id", user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }

    // Only department heads can access this endpoint
    if (profile.role !== "department_head" && profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Department Head access required" }, { status: 403 })
    }

    if (!profile.department_id) {
      return NextResponse.json({ error: "No department assigned to this user" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Use Ghana server time for date range (default last 7 days)
    const defaultStartDate = getGhanaServerTime()
    defaultStartDate.setDate(defaultStartDate.getDate() - 7)

    const filterStartDate = startDate ? new Date(startDate) : defaultStartDate
    const filterEndDate = endDate ? new Date(endDate) : getGhanaServerTime()

    // Get all staff in this department
    const { data: deptStaff, error: staffError } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, employee_id")
      .eq("department_id", profile.department_id)
      .eq("is_active", true)

    if (staffError) {
      return NextResponse.json({ error: "Failed to fetch department staff" }, { status: 500 })
    }

    const deptStaffIds = deptStaff?.map(s => s.id) || []

    if (deptStaffIds.length === 0) {
      return NextResponse.json({
        success: true,
        department: profile.departments,
        sharedDevices: [],
        totalSharedDevices: 0,
        message: "No staff in department"
      })
    }

    // Fetch device sessions for department staff only
    // Only sessions with valid device_id (not null, not empty)
    const { data: deviceSessions, error: sessionsError } = await supabase
      .from("device_sessions")
      .select("device_id, ip_address, user_id, created_at")
      .in("user_id", deptStaffIds)
      .not("device_id", "is", null)
      .neq("device_id", "")
      .gte("created_at", filterStartDate.toISOString())
      .lte("created_at", filterEndDate.toISOString())

    if (sessionsError) {
      return NextResponse.json({ error: "Failed to fetch device sessions" }, { status: 500 })
    }

    // Group sessions by device_id to find shared devices
    const deviceUserMap: Record<string, Set<string>> = {}
    const deviceSessions_list: Record<string, any[]> = {}

    for (const session of deviceSessions || []) {
      const deviceId = session.device_id
      if (!deviceId) continue

      if (!deviceUserMap[deviceId]) {
        deviceUserMap[deviceId] = new Set()
        deviceSessions_list[deviceId] = []
      }
      deviceUserMap[deviceId].add(session.user_id)
      deviceSessions_list[deviceId].push(session)
    }

    // Find devices used by multiple users (violations)
    const sharedDevices: any[] = []

    for (const [deviceId, userIds] of Object.entries(deviceUserMap)) {
      if (userIds.size > 1) {
        // Get user details for each user who used this device
        const users = Array.from(userIds).map(userId => {
          const staff = deptStaff?.find(s => s.id === userId)
          const sessions = deviceSessions_list[deviceId].filter(s => s.user_id === userId)
          return {
            id: userId,
            name: staff ? `${staff.first_name} ${staff.last_name}` : "Unknown",
            email: staff?.email || "Unknown",
            employee_id: staff?.employee_id || "Unknown",
            sessionCount: sessions.length,
            lastUsed: sessions.length > 0 ? sessions[sessions.length - 1].created_at : null,
          }
        })

        // Determine risk level
        let riskLevel = "low"
        if (userIds.size >= 5) riskLevel = "critical"
        else if (userIds.size >= 3) riskLevel = "high"
        else if (userIds.size >= 2) riskLevel = "medium"

        sharedDevices.push({
          device_id: deviceId,
          user_count: userIds.size,
          users,
          risk_level: riskLevel,
          total_sessions: deviceSessions_list[deviceId].length,
          first_detected: deviceSessions_list[deviceId][0]?.created_at,
          last_activity: deviceSessions_list[deviceId][deviceSessions_list[deviceId].length - 1]?.created_at,
        })
      }
    }

    // Sort by risk level and user count
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    sharedDevices.sort((a, b) => {
      const riskDiff = riskOrder[a.risk_level] - riskOrder[b.risk_level]
      if (riskDiff !== 0) return riskDiff
      return b.user_count - a.user_count
    })

    return NextResponse.json({
      success: true,
      department: profile.departments,
      sharedDevices,
      totalSharedDevices: sharedDevices.length,
      dateRange: {
        start: filterStartDate.toISOString(),
        end: filterEndDate.toISOString(),
      },
      totalStaffInDepartment: deptStaff?.length || 0,
    })
  } catch (error) {
    console.error("Dept device sharing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
