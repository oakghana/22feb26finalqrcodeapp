import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user (checking if session exists)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: "No active session", success: false },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { latitude, longitude, device_info } = body

    console.log("[v0] Auto Login: Validating user location:", user.id, { latitude, longitude })

    // Validate coordinates
    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing location coordinates", success: false },
        { status: 400 }
      )
    }

    // Fetch active geofence locations
    const { data: geofenceLocations } = await supabase
      .from("geofence_locations")
      .select("id, name, latitude, longitude, radius_meters, is_active")
      .eq("is_active", true)

    if (!geofenceLocations || geofenceLocations.length === 0) {
      return NextResponse.json(
        { error: "No active geofence locations", success: false },
        { status: 400 }
      )
    }

    // Haversine distance calculation
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3
      const φ1 = toRad(lat1)
      const φ2 = toRad(lat2)
      const Δφ = toRad(lat2 - lat1)
      const Δλ = toRad(lon2 - lon1)
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return Math.round(R * c)
    }

    // Check if user is within any geofence
    let withinGeofence = false
    let matchedLocation = null

    for (const loc of geofenceLocations) {
      const distance = distanceMeters(latitude, longitude, loc.latitude, loc.longitude)
      if (distance <= loc.radius_meters) {
        withinGeofence = true
        matchedLocation = loc
        break
      }
    }

    if (!withinGeofence) {
      console.log("[v0] Auto Login: User outside geofence", user.id)
      return NextResponse.json(
        {
          success: false,
          reason: "outside_geofence",
          message: "User is outside registered geofence locations",
        },
        { status: 200 },
      )
    }

    // Fetch user profile to check if auto-login is enabled
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, auto_login_enabled")
      .eq("id", user.id)
      .maybeSingle()

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile not found", success: false },
        { status: 404 }
      )
    }

    // Check if auto-login is explicitly disabled
    if (userProfile.auto_login_enabled === false) {
      console.log("[v0] Auto Login: User has disabled auto-login")
      return NextResponse.json(
        {
          success: false,
          reason: "auto_login_disabled",
          message: "Auto-login is disabled for this user",
        },
        { status: 200 },
      )
    }

    // Log successful auto-login validation
    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "auto_login_geofence_validation",
        table_name: "user_profiles",
        record_id: user.id,
        new_values: {
          location: matchedLocation.name,
          latitude,
          longitude,
        },
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        user_agent: request.headers.get("user-agent"),
      })
      .catch(() => {})

    console.log("[v0] Auto Login: User validated within geofence", user.id, "at:", matchedLocation.name)

    return NextResponse.json({
      success: true,
      message: "Auto-login validated - user within geofence",
      data: {
        userId: user.id,
        userEmail: user.email,
        userName: `${userProfile.first_name} ${userProfile.last_name}`,
        location: {
          id: matchedLocation.id,
          name: matchedLocation.name,
        },
      },
    })
  } catch (error) {
    console.error("[v0] Auto Login: Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error", success: false },
      { status: 500 }
    )
  }
}
