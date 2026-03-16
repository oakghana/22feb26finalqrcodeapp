import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { OffPremisesStatisticsDashboard } from "@/components/admin/offpremises-statistics-dashboard"

export const metadata = {
  title: "Off-Premises Statistics | QCC Electronic Attendance",
  description: "Monitor off-premises check-in statistics and metrics",
}

export const dynamic = "force-dynamic"

export default async function OffPremisesStatisticsPage() {
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
          <OffPremisesStatisticsDashboard />
        </div>
      </div>
    )
  } catch (error) {
    console.error("[v0] Error loading statistics page:", error)
    redirect("/dashboard")
  }
}
