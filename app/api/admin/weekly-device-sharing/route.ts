import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { getGhanaServerTime, getGhanaServerTimeISO } from "@/lib/server-time"

// Helper: Calculate distance between two GPS coordinates (Haversine formula, returns meters)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const R = 6371e3 // Earth's radius in meters
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lon2 - lon1)
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

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

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "admin" && profile.role !== "department_head")) {
      return NextResponse.json({ error: "Forbidden: Admin or Department Head access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get("location_id")
    const departmentId = searchParams.get("department_id")
    const startDate = searchParams.get("start_date")
    const endDate = searchParams.get("end_date")

    // Use Ghana server time for date range
    const defaultStartDate = getGhanaServerTime()
    defaultStartDate.setDate(defaultStartDate.getDate() - 7)

    const filterStartDate = startDate ? new Date(startDate) : defaultStartDate
    const filterEndDate = endDate ? new Date(endDate) : getGhanaServerTime()

    // Fetch device sessions with location data
    const { data: deviceSessions, error: sessionsError } = await supabase
      .from("device_sessions")
      .select("device_id, user_id, created_at, location_id, location_name, latitude, longitude")
      .not("device_id", "is", null)
      .neq("device_id", "")
      .gte("created_at", filterStartDate.toISOString())
      .lte("created_at", filterEndDate.toISOString())
      .order("created_at", { ascending: false })

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
      .select("id, first_name, last_name, email, department_id, assigned_location_id")
      .in("id", userIds)

    if (departmentId) {
      userProfilesQuery = userProfilesQuery.eq("department_id", departmentId)
    }
    if (locationId) {
      userProfilesQuery = userProfilesQuery.eq("assigned_location_id", locationId)
    }

    const { data: userProfiles, error: profilesError } = await userProfilesQuery

    if (profilesError) {
      console.error("[v0] Error fetching user profiles:", profilesError)
      return NextResponse.json({ error: "Failed to fetch user profiles", data: [] }, { status: 200 })
    }

    const profileMap = new Map(userProfiles?.map((p) => [p.id, p]) || [])

    // Group by device_id and analyze locations
    const deviceMap = new Map<
      string,
      {
        device_id: string
        sessions: Array<{
          user_id: string
          first_name: string
          last_name: string
          email: string
          location_name: string | null
          latitude: number | null
          longitude: number | null
          created_at: string
        }>
      }
    >()

    for (const session of deviceSessions) {
      if (!session.device_id || session.device_id.trim() === "") continue

      const userProfile = profileMap.get(session.user_id)
      if (!userProfile) continue

      // Department heads only see their own department
      if (profile.role === "department_head") {
        if (userProfile.department_id !== profile.department_id) continue
      }

      const key = session.device_id
      if (!deviceMap.has(key)) {
        deviceMap.set(key, {
          device_id: session.device_id,
          sessions: [],
        })
      }

      deviceMap.get(key)!.sessions.push({
        user_id: session.user_id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        email: userProfile.email,
        location_name: session.location_name,
        latitude: session.latitude,
        longitude: session.longitude,
        created_at: session.created_at,
      })
    }

    // Analyze devices for suspicious sharing patterns
    const suspiciousDevices = Array.from(deviceMap.values())
      .map((device) => {
        const uniqueUsers = new Set(device.sessions.map((s) => s.user_id))

        // Only flag if 2+ different users used the same device
        if (uniqueUsers.size < 2) return null

        // Analyze location patterns
        const locations = device.sessions.map((s) => ({
          location_name: s.location_name || "Unknown",
          latitude: s.latitude,
          longitude: s.longitude,
          user_id: s.user_id,
          timestamp: s.created_at,
        }))

        // Check for suspicious location changes (same device in different locations close in time)
        let riskLevel = "low"
        let suspicionReason = ""
        const sameLocationSessions: any[] = []

        // Group sessions by location
        const locationGroups = new Map<string, typeof locations>()
        for (const loc of locations) {
          const key = `${loc.latitude}-${loc.longitude}`
          if (!locationGroups.has(key)) {
            locationGroups.set(key, [])
          }
          locationGroups.get(key)!.push(loc)
        }

        // Check for multiple users at same location (most suspicious)
        for (const [locKey, locSessions] of locationGroups) {
          const userIdsAtLoc = new Set(locSessions.map((s) => s.user_id))
          if (userIdsAtLoc.size > 1) {
            // Multiple different users used same device at exact same location
            riskLevel = userIdsAtLoc.size >= 3 ? "critical" : userIdsAtLoc.size === 2 ? "high" : "medium"
            suspicionReason = `${userIdsAtLoc.size} users used this device at the same location: ${locSessions[0].location_name}`
            sameLocationSessions.push(
              ...locSessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            )
          }
        }

        // If no same-location issue, check for impossible speed travel (low priority)
        if (!suspicionReason && locations.length > 1) {
          for (let i = 0; i < locations.length - 1; i++) {
            const curr = locations[i]
            const next = locations[i + 1]

            if (curr.latitude && curr.longitude && next.latitude && next.longitude) {
              const distance = calculateDistance(curr.latitude, curr.longitude, next.latitude, next.longitude)
              const timeDiff = Math.abs(new Date(next.timestamp).getTime() - new Date(curr.timestamp).getTime())
              const timeMinutes = timeDiff / (1000 * 60)

              // Flag if device traveled >100km in <30 minutes (impossible for humans)
              if (distance > 100000 && timeMinutes < 30) {
                riskLevel = "medium"
                suspicionReason = `Device teleported ${Math.round(distance / 1000)}km in ${timeMinutes.toFixed(1)} minutes`
                break
              }
            }
          }
        }

        return {
          device_id: device.device_id,
          user_count: uniqueUsers.size,
          risk_level: suspicionReason ? riskLevel : "low",
          suspicion_reason: suspicionReason || "Multiple users, no location overlap detected",
          sessions: device.sessions.map((s) => ({
            user_id: s.user_id,
            name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            location: s.location_name || "Unknown",
            timestamp: s.created_at,
          })),
          same_location_sessions: sameLocationSessions.map((s) => ({
            user_id: s.user_id,
            location: s.location_name,
            timestamp: s.timestamp,
          })),
          first_detected: device.sessions[device.sessions.length - 1].created_at,
          last_detected: device.sessions[0].created_at,
        }
      })
      .filter((d): d is Exclude<typeof d, null> => d !== null && d.risk_level !== "low")
      .sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return riskOrder[a.risk_level as keyof typeof riskOrder] - riskOrder[b.risk_level as keyof typeof riskOrder]
      })

    return NextResponse.json({ data: suspiciousDevices })
  } catch (error) {
    console.error("[v0] Weekly device sharing error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
