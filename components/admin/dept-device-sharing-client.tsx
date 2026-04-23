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
import { RefreshCw, ShieldAlert, Users, AlertTriangle, CheckCircle2, Smartphone, MapPin } from "lucide-react"

interface Session {
  user_id: string
  name: string
  email: string
  location: string
  timestamp: string
}

interface SharedDevice {
  device_id: string
  user_count: number
  risk_level: "critical" | "high" | "medium" | "low"
  suspicion_reason: string
  sessions: Session[]
  same_location_sessions: Array<{
    user_id: string
    location: string
    timestamp: string
  }>
  first_detected: string
  last_detected: string
}

interface DeptData {
  data: SharedDevice[]
}

export function DeptDeviceSharingClient() {
  const [data, setData] = useState<SharedDevice[]>([])
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

      setData(result.data || [])
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
        return <Badge variant="destructive">Critical Risk</Badge>
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600">High Risk</Badge>
      case "medium":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Medium Risk</Badge>
      default:
        return <Badge variant="secondary">Low Risk</Badge>
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Department Device Sharing</h1>
          <p className="text-muted-foreground">
            Location-aware device sharing analysis for your department
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
            <CardTitle className="text-sm font-medium">Suspicious Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.length}</div>
            <p className="text-xs text-muted-foreground">Devices flagged in last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Violations</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.filter((d) => d.risk_level === "critical").length}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate investigation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            {data.length > 0 ? (
              <ShieldAlert className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.length > 0 ? "Violations Found" : "All Clear"}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days monitoring
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
            Devices used by multiple staff members. Location analysis helps identify genuine sharing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">No Device Sharing Detected</h3>
              <p className="text-muted-foreground max-w-md mt-2">
                No suspicious device sharing patterns detected in your department. All staff appear to be using unique devices.
              </p>
            </div>
          ) : (
            <Tabs defaultValue={`device-0`} className="w-full">
              <TabsList className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-6 w-full">
                {data.map((device, index) => (
                  <TabsTrigger key={device.device_id} value={`device-${index}`} className="text-xs">
                    <Smartphone className="h-3 w-3 mr-1" />
                    <span className="hidden sm:inline">Device {index + 1}</span>
                    <span className="sm:hidden">D{index + 1}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {data.map((device, index) => (
                <TabsContent key={device.device_id} value={`device-${index}`} className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex flex-col flex-1">
                        <span className="font-mono text-sm font-medium break-all">{device.device_id}</span>
                        <span className="text-xs text-muted-foreground mt-1">{device.user_count} users detected</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-2">{device.suspicion_reason}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getRiskBadge(device.risk_level)}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Risk Level</p>
                      <p className="text-sm font-medium capitalize">{device.risk_level}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">First Detected</p>
                      <p className="text-sm font-medium">{formatDate(device.first_detected)}</p>
                    </div>
                    <div className="rounded-lg border p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Last Activity</p>
                      <p className="text-sm font-medium">{formatDate(device.last_detected)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      All Device Sessions ({device.sessions.length})
                    </h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Location
                          </TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {device.sessions.map((session, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{session.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{session.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{session.location}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(session.timestamp)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {device.same_location_sessions.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                      <h4 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        ⚠️ HIGHEST SUSPICION: Same Location Usage
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                        Multiple staff members used this device at the SAME physical location. This is the strongest indicator of unauthorized device sharing:
                      </p>
                      <div className="mt-3 space-y-2">
                        {device.same_location_sessions.map((session, idx) => (
                          <div key={idx} className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {session.location} — {formatDate(session.timestamp)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Action Required
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {device.same_location_sessions.length > 0
                        ? "This device was used by multiple staff at the same location. Investigate immediately and take appropriate disciplinary action if unauthorized sharing is confirmed."
                        : "While these staff used the same device, they were at different locations. Investigate if this is legitimate device sharing or device fingerprint error."}
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
