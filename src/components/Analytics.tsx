import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Badge } from "./ui/badge"
import { Progress } from "./ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"
import { Calendar, TrendingUp, Users, Package, Clock, Target, Award } from "lucide-react"
import { StoreSelector } from "./StoreSelector"
import { useMobileView } from "./Dashboard"
import { useAuth } from "../contexts/AuthContext"
import { getAnalytics, getFloristStats, getStores } from "../services/api"
import type { FloristStats, TimeFrame, Store } from "../types"
import { getSingaporeDateRange, formatSingaporeDate, formatSingaporeTime } from "../lib/utils"
import { TimezoneIndicator } from "./TimezoneIndicator"

// Generate a consistent color based on store ID
const generateStoreColor = (storeId: string): string => {
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#ec4899",
    "#6366f1",
  ]
  const index = storeId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}

export function Analytics() {
  const { tenant } = useAuth()
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("weekly")
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null)
  const [stats, setStats] = useState<FloristStats[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Get mobile view context
  const { isMobileView } = useMobileView()

  useEffect(() => {
    const loadData = async () => {
      if (!tenant?.id) {
        setError("No tenant found")
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch analytics data
        const analyticsData = await getAnalytics(tenant.id, timeFrame)
        setAnalytics(analyticsData)

        // Fetch florist stats
        const statsData = await getFloristStats(tenant.id)
        setStats(statsData)

        // Fetch stores
        const storesData = await getStores(tenant.id)
        setStores(storesData)
      } catch (err) {
        console.error("Error loading analytics:", err)
        setError("Failed to load analytics data. Please try again.")
        setStats([])
        setStores([])
        setAnalytics(null)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tenant?.id, timeFrame])

  const formatTime = (minutes: number): string => {
    if (minutes === 0) return "N/A"
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  const getTimeFrameLabel = (frame: TimeFrame): string => {
    const { endDateSG } = getSingaporeDateRange(1) // Get current Singapore date
    switch (frame) {
      case "daily":
        return `Today (${endDateSG})`
      case "weekly":
        return `This Week (Singapore time)`
      case "monthly":
        return `This Month (Singapore time)`
      default:
        return `This Week (Singapore time)`
    }
  }

  // Filter stats by store if selected
  const getFilteredStats = () => {
    if (!selectedStoreId) return stats

    return stats.map((stat) => {
      const storeData = stat.storeBreakdown?.[selectedStoreId]
      if (!storeData) {
        return {
          ...stat,
          completedOrders: 0,
          averageCompletionTime: 0,
        }
      }
      return {
        ...stat,
        completedOrders: storeData.orders,
        averageCompletionTime: storeData.avgTime,
      }
    })
  }

  const filteredStats = getFilteredStats()
  const sortedStats = [...filteredStats].sort((a, b) => b.completedOrders - a.completedOrders)

  const selectedStore = stores.find((s) => s.id === selectedStoreId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <div className="text-sm text-gray-500 mt-2">Loading analytics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">Error</div>
          <div className="text-sm text-gray-500 mt-2">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobileView ? "space-y-4" : "space-y-6"} max-w-6xl mx-auto`}>
      <div
        className={`flex justify-between ${isMobileView ? "flex-col gap-3" : "items-center"}`}
      >
        <div className="flex flex-col gap-2">
          <h2 className={`font-bold text-gray-900 ${isMobileView ? "text-lg" : "text-2xl"}`}>
            {isMobileView ? "Analytics" : "Analytics Dashboard"}
          </h2>
          <TimezoneIndicator showLabel={false} />
        </div>
        <div className={`flex ${isMobileView ? "flex-col gap-2" : "items-center space-x-4"}`}>
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            onStoreChange={setSelectedStoreId}
          />
          <Select value={timeFrame} onValueChange={(value: TimeFrame) => setTimeFrame(value)}>
            <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-[180px]"}`}>
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedStore && (
        <div className={isMobileView ? "mb-3" : "mb-6"}>
          <Card
            className="border-l-4"
            style={{ borderLeftColor: generateStoreColor(selectedStore.id) }}
          >
            <CardContent className={`${isMobileView ? "p-3" : "p-4"}`}>
              <div className="flex items-center">
                <div
                  className={`${isMobileView ? "w-3 h-3 mr-2" : "w-4 h-4 mr-3"} rounded-full`}
                  style={{ backgroundColor: generateStoreColor(selectedStore.id) }}
                />
                <span className={`font-medium ${isMobileView ? "text-sm" : ""}`}>
                  {isMobileView
                    ? selectedStore.name
                    : `Showing analytics for ${selectedStore.name}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div
        className={`grid gap-4 ${isMobileView ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}`}
      >
        {/* Total Orders */}
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`${isMobileView ? "pb-1" : "pb-2"}`}>
            <CardTitle
              className={`font-medium text-gray-600 ${isMobileView ? "text-xs" : "text-sm"}`}
            >
              Total Orders Completed
            </CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? "pt-2" : ""}`}>
            <div className={`font-bold text-green-600 ${isMobileView ? "text-xl" : "text-2xl"}`}>
              {filteredStats.reduce((sum, stat) => sum + stat.completedOrders, 0)}
            </div>
            <p className={`text-gray-500 mt-1 ${isMobileView ? "text-[10px]" : "text-xs"}`}>
              {getTimeFrameLabel(timeFrame)}
              {selectedStore && !isMobileView && ` • ${selectedStore.name}`}
            </p>
          </CardContent>
        </Card>

        {/* Average Completion Time */}
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`${isMobileView ? "pb-1" : "pb-2"}`}>
            <CardTitle
              className={`font-medium text-gray-600 ${isMobileView ? "text-xs" : "text-sm"}`}
            >
              Average Completion Time
            </CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? "pt-2" : ""}`}>
            <div className={`font-bold text-blue-600 ${isMobileView ? "text-xl" : "text-2xl"}`}>
              {filteredStats.length > 0
                ? formatTime(
                    Math.round(
                      filteredStats.reduce((sum, stat) => sum + stat.averageCompletionTime, 0) /
                        filteredStats.length
                    )
                  )
                : "N/A"}
            </div>
            <p className={`text-gray-500 mt-1 ${isMobileView ? "text-[10px]" : "text-xs"}`}>
              Across all florists
            </p>
          </CardContent>
        </Card>

        {/* Top Performer */}
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`${isMobileView ? "pb-1" : "pb-2"}`}>
            <CardTitle
              className={`font-medium text-gray-600 ${isMobileView ? "text-xs" : "text-sm"}`}
            >
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? "pt-2" : ""}`}>
            {sortedStats.length > 0 && sortedStats[0].completedOrders > 0 ? (
              <>
                <div
                  className={`font-bold text-purple-600 ${isMobileView ? "text-xl" : "text-2xl"}`}
                >
                  {sortedStats[0].floristName}
                </div>
                <p className={`text-gray-500 mt-1 ${isMobileView ? "text-[10px]" : "text-xs"}`}>
                  {sortedStats[0].completedOrders} orders completed
                </p>
              </>
            ) : (
              <div className={`font-bold text-gray-400 ${isMobileView ? "text-xl" : "text-2xl"}`}>
                N/A
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store Breakdown for All Stores View */}
      {!selectedStoreId && (
        <div className={isMobileView ? "mb-4" : "mb-8"}>
          <Card>
            <CardHeader className={`${isMobileView ? "pb-2" : ""}`}>
              <CardTitle className={`${isMobileView ? "text-base" : ""}`}>
                {isMobileView
                  ? "By Store"
                  : `Performance by Store - ${getTimeFrameLabel(timeFrame)}`}
              </CardTitle>
            </CardHeader>
            <CardContent className={isMobileView ? "pt-0" : ""}>
              <div
                className={`grid gap-4 ${isMobileView ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}
              >
                {stores.map((store) => {
                  const storeStats = stats.map((stat) => ({
                    ...stat,
                    completedOrders: stat.storeBreakdown?.[store.id]?.orders || 0,
                    averageCompletionTime: stat.storeBreakdown?.[store.id]?.avgTime || 0,
                  }))
                  const totalOrders = storeStats.reduce(
                    (sum, stat) => sum + stat.completedOrders,
                    0
                  )
                  const avgTime =
                    storeStats.length > 0
                      ? Math.round(
                          storeStats.reduce((sum, stat) => sum + stat.averageCompletionTime, 0) /
                            storeStats.length
                        )
                      : 0

                  return (
                    <Card
                      key={store.id}
                      className={`border-l-4 ${isMobileView ? "p-3" : ""}`}
                      style={{ borderLeftColor: generateStoreColor(store.id) }}
                    >
                      <CardContent className={`${isMobileView ? "p-0" : "p-4"}`}>
                        <div className={`flex items-center ${isMobileView ? "mb-2" : "mb-3"}`}>
                          <div
                            className={`${isMobileView ? "w-2 h-2 mr-2" : "w-3 h-3 mr-2"} rounded-full`}
                            style={{ backgroundColor: generateStoreColor(store.id) }}
                          />
                          <span className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>
                            {store.name}
                          </span>
                        </div>
                        <div className={`${isMobileView ? "space-y-1" : "space-y-2"}`}>
                          <div>
                            <div
                              className={`font-bold text-green-600 ${isMobileView ? "text-base" : "text-lg"}`}
                            >
                              {totalOrders}
                            </div>
                            <div
                              className={`text-gray-500 ${isMobileView ? "text-[10px]" : "text-xs"}`}
                            >
                              Orders Completed
                            </div>
                          </div>
                          <div>
                            <div
                              className={`font-bold text-blue-600 ${isMobileView ? "text-base" : "text-lg"}`}
                            >
                              {formatTime(avgTime)}
                            </div>
                            <div
                              className={`text-gray-500 ${isMobileView ? "text-[10px]" : "text-xs"}`}
                            >
                              Avg. Time
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Stats Table */}
      <Card>
        <CardHeader className={`${isMobileView ? "pb-2" : ""}`}>
          <CardTitle className={`${isMobileView ? "text-base" : ""}`}>
            {isMobileView
              ? "Florist Performance"
              : `Florist Performance - ${getTimeFrameLabel(timeFrame)}`}
            {selectedStore && !isMobileView && ` • ${selectedStore.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className={isMobileView ? "pt-0" : ""}>
          {isMobileView ? (
            // Mobile Card Layout
            <div className="space-y-3">
              {sortedStats.map((stat, index) => {
                const isTopPerformer = index === 0 && stat.completedOrders > 0
                const isFastestFlorist =
                  filteredStats.length > 1 &&
                  stat.averageCompletionTime > 0 &&
                  stat.averageCompletionTime ===
                    Math.min(
                      ...filteredStats
                        .filter((s) => s.averageCompletionTime > 0)
                        .map((s) => s.averageCompletionTime)
                    )

                return (
                  <Card key={stat.floristId} className="border border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                          <span className="font-medium text-gray-900 text-sm">
                            {stat.floristName}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {isTopPerformer && (
                            <Badge
                              variant="default"
                              className="bg-purple-100 text-purple-800 text-xs"
                            >
                              Top
                            </Badge>
                          )}
                          {isFastestFlorist && stat.completedOrders > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-green-100 text-green-800 text-xs"
                            >
                              Fast
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-500">Orders</div>
                          <div className="font-bold text-gray-900">{stat.completedOrders}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Avg. Time</div>
                          <div className="font-bold text-gray-900">
                            {formatTime(stat.averageCompletionTime)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {stat.completedOrders >= 20 && (
                          <Badge variant="outline" className="text-[10px]">
                            High Volume
                          </Badge>
                        )}
                        {stat.averageCompletionTime > 0 && stat.averageCompletionTime <= 40 && (
                          <Badge variant="outline" className="text-[10px]">
                            Efficient
                          </Badge>
                        )}
                        {stat.completedOrders === 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            No Activity
                          </Badge>
                        )}
                      </div>

                      {!selectedStoreId && (
                        <div className="mt-2">
                          <div className="text-[10px] text-gray-500 mb-1">Store Breakdown</div>
                          <div className="flex flex-wrap gap-1">
                            {stores.map((store) => {
                              const storeData = stat.storeBreakdown?.[store.id]
                              if (!storeData || storeData.orders === 0) return null
                              return (
                                <div
                                  key={store.id}
                                  className="flex items-center text-[10px] bg-gray-50 px-1 rounded"
                                >
                                  <div
                                    className="w-2 h-2 rounded-full mr-1"
                                    style={{ backgroundColor: generateStoreColor(store.id) }}
                                  />
                                  <span>{storeData.orders}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            // Desktop Table Layout
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Florist</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Orders Completed
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      Avg. Completion Time
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Performance</th>
                    {!selectedStoreId && (
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        Store Breakdown
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((stat, index) => {
                    const isTopPerformer = index === 0 && stat.completedOrders > 0
                    const isFastestFlorist =
                      filteredStats.length > 1 &&
                      stat.averageCompletionTime > 0 &&
                      stat.averageCompletionTime ===
                        Math.min(
                          ...filteredStats
                            .filter((s) => s.averageCompletionTime > 0)
                            .map((s) => s.averageCompletionTime)
                        )

                    return (
                      <tr
                        key={stat.floristId}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            {isTopPerformer && (
                              <Badge
                                variant="default"
                                className="ml-2 bg-purple-100 text-purple-800"
                              >
                                Top
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{stat.floristName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-gray-900">{stat.completedOrders}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <span className="text-sm text-gray-900">
                              {formatTime(stat.averageCompletionTime)}
                            </span>
                            {isFastestFlorist && stat.completedOrders > 0 && (
                              <Badge
                                variant="secondary"
                                className="ml-2 bg-green-100 text-green-800"
                              >
                                Fastest
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-1">
                            {stat.completedOrders >= 20 && (
                              <Badge variant="outline" className="text-xs">
                                High Volume
                              </Badge>
                            )}
                            {stat.averageCompletionTime > 0 && stat.averageCompletionTime <= 40 && (
                              <Badge variant="outline" className="text-xs">
                                Efficient
                              </Badge>
                            )}
                            {stat.completedOrders === 0 && (
                              <Badge variant="secondary" className="text-xs">
                                No Activity
                              </Badge>
                            )}
                          </div>
                        </td>
                        {!selectedStoreId && (
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {stores.map((store) => {
                                const storeData = stat.storeBreakdown?.[store.id]
                                if (!storeData || storeData.orders === 0) return null
                                return (
                                  <div key={store.id} className="flex items-center text-xs">
                                    <div
                                      className="w-2 h-2 rounded-full mr-1"
                                      style={{ backgroundColor: generateStoreColor(store.id) }}
                                    />
                                    <span>{storeData.orders}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredStats.length === 0 && (
            <div className="text-center py-8 text-gray-500">No performance data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
