'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import { TrendingUp, Clock, CheckCircle2, XCircle, AlertCircle, Users } from 'lucide-react'

interface StatisticsData {
  metrics: {
    pending_count: number
    approved_count: number
    rejected_count: number
    approval_rate: number
    total_processed: number
    avg_approval_time_minutes: number
  }
  trends: Array<{
    date: string
    pending: number
    approved: number
    rejected: number
  }>
  by_department: Array<{
    name: string
    approved: number
    pending: number
    rejected: number
  }>
  range: string
}

export function OffPremisesStatisticsDashboard() {
  const [data, setData] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    fetchStatistics()
  }, [timeRange])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/offpremises/statistics?range=${timeRange}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch statistics')
      }

      setData(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
    } finally {
      setLoading(false)
    }
  }

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
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Off-Premises Statistics</h2>
          <p className="text-sm text-gray-500">Real-time metrics on off-premises check-in activities</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-12 w-12 rounded mb-2" />
                  <Skeleton className="h-6 w-20 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : data ? (
          <>
            {/* Pending */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.pending_count}</div>
                <p className="text-xs text-gray-500">Awaiting approval</p>
              </CardContent>
            </Card>

            {/* Approved */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.approved_count}</div>
                <p className="text-xs text-gray-500">
                  {data.metrics.approval_rate}% approval rate
                </p>
              </CardContent>
            </Card>

            {/* Rejected */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.rejected_count}</div>
                <p className="text-xs text-gray-500">
                  {data.metrics.total_processed} total processed
                </p>
              </CardContent>
            </Card>

            {/* Avg Approval Time */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg. Approval Time</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.metrics.avg_approval_time_minutes}m</div>
                <p className="text-xs text-gray-500">Average processing time</p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Daily Trend
              </CardTitle>
              <CardDescription>Approved, pending, and rejected requests over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="approved" stackId="1" stroke="#10b981" fill="#d1fae5" />
                  <Area type="monotone" dataKey="pending" stackId="1" stroke="#f59e0b" fill="#fef3c7" />
                  <Area type="monotone" dataKey="rejected" stackId="1" stroke="#ef4444" fill="#fee2e2" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Department Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                By Department
              </CardTitle>
              <CardDescription>Request distribution across departments</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.by_department}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="approved" stackId="a" fill="#10b981" />
                  <Bar dataKey="pending" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="rejected" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Summary Stats */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Requests</p>
                <p className="text-xl font-bold">{data.metrics.approved_count + data.metrics.rejected_count + data.metrics.pending_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Approval Rate</p>
                <p className="text-xl font-bold">{data.metrics.approval_rate}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Departments</p>
                <p className="text-xl font-bold">{data.by_department.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Time Range</p>
                <Badge variant="outline">
                  {timeRange === '7d' ? 'Last 7 days' : timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
