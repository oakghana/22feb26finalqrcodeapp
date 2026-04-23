import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DeptDeviceSharingClient } from "@/components/admin/dept-device-sharing-client"

export default async function DeptDeviceSharingPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, department_id, departments(id, name, code)")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.role !== "department_head" && profile.role !== "admin")) {
    redirect("/dashboard")
  }

  return <DeptDeviceSharingClient />
}
