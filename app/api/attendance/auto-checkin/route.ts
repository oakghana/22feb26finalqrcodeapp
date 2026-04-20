import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { latitude, longitude, location_id, device_info } = body

    console.log("[v0] Auto Check-in: Starting for user:", user.id, { latitude, longitude, location_id })

    // Check if user already checked in today
    const today = new Date().toISOString().split("T")[0]
    const { data: existingRecord } = await supabase
      .from("attendance_records")
      .select("id, check_in_time")
      .eq("user_id", user.id)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .maybeSingle()

    if (existingRecord && existingRecord.check_in_time) {
      console.log("[v0] Auto Check-in: User already checked in today")
      return NextResponse.json(
        {
          success: false,
          reason: "already_checked_in",
          message: "User already checked in today",
        },
        { status: 200 }, // Return 200 to indicate this is expected behavior
      )
    }

    // Check if user has auto-checkin enabled (from user_profiles or attendance settings)
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, role, auto_checkin_enabled")
      .eq("id", user.id)
      .maybeSingle()

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      )
    }

    // Check if auto-checkin is explicitly disabled by user
    if (userProfile.auto_checkin_enabled === false) {
      console.log("[v0] Auto Check-in: User has disabled auto-checkin")
      return NextResponse.json(
        {
          success: false,
          reason: "auto_checkin_disabled",
          message: "Auto-checkin is disabled for this user",
        },
        { status: 200 },
      )
    }

    // Validate location coordinates
    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing latitude or longitude" },
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
        { error: "No active geofence locations found" },
        { status: 400 }
      )
    }

    // Haversine distance calculation
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const distanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371e3 // Earth's radius in meters
      const φ1 = toRad(lat1)
      const φ2 = toRad(lat2)
      const Δφ = toRad(lat2 - lat1)
      const Δλ = toRad(lon2 - lon1)
      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return Math.round(R * c)
    }

    // Find matching geofence location
    let matchedLocation = null
    let minDistance = Infinity

    for (const loc of geofenceLocations) {
      const distance = distanceMeters(latitude, longitude, loc.latitude, loc.longitude)
      if (distance <= loc.radius_meters && distance < minDistance) {
        matchedLocation = loc
        minDistance = distance
      }
    }

    if (!matchedLocation) {
      console.log("[v0] Auto Check-in: User not within any geofence location")
      return NextResponse.json(
        {
          success: false,
          reason: "outside_geofence",
          message: "User is outside all geofence locations",
        },
        { status: 200 },
      )
    }

    // Check for recent auto-checkin to prevent duplicates within 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentAutoCheckin } = await supabase
      .from("attendance_records")
      .select("id, check_in_time")
      .eq("user_id", user.id)
      .eq("check_in_method", "auto_geofence")
      .gte("check_in_time", fiveMinutesAgo)
      .order("check_in_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentAutoCheckin) {
      console.log("[v0] Auto Check-in: Duplicate auto-checkin within 5 minutes")
      return NextResponse.json(
        {
          success: false,
          reason: "duplicate_recent_checkin",
          message: "Auto-checkin already performed recently",
        },
        { status: 200 },
      )
    }

    // Perform the auto check-in
    const checkInTime = new Date()
    const { data: newRecord, error: insertError } = await supabase
      .from("attendance_records")
      .insert({
        user_id: user.id,
        check_in_time: checkInTime.toISOString(),
        check_in_latitude: latitude,
        check_in_longitude: longitude,
        location_id: matchedLocation.id,
        check_in_method: "auto_geofence", // Mark as automatic geofence checkin
        device_info: device_info || null,
        is_auto_checkin: true, // New field to explicitly mark auto-checkin
        check_in_source: "mobile_app",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Auto Check-in: Error creating attendance record:", insertError)
      return NextResponse.json(
        { error: "Failed to record attendance" },
        { status: 500 }
      )
    }

    console.log("[v0] Auto Check-in: Successfully checked in user", user.id, "at location:", matchedLocation.id)

    // Log the auto-checkin event
    await supabase
      .from("audit_logs")
      .insert({
        user_id: user.id,
        action: "auto_geofence_checkin",
        table_name: "attendance_records",
        record_id: newRecord?.id,
        new_values: {
          location: matchedLocation.name,
          latitude,
          longitude,
          distance_meters: minDistance,
        },
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        user_agent: request.headers.get("user-agent"),
      })
      .catch(() => {}) // Ignore audit log errors

    // Create geofence entry log for analytics
    await supabase
      .from("geofence_entry_logs")
      .insert({
        user_id: user.id,
        location_id: matchedLocation.id,
        entry_timestamp: checkInTime.toISOString(),
        entry_latitude: latitude,
        entry_longitude: longitude,
        distance_from_center_meters: minDistance,
        device_info: device_info || null,
        auto_checkin_performed: true,
      })
      .catch(() => {}) // Ignore if table doesn't exist yet

    return NextResponse.json({
      success: true,
      message: `Auto checked-in at ${matchedLocation.name}`,
      data: {
        recordId: newRecord?.id,
        checkInTime: checkInTime.toISOString(),
        location: {
          id: matchedLocation.id,
          name: matchedLocation.name,
        },
        distanceMeters: minDistance,
      },
    })
  } catch (error) {
    console.error("[v0] Auto Check-in: Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
