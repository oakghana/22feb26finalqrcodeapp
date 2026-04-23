"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { RefreshCw, ShieldAlert, Users, AlertTriangle, CheckCircle2, Smartphone } from "lucide-react"

interface SharedDevice {
  device_id: string
  user_count: number
  risk_level: "critical" | "high" | "medium" | "low"
  total_sessions: number
  first_detected: string
  last_activity: string
  users: {
    id: string
    name: string
    email: string
    employee_id: string
    sessionCount: number
    lastUsed: string
  }[]
}

interface DeptData {
  success: boolean
  department: { id: string; name: string; code: string }
  sharedDevices: SharedDevice[]
  totalSharedDevices: number
  totalStaffInDepartment: number
  dateRange: { start: string; end: string }
}

export function DeptDeviceSharingClient() {
  const [data, setData] = useState<DeptData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/dept-device-sharing")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data")
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Medium</Badge>
      default:
        return <Badge variant="secondary">Low</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={fetchData} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Device Sharing</h1>
          <p className="text-muted-foreground">
            Monitor device sharing violations in {data.department?.name || "your department"}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStaffInDepartment}</div>
            <p className="text-xs text-muted-foreground">Active staff in department</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalSharedDevices}</div>
            <p className="text-xs text-muted-foreground">Devices used by multiple staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {data.totalSharedDevices > 0 ? (
              <ShieldAlert className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalSharedDevices > 0 ? "Violations Found" : "All Clear"}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days monitoring period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Violations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Device Sharing Violations
          </CardTitle>
          <CardDescription>
            Staff members in your department who have been detected using the same device
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.sharedDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">No Device Sharing Detected</h3>
              <p className="text-muted-foreground max-w-md mt-2">
                No staff members in your department have been detected sharing devices in the last 7 days.
                Keep monitoring to ensure compliance.
              </p>
            </div>
          ) : (
            <Tabs defaultValue={`device-0`} className="w-full">
              <TabsList className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6 w-full">
                {data.sharedDevices.map((device, index) => (
                  <TabsTrigger key={device.device_id} value={`device-${index}`} className="text-xs">
                    <Smartphone className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Device {index + 1}</span>
                    <span className="sm:hidden">D{index + 1}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {data.sharedDevices.map((device, index) => (
                <TabsContent key={device.device_id} value={`device-${index}`} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-medium">{device.device_id}</span>
                        <span className="text-xs text-muted-foreground">{device.user_count} users sharing this device</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRiskBadge(device.risk_level)}
                      <Badge variant="outline">{device.total_sessions} sessions</Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">First Detected</p>
                      <p className="text-sm font-medium">{formatDate(device.first_detected)}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Last Activity</p>
                      <p className="text-sm font-medium">{formatDate(device.last_activity)}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Sessions</TableHead>
                        <TableHead>Last Used</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {device.users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.employee_id}</TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-right">{user.sessionCount}</TableCell>
                          <TableCell>
                            {user.lastUsed ? formatDate(user.lastUsed) : "N/A"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Action Required
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Please investigate why these staff members are using the same device.
                      If unauthorized device sharing is confirmed, take appropriate disciplinary action.
                    </p>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
