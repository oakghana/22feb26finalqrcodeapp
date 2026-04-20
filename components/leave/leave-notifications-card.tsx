"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface LeaveNotification {
  id: string
  leave_request_id: string
  user_id: string
  status: "pending" | "approved" | "dismissed"
  notification_type: string
  created_at: string
  leave_requests: {
    id: string
    start_date: string
    end_date: string
    reason: string
    leave_type: string
    status: string
  }
}

export function LeaveNotificationsCard() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<LeaveNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Get user profile to check role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, department_id")
        .eq("id", user.id)
        .single()

      if (!profile) return

      // Fetch pending leave notifications based on user role
      let query = supabase
        .from("leave_notifications")
        .select("*, leave_requests(*)")
        .eq("status", "pending")

      // Filter by user role
      if (profile.role === "staff") {
        query = query.eq("user_id", user.id)
      } else if (profile.role === "department_head") {
        // Department heads see pending requests from their staff
        query = query.not("status", "eq", "dismissed")
      } else if (profile.role === "regional_manager") {
        // Regional managers see all pending for their region
        query = query.not("status", "eq", "dismissed")
      }
      // Admin sees all

      const { data, error } = await query.order("created_at", { ascending: false })

      if (!error && data) {
        setNotifications(data as LeaveNotification[])
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveLeave = async (notificationId: string) => {
    setProcessingId(notificationId)
    try {
      const response = await fetch("/api/leave/approve-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: notificationId,
          action: "approve",
        }),
      })

      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error("Error approving leave:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDismissLeave = async (notificationId: string, reason: string) => {
    setProcessingId(notificationId)
    try {
      const response = await fetch("/api/leave/approve-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_id: notificationId,
          action: "dismiss",
          reason: reason || "Request dismissed by manager",
        }),
      })

      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error("Error dismissing leave:", error)
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <Card className="shadow-lg border-0 bg-gradient-to-br from-card via-card/95 to-card/90">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
            Leave Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8 sm:py-12">
          <Loader2 className="h-5 sm:h-6 w-5 sm:w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (notifications.length === 0) {
    return (
      <Card className="shadow-lg border-0 bg-gradient-to-br from-card via-card/95 to-card/90">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
            Leave Notifications
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">No pending leave requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 sm:py-12">
            <div className="w-12 sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-6 sm:h-8 w-6 sm:w-8 text-primary" />
            </div>
            <p className="text-base sm:text-lg font-medium text-muted-foreground">All caught up!</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">No pending leave notifications at this time.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-card via-card/95 to-card/90">
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 sm:h-5 w-4 sm:w-5 text-primary" />
              Leave Notifications
            </CardTitle>
            <CardDescription>
              {notifications.length} pending leave request{notifications.length !== 1 ? "s" : ""}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {notifications.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {notifications.map((notification) => {
          const isProcessing = processingId === notification.id
          const leave = notification.leave_requests

          return (
            <Alert key={notification.id} className="border-l-4 border-l-amber-500 bg-amber-50/50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <div className="space-y-3 w-full ml-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <AlertDescription className="text-foreground font-semibold text-base">
                      {leave.leave_type} Leave Request
                    </AlertDescription>
                    <p className="text-sm text-muted-foreground mt-1">
                      {leave.reason || "No reason provided"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      {format(new Date(leave.start_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">
                      {format(new Date(leave.end_date), "MMM dd, yyyy")}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApproveLeave(notification.id)}
                    disabled={isProcessing}
                    className="flex-1 gap-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDismissLeave(notification.id, "Request dismissed")}
                    disabled={isProcessing}
                    className="flex-1 gap-1"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Dismiss
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Alert>
          )
        })}
      </CardContent>
    </Card>
  )
}
