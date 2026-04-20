import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Fetch active geofence locations (public data, no auth required)
    const { data: locations, error } = await supabase
      .from("geofence_locations")
      .select("id, name, latitude, longitude, radius_meters, is_active")
      .eq("is_active", true)
      .order("name")

    if (error) {
      console.error("[v0] Error fetching geofence locations:", error)
      return NextResponse.json(
        { error: "Failed to fetch locations" },
        { status: 500 }
      )
    }

    console.log("[v0] Geofence locations fetched:", locations?.length || 0)

    return NextResponse.json({
      success: true,
      locations: locations || [],
      count: locations?.length || 0,
    })
  } catch (error) {
    console.error("[v0] Geofence API error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
