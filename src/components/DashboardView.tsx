import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Badge } from "./ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Calendar as CalendarComponent } from "./ui/calendar"
import {
  Search,
  Filter,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  CalendarDays,
  Package,
  BarChart3,
  TrendingUp,
  Store as StoreIcon,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { format } from "date-fns"
import { DashboardCard } from "./DashboardCard"
import { StoreSelector } from "./StoreSelector"
import { useIsMobile } from "./hooks/use-mobile"
import { useAuth } from "../contexts/AuthContext"
import { useRealtimeUpdates } from "../hooks/use-realtime-updates"
import {
  getOrders,
  getUsers,
  getStores,
  getProductLabels,
  getOrderCardConfig,
  getOrdersByDate,
  getOrdersFromDbByDate,
  fetchShopifyOrder,
  getProductByShopifyIds,
  syncOrdersByDate,
  updateExistingOrders,
} from "../services/api"
import type { User, Order, Store, ProductLabel } from "../types"
import type { OrderCardField } from "../types/orderCardFields"
import { toast } from "sonner"

interface StatCardData {
  title: string
  value: number
  icon: React.ReactNode
  color: string
  filterKey?: string
}

interface FilterState {
  status?: 'unassigned' | 'assigned' | 'completed'
  store?: string
  difficulty?: string
  productType?: string
  timeWindow?: string
}

interface ProcessedOrder extends Order {
  shopifyOrderData?: any
  timeWindow?: string
  isExpress?: boolean
  storeData?: Store
  difficultyLabel?: string
  productTypeLabel?: string
}

export function DashboardView() {
  const { user, tenant } = useAuth()
  const isMobileView = useIsMobile()

  // Core state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [orders, setOrders] = useState<ProcessedOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<ProcessedOrder[]>([])
  const [florists, setFlorists] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [productLabels, setProductLabels] = useState<ProductLabel[]>([])
  const [orderCardConfig, setOrderCardConfig] = useState<OrderCardField[]>([])
  
  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterState>({})
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)

  // Real-time updates
  const { isConnected } = useRealtimeUpdates({
    tenantId: tenant?.id || '',
    onOrderUpdate: (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
    }
  })

  // Load initial data
  const loadData = useCallback(async () => {
    if (!tenant?.id) {
      setError("No tenant found")
      setLoading(false)
      return
    }
    
    setLoading(true)
    setError(null)

    try {
      const [usersData, storesData, labelsData, configData] = await Promise.all([
        getUsers(tenant.id),
        getStores(tenant.id),
        getProductLabels(tenant.id),
        getOrderCardConfig(tenant.id)
      ])

      setFlorists(usersData)
      setStores(storesData)
      setProductLabels(labelsData)
      setOrderCardConfig(configData.fields || [])
    } catch (error) {
      console.error("Failed to load data:", error)
      setError("Failed to load data")
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }, [tenant?.id])

  // Load orders for selected date
  const loadOrdersForDate = useCallback(async () => {
    if (!tenant?.id) return
    
    setLoading(true)
    const dateStr = format(selectedDate, "dd/MM/yyyy")
    
    try {
      const ordersData = await getOrdersFromDbByDate(tenant.id, dateStr)
      
      // Process orders with additional data
      const processedOrders = await Promise.all(
        ordersData.map(async (order) => {
          try {
            // Extract time window from tags
            const timeWindow = extractTimeWindow(order.tags || "")
            
            // Check if express order
            const isExpress = checkExpressOrder(order.shopifyOrderData)
            
            // Get store data
            const storeData = stores.find(s => s.id === order.storeId)
            
            // Get labels from saved products if line items exist
            const { difficultyLabel, productTypeLabel } = await getOrderLabels(order, tenant.id)
            
            return {
              ...order,
              timeWindow,
              isExpress,
              storeData,
              difficultyLabel,
              productTypeLabel,
            } as ProcessedOrder
          } catch (error) {
            console.error("Error processing order:", error)
            return order as ProcessedOrder
          }
        })
      )
      
      // Sort orders by priority
      const sortedOrders = sortOrdersByPriority(processedOrders)
      setOrders(sortedOrders)
    } catch (error) {
      console.error("Failed to load orders:", error)
      setError("Failed to load orders")
      toast.error("Failed to load orders for selected date")
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedDate, stores])

  // Helper functions
  const extractTimeWindow = (tags: string): string | undefined => {
    if (!tags) return undefined
    const timeRegex = /\b(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\b/
    const match = tags.match(timeRegex)
    return match ? match[0] : undefined
  }

  const checkExpressOrder = (shopifyOrderData: any): boolean => {
    if (!shopifyOrderData?.line_items) return false
    return shopifyOrderData.line_items.some((item: any) => 
      item.title?.toLowerCase().includes('express')
    )
  }

  const getOrderLabels = async (order: Order, tenantId: string) => {
    let difficultyLabel = "Standard"
    let productTypeLabel = "Arrangement"
    
    try {
      if (order.shopifyOrderData?.line_items?.length > 0) {
        const firstItem = order.shopifyOrderData.line_items[0]
        if (firstItem.product_id && firstItem.variant_id) {
          const productData = await getProductByShopifyIds(
            tenantId,
            firstItem.product_id.toString(),
            firstItem.variant_id.toString()
          )
          
          if (productData?.labelNames) {
            const diffLabel = productLabels.find(l => 
              l.category === 'difficulty' && productData.labelNames.includes(l.name)
            )
            const typeLabel = productLabels.find(l => 
              l.category === 'productType' && productData.labelNames.includes(l.name)
            )
            
            if (diffLabel) difficultyLabel = diffLabel.name
            if (typeLabel) productTypeLabel = typeLabel.name
          }
        }
      }
    } catch (error) {
      console.error("Error getting order labels:", error)
    }
    
    return { difficultyLabel, productTypeLabel }
  }

  const sortOrdersByPriority = (orders: ProcessedOrder[]): ProcessedOrder[] => {
    return orders.sort((a, b) => {
      // 1. Time window priority
      if (a.timeWindow && b.timeWindow) {
        const aTime = a.timeWindow.split('-')[0]
        const bTime = b.timeWindow.split('-')[0]
        if (aTime !== bTime) return aTime.localeCompare(bTime)
      } else if (a.timeWindow && !b.timeWindow) {
        return -1
      } else if (!a.timeWindow && b.timeWindow) {
        return 1
      }
      
      // 2. Store sorting
      const aStore = a.storeData?.name || ''
      const bStore = b.storeData?.name || ''
      if (aStore !== bStore) return aStore.localeCompare(bStore)
      
      // 3. Express orders first
      if (a.isExpress && !b.isExpress) return -1
      if (!a.isExpress && b.isExpress) return 1
      
      // 4. Label priority (lower priority number = higher priority)
      const aDiffPriority = productLabels.find(l => l.name === a.difficultyLabel)?.priority || 999
      const bDiffPriority = productLabels.find(l => l.name === b.difficultyLabel)?.priority || 999
      if (aDiffPriority !== bDiffPriority) return aDiffPriority - bDiffPriority
      
      return 0
    })
  }

  // Apply filters to orders
  useEffect(() => {
    let filtered = [...orders]
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Store filter
    if (selectedStore !== "all") {
      filtered = filtered.filter(order => order.storeId === selectedStore)
    }
    
    // Active filters
    if (activeFilter.status) {
      filtered = filtered.filter(order => order.status === activeFilter.status)
    }
    
    if (activeFilter.store) {
      filtered = filtered.filter(order => order.storeId === activeFilter.store)
    }
    
    if (activeFilter.difficulty) {
      filtered = filtered.filter(order => order.difficultyLabel === activeFilter.difficulty)
    }
    
    if (activeFilter.productType) {
      filtered = filtered.filter(order => order.productTypeLabel === activeFilter.productType)
    }
    
    if (activeFilter.timeWindow) {
      filtered = filtered.filter(order => order.timeWindow === activeFilter.timeWindow)
    }
    
    setFilteredOrders(filtered)
  }, [orders, searchTerm, selectedStore, activeFilter])

  // Calculate statistics
  const statistics = useMemo(() => {
    const stats = {
      total: filteredOrders.length,
      unassigned: filteredOrders.filter(o => o.status === 'unassigned').length,
      assigned: filteredOrders.filter(o => o.status === 'assigned').length,
      completed: filteredOrders.filter(o => o.status === 'completed').length,
    }
    
    return stats
  }, [filteredOrders])

  // Store breakdown
  const storeBreakdown = useMemo(() => {
    const breakdown: Record<string, { count: number; store: Store }> = {}
    
    filteredOrders.forEach(order => {
      if (order.storeData) {
        const storeId = order.storeData.id
        if (!breakdown[storeId]) {
          breakdown[storeId] = { count: 0, store: order.storeData }
        }
        breakdown[storeId].count++
      }
    })
    
    return Object.values(breakdown).sort((a, b) => b.count - a.count)
  }, [filteredOrders])

  // Difficulty breakdown
  const difficultyBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    
    filteredOrders.forEach(order => {
      const difficulty = order.difficultyLabel || 'Standard'
      breakdown[difficulty] = (breakdown[difficulty] || 0) + 1
    })
    
    return Object.entries(breakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredOrders])

  // Product type breakdown
  const productTypeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    
    filteredOrders.forEach(order => {
      const productType = order.productTypeLabel || 'Arrangement'
      breakdown[productType] = (breakdown[productType] || 0) + 1
    })
    
    return Object.entries(breakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredOrders])

  // Stat cards data
  const statCards: StatCardData[] = [
    {
      title: "Total Orders",
      value: statistics.total,
      icon: <Package className="h-4 w-4" />,
      color: "blue",
      filterKey: "total"
    },
    {
      title: "Unassigned",
      value: statistics.unassigned,
      icon: <AlertCircle className="h-4 w-4" />,
      color: "yellow",
      filterKey: "unassigned"
    },
    {
      title: "Assigned",
      value: statistics.assigned,
      icon: <Users className="h-4 w-4" />,
      color: "blue",
      filterKey: "assigned"
    },
    {
      title: "Completed",
      value: statistics.completed,
      icon: <CheckCircle className="h-4 w-4" />,
      color: "green",
      filterKey: "completed"
    },
  ]

  // Event handlers
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      setIsCalendarOpen(false)
    }
  }

  const handleStatCardClick = (filterKey: string) => {
    if (filterKey === "total") {
      setActiveFilter({})
    } else {
      setActiveFilter({ status: filterKey as 'unassigned' | 'assigned' | 'completed' })
    }
  }

  const handleStoreFilterClick = (storeId: string) => {
    setActiveFilter({ store: storeId })
  }

  const clearFilters = () => {
    setActiveFilter({})
    setSearchTerm("")
    setSelectedStore("all")
  }

  const handleSyncOrders = async () => {
    if (!tenant?.id) return
    
    setIsSyncing(true)
    const dateStr = format(selectedDate, "dd/MM/yyyy")
    
    try {
      const result = await updateExistingOrders(tenant.id, dateStr)
      setLastSyncTime(new Date())
      toast.success(`Updated ${result.updatedCount || 0} orders`)
      await loadOrdersForDate()
    } catch (error) {
      console.error("Failed to sync orders:", error)
      toast.error("Failed to sync orders")
    } finally {
      setIsSyncing(false)
    }
  }

  const handleOrderUpdate = async (orderId: string, updates: Partial<Order>) => {
    if (!tenant?.id || !user?.id) return

    try {
      await updateOrder(tenant.id, orderId, updates, user.id)
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, ...updates } : order
      ))
      
      toast.success("Order updated successfully")
    } catch (error) {
      console.error("Failed to update order:", error)
      toast.error("Failed to update order")
    }
  }

  // Load data on mount and date change
  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (stores.length > 0) {
      loadOrdersForDate()
    }
  }, [loadOrdersForDate, stores.length])

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${isMobileView ? "space-y-4" : ""}`}>
      {/* Header */}
      <div className="flex flex-col space-y-4">
        <div className={`flex ${isMobileView ? "flex-col space-y-3" : "items-center justify-between"}`}>
          <div className="flex items-center space-x-4">
            <h1 className={`font-semibold text-gray-900 ${isMobileView ? "text-lg" : "text-2xl"}`}>
              Dashboard
            </h1>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">
                  Offline
                </Badge>
              )}
            </div>
          </div>

          <div className={`flex ${isMobileView ? "flex-col space-y-2" : "items-center space-x-4"}`}>
            {/* Date Picker */}
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`${isMobileView ? "w-full justify-start" : "w-60 justify-start"} text-left font-normal`}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Sync Button */}
            <Button
              onClick={handleSyncOrders}
              disabled={isSyncing}
              variant="outline"
              className={isMobileView ? "w-full" : ""}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Update Orders'}
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <div className={`flex ${isMobileView ? "flex-col space-y-3" : "items-center space-x-4"}`}>
          <StoreSelector
            stores={stores}
            selectedStore={selectedStore}
            onStoreChange={setSelectedStore}
            className={isMobileView ? "w-full" : ""}
          />
          
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {(Object.keys(activeFilter).length > 0 || searchTerm || selectedStore !== "all") && (
            <Button
              onClick={clearFilters}
              variant="outline"
              size="sm"
              className={isMobileView ? "w-full" : ""}
            >
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Cards Row 1 - Core Metrics */}
      <div className={`grid ${isMobileView ? "grid-cols-2 gap-3" : "grid-cols-4 gap-6"}`}>
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className={`cursor-pointer transition-colors hover:bg-gray-50 ${
              activeFilter.status === stat.filterKey || (stat.filterKey === "total" && Object.keys(activeFilter).length === 0)
                ? "ring-2 ring-blue-500 bg-blue-50"
                : ""
            }`}
            onClick={() => handleStatCardClick(stat.filterKey!)}
          >
            <CardContent className={`p-4 ${isMobileView ? "p-3" : ""}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm text-gray-600 ${isMobileView ? "text-xs" : ""}`}>
                    {stat.title}
                  </p>
                  <p className={`text-2xl font-bold ${isMobileView ? "text-xl" : ""}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-2 rounded-full bg-${stat.color}-100 text-${stat.color}-600`}>
                  {stat.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Statistics Cards Row 2 - Breakdown Analytics */}
      <div className={`grid ${isMobileView ? "grid-cols-1 gap-3" : "grid-cols-3 gap-6"}`}>
        {/* Store Breakdown */}
        <Card>
          <CardHeader className={isMobileView ? "pb-3" : ""}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <Store className="h-4 w-4" />
              Store Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobileView ? "pt-0" : ""}>
            <div className="space-y-2">
              {storeBreakdown.map(({ store, count }) => (
                <div
                  key={store.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-gray-50 ${
                    activeFilter.store === store.id ? "bg-blue-50 ring-1 ring-blue-500" : ""
                  }`}
                  onClick={() => handleStoreFilterClick(store.id)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: store.color || '#3B82F6' }}
                    />
                    <span className={`font-medium ${isMobileView ? "text-sm" : ""}`}>
                      {store.name}
                    </span>
                  </div>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {storeBreakdown.length === 0 && (
                <p className={`text-gray-500 text-center py-4 ${isMobileView ? "text-sm" : ""}`}>
                  No orders for selected date
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Difficulty Breakdown */}
        <Card>
          <CardHeader className={isMobileView ? "pb-3" : ""}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <TrendingUp className="h-4 w-4" />
              Difficulty Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobileView ? "pt-0" : ""}>
            <div className="space-y-2">
              {difficultyBreakdown.map(({ name, count }) => {
                const label = productLabels.find(l => l.name === name && l.category === 'difficulty')
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label?.color || '#6B7280' }}
                      />
                      <span className={`font-medium ${isMobileView ? "text-sm" : ""}`}>
                        {name}
                      </span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                )
              })}
              {difficultyBreakdown.length === 0 && (
                <p className={`text-gray-500 text-center py-4 ${isMobileView ? "text-sm" : ""}`}>
                  No orders for selected date
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Type Breakdown */}
        <Card>
          <CardHeader className={isMobileView ? "pb-3" : ""}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <Package className="h-4 w-4" />
              Product Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className={isMobileView ? "pt-0" : ""}>
            <div className="space-y-2">
              {productTypeBreakdown.map(({ name, count }) => {
                const label = productLabels.find(l => l.name === name && l.category === 'productType')
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between p-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: label?.color || '#6B7280' }}
                      />
                      <span className={`font-medium ${isMobileView ? "text-sm" : ""}`}>
                        {name}
                      </span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                )
              })}
              {productTypeBreakdown.length === 0 && (
                <p className={`text-gray-500 text-center py-4 ${isMobileView ? "text-sm" : ""}`}>
                  No orders for selected date
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className={`font-semibold text-gray-900 ${isMobileView ? "text-base" : "text-lg"}`}>
            Orders for {format(selectedDate, "dd/MM/yyyy")}
            {Object.keys(activeFilter).length > 0 && " (Filtered)"}
          </h2>
          <Badge variant="outline">
            {filteredOrders.length} of {orders.length} orders
          </Badge>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {orders.length === 0 
                  ? "No orders found for this date" 
                  : "No orders match the current filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className={`grid gap-4 ${isMobileView ? "grid-cols-1" : "grid-cols-1"}`}>
            {filteredOrders.map((order) => (
              <DashboardCard
                key={order.id}
                order={order}
                config={orderCardConfig}
                onUpdate={handleOrderUpdate}
                florists={florists}
                currentUser={user}
                isMobileView={isMobileView}
              />
            ))}
          </div>
        )}
      </div>

      {/* Last Sync Info */}
      {lastSyncTime && (
        <div className="text-xs text-gray-500 text-center">
          Last updated: {format(lastSyncTime, "HH:mm:ss")}
        </div>
      )}
    </div>
  )
} 