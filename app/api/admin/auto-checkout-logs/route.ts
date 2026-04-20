import { createClient } from "@/lib/supabase/server"
import { NextResponse, type NextRequest } from "next/server"

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

    // Check if user is admin
    const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).maybeSingle()

    if (!profile || (profile.role !== "admin" && profile.role !== "department_head")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200)
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const userId = searchParams.get("userId")
    const sortBy = searchParams.get("sortBy") || "created_at"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    let query = supabase
      .from("attendance_records")
      .select(
        `
        id,
        user_id,
        check_in_time,
        check_out_time,
        auto_checked_out,
        auto_checkout_reason,
        notes,
        created_at,
        user_profiles!inner (
          id,
          email,
          first_name,
          last_name,
          employee_id
        )
      `,
        { count: "exact" },
      )
      .eq("auto_checked_out", true)

    if (userId) {
      query = query.eq("user_id", userId)
    }

    if (dateFrom) {
      query = query.gte("created_at", new Date(dateFrom).toISOString())
    }

    if (dateTo) {
      query = query.lt("created_at", new Date(dateTo).toISOString())
    }

    const orderAscending = sortOrder === "asc"
    const orderColumn = sortBy === "user" ? "user_profiles.email" : sortBy === "hours" ? "check_out_time" : "created_at"

    query = query.order(orderColumn, { ascending: orderAscending })

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: records, error: queryError, count } = await query

    if (queryError) {
      console.error("[v0] Error fetching auto-checkout logs:", queryError)
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
    }

    // Calculate hours worked for each record
    const enrichedRecords = (records || []).map((record: any) => {
      const checkInTime = new Date(record.check_in_time)
      const checkOutTime = new Date(record.check_out_time)
      const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

      return {
        ...record,
        hours_worked: Math.round(hoursWorked * 100) / 100,
        user_name: `${record.user_profiles.first_name} ${record.user_profiles.last_name}`,
      }
    })

    const totalPages = count ? Math.ceil(count / limit) : 1

    return NextResponse.json({
      success: true,
      data: enrichedRecords,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
      },
    })
  } catch (error) {
    console.error("[v0] Auto-checkout logs error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
