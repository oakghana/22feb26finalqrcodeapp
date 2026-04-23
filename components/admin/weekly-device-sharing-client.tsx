"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ChevronLeft, Smartphone, Users, Calendar, MapPin, Filter, X, Trash2 } from "lucide-react"
import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface SharedDevice {
  device_id: string
  ip_address: string | null
  user_count: number
  risk_level: "low" | "medium" | "high" | "critical"
  users: Array<{
    user_id: string
    first_name: string
    last_name: string
    email: string
    department_name: string
    last_used: string
  }>
  first_detected: string
  last_detected: string
}

interface Location {
  id: string
  name: string
}

interface Department {
  id: string
  name: string
}

interface WeeklyDeviceSharingClientProps {
  userRole: string
  departmentId?: string
}

export default function WeeklyDeviceSharingClient({ userRole, departmentId }: WeeklyDeviceSharingClientProps) {
  const [sharedDevices, setSharedDevices] = useState<SharedDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearStartDate, setClearStartDate] = useState<string>("")
  const [clearEndDate, setClearEndDate] = useState<string>("")
  const [clearing, setClearing] = useState(false)
  
  // Filter states
  const [selectedLocation, setSelectedLocation] = useState<string>("all")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

  useEffect(() => {
    fetchLocations()
    fetchDepartments()
    fetchSharedDevices()
  }, [])

  useEffect(() => {
    fetchSharedDevices()
  }, [selectedLocation, selectedDepartment, startDate, endDate])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/locations/active")
      const data = await response.json()
      setLocations(data.locations || [])
    } catch (err) {
      console.error("[v0] Error fetching locations:", err)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/admin/departments")
      const data = await response.json()
      setDepartments(data.data || [])
    } catch (err) {
      console.error("[v0] Error fetching departments:", err)
    }
  }

  const fetchSharedDevices = async () => {
    try {
      setLoading(true)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (selectedLocation !== "all") params.append("location_id", selectedLocation)
      if (selectedDepartment !== "all") params.append("department_id", selectedDepartment)
      if (startDate) params.append("start_date", startDate)
      if (endDate) params.append("end_date", endDate)
      
      const url = `/api/admin/weekly-device-sharing${params.toString() ? `?${params.toString()}` : ""}`
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch device sharing data")
      }

      setSharedDevices(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setSelectedLocation("all")
    setSelectedDepartment("all")
    setStartDate("")
    setEndDate("")
  }

  const hasActiveFilters = selectedLocation !== "all" || selectedDepartment !== "all" || startDate || endDate

  const handleClearViolationData = async () => {
    if (!clearStartDate || !clearEndDate) {
      alert("Please select both start and end dates")
      return
    }

    if (new Date(clearStartDate) > new Date(clearEndDate)) {
      alert("Start date cannot be after end date")
      return
    }

    try {
      setClearing(true)
      const response = await fetch("/api/admin/clear-device-violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: clearStartDate + "T00:00:00Z",
          end_date: clearEndDate + "T23:59:59Z",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to clear violation data")
      }

      alert(`Successfully cleared ${data.records_deleted} device session records`)
      setShowClearDialog(false)
      setClearStartDate("")
      setClearEndDate("")
      fetchSharedDevices()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error clearing violation data")
    } finally {
      setClearing(false)
    }
  }

  const getRiskBadge = (level: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    }

    return <Badge className={colors[level as keyof typeof colors] || colors.low}>{level.toUpperCase()}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading device sharing data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold">Weekly Device Sharing Report</h1>
          <p className="text-muted-foreground">Devices used by multiple staff members</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowFilters(!showFilters)} variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters {hasActiveFilters && <Badge className="ml-2" variant="secondary">Active</Badge>}
          </Button>
          <Button onClick={fetchSharedDevices} variant="outline">
            Refresh Data
          </Button>
          {userRole === "admin" && (
            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Violation Data
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear Violation Data</DialogTitle>
                  <DialogDescription>
                    Select a date range to clear all device violation records. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clear-start">Start Date</Label>
                    <Input
                      id="clear-start"
                      type="date"
                      value={clearStartDate}
                      onChange={(e) => setClearStartDate(e.target.value)}
                      max={clearEndDate || undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clear-end">End Date</Label>
                    <Input
                      id="clear-end"
                      type="date"
                      value={clearEndDate}
                      onChange={(e) => setClearEndDate(e.target.value)}
                      min={clearStartDate || undefined}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>
                      This will permanently delete all device session records from the selected date range. This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => setShowClearDialog(false)}
                    disabled={clearing}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleClearViolationData}
                    disabled={clearing || !clearStartDate || !clearEndDate}
                    variant="destructive"
                  >
                    {clearing ? "Clearing..." : "Clear Data"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Filter Options</span>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="ghost" size="sm">
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Location Filter */}
              <div className="space-y-2">
                <Label htmlFor="location-filter">Location</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger id="location-filter">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="department-filter">Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger id="department-filter">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  max={endDate || undefined}
                />
              </div>

              {/* End Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Alert */}
      {sharedDevices.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Device Sharing Detected</AlertTitle>
          <AlertDescription>
            {sharedDevices.length} device{sharedDevices.length !== 1 ? "s have" : " has"} been used by multiple staff
            members this week. Review the details below and investigate suspicious activity.
          </AlertDescription>
        </Alert>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Data State */}
      {!loading && !error && sharedDevices.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Smartphone className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Shared Devices Detected</h3>
              <p className="text-muted-foreground">
                No devices have been used by multiple staff members in the past 7 days.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shared Devices List */}
      <div className="grid gap-6">
        {sharedDevices.map((device, index) => (
          <Card
            key={index}
            className="border-l-4"
            style={{
              borderLeftColor:
                device.risk_level === "critical"
                  ? "#dc2626"
                  : device.risk_level === "high"
                    ? "#ea580c"
                    : device.risk_level === "medium"
                      ? "#ca8a04"
                      : "#3b82f6",
            }}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Device: {device.device_id.slice(0, 16)}...
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    IP Address: {device.ip_address}
                  </CardDescription>
                </div>
                {getRiskBadge(device.risk_level)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{device.user_count} Different Users</p>
                    <p className="text-xs text-muted-foreground">Used this device</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Last 7 Days</p>
                    <p className="text-xs text-muted-foreground">Activity period</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Security Risk</p>
                    <p className="text-xs text-muted-foreground">{device.risk_level} level</p>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Staff Members Using This Device:</h4>
                <div className="space-y-2">
                  {device.users && device.users.length > 0 ? (
                    device.users.map((user, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <Badge variant="outline">{user.department_name || "N/A"}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No user details available</p>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>First Activity: {new Date(device.first_detected).toLocaleString()}</span>
                  <span>Last Activity: {new Date(device.last_detected).toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
