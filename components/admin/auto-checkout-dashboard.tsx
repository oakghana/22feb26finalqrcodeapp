"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Clock, AlertCircle, CheckCircle2, Filter, Download } from "lucide-react"

interface AutoCheckoutRecord {
  id: string
  user_id: string
  user_name: string
  user_profiles: {
    email: string
    employee_id: string
  }
  check_in_time: string
  check_out_time: string
  auto_checkout_reason: string
  notes: string
  hours_worked: number
  created_at: string
}

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AutoCheckoutDashboard() {
  const [records, setRecords] = useState<AutoCheckoutRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    userId: "",
  })
  const [sortBy, setSortBy] = useState("created_at")
  const [sortOrder, setSortOrder] = useState("desc")

  const fetchRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.append("page", String(page))
      params.append("limit", String(limit))
      params.append("sortBy", sortBy)
      params.append("sortOrder", sortOrder)

      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.append("dateTo", filters.dateTo)
      if (filters.userId) params.append("userId", filters.userId)

      const response = await fetch(`/api/admin/auto-checkout-logs?${params}`)
      const result = await response.json()

      if (result.success) {
        setRecords(result.data)
        setPagination(result.pagination)
      } else {
        console.error("Failed to fetch logs:", result.error)
      }
    } catch (error) {
      console.error("Error fetching auto-checkout logs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [page, limit, sortBy, sortOrder])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filtering
  }

  const handleApplyFilters = () => {
    setPage(1)
    fetchRecords()
  }

  const handleExport = () => {
    if (records.length === 0) return

    const csv = [
      ["User Name", "Email", "Employee ID", "Check-in Time", "Check-out Time", "Hours Worked", "Reason", "Notes"],
      ...records.map((r) => [
        r.user_name,
        r.user_profiles.email,
        r.user_profiles.employee_id,
        new Date(r.check_in_time).toLocaleString(),
        new Date(r.check_out_time).toLocaleString(),
        r.hours_worked,
        r.auto_checkout_reason,
        r.notes || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `auto-checkout-logs-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Clock className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Auto-Checkout Logs</h1>
            <p className="text-muted-foreground">View all automatic staff checkouts outside geofence locations</p>
          </div>
        </div>

        {pagination && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">Total Auto-Checkouts: {pagination.total}</p>
              <p className="text-xs mt-1">
                Staff members who worked more than 7 hours and were outside registered locations were automatically checked out at 5:30 PM.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-slate-50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input
                placeholder="Search by user ID"
                value={filters.userId}
                onChange={(e) => handleFilterChange("userId", e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className="flex-1">
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Auto-Checkout Records</CardTitle>
            <CardDescription>
              {pagination ? `Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, pagination.total)} of ${pagination.total} records` : ""}
            </CardDescription>
          </div>
          <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-medium">No auto-checkout records</p>
              <p className="text-sm text-muted-foreground">No staff were automatically checked out during this period</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Auto-Checkout</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.user_name}</TableCell>
                        <TableCell className="text-sm">{record.user_profiles.email}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(record.check_in_time).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(record.check_out_time).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{record.hours_worked.toFixed(2)}h</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-orange-100 text-orange-800">Outside Location</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
