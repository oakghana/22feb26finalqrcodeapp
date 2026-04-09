import { createClient, createAdminClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Reports API - Starting request")
    const supabase = await createClient()

    // Get authenticated user and check role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("[v0] Reports API - Auth error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Reports API - User authenticated:", user.id)

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, department_id, assigned_location_id")
      .eq("id", user.id)
      .single()

    if (!profile || !["admin", "regional_manager", "department_head", "staff"].includes(profile.role)) {
      console.error("[v0] Reports API - Insufficient permissions:", profile?.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    console.log("[v0] Reports API - User role:", profile.role)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const startDate =
      searchParams.get("start_date") || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const endDate = searchParams.get("end_date") || new Date().toISOString().split("T")[0]
    const departmentId = searchParams.get("department_id")
    const userId = searchParams.get("user_id")
    const locationId = searchParams.get("location_id")
    const districtId = searchParams.get("district_id")

    console.log("[v0] Reports API - Filters:", {
      startDate,
      endDate,
      departmentId,
      userId,
      locationId,
      districtId,
    })

    let query = supabase
      .from("attendance_records")
      .select(`
        *,
        check_in_location:geofence_locations!check_in_location_id (
          id,
          name,
          address,
          district_id
        ),
        check_out_location:geofence_locations!check_out_location_id (
          id,
          name,
          address,
          district_id
        )
      `)
      .gte("check_in_time", `${startDate}T00:00:00`)
      .lte("check_in_time", `${endDate}T23:59:59`)

    // Validate incoming UUID-like params to avoid invalid input to Postgres
    const safeLocationId = locationId && locationId !== "undefined" ? locationId : null
    const safeDistrictId = districtId && districtId !== "undefined" ? districtId : null
    const safeDepartmentId = departmentId && departmentId !== "undefined" ? departmentId : null

    if (profile.role === "staff") {
      query = query.eq("user_id", user.id)
    } else if (userId) {
      query = query.eq("user_id", userId)
    }
    // department_head, regional_manager, admin: department/location filtering handled below via
    // user_profiles subquery so we always get accurate results regardless of pagination.

    // If a location filter is selected, scope records by check_in_location_id
    if (safeLocationId) {
      query = query.eq("check_in_location_id", safeLocationId)
    }

    // If a department filter is provided, resolve the matching user IDs first,
    // then restrict the attendance query to those users. This works for all roles
    // (admin, regional_manager, department_head) and ensures location+dept filters combine correctly.
    if (safeDepartmentId && profile.role !== "staff") {
      let deptUsersQuery = supabase
        .from("user_profiles")
        .select("id")
        .eq("department_id", safeDepartmentId)

      // Department heads are further restricted to their own department (enforced above already
      // via profile.department_id check). For regional_manager we don't restrict by location here
      // because they can now see all locations.
      if (profile.role === "department_head") {
        deptUsersQuery = deptUsersQuery.eq("department_id", profile.department_id)
      }

      const { data: deptUsers } = await deptUsersQuery
      const deptUserIds = (deptUsers || []).map((u: any) => u.id)
      if (deptUserIds.length > 0) {
        query = query.in("user_id", deptUserIds)
      } else {
        // No users in this department → return empty result set
        query = query.eq("user_id", "00000000-0000-0000-0000-000000000000")
      }
    } else if (profile.role === "department_head" && !safeDepartmentId) {
      // Department head with no specific department filter: scope to their own department
      const { data: deptUsers } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("department_id", profile.department_id)
      const deptUserIds = (deptUsers || []).map((u: any) => u.id)
      if (deptUserIds.length > 0) {
        query = query.in("user_id", deptUserIds)
      } else {
        query = query.eq("user_id", "00000000-0000-0000-0000-000000000000")
      }
    }

    // Apply ordering and pagination
    const pageParam = searchParams.get("page")
    const pageSizeParam = searchParams.get("page_size")
    const exportMode = searchParams.get("export") === "true"
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1
    // Cap normal page size at 200 for UI performance; export mode fetches in large chunks
    const pageSize = exportMode
      ? Math.min(1000, pageSizeParam ? parseInt(pageSizeParam, 10) || 1000 : 1000)
      : Math.min(200, pageSizeParam ? parseInt(pageSizeParam, 10) || 50 : 50)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize - 1

    const { data: attendanceRecords, error } = await query.order("check_in_time", { ascending: false }).range(startIndex, endIndex)

    if (error) {
      console.error("[v0] Reports API - Error fetching attendance records:", error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const userIds = new Set(attendanceRecords.map((record) => record.user_id))

    // Use admin client to bypass RLS when fetching user_profiles
    const adminClient = await createAdminClient()

    // Fetch ALL user_profiles via admin client (no RLS, no .in() size limit)
    let userProfiles: any[] = []
    const { data: allProfiles, error: profileError } = await adminClient
      .from("user_profiles")
      .select(`id, first_name, last_name, email, employee_id, department_id, assigned_location_id`)
    if (profileError) {
      console.error("[v0] Reports API - Error fetching user profiles:", profileError)
    }
    // Only keep profiles relevant to this batch of attendance records
    userProfiles = (allProfiles || []).filter(p => userIds.has(p.id))

  // Enrich profiles with department and location names
  // Use admin client to bypass RLS for department/location lookups
  if (userProfiles.length > 0) {
    const deptIds = [...new Set(userProfiles.map(p => p.department_id).filter(Boolean))]
    const locIds  = [...new Set(userProfiles.map(p => p.assigned_location_id).filter(Boolean))]
    const deptMap = new Map<string, any>()
    const locMap  = new Map<string, any>()
    
    if (deptIds.length > 0) {
      const { data: depts, error: deptError } = await adminClient.from("departments").select("id, name, code").in("id", deptIds)
      if (!deptError) {
        depts?.forEach(d => deptMap.set(d.id, d))
      } else {
        console.error("[v0] Reports API - Department fetch error:", deptError)
      }
    }
    if (locIds.length > 0) {
      const { data: locs, error: locError } = await adminClient.from("geofence_locations").select("id, name, address, district_id").in("id", locIds)
      if (!locError) {
        locs?.forEach(l => locMap.set(l.id, l))
      } else {
        console.error("[v0] Reports API - Location fetch error:", locError)
      }
    }
    
    userProfiles = userProfiles.map(profile => {
      const dept = profile.department_id ? deptMap.get(profile.department_id) : null
      const loc = profile.assigned_location_id ? locMap.get(profile.assigned_location_id) : null
      
      return {
        ...profile,
        departments: dept,
        assigned_location: loc,
      }
    })
    
    // Log any profiles still missing departments after the mapping
    const stillMissingDept = userProfiles.filter(p => p.department_id && !p.departments)
    if (stillMissingDept.length > 0) {
      console.warn("[v0] Reports API - Profiles with department_id but missing department data:", {
        count: stillMissingDept.length,
        examples: stillMissingDept.slice(0, 5).map(p => ({ id: p.id, department_id: p.department_id }))
      })
    }
  }

    const userMap = new Map(userProfiles.map((u) => [u.id, u]))

    // For records with no matching profile, fall back to auth.users (paginate all pages)
    const missingIds = [...userIds].filter(id => !userMap.has(id))
    const authUserMap = new Map<string, { email?: string | null, first_name: string, last_name: string, employee_id: string }>()
    if (missingIds.length > 0) {
      try {
        let page = 1
        const perPage = 1000
        while (true) {
          const { data: authPage } = await adminClient.auth.admin.listUsers({ page, perPage })
          const users = authPage?.users || []
          users.forEach((u) => {
            if (missingIds.includes(u.id)) {
              const meta = u.user_metadata || {}
              let fn = meta.first_name || meta.name?.split(' ')[0] || ''
              let ln = meta.last_name  || meta.name?.split(' ').slice(1).join(' ') || ''
              if (!fn && u.email) {
                const parts = u.email.split('@')[0].split(/[._-]/).filter(Boolean)
                fn = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : ''
                ln = parts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
              }
              authUserMap.set(u.id, {
                email: u.email,
                first_name: fn || 'Unknown',
                last_name: ln || 'User',
                employee_id: meta.employee_id || u.id.slice(0, 8).toUpperCase(),
              })
            }
          })
          if (users.length < perPage) break
          page++
        }
      } catch (authErr) {
        console.error('[v0] Reports API - Failed to fetch auth users:', authErr)
      }
    }

    // All department and location filtering is now done at the DB query level above.
    // Post-fetch we only need district filtering (no DB column to filter on directly).
    let filteredRecords = attendanceRecords

    if (safeDistrictId) {
      filteredRecords = filteredRecords.filter((record) => {
        const user = userMap.get(record.user_id)
        return (
          user?.assigned_location?.district_id === safeDistrictId ||
          record.check_in_location?.district_id === safeDistrictId
        )
      })
    }

    console.log("[v0] Reports API - After filtering:", filteredRecords.length, "records")

    // Diagnostic: if we fetched records but filtering removed all of them, log helpful details
    if ((attendanceRecords?.length || 0) > 0 && filteredRecords.length === 0) {
      try {
        console.warn("[v0] Reports API - Filtering removed all fetched records — diagnostic info:", {
          userRole: profile?.role,
          profileDepartmentId: profile?.department_id,
          requestDepartmentId: departmentId,
          requestDistrictId: districtId,
          fetchedAttendanceCount: attendanceRecords.length,
          attendanceUserIds: userIds,
          foundUserProfilesCount: (userProfiles || []).length,
          userProfilesPreview: (userProfiles || []).slice(0, 10).map((u: any) => ({ id: u.id, department_id: u.department_id, assigned_location_id: u.assigned_location_id }))
        })
      } catch (diagErr) {
        console.error('[v0] Reports API - Diagnostic logging failed:', diagErr)
      }
    }

    const enrichedRecords = filteredRecords.map((record) => {
      const userProfile = userMap.get(record.user_id) || null

      // Determine if check-in/check-out was outside assigned location
      const isCheckInOutsideLocation =
        userProfile?.assigned_location_id && record.check_in_location_id !== userProfile.assigned_location_id

      const isCheckOutOutsideLocation =
        userProfile?.assigned_location_id &&
        record.check_out_location_id &&
        record.check_out_location_id !== userProfile.assigned_location_id

      // If no profile, use enriched auth user data as fallback
      const authUser = authUserMap.get(record.user_id)
      const enrichedProfile = userProfile || (authUser ? { 
        id: record.user_id,
        email: authUser.email,
        first_name: authUser.first_name,
        last_name: authUser.last_name,
        employee_id: authUser.employee_id,
        departments: null,
        assigned_location: null
      } : null)

      return {
        ...record,
        user_profiles: enrichedProfile,
        is_check_in_outside_location: isCheckInOutsideLocation,
        is_check_out_outside_location: isCheckOutOutsideLocation,
        // Keep backward compatibility
        geofence_locations: record.check_in_location,
      }
    })

    // Diagnostic: Log sample of enriched records to verify department data is present
    const sampleRecords = enrichedRecords.slice(0, 5)
    const withDepts = sampleRecords.filter(r => r.user_profiles?.departments?.name).length
    const withoutDepts = sampleRecords.filter(r => !r.user_profiles?.departments?.name).length
    if (sampleRecords.length > 0) {
      console.log("[v0] Reports API - Department enrichment check:", {
        sampleSize: sampleRecords.length,
        withDepartments: withDepts,
        withoutDepartments: withoutDepts,
        examples: sampleRecords.slice(0, 3).map(r => ({
          userId: r.user_id,
          employeeName: r.user_profiles ? `${r.user_profiles.first_name} ${r.user_profiles.last_name}` : "N/A",
          departmentId: r.user_profiles?.department_id,
          departmentName: r.user_profiles?.departments?.name || "N/A"
        }))
      })
    }

    // --- audit: if any attendance rows are missing user_profiles, write an audit log so admins can track and fix ---
    const missingProfiles = enrichedRecords.filter((r) => !r.user_profiles)
    if (missingProfiles.length > 0) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'missing_user_profiles_detected',
          table_name: 'attendance_records',
          details: { missing_count: missingProfiles.length, examples: missingProfiles.slice(0,10).map(m => ({ id: m.id, user_id: m.user_id })) },
          ip_address: (request as any).ip || request.headers.get('x-forwarded-for') || null,
          user_agent: request.headers.get('user-agent')
        })
      } catch (auditErr) {
        console.error('[v0] Reports API - Failed to write missing_user_profiles audit log:', auditErr)
      }
    }

    // Calculate summary statistics
    // Calculate total matching records (without pagination)
    // Use filtered record count as total (accurate because DB-level filters applied above)
    let totalRecords = filteredRecords.length
    try {
      // Build a count query that mirrors the main query filters exactly
      let countQuery = supabase
        .from("attendance_records")
        .select("id", { count: "exact", head: true })
        .gte("check_in_time", `${startDate}T00:00:00`)
        .lte("check_in_time", `${endDate}T23:59:59`)

      if (profile.role === "staff") {
        countQuery = countQuery.eq("user_id", user.id)
      } else if (userId) {
        countQuery = countQuery.eq("user_id", userId)
      }
      if (safeLocationId) countQuery = countQuery.eq("check_in_location_id", safeLocationId)

      // Mirror department user scoping for the count
      if (safeDepartmentId && profile.role !== "staff") {
        let deptUsersCountQuery = supabase
          .from("user_profiles")
          .select("id")
          .eq("department_id", safeDepartmentId)
        if (profile.role === "department_head") {
          deptUsersCountQuery = deptUsersCountQuery.eq("department_id", profile.department_id)
        }
        const { data: deptUsersCount } = await deptUsersCountQuery
        const deptUserIdsCount = (deptUsersCount || []).map((u: any) => u.id)
        if (deptUserIdsCount.length > 0) {
          countQuery = countQuery.in("user_id", deptUserIdsCount)
        } else {
          countQuery = countQuery.eq("user_id", "00000000-0000-0000-0000-000000000000")
        }
      } else if (profile.role === "department_head" && !safeDepartmentId) {
        const { data: deptUsersCount } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("department_id", profile.department_id)
        const deptUserIdsCount = (deptUsersCount || []).map((u: any) => u.id)
        if (deptUserIdsCount.length > 0) {
          countQuery = countQuery.in("user_id", deptUserIdsCount)
        } else {
          countQuery = countQuery.eq("user_id", "00000000-0000-0000-0000-000000000000")
        }
      }

      const { count: countResult, error: countError } = await countQuery
      if (countError) {
        console.error("[v0] Reports API - Count query error:", countError)
      } else {
        totalRecords = countResult || 0
      }
    } catch (err) {
      console.error("[v0] Reports API - Count exception:", err)
    }

    const totalWorkHours = enrichedRecords.reduce((sum, record) => sum + (record.work_hours || 0), 0)
    const averageWorkHours = totalRecords > 0 ? totalWorkHours / totalRecords : 0

    // Group by status
    const statusCounts = enrichedRecords.reduce(
      (acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    // Group by department
    const departmentStats = enrichedRecords.reduce(
      (acc, record) => {
        const deptName = record.user_profiles?.departments?.name || "Unknown"
        if (!acc[deptName]) {
          acc[deptName] = { count: 0, totalHours: 0 }
        }
        acc[deptName].count += 1
        acc[deptName].totalHours += record.work_hours || 0
        return acc
      },
      {} as Record<string, { count: number; totalHours: number }>,
    )

    console.log("[v0] Reports API - Returning", totalRecords, "records with summary")

    return NextResponse.json(
      {
        success: true,
        data: {
          records: enrichedRecords,
          summary: {
            totalRecords,
            totalWorkHours: Math.round(totalWorkHours * 100) / 100,
            averageWorkHours: Math.round(averageWorkHours * 100) / 100,
            statusCounts,
            departmentStats,
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate, private",
          Pragma: "no-cache",
          Expires: "0",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
    )
  } catch (error) {
    console.error("[v0] Reports API - Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    )
  }
}
