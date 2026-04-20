"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  MapPin,
  AlertTriangle,
  Target,
  Activity,
  BarChart3,
  PieChartIcon,
  LineChartIcon,
} from "lucide-react"

interface AnalyticsData {
  attendanceRate: number
  totalEmployees: number
  activeLocations: number
  avgWorkHours: number
  trends: {
    daily: Array<{ date: string; present: number; absent: number; late: number }>
    weekly: Array<{ week: string; attendance: number; productivity: number }>
    monthly: Array<{ month: string; rate: number; hours: number }>
  }
  departmentStats: Array<{
    name: string
    attendance: number
    employees: number
    avgHours: number
    color: string
  }>
  locationStats: Array<{
    name: string
    checkins: number
    utilization: number
    peakHours: string
  }>
  predictions: {
    nextWeekAttendance: number
    riskEmployees: number
    peakDays: string[]
  }
}

const COLORS = ["#e97444", "#f39c12", "#3498db", "#2ecc71", "#9b59b6", "#e74c3c", "#1abc9c", "#34495e"]

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState("30d")
  const [activeTab, setActiveTab] = useState("overview")

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/analytics?range=${timeRange}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch analytics")
      }

      setData(result)
      setError(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch analytics")
    } finally {
      setLoading(false)
    }
  }

  const kpiCards = useMemo(() => {
    if (!data) return []

    return [
      {
        title: "Attendance Rate",
        value: `${data.attendanceRate.toFixed(1)}%`,
        change: data.attendanceRate > 85 ? 2.5 : -1.2,
        icon: Users,
        color: data.attendanceRate > 85 ? "text-green-600" : "text-red-600",
        bgColor: data.attendanceRate > 85 ? "bg-green-50" : "bg-red-50",
      },
      {
        title: "Active Employees",
        value: data.totalEmployees.toString(),
        change: 5.2,
        icon: Activity,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
      },
      {
        title: "Avg Work Hours",
        value: `${data.avgWorkHours.toFixed(1)}h`,
        change: data.avgWorkHours > 8 ? 1.8 : -0.5,
        icon: Clock,
        color: data.avgWorkHours > 8 ? "text-green-600" : "text-orange-600",
        bgColor: data.avgWorkHours > 8 ? "bg-green-50" : "bg-orange-50",
      },
      {
        title: "Active Locations",
        value: data.activeLocations.toString(),
        change: 0,
        icon: MapPin,
        color: "text-purple-600",
        bgColor: "bg-purple-50",
      },
    ]
  }, [data])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2">
            <BarChart3 className="h-6 sm:h-8 w-6 sm:w-8" />
            Analytics Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Real-time insights and predictive analytics for attendance management
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">7 Days</SelectItem>
            <SelectItem value="30d">30 Days</SelectItem>
            <SelectItem value="90d">90 Days</SelectItem>
            <SelectItem value="1y">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className="shadow-sm border-0 bg-gradient-to-br from-white to-gray-50/50">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground">{kpi.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.change > 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${kpi.change > 0 ? "text-green-600" : "text-red-600"}`}>
                      {kpi.change > 0 ? "+" : ""}
                      {kpi.change}%
                    </span>
                  </div>
                </div>
                <div className={`p-2 sm:p-3 rounded-lg ${kpi.bgColor}`}>
                  <kpi.icon className={`h-5 sm:h-6 w-5 sm:w-6 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Predictive Insights */}
      <Card className="shadow-sm border-0 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-4 sm:pb-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-primary">
            <Target className="h-4 sm:h-5 w-4 sm:w-5" />
            Predictive Insights
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">AI-powered predictions and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
            <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-primary mb-1">{data.predictions.nextWeekAttendance}%</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Predicted Next Week Attendance</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
              <div className="text-xl sm:text-2xl font-bold text-orange-600 mb-1">{data.predictions.riskEmployees}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">At-Risk Employees</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
              <div className="text-xs sm:text-sm font-medium text-green-600 mb-1">Peak Days</div>
              <div className="text-xs text-muted-foreground">{data.predictions.peakDays.join(", ")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Departments
          </TabsTrigger>
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <CardTitle>Daily Attendance Trend</CardTitle>
                <CardDescription>Last 30 days attendance pattern</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.trends.daily}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="present" stackId="1" stroke="#e97444" fill="#e97444" />
                    <Area type="monotone" dataKey="late" stackId="1" stroke="#f39c12" fill="#f39c12" />
                    <Area type="monotone" dataKey="absent" stackId="1" stroke="#e74c3c" fill="#e74c3c" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <CardTitle>Weekly Performance</CardTitle>
                <CardDescription>Attendance vs productivity correlation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.trends.weekly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="attendance" stroke="#e97444" strokeWidth={2} />
                    <Line type="monotone" dataKey="productivity" stroke="#3498db" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader>
              <CardTitle>Monthly Trends</CardTitle>
              <CardDescription>Long-term attendance and work hours analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.trends.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="rate" fill="#e97444" name="Attendance Rate %" />
                  <Line yAxisId="right" type="monotone" dataKey="hours" stroke="#3498db" name="Avg Hours" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <CardTitle>Department Distribution</CardTitle>
                <CardDescription>Attendance rates by department</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.departmentStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, attendance }) => `${name}: ${attendance}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="attendance"
                    >
                      {data.departmentStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-white">
              <CardHeader>
                <CardTitle>Department Performance</CardTitle>
                <CardDescription>Detailed metrics by department</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.departmentStats.map((dept, index) => (
                    <div key={dept.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium">{dept.name}</div>
                          <div className="text-sm text-muted-foreground">{dept.employees} employees</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{dept.attendance}%</div>
                        <div className="text-sm text-muted-foreground">{dept.avgHours}h avg</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="locations" className="space-y-6">
          <div className="grid gap-6">
            {data.locationStats.map((location) => (
              <Card key={location.name} className="shadow-sm border-0 bg-white">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {location.name}
                    </span>
                    <Badge variant="secondary">{location.peakHours}</Badge>
                  </CardTitle>
                  <CardDescription>Location utilization and check-in statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{location.checkins}</div>
                      <div className="text-sm text-muted-foreground">Total Check-ins</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{location.utilization}%</div>
                      <div className="text-sm text-muted-foreground">Utilization Rate</div>
                    </div>
                    <div className="text-center">
                      <Progress value={location.utilization} className="mt-2" />
                      <div className="text-sm text-muted-foreground mt-1">Capacity Usage</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
