import { createClient, createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log("[v0] Location update request for ID:", id)

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

    if (!profile || !["admin", "department_head", "it-admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    console.log("[v0] User role:", profile.role)
    console.log("[v0] Location update data:", body)

    const isITAdmin = profile.role === "it-admin"

    // Fetch current location
    const { data: currentLocation, error: fetchError } = await supabase
      .from("geofence_locations")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !currentLocation) {
      console.error("[v0] Location not found")
      return NextResponse.json({ error: "Location not found" }, { status: 404 })
    }

    // IT-Admin: Only update name — use admin client to bypass RLS
    if (isITAdmin) {
      const newName = body.name?.trim()

      if (!newName) {
        return NextResponse.json({ error: "Location name cannot be empty" }, { status: 400 })
      }

      // createAdminClient uses the service role key and bypasses RLS
      const adminSupabase = await createAdminClient()

      const { data: updateResult, error: updateError } = await adminSupabase
        .from("geofence_locations")
        .update({ name: newName })
        .eq("id", id)
        .select()

      if (updateError) {
        console.error("[v0] IT-Admin update error:", updateError)
        return NextResponse.json({ error: updateError.message || "Failed to update location name" }, { status: 500 })
      }

      if (!updateResult || updateResult.length === 0) {
        console.error("[v0] IT-Admin update returned no rows")
        return NextResponse.json({ error: "Location not found or could not be updated" }, { status: 404 })
      }

      // Try to insert audit log but don't block if it fails
      try {
        await adminSupabase.from("audit_logs").insert({
          user_id: user.id,
          action: "update_location_name",
          table_name: "geofence_locations",
          record_id: id,
          old_values: { name: currentLocation.name },
          new_values: { name: newName },
          ip_address: request.headers.get("x-forwarded-for") || null,
        })
      } catch (auditError) {
        console.warn("[v0] Audit log insert failed (non-blocking):", auditError)
      }

      return NextResponse.json({
        success: true,
        data: updateResult[0],
        message: "Location name updated successfully",
      })
    }

    // Full admin/department_head update
    const updateData: any = {}
    
    if (body.name !== undefined) updateData.name = body.name
    if (body.address !== undefined) updateData.address = body.address
    if (body.latitude !== undefined) updateData.latitude = Number(body.latitude)
    if (body.longitude !== undefined) updateData.longitude = Number(body.longitude)
    if (body.radius_meters !== undefined) updateData.radius_meters = Number(body.radius_meters)
    if (body.is_active !== undefined) updateData.is_active = body.is_active
    if (body.check_in_start_time !== undefined) updateData.check_in_start_time = body.check_in_start_time
    if (body.check_out_end_time !== undefined) updateData.check_out_end_time = body.check_out_end_time
    if (body.require_early_checkout_reason !== undefined) updateData.require_early_checkout_reason = body.require_early_checkout_reason
    if (body.working_hours_description !== undefined) updateData.working_hours_description = body.working_hours_description

    const { data: updateResult, error: updateError } = await supabase
      .from("geofence_locations")
      .update(updateData)
      .eq("id", id)
      .select()

    if (updateError) {
      console.error("[v0] Update error:", updateError)
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 })
    }

    if (!updateResult || updateResult.length === 0) {
      console.error("[v0] Update returned no rows - possible RLS issue")
      return NextResponse.json({ error: "Failed to update location - permission denied" }, { status: 403 })
    }

    console.log("[v0] Location updated successfully")

    // Try to insert audit log but don't block if it fails
    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "update_location",
        table_name: "geofence_locations",
        record_id: id,
        old_values: currentLocation,
        new_values: updateData,
        ip_address: request.headers.get("x-forwarded-for") || null,
      })
    } catch (auditError) {
      console.warn("[v0] Audit log insert failed (non-blocking):", auditError)
    }

    return NextResponse.json({
      success: true,
      data: updateResult[0],
      message: "Location updated successfully",
    })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
