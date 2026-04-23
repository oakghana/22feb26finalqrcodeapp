import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getGhanaServerTime, getGhanaServerTimeISO } from "@/lib/server-time"

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

    // Get user profile to check role and department
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "department_head")) {
      return NextResponse.json({ error: "Forbidden: Admin or Department Head access required" }, { status: 403 })
    }

    // Get filter parameters from query string
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("location_id")
    const departmentId = searchParams.get("department_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Set date range (default to last 7 days) using Ghana server time
    const defaultStartDate = getGhanaServerTime()
    defaultStartDate.setDate(defaultStartDate.getDate() - 7)
    
    const filterStartDate = startDate ? new Date(startDate) : defaultStartDate
    const filterEndDate = endDate ? new Date(endDate) : getGhanaServerTime()

    const sevenDaysAgo = defaultStartDate;

    let deviceSessionsQuery = supabase
      .from("device_sessions")
      .select("device_id, ip_address, user_id, created_at")
      .gte("created_at", filterStartDate.toISOString())
      .lte("created_at", filterEndDate.toISOString())
      .order("created_at", { ascending: false })

    const { data: deviceSessions, error: sessionsError } = await deviceSessionsQuery

    if (sessionsError) {
      console.error("[v0] Error fetching device sessions:", sessionsError)
      return NextResponse.json({ error: "Failed to fetch device sessions", data: [] }, { status: 200 })
    }

    if (!deviceSessions || deviceSessions.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const userIds = [...new Set(deviceSessions.map((s) => s.user_id))]
    let userProfilesQuery = supabase
      .from("user_profiles")
      .select("id, first_name, last_name, email, department_id, assigned_location_id, departments(name)")
      .in("id", userIds)
    
    // Apply department filter
    if (departmentId) {
      userProfilesQuery = userProfilesQuery.eq("department_id", departmentId)
    }
    
    // Apply location filter
    if (locationId) {
      userProfilesQuery = userProfilesQuery.eq("assigned_location_id", locationId)
    }

    const { data: userProfiles, error: profilesError } = await userProfilesQuery

    if (profilesError) {
      console.error("[v0] Error fetching user profiles:", profilesError)
      return NextResponse.json({ error: "Failed to fetch user profiles", data: [] }, { status: 200 })
    }

    const profileMap = new Map(userProfiles?.map((p) => [p.id, p]) || [])

    const deviceMap = new Map<
      string,
      {
        device_id: string
        ip_address: string | null
        users: Set<string>
        userDetails: Array<{
          user_id: string
          first_name: string
          last_name: string
          email: string
          department_name: string
          last_used: string
        }>
      }
    >()

    for (const session of deviceSessions) {
      const key = session.device_id || session.ip_address
      if (!key) continue

      const userProfile = profileMap.get(session.user_id)
      if (!userProfile) continue

      // Filter by department for department heads
      if (profile.role === "department_head") {
        if (userProfile.department_id !== profile.department_id) {
          continue
        }
      }

      if (!deviceMap.has(key)) {
        deviceMap.set(key, {
          device_id: session.device_id,
          ip_address: session.ip_address,
          users: new Set(),
          userDetails: [],
        })
      }

      const device = deviceMap.get(key)!
      if (!device.users.has(session.user_id)) {
        device.users.add(session.user_id)
        device.userDetails.push({
          user_id: session.user_id,
          first_name: userProfile.first_name,
          last_name: userProfile.last_name,
          email: userProfile.email,
          department_name: userProfile.departments?.name || "Unknown",
          last_used: session.created_at,
        })
      }
    }

    const sharedDevices = Array.from(deviceMap.values())
      .filter((device) => device.users.size > 1)
      .map((device) => ({
        device_id: device.device_id,
        ip_address: device.ip_address,
        user_count: device.users.size,
        risk_level: device.users.size >= 5 ? "critical" : device.users.size >= 3 ? "high" : "medium",
        users: device.userDetails,
        first_detected: device.userDetails.reduce(
          (earliest, user) => (user.last_used < earliest ? user.last_used : earliest),
          device.userDetails[0].last_used,
        ),
        last_detected: device.userDetails.reduce(
          (latest, user) => (user.last_used > latest ? user.last_used : latest),
          device.userDetails[0].last_used,
        ),
      }))
      .sort((a, b) => b.user_count - a.user_count)

    return NextResponse.json({ data: sharedDevices })
  } catch (error) {
    console.error("Weekly device sharing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
