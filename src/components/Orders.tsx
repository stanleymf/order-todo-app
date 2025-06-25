import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"

import { Separator } from "./ui/separator"
import {
  Search,
  RefreshCw,
  Package,
  Download,
  Upload,
  Trash2,
  User,
  Clock,
  MapPin,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Gift,
  ChevronDown,
  Store,
  Tags,
  Layers,
  UserCheck,
  Circle,
  AlertTriangle
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { getOrdersFromDbByDate, getStores, getOrderCardConfig, updateExistingOrders } from "../services/api"
import { OrderDetailCard } from "./OrderDetailCard"
import { OrderCardField } from "../types/orderCardFields"
import { toast } from "sonner"

export const Orders: React.FC = () => {
  const { user, tenant } = useAuth()
  
  // State for controls
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [stores, setStores] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [mainOrders, setMainOrders] = useState<any[]>([])
  const [addOnOrders, setAddOnOrders] = useState<any[]>([])
  const [orderFields, setOrderFields] = useState<OrderCardField[]>([])
  const [loading, setLoading] = useState(false)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  
  // Filter state management
  const [activeFilters, setActiveFilters] = useState<{
    status?: 'unassigned' | 'assigned' | 'completed'
    stores?: string[]
  }>({})

  // Load stores and configuration on mount
  useEffect(() => {
    const loadInitialData = async () => {
      if (!tenant?.id) return

      try {
        // Load stores
        const storesData = await getStores(tenant.id)
        setStores(storesData)

        // Load order card configuration
        const configData = await getOrderCardConfig(tenant.id)
        setOrderFields(configData.fields || [])
      } catch (error) {
        console.error("Failed to load initial data:", error)
        toast.error("Failed to load configuration")
      }
    }

    loadInitialData()
  }, [tenant?.id])

  const handleFetchOrders = useCallback(async () => {
    if (!tenant?.id || !selectedDate) {
      return
    }

    setLoading(true)
    try {
      // Convert date from YYYY-MM-DD to DD/MM/YYYY format for API
      const dateStr = selectedDate.split("-").reverse().join("/")
      console.log("Fetching orders for date:", dateStr)
      
      const response = await getOrdersFromDbByDate(tenant.id, dateStr)
      console.log("Orders response:", response)
      
      // Handle both old format (array) and new format (object with categories)
      if (Array.isArray(response)) {
        // Old format - treat all as main orders
        console.log("Setting orders (old format):", response.length)
        setAllOrders(response)
        setMainOrders(response)
        setAddOnOrders([])
      } else {
        // New format with categories
        console.log("Setting orders (new format):", {
          all: response.orders?.length || 0,
          main: response.mainOrders?.length || 0,
          addOns: response.addOnOrders?.length || 0
        })
        setAllOrders(response.orders || [])
        setMainOrders(response.mainOrders || [])
        setAddOnOrders(response.addOnOrders || [])
      }
      
      console.log(`Loaded ${(response.orders || response).length} orders for ${dateStr}`)
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      toast.error("Failed to fetch orders")
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedDate])

  // Auto-load orders when date changes
  useEffect(() => {
    if (tenant?.id && selectedDate) {
      handleFetchOrders()
    }
  }, [handleFetchOrders, tenant?.id, selectedDate])

  const handleUpdateOrders = async () => {
    if (!tenant?.id || !stores.length) {
      toast.error("No stores configured")
      return
    }

    const storeId = selectedStore === "all" ? stores[0].id : selectedStore
    
    setLoading(true)
    try {
      console.log("Updating existing orders with enhanced GraphQL data...")
      toast.info("Updating orders with enhanced data...")
      
      // Call the update-existing API function
      const result = await updateExistingOrders(tenant.id, storeId)
      
      console.log("Update result:", result)
      
      if (result.success) {
        toast.success(`Successfully updated ${result.totalProcessed || result.updatedOrders?.length || 0} orders with enhanced GraphQL data`)
        
        // Refresh the orders list to show the updated data
        await handleFetchOrders()
      } else {
        toast.error("Update completed but with errors")
      }
      
    } catch (error) {
      console.error("Failed to update orders:", error)
      toast.error("Failed to update orders: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOrders = () => {
    if (window.confirm("Are you sure you want to delete selected orders?")) {
      console.log("Deleting orders...")
      toast.info("Delete functionality coming soon")
    }
  }

  const handleExportOrders = () => {
    console.log("Exporting orders...")
    toast.info("Export functionality coming soon")
  }

  // Filter orders based on search term and store
  const filterOrders = (orders: any[]) => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.title?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStore = selectedStore === "all" || 
        order.storeId === selectedStore ||
        order.store_id === selectedStore
      
      // Apply active filters
      const matchesStatusFilter = !activeFilters.status || 
        (activeFilters.status === 'unassigned' && (!order.status || order.status === 'unassigned')) ||
        (activeFilters.status === 'assigned' && order.status === 'assigned') ||
        (activeFilters.status === 'completed' && order.status === 'completed')
      
      const matchesStoreFilter = !activeFilters.stores?.length || 
        activeFilters.stores.includes(order.storeId) || 
        activeFilters.stores.includes(order.store_id)
      
      return matchesSearch && matchesStore && matchesStatusFilter && matchesStoreFilter
    })
  }

  // Filter functions
  const handleStatusFilterClick = (status: 'unassigned' | 'assigned' | 'completed') => {
    setActiveFilters(prev => ({
      ...prev,
      status: prev.status === status ? undefined : status
    }))
  }

  const handleTotalFilterClick = () => {
    setActiveFilters({})
  }

  const handleStoreFilterClick = (storeId: string) => {
    setActiveFilters(prev => {
      const currentStores = prev.stores || []
      const isActive = currentStores.includes(storeId)
      
      return {
        ...prev,
        stores: isActive 
          ? currentStores.filter(id => id !== storeId)
          : [...currentStores, storeId]
      }
    })
  }

  const filteredMainOrders = filterOrders(mainOrders)
  const filteredAddOnOrders = filterOrders(addOnOrders)
  const filteredAllOrders = filterOrders(allOrders)

  const getComprehensiveStats = () => {
    // Use unfiltered data for stats (show total counts, not filtered counts)
    const allOrdersForStats = allOrders
    
    // Basic counts
    const totalOrderCount = allOrdersForStats.length
    const unassignedCount = allOrdersForStats.filter(o => !o.status || o.status === 'unassigned').length
    const assignedCount = allOrdersForStats.filter(o => o.status === 'assigned').length
    const completedCount = allOrdersForStats.filter(o => o.status === 'completed').length
    
    // Florist breakdown - count completed orders by florist
    const floristBreakdown = allOrdersForStats
      .filter(o => o.status === 'completed' && o.assignedTo)
      .reduce((acc: any, order) => {
        const florist = order.assignedTo || 'Unknown'
        acc[florist] = (acc[florist] || 0) + 1
        return acc
      }, {})

    // Breakdown by store
    const storeBreakdown = stores.reduce((acc: any, store) => {
      const storeOrders = allOrdersForStats.filter(o => o.storeId === store.id || o.store_id === store.id)
      acc[store.name] = storeOrders.length
      return acc
    }, {})

    // Difficulty labels count
    const difficultyBreakdown = allOrdersForStats.reduce((acc: any, order) => {
      const difficulty = order.difficultyLabel || 'Unknown'
      acc[difficulty] = (acc[difficulty] || 0) + 1
      return acc
    }, {})

    // Product type label count
    const productTypeBreakdown = allOrdersForStats.reduce((acc: any, order) => {
      const productType = order.productCategory || order.productTypeLabel || 'Unknown'
      acc[productType] = (acc[productType] || 0) + 1
      return acc
    }, {})
    
    return { 
      totalOrderCount, 
      unassignedCount, 
      assignedCount, 
      completedCount,
      floristBreakdown,
      storeBreakdown,
      difficultyBreakdown,
      productTypeBreakdown
    }
  }

  const stats = getComprehensiveStats()

  // Handle status changes from OrderDetailCard
  const handleOrderStatusChange = (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed') => {
    // Update the order status in all relevant arrays
    const updateOrderStatus = (orders: any[]) => 
      orders.map(order => 
        (order.cardId === orderId || order.id === orderId) 
          ? { ...order, status: newStatus }
          : order
      )

    setAllOrders(prev => updateOrderStatus(prev))
    setMainOrders(prev => updateOrderStatus(prev))
    setAddOnOrders(prev => updateOrderStatus(prev))
  }

  return (
    <div className="flex-1 space-y-4 sm:space-y-6 p-2 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders Management</h1>
          <p className="text-muted-foreground">
            Manage and track your orders across all stores
          </p>
        </div>
      </div>

      {/* Stats Container - Collapsible */}
      <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Stats
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isStatsOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Basic Stats - Row 1 */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card 
                  className={`border cursor-pointer transition-all hover:shadow-md ${
                    !activeFilters.status && !activeFilters.stores?.length 
                      ? 'border-blue-500 bg-blue-100 shadow-md' 
                      : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={handleTotalFilterClick}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <Package className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{stats.totalOrderCount}</div>
                    <p className="text-xs text-muted-foreground">
                      For {selectedDate.split("-").reverse().join("/")}
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`border cursor-pointer transition-all hover:shadow-md ${
                    activeFilters.status === 'unassigned'
                      ? 'border-gray-500 bg-gray-200 shadow-md' 
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => handleStatusFilterClick('unassigned')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
                    <Circle className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{stats.unassignedCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Awaiting assignment
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`border cursor-pointer transition-all hover:shadow-md ${
                    activeFilters.status === 'assigned'
                      ? 'border-blue-500 bg-blue-200 shadow-md' 
                      : 'border-blue-200 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => handleStatusFilterClick('assigned')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Assigned</CardTitle>
                    <UserCheck className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{stats.assignedCount}</div>
                    <p className="text-xs text-muted-foreground">
                      In progress
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`border cursor-pointer transition-all hover:shadow-md ${
                    activeFilters.status === 'completed'
                      ? 'border-green-500 bg-green-200 shadow-md' 
                      : 'border-green-200 bg-green-50 hover:bg-green-100'
                  }`}
                  onClick={() => handleStatusFilterClick('completed')}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{stats.completedCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Finished orders
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Stats - Row 2 */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border border-purple-200 bg-purple-50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Breakdown by Store</CardTitle>
                    <Store className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {Object.entries(stats.storeBreakdown).map(([storeName, count]) => {
                        const storeData = stores.find(s => s.name === storeName)
                        const storeId = storeData?.id
                        const isActive = activeFilters.stores?.includes(storeId)
                        
                        return (
                          <div 
                            key={storeName} 
                            className={`flex justify-between text-xs cursor-pointer rounded px-2 py-1 transition-colors ${
                              isActive 
                                ? 'bg-purple-200 font-medium' 
                                : 'hover:bg-purple-100'
                            }`}
                            onClick={() => storeId && handleStoreFilterClick(storeId)}
                          >
                            <span className="truncate">{storeName}:</span>
                            <span className="font-semibold text-purple-600">{count as number}</span>
                          </div>
                        )
                      })}
                      {Object.keys(stats.storeBreakdown).length === 0 && (
                        <div className="text-xs text-muted-foreground">No store data</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-amber-200 bg-amber-50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Difficulty Labels</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {Object.entries(stats.difficultyBreakdown).map(([difficulty, count]) => (
                        <div key={difficulty} className="flex justify-between text-xs">
                          <span className="truncate">{difficulty}:</span>
                          <span className="font-semibold text-amber-600">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(stats.difficultyBreakdown).length === 0 && (
                        <div className="text-xs text-muted-foreground">No difficulty data</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-teal-200 bg-teal-50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Product Type Labels</CardTitle>
                    <Tags className="h-4 w-4 text-teal-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {Object.entries(stats.productTypeBreakdown).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-xs">
                          <span className="truncate">{type}:</span>
                          <span className="font-semibold text-teal-600">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(stats.productTypeBreakdown).length === 0 && (
                        <div className="text-xs text-muted-foreground">No product type data</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-orange-200 bg-orange-50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed by Florist</CardTitle>
                    <UserCheck className="h-4 w-4 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {Object.entries(stats.floristBreakdown).map(([florist, count]) => (
                        <div key={florist} className="flex justify-between text-xs">
                          <span className="truncate">{florist}:</span>
                          <span className="font-semibold text-orange-600">{count as number}</span>
                        </div>
                      ))}
                      {Object.keys(stats.floristBreakdown).length === 0 && (
                        <div className="text-xs text-muted-foreground">No completed orders</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Controls Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Order Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  console.log("Date changed to:", e.target.value)
                  setSelectedDate(e.target.value)
                }}
                className="w-[180px]"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="store">Store</Label>
              <select
                id="store"
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="all">All Stores</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 flex-1 max-w-sm">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by customer name or order ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={() => {
                  handleFetchOrders()
                  toast.success("Refreshing orders...")
                }}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Fetch Orders
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleUpdateOrders} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Update Orders
              </Button>
              
              <Button variant="outline" onClick={handleExportOrders} className="gap-2">
                <Download className="h-4 w-4" />
                Export Data
              </Button>
              
              <Button variant="destructive" onClick={handleDeleteOrders} className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Lists */}
      {loading ? (
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading orders...</span>
            </div>
          </CardContent>
        </Card>
      ) : filteredAllOrders.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground mb-4">
                {allOrders.length === 0 
                  ? "Click 'Fetch Orders' to load orders from your Shopify store"
                  : "Try adjusting your filters or date range"
                }
              </p>
              {allOrders.length === 0 && (
                <Button onClick={handleFetchOrders} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Fetch Orders
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Main Orders Container */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Main Orders ({filteredMainOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredMainOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No main orders found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMainOrders.map(order => (
                    <OrderDetailCard
                      key={order.cardId || order.id}
                      order={order}
                      fields={orderFields}
                      isExpanded={false}
                      onStatusChange={handleOrderStatusChange}
                      deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add-ons Container */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-orange-500" />
                Add-ons ({filteredAddOnOrders.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredAddOnOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No add-ons found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAddOnOrders.map(order => (
                    <OrderDetailCard
                      key={order.cardId || order.id}
                      order={order}
                      fields={orderFields}
                      isExpanded={false}
                      onStatusChange={handleOrderStatusChange}
                      deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 