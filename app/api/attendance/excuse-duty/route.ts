import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Excuse duty API - Starting request")

    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] Excuse duty API - Authentication failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Excuse duty API - User authenticated:", user.id)

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    const excuseDate = formData.get("excuseDate") as string
    const documentType = formData.get("documentType") as string
    const excuseReason = formData.get("excuseReason") as string

    if (!file || !excuseDate || !documentType || !excuseReason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate file
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 })
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 })
    }

    // Convert file to base64 for storage (in a real app, you'd use proper file storage like Supabase Storage)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64File = buffer.toString("base64")
    const fileUrl = `data:${file.type};base64,${base64File}`

    console.log("[v0] Excuse duty API - File processed:", file.name, file.type, file.size)

    // Check if there's an attendance record for this date
    const startOfDay = `${excuseDate}T00:00:00`
    const endOfDay = `${excuseDate}T23:59:59`

    const { data: attendanceRecords } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("user_id", user.id)
      .gte("check_in_time", startOfDay)
      .lte("check_in_time", endOfDay)
      .limit(1)

    const attendanceRecord = attendanceRecords?.[0] || null

    console.log("[v0] Excuse duty API - Attendance record check:", attendanceRecord?.id || "none")

    // Insert excuse document
    const { data: excuseDoc, error: insertError } = await supabase
      .from("excuse_documents")
      .insert({
        user_id: user.id,
        attendance_record_id: attendanceRecord?.id || null,
        document_name: file.name,
        document_type: documentType,
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        excuse_reason: excuseReason,
        excuse_date: excuseDate,
        status: "pending",
      })
      .select()
      .single()

    if (insertError) {
      console.error("[v0] Excuse duty API - Insert error:", insertError)
      return NextResponse.json({ error: "Failed to save excuse document" }, { status: 500 })
    }

    console.log("[v0] Excuse duty API - Document saved:", excuseDoc.id)

    // Update attendance record notes if it exists
    if (attendanceRecord) {
      const { error: updateError } = await supabase
        .from("attendance_records")
        .update({
          notes: `Excuse duty note submitted: ${documentType} - ${excuseReason}`,
          status: "absent", // Mark as absent with excuse
        })
        .eq("id", attendanceRecord.id)

      if (updateError) {
        console.error("[v0] Excuse duty API - Update attendance error:", updateError)
      } else {
        console.log("[v0] Excuse duty API - Attendance record updated")
      }
    }

    // Get user profile to find approvers
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("department_id, first_name, last_name, employee_id")
      .eq("id", user.id)
      .single()

    if (userProfile) {
      // Collect all approvers: admins + department heads for this dept + all regional managers
      const approversMap: Record<string, any> = {}
      const addUnique = (arr: any[] | null) => {
        (arr || []).forEach((a) => { if (a?.id) approversMap[a.id] = a })
      }

      const [adminsResult, deptHeadsResult, regionalResult] = await Promise.all([
        supabase.from("user_profiles").select("id, first_name, last_name").eq("role", "admin").eq("is_active", true),
        userProfile.department_id
          ? supabase.from("user_profiles").select("id, first_name, last_name, email").eq("role", "department_head").eq("department_id", userProfile.department_id).eq("is_active", true)
          : Promise.resolve({ data: [] }),
        supabase.from("user_profiles").select("id, first_name, last_name").eq("role", "regional_manager").eq("is_active", true),
      ])

      addUnique(adminsResult.data)
      addUnique(deptHeadsResult.data as any[])
      addUnique(regionalResult.data)

      const approvers = Object.values(approversMap)

      if (approvers.length > 0) {
        const notifications = approvers.map((approver: any) => ({
          recipient_id: approver.id,
          type: "excuse_duty_request",
          title: "Excuse Duty Submission",
          message: `${userProfile.first_name} ${userProfile.last_name} (${userProfile.employee_id || 'N/A'}) submitted an excuse duty note for ${new Date(excuseDate).toLocaleDateString()}. Type: ${documentType}. Reason: ${excuseReason}`,
          data: {
            excuse_doc_id: excuseDoc.id,
            staff_user_id: user.id,
            staff_name: `${userProfile.first_name} ${userProfile.last_name}`,
            excuse_date: excuseDate,
            document_type: documentType,
            reason: excuseReason,
          },
          is_read: false,
        }))

        const { error: notifError } = await supabase.from("staff_notifications").insert(notifications)
        if (notifError) {
          console.warn("[v0] Excuse duty API - Failed to insert staff_notifications:", notifError)
        } else {
          console.log("[v0] Excuse duty API - Notifications sent to", approvers.length, "approvers")
        }
      }

      // Also send email to department head (legacy)
      if (deptHeadsResult.data && (deptHeadsResult.data as any[]).length > 0) {
        const departmentHead = (deptHeadsResult.data as any[])[0]
        await supabase.from("email_notifications").insert({
          user_id: departmentHead.id,
          email_type: "excuse_duty_review",
          subject: "New Excuse Duty Submission for Review",
          body: `A new excuse duty submission requires your review:\n\nStaff Member: ${userProfile.first_name} ${userProfile.last_name} (${userProfile.employee_id})\nDate of Absence: ${new Date(excuseDate).toLocaleDateString()}\nDocument Type: ${documentType}\nReason: ${excuseReason}\n\nPlease log in to the system to review and approve this submission.`,
          status: "pending",
        })
        console.log("[v0] Excuse duty API - Email notification sent to department head")
      }
    }

    // Log the action
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "excuse_duty_submitted",
      table_name: "excuse_documents",
      record_id: excuseDoc.id,
      new_values: {
        excuse_date: excuseDate,
        document_type: documentType,
        status: "pending",
      },
    })

    console.log("[v0] Excuse duty API - Success")

    return NextResponse.json({
      success: true,
      message: "Excuse duty note submitted successfully",
      id: excuseDoc.id,
    })
  } catch (error) {
    console.error("[v0] Excuse duty API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[v0] Excuse duty GET API - Starting request")

    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      console.log("[v0] Excuse duty GET API - Authentication failed")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[v0] Excuse duty GET API - User authenticated:", user.id)

    // Get excuse documents without trying to use a non-existent relationship
    const { data: excuseDocs, error } = await supabase
      .from("excuse_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[v0] Excuse duty GET API - Query error:", error.message)
      return NextResponse.json({ error: "Failed to fetch excuse documents" }, { status: 500 })
    }

    const docsWithReviewers = await Promise.all(
      (excuseDocs || []).map(async (doc) => {
        if (doc.reviewed_by) {
          const { data: reviewer } = await supabase
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("id", doc.reviewed_by)
            .single()

          return {
            ...doc,
            reviewed_by_profile: reviewer,
          }
        }
        return {
          ...doc,
          reviewed_by_profile: null,
        }
      }),
    )

    console.log("[v0] Excuse duty GET API - Found documents:", docsWithReviewers.length)

    return NextResponse.json({ excuseDocuments: docsWithReviewers })
  } catch (error) {
    console.error("[v0] Excuse duty GET API - Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
