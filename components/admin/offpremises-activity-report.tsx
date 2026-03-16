'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertCircle,
  Download,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface ReportRecord {
  id: string
  staff_name: string
  email: string
  employee_id: string
  department_id: string
  location: string
  reason: string
  status: 'approved' | 'rejected' | 'pending'
  created_at: string
  approved_at: string | null
  rejection_reason?: string
  approved_by: string
}

interface ReportData {
  records: ReportRecord[]
  total: number
  page: number
  pageSize: number
  metrics: {
    approval_rate: number
    avg_approval_time_minutes: number
    approved_count: number
    rejected_count: number
    pending_count: number
  }
}

export function OffPremisesActivityReport() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [status, setStatus] = useState('all')
  const [staffSearch, setStaffSearch] = useState('')

  const pageSize = 50

  useEffect(() => {
    fetchReport()
  }, [page, dateFrom, dateTo, status, staffSearch])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        status,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
        ...(staffSearch && { staffSearch }),
      })

      const response = await fetch(`/api/admin/offpremises/report?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch report')
      }

      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch report')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!data?.records) return

    // Prepare CSV headers
    const headers = [
      'Staff Name',
      'Email',
      'Employee ID',
      'Location',
      'Reason',
      'Status',
      'Requested Date',
      'Approved Date',
      'Approved By',
      'Rejection Reason',
    ]

    // Prepare CSV rows
    const rows = data.records.map((record) => [
      record.staff_name,
      record.email,
      record.employee_id,
      record.location,
      record.reason,
      record.status,
      format(new Date(record.created_at), 'yyyy-MM-dd HH:mm'),
      record.approved_at ? format(new Date(record.approved_at), 'yyyy-MM-dd HH:mm') : 'N/A',
      record.approved_by,
      record.rejection_reason || 'N/A',
    ])

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `off-premises-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  const handleReset = () => {
    setDateFrom('')
    setDateTo('')
    setStatus('all')
    setStaffSearch('')
    setPage(0)
  }

  const hasFilters = dateFrom || dateTo || status !== 'all' || staffSearch

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Off-Premises Activity Report</h2>
        <p className="text-sm text-gray-500">Comprehensive historical report of all off-premises requests</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date From */}
            <div>
              <label className="text-sm font-medium">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(0)
                }}
                className="mt-1"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="text-sm font-medium">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(0)
                }}
                className="mt-1"
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={(val) => {
                setStatus(val)
                setPage(0)
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Staff Search */}
            <div>
              <label className="text-sm font-medium">Staff Search</label>
              <Input
                placeholder="Name, email, or ID"
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value)
                  setPage(0)
                }}
                className="mt-1"
              />
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <Button
                onClick={handleExportCSV}
                disabled={loading || !data?.records?.length}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {hasFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <X className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metrics Summary */}
      {!loading && data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-gray-500">Total Records</p>
              <p className="text-xl font-bold">{data.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-gray-500">Approved</p>
              <p className="text-xl font-bold text-green-600">{data.metrics.approved_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-gray-500">Rejected</p>
              <p className="text-xl font-bold text-red-600">{data.metrics.rejected_count}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-gray-500">Approval Rate</p>
              <p className="text-xl font-bold">{data.metrics.approval_rate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-gray-500">Avg. Time</p>
              <p className="text-xl font-bold">{data.metrics.avg_approval_time_minutes}m</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Records {!loading && data ? `(${Math.min((page + 1) * pageSize, data.total)} of ${data.total})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.records?.length ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.staff_name}</TableCell>
                        <TableCell className="text-sm">{record.email}</TableCell>
                        <TableCell className="text-sm">{record.location}</TableCell>
                        <TableCell className="text-sm max-w-xs truncate">{record.reason}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              record.status === 'approved'
                                ? 'default'
                                : record.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col">
                            <span>{format(new Date(record.created_at), 'MMM dd, yyyy')}</span>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{record.approved_by}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Page {page + 1} of {Math.ceil(data.total / pageSize)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0 || loading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={!data?.records?.length || data.records.length < pageSize || loading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">No records found</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
