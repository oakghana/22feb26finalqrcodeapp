import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OffPremisesActivityReport } from "@/components/admin/offpremises-activity-report"

export const metadata = {
  title: "Off-Premises Report | QCC Electronic Attendance",
  description: "Comprehensive activity report for off-premises check-ins",
}

export const dynamic = "force-dynamic"

export default async function OffPremisesReportPage() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      redirect("/auth/login")
    }

    // Check if user is a manager
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profileError || !userProfile) {
      redirect("/dashboard")
    }

    if (!["admin", "department_head", "regional_manager"].includes(userProfile.role)) {
      redirect("/dashboard")
    }

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4">
          <OffPremisesActivityReport />
        </div>
      </div>
    )
  } catch (error) {
    console.error("[v0] Error loading report page:", error)
    redirect("/dashboard")
  }
}
