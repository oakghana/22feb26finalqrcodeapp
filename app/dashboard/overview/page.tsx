import { createClient } from "@/lib/supabase/server"
import { DashboardOverviewClient } from "./dashboard-overview-client"

export default async function DashboardOverviewPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Please log in</div>
  }

  // Get profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select(`
      *,
      departments (
        name,
        code
      )
    `)
    .eq("id", user.id)
    .maybeSingle()

  // Get today's attendance
  const today = new Date().toISOString().split("T")[0]
  const { data: todayData } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("check_in_time", `${today}T00:00:00`)
    .lt("check_in_time", `${today}T23:59:59`)
    .maybeSingle()

  // Get monthly attendance count
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count: monthCount } = await supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("check_in_time", startOfMonth)

  // Get pending approvals if admin
  let pendingApprovals = 0
  if (profile?.role === "admin") {
    const { count } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)
    pendingApprovals = count || 0
  }

  // Check for missed checkout from yesterday
  let missedCheckoutWarning = null
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStart = new Date(yesterday)
  yesterdayStart.setHours(0, 0, 0, 0)
  const yesterdayEnd = new Date(yesterday)
  yesterdayEnd.setHours(23, 59, 59, 999)

  const { data: unfinishedRecords } = await supabase
    .from("attendance_records")
    .select("id, check_in_time, check_out_time, created_at")
    .eq("user_id", user.id)
    .gte("created_at", yesterdayStart.toISOString())
    .lte("created_at", yesterdayEnd.toISOString())
    .is("check_out_time", null)
    .limit(1)

  if (unfinishedRecords && unfinishedRecords.length > 0) {
    const missedRecord = unfinishedRecords[0]
    missedCheckoutWarning = {
      type: "no_checkout",
      date: yesterday.toISOString().split("T")[0],
      message: "You did not check out yesterday before 11:59 PM",
      missedCheckInTime: missedRecord.check_in_time,
    }
  }

  return (
    <DashboardOverviewClient
      user={user}
      profile={profile}
      todayAttendance={todayData}
      monthlyAttendance={monthCount || 0}
      pendingApprovals={pendingApprovals}
      missedCheckoutWarning={missedCheckoutWarning}
    />
  )
}
