import { type NextRequest, NextResponse } from "next/server"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import "jspdf-autotable"

export async function POST(request: NextRequest) {
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Export timeout")), 60000) // 60 second timeout
    })

    const exportPromise = async () => {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Check admin role
      const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single()

      if (!profile || !["admin", "regional_manager", "department_head"].includes(profile.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
      }

      const { format, filters } = await request.json()
      const { startDate, endDate, locationId, districtId, reportType } = filters

      let attendanceQuery = supabase.from("attendance_records").select("*")

      if (startDate) {
        attendanceQuery = attendanceQuery.gte("check_in_time", `${startDate}T00:00:00`)
      }
      if (endDate) {
        attendanceQuery = attendanceQuery.lte("check_in_time", `${endDate}T23:59:59`)
      }
      if (locationId) {
        attendanceQuery = attendanceQuery.eq("check_in_location_id", locationId)
      }

      const { data: attendanceRecords, error: attendanceError } = await attendanceQuery.order("check_in_time", {
        ascending: false,
      })

      if (attendanceError) {
        console.error("Attendance fetch error:", attendanceError)
        return NextResponse.json({ error: attendanceError.message }, { status: 500 })
      }

      if (!attendanceRecords || attendanceRecords.length === 0) {
        return NextResponse.json({ error: "No attendance records found" }, { status: 404 })
      }

      const userIds = [...new Set(attendanceRecords.map((record) => record.user_id))]
      const locationIds = [...new Set(attendanceRecords.map((record) => record.check_in_location_id).filter(Boolean))]

      // Use admin client to bypass RLS for user_profiles (regular client blocked by RLS)
      const adminClient = await createAdminClient()

      // Fetch ALL user_profiles via admin client (no RLS, no .in() size limit)
      const userIdSet = new Set(userIds)
      const { data: allProfiles } = await adminClient
        .from("user_profiles")
        .select("id, first_name, last_name, employee_id, department_id")
      const userProfiles = (allProfiles || []).filter(p => userIdSet.has(p.id))

      // For missing user_ids, paginate through all auth.users as fallback
      const missingProfileIds = userIds.filter(id => !userProfiles.find(p => p.id === id))
      const authUserMap = new Map<string, {first_name: string, last_name: string, employee_id: string}>()
      if (missingProfileIds.length > 0) {
        try {
          let page = 1
          const perPage = 1000
          while (true) {
            const { data: authPage } = await adminClient.auth.admin.listUsers({ page, perPage })
            const users = authPage?.users || []
            users.forEach((u) => {
              if (missingProfileIds.includes(u.id)) {
                const meta = u.user_metadata || {}
                let fn = meta.first_name || ''
                let ln = meta.last_name || ''
                if (!fn && u.email) {
                  const parts = u.email.split('@')[0].split(/[._-]/).filter(Boolean)
                  fn = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase() : ''
                  ln = parts.slice(1).map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
                }
                authUserMap.set(u.id, {
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
          console.error('[v0] Export - Failed to fetch auth users:', authErr)
        }
      }

      // Merge profiles with auth fallback data
      const allUserProfiles = [
        ...userProfiles,
        ...Array.from(authUserMap.entries()).map(([userId, d]) => ({
          id: userId, first_name: d.first_name, last_name: d.last_name,
          employee_id: d.employee_id, department_id: null
        }))
      ]

      // Fetch departments
      const departmentIds = [...new Set(allUserProfiles.map(p => p.department_id).filter(Boolean))]
      const { data: departments } = await adminClient.from("departments").select("id, name").in("id", departmentIds)

      // Fetch locations
      const { data: locations } = await adminClient
        .from("geofence_locations")
        .select("id, name, address")
        .in("id", locationIds)

      // Build enriched profile map with department and location data
      const userProfileMap = new Map<string, any>()
      const departmentMap  = new Map(departments?.map((d) => [d.id, d]) || [])
      const locationMap    = new Map(locations?.map((l) => [l.id, l]) || [])
      
      allUserProfiles.forEach((profile) => {
        const enrichedProfile = {
          ...profile,
          departments: profile.department_id ? departmentMap.get(profile.department_id) : null,
        }
        userProfileMap.set(profile.id, enrichedProfile)
      })

      const exportData = attendanceRecords.map((record) => {
        const userProfile = userProfileMap.get(record.user_id)
        const department = userProfile?.departments
        const location = locationMap.get(record.check_in_location_id)

        // Ensure department is included in export, defaulting to "N/A" if missing
        const departmentName = department?.name || "N/A"

        return {
          "Employee ID": userProfile?.employee_id || "N/A",
          Name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : "N/A",
          Department: departmentName,
          District: "N/A", // District info not available in current schema
          Location: location?.name || "N/A",
          "Check In": new Date(record.check_in_time).toLocaleString(),
          "Check Out": record.check_out_time ? new Date(record.check_out_time).toLocaleString() : "Not checked out",
          Status: record.status,
          "Work Hours": record.work_hours || "0",
          Date: new Date(record.check_in_time).toLocaleDateString(),
          Comment: record.notes || "",
          Reason: record.early_checkout_reason || "",
        }
      })

      if (format === "excel") {
        try {
          const worksheet = XLSX.utils.json_to_sheet(exportData)
          const workbook = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report")

          const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })

          return new NextResponse(excelBuffer, {
            headers: {
              "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().split("T")[0]}.xlsx"`,
              "Content-Length": excelBuffer.byteLength.toString(),
            },
          })
        } catch (excelError) {
          console.error("Excel generation error:", excelError)
          return NextResponse.json({ error: "Failed to generate Excel file" }, { status: 500 })
        }
      } else if (format === "pdf") {
        try {
          const doc = new jsPDF()

          // Add title
          doc.setFontSize(16)
          doc.text("QCC Attendance Report", 20, 20)
          doc.setFontSize(10)
          doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 30)

          // Add table
          const tableData = exportData.map((row) => Object.values(row))
          const tableHeaders = Object.keys(exportData[0] || {})

          doc.autoTable({
            head: [tableHeaders],
            body: tableData,
            startY: 40,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] },
          })

          const pdfBuffer = doc.output("arraybuffer")

          return new NextResponse(pdfBuffer, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().split("T")[0]}.pdf"`,
              "Content-Length": pdfBuffer.byteLength.toString(),
            },
          })
        } catch (pdfError) {
          console.error("PDF generation error:", pdfError)
          return NextResponse.json({ error: "Failed to generate PDF file" }, { status: 500 })
        }
      } else if (format === "csv") {
        try {
          const csvHeaders = Object.keys(exportData[0] || {})
          const csvRows = exportData.map((row) =>
            csvHeaders
              .map((header) => {
                const value = row[header] || ""
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
                  return `"${value.replace(/"/g, '""')}"`
                }
                return value
              })
              .join(","),
          )

          const csvContent = [csvHeaders.join(","), ...csvRows].join("\n")
          const csvBuffer = Buffer.from(csvContent, "utf-8")

          return new NextResponse(csvBuffer, {
            headers: {
              "Content-Type": "text/csv",
              "Content-Disposition": `attachment; filename="attendance-report-${new Date().toISOString().split("T")[0]}.csv"`,
              "Content-Length": csvBuffer.byteLength.toString(),
            },
          })
        } catch (csvError) {
          console.error("CSV generation error:", csvError)
          return NextResponse.json({ error: "Failed to generate CSV file" }, { status: 500 })
        }
      }

      return NextResponse.json({ error: "Invalid format. Supported formats: excel, pdf, csv" }, { status: 400 })
    }

    return await Promise.race([exportPromise(), timeoutPromise])
  } catch (error) {
    console.error("Export error:", error)
    if (error instanceof Error && error.message === "Export timeout") {
      return NextResponse.json(
        { error: "Export request timed out. Please try with a smaller date range." },
        { status: 408 },
      )
    }
    return NextResponse.json({ error: "Export failed. Please try again." }, { status: 500 })
  }
}
