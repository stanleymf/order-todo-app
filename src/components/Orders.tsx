import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible"

import { Separator } from "./ui/separator"
import {
  Search,
  RefreshCw,
  Package,
  Download,
  Upload,
  CheckCircle,
  BarChart3,
  Gift,
  ChevronDown,
  ChevronUp,
  Store,
  Tags,
  UserCheck,
  Circle,
  AlertTriangle,
  Sunrise,
  Sun,
  Moon,
  Clock,
  Calendar,
  SortAsc
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { getOrdersFromDbByDate, getStores, getOrderCardConfig, updateExistingOrders, deleteOrder, reorderOrders, syncOrdersByDate, getUnscheduledOrders } from "../services/api"
import { useRealtimeWebSocket } from "../hooks/use-realtime-websocket"
import { OrderDetailCard } from "./OrderDetailCard"
import { SortableOrderCard } from "./SortableOrderCard"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers'
import { OrderCardField } from "../types/orderCardFields"
import { toast } from "sonner"

export const Orders: React.FC = () => {
  const { tenant, user } = useAuth()
  
  // Google Sheets-style real-time updates with individual order updates
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0)
  const [realtimeEnabled, setRealtimeEnabled] = useState(true) // Default enabled like Google Sheets
  const [activeUpdateIds, setActiveUpdateIds] = useState<Set<string>>(new Set()) // Track ongoing updates
  const refreshCooldown = 2000 // Shorter cooldown for individual updates

  // Google Sheets-style individual order update function
  const updateIndividualOrder = useCallback((orderId: string, updateData: any, updateSource: string) => {
    if (activeUpdateIds.has(orderId)) {
      return // Skip if already updating this order
    }

    // Mark this order as being updated
    setActiveUpdateIds(prev => new Set(prev).add(orderId))

    try {
      console.log(`[REALTIME-INDIVIDUAL] Updating single order ${orderId} from ${updateSource}`, updateData)

      // Update this specific order in all relevant arrays (Google Sheets style)
      const updateOrderInArray = (orders: any[]) => 
        orders.map((order: any) => 
          (order.cardId === orderId || order.id === orderId || order.orderId === orderId)
            ? { 
                ...order, 
                status: updateData.status || order.status,
                assignedTo: updateData.assignedTo || order.assignedTo,
                notes: updateData.notes !== undefined ? updateData.notes : order.notes,
                sortOrder: updateData.sortOrder || order.sortOrder
              }
            : order
        )

      // Apply individual updates to each array
      setAllOrders(prev => updateOrderInArray(prev))
      setMainOrders(prev => updateOrderInArray(prev))
      setAddOnOrders(prev => updateOrderInArray(prev))
      setUnscheduledOrders(prev => updateOrderInArray(prev))
      
      // Update store containers
      setStoreContainers(prev => 
        prev.map(container => ({
          ...container,
          orders: updateOrderInArray(container.orders)
        }))
      )

      console.log(`[REALTIME-INDIVIDUAL] Successfully updated order ${orderId} in UI`)
    } catch (error) {
      console.error(`[REALTIME-INDIVIDUAL] Failed to update order ${orderId}:`, error)
    } finally {
      // Remove from active updates after a short delay
      setTimeout(() => {
        setActiveUpdateIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(orderId)
          return newSet
        })
      }, 100)
    }
  }, [activeUpdateIds])

  // WebSocket hook will be initialized after the real-time handler is defined
  
  // Manual real-time toggle (now defaults to enabled)
  const toggleRealtime = () => {
    setRealtimeEnabled(!realtimeEnabled)
    toast.info(realtimeEnabled ? 'Real-time updates disabled' : 'Real-time updates enabled')
  }
  
  // TESTING: Manual WebSocket status check for verification
  const triggerManualPoll = () => {
    console.log('🔬 [WEBSOCKET] Connection status check')
    console.log(`🔌 [WEBSOCKET] Currently ${isConnected ? 'connected' : 'disconnected'}`)
    console.log(`📊 [WEBSOCKET] Status: ${connectionStatus}`)
    console.log(`📈 [WEBSOCKET] Updates received: ${updates.length}`)
  }
  
  // Expose manual poll function globally for testing
  useEffect(() => {
    (window as any).triggerManualPoll = triggerManualPoll
    return () => {
      delete (window as any).triggerManualPoll
    }
  }, [triggerManualPoll])
  
  // Console log for connection status will be moved after hook initialization
  
  // Helper function to get today's date in YYYY-MM-DD format (local timezone)
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // State for controls
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate())
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [stores, setStores] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [mainOrders, setMainOrders] = useState<any[]>([])
  const [addOnOrders, setAddOnOrders] = useState<any[]>([])
  // Add store containers state for new grouping
  const [storeContainers, setStoreContainers] = useState<any[]>([])
  const [orderFields, setOrderFields] = useState<OrderCardField[]>([])
  const [loading, setLoading] = useState(false)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  
  // Unscheduled orders state
  const [unscheduledOrders, setUnscheduledOrders] = useState<any[]>([])
  const [unscheduledSearchTerm, setUnscheduledSearchTerm] = useState<string>("")
  const [loadingUnscheduled, setLoadingUnscheduled] = useState(false)
  
  // Collapsible state management
  const [collapsedContainers, setCollapsedContainers] = useState<Record<string, boolean>>({
    'unscheduled-all': true // Default collapsed state for unscheduled container
  })
  
  // Quick Actions collapsible state (default collapsed)
  const [isQuickActionsCollapsed, setIsQuickActionsCollapsed] = useState(true)
  
  // Filter state management
  const [activeFilters, setActiveFilters] = useState<{
    status?: 'unassigned' | 'assigned' | 'completed'
    stores?: string[]
  }>({})

  // Back to Top functionality
  const [showBackToTop, setShowBackToTop] = useState(false)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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
    if (!tenant?.id || !selectedDate || !stores.length) {
      return
    }

    setLoading(true)
    try {
      // Use the selected store, or default to first store if "all" is selected
      const storeId = selectedStore === "all" ? stores[0]?.id : selectedStore
      if (!storeId) {
        toast.error("No store selected")
        return
      }

      // Convert date from YYYY-MM-DD to DD/MM/YYYY format for API
      const dateStr = selectedDate.split("-").reverse().join("/")
      console.log("Syncing orders from Shopify for date:", dateStr, "store:", storeId)
      
      // Sync orders from Shopify for this specific date
      const syncResponse = await syncOrdersByDate(tenant.id, storeId, dateStr)
      console.log("Sync response:", syncResponse)
      
      if (syncResponse.success) {
        const totalProcessed = syncResponse.newOrders?.length + syncResponse.updatedOrders?.length || 0
        toast.success(`Synced ${totalProcessed} orders for ${dateStr} from Shopify`)
        
        // Now fetch the updated data from database
        const response = await getOrdersFromDbByDate(tenant.id, dateStr)
        console.log("Orders response after sync:", response)
        
        // CACHE-FIX: Force clear all order state before setting new data
        setAllOrders([])
        setMainOrders([])
        setAddOnOrders([])
        setStoreContainers([])
        
        // Handle both old format (array) and new format (object with categories)
        if (Array.isArray(response)) {
          // Old format - treat all as main orders
          setAllOrders(response)
          setMainOrders(response)
          setAddOnOrders([])
          setStoreContainers([])
        } else {
          // New format with categories and store containers
          setAllOrders(response.orders || [])
          setMainOrders(response.mainOrders || [])
          setAddOnOrders(response.addOnOrders || [])
          setStoreContainers(response.storeContainers || [])
        }
        
        console.log(`Loaded ${(response.orders || response).length} orders for ${dateStr}`)
      } else {
        toast.error("Failed to sync orders from Shopify")
      }
    } catch (error) {
      console.error("Failed to sync orders:", error)
      toast.error("Failed to sync orders: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedDate, selectedStore, stores, syncOrdersByDate, getOrdersFromDbByDate])

  const handleRefreshFromDatabase = useCallback(async () => {
    if (!tenant?.id || !selectedDate) {
      return
    }

    setLoading(true)
    try {
      // Convert date from YYYY-MM-DD to DD/MM/YYYY format for API
      const dateStr = selectedDate.split("-").reverse().join("/")
      console.log("Refreshing orders from database for date:", dateStr)
      
      const response = await getOrdersFromDbByDate(tenant.id, dateStr)
      console.log("Orders response:", response)
      
      // CACHE-FIX: Force clear all order state before setting new data
      setAllOrders([])
      setMainOrders([])
      setAddOnOrders([])
      setStoreContainers([])
      
      // Handle both old format (array) and new format (object with categories)
      if (Array.isArray(response)) {
        // Old format - treat all as main orders
        console.log("Setting orders (old format):", response.length)
        setAllOrders(response)
        setMainOrders(response)
        setAddOnOrders([])
        setStoreContainers([])
      } else {
        // New format with categories and store containers
        console.log("Setting orders (new format):", {
          all: response.orders?.length || 0,
          main: response.mainOrders?.length || 0,
          addOns: response.addOnOrders?.length || 0,
          storeContainers: response.storeContainers?.length || 0
        })
        setAllOrders(response.orders || [])
        setMainOrders(response.mainOrders || [])
        setAddOnOrders(response.addOnOrders || [])
        setStoreContainers(response.storeContainers || [])
      }
      
      console.log(`Refreshed ${(response.orders || response).length} orders for ${dateStr}`)
      toast.success("Orders refreshed from database")
    } catch (error) {
      console.error("Failed to refresh orders:", error)
      toast.error("Failed to refresh orders")
    } finally {
      setLoading(false)
    }
  }, [tenant?.id, selectedDate])

  // Auto-load orders when date changes - use database refresh for auto-load
  useEffect(() => {
    if (tenant?.id && selectedDate) {
      handleRefreshFromDatabase()
    }
  }, [handleRefreshFromDatabase, tenant?.id, selectedDate])

  // Back to Top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      // Show button when user scrolls down 300px from top
      setShowBackToTop(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // Collapsible container helper functions
  const toggleContainer = (containerKey: string) => {
    setCollapsedContainers(prev => ({
      ...prev,
      [containerKey]: !prev[containerKey]
    }))
  }

  const collapseAllContainers = () => {
    const allKeys = [
      ...filteredStoreContainers.map(c => c.containerKey || c.storeName),
      'main-orders',
      'add-ons',
      'unscheduled-all'
    ]
    const collapsed = allKeys.reduce((acc, key) => ({ ...acc, [key]: true }), {})
    setCollapsedContainers(collapsed)
  }

  const expandAllContainers = () => {
    const allKeys = [
      ...filteredStoreContainers.map(c => c.containerKey || c.storeName),
      'main-orders',
      'add-ons',
      'unscheduled-all'
    ]
    const expanded = allKeys.reduce((acc, key) => ({ ...acc, [key]: false }), {})
    setCollapsedContainers(expanded)
  }

  // Function to load unscheduled orders
  const handleLoadUnscheduledOrders = useCallback(async () => {
    if (!tenant?.id) return

    setLoadingUnscheduled(true)
    try {
      console.log("Loading unscheduled orders...")
      const unscheduledData = await getUnscheduledOrders(tenant.id)
      console.log("Unscheduled orders loaded:", unscheduledData)
      setUnscheduledOrders(unscheduledData || [])
      toast.success(`Loaded ${unscheduledData?.length || 0} unscheduled orders`)
    } catch (error) {
      console.error("Failed to load unscheduled orders:", error)
      toast.error("Failed to load unscheduled orders")
    } finally {
      setLoadingUnscheduled(false)
    }
  }, [tenant?.id])

  // Auto-load unscheduled orders when tenant changes
  useEffect(() => {
    if (tenant?.id) {
      handleLoadUnscheduledOrders()
    }
  }, [handleLoadUnscheduledOrders, tenant?.id])

  const handleUpdateOrders = async () => {
    if (!tenant?.id || !stores.length) {
      toast.error("No stores configured")
      return
    }

    const storeId = selectedStore === "all" ? stores[0].id : selectedStore
    
    setLoading(true)
    try {
      // Convert date from YYYY-MM-DD to DD/MM/YYYY format for API (same as handleFetchOrders)
      const dateStr = selectedDate.split("-").reverse().join("/")
      console.log(`Updating existing orders for date ${dateStr} with enhanced GraphQL data...`)
      toast.info(`Updating orders for ${dateStr} with enhanced data...`)
      
      // Call the update-existing API function with converted date
      const result = await updateExistingOrders(tenant.id, storeId, dateStr)
      
      console.log("Update result:", result)
      
      if (result.success) {
        const updatedCount = result.totalProcessed || result.updatedOrders?.length || 0
        toast.success(`Successfully updated ${updatedCount} orders for ${dateStr}`)
        
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

  // Filter orders based on search term and store
  const filterOrders = (orders: any[]) => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || (() => {
        const searchLower = searchTerm.toLowerCase()
        
        // Basic order fields
        const customerNameMatch = order.customerName?.toLowerCase().includes(searchLower)
        const orderIdMatch = order.id?.toLowerCase().includes(searchLower)
        const titleMatch = order.title?.toLowerCase().includes(searchLower)
        
        // Order name/number from Shopify (like #WF123456)
        let orderNameMatch = false
        if (order.shopifyOrderData?.name) {
          orderNameMatch = order.shopifyOrderData.name.toLowerCase().includes(searchLower)
        }
        // Also check shopifyOrderId for order numbers
        if (order.shopifyOrderId) {
          const orderNumber = `#WF${String(order.shopifyOrderId).slice(-6)}`
          orderNameMatch = orderNameMatch || orderNumber.toLowerCase().includes(searchLower)
          orderNameMatch = orderNameMatch || String(order.shopifyOrderId).toLowerCase().includes(searchLower)
        }
        
        // Product titles from line items
        let productTitleMatch = false
        if (order.shopifyOrderData?.lineItems?.edges) {
          productTitleMatch = order.shopifyOrderData.lineItems.edges.some((edge: any) => 
            edge.node?.title?.toLowerCase().includes(searchLower)
          )
        }
        // Also check variant titles
        if (order.shopifyOrderData?.lineItems?.edges) {
          const variantTitleMatch = order.shopifyOrderData.lineItems.edges.some((edge: any) => 
            edge.node?.variant?.title?.toLowerCase().includes(searchLower)
          )
          productTitleMatch = productTitleMatch || variantTitleMatch
        }
        // Check stored product titles if lineItems not available
        if (order.productTitles) {
          try {
            const titles = JSON.parse(order.productTitles)
            if (Array.isArray(titles)) {
              productTitleMatch = productTitleMatch || titles.some((title: string) => 
                title?.toLowerCase().includes(searchLower)
              )
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
        
        return customerNameMatch || orderIdMatch || titleMatch || orderNameMatch || productTitleMatch
      })()
      
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
  
  // Create filtered store containers
  const filteredStoreContainers = storeContainers.map(container => ({
    ...container,
    orders: filterOrders(container.orders)
  })).filter(container => container.orders.length > 0)

  // Filter unscheduled orders by search term only (ignore date/store filters)
  const filteredUnscheduledOrders = unscheduledOrders.filter(order => {
    if (!unscheduledSearchTerm) return true
    
    const searchLower = unscheduledSearchTerm.toLowerCase()
    
    // Search by Shopify order name (like #WF123456)
    let orderNameMatch = false
    if (order.shopifyOrderData?.name) {
      orderNameMatch = order.shopifyOrderData.name.toLowerCase().includes(searchLower)
    }
    // Also check shopifyOrderId for order numbers
    if (order.shopifyOrderId) {
      const orderNumber = `#WF${String(order.shopifyOrderId).slice(-6)}`
      orderNameMatch = orderNameMatch || orderNumber.toLowerCase().includes(searchLower)
      orderNameMatch = orderNameMatch || String(order.shopifyOrderId).toLowerCase().includes(searchLower)
    }
    
    // Basic order fields
    const customerNameMatch = order.customerName?.toLowerCase().includes(searchLower)
    const orderIdMatch = order.id?.toLowerCase().includes(searchLower)
    const titleMatch = order.title?.toLowerCase().includes(searchLower)
    
    // Product titles from line items
    let productTitleMatch = false
    if (order.shopifyOrderData?.lineItems?.edges) {
      productTitleMatch = order.shopifyOrderData.lineItems.edges.some((edge: any) => 
        edge.node?.title?.toLowerCase().includes(searchLower)
      )
    }
    
    return orderNameMatch || customerNameMatch || orderIdMatch || titleMatch || productTitleMatch
  })

  const getComprehensiveStats = () => {
    // Use unfiltered data for stats (show total counts, not filtered counts)
    const allOrdersForStats = allOrders
    
    // Basic counts
    const totalOrderCount = allOrdersForStats.length
    const unassignedCount = allOrdersForStats.filter(o => 
      !o.status || o.status === 'unassigned'
    ).length
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
  const handleOrderStatusChange = (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed', orderTitle?: string, isFromRealtime = false) => {
    // Update the order status in all relevant arrays
    const updateOrderStatus = (orders: any[]) => 
      orders.map((order: any) => 
        (order.cardId === orderId || order.id === orderId) 
          ? { ...order, status: newStatus }
          : order
      )

    // Sort orders with completed orders at the bottom and wedding orders at the top
    const sortOrdersWithStatusPriority = (orders: any[]) => {
      return orders.sort((a, b) => {
        // 1. Status priority - completed orders go to bottom
        const aCompleted = a.status === 'completed'
        const bCompleted = b.status === 'completed'
        
        if (aCompleted && !bCompleted) return 1  // a goes after b
        if (!aCompleted && bCompleted) return -1  // a goes before b
        
        // 2. Wedding priority - wedding orders go to top (within same status)
        const aIsWedding = a.isWeddingProduct
        const bIsWedding = b.isWeddingProduct
        
        if (aIsWedding && !bIsWedding) return -1  // a goes before b
        if (!aIsWedding && bIsWedding) return 1   // a goes after b
        
        // 3. Existing sort logic for same status and wedding group
        if (a.sortOrder !== undefined && b.sortOrder !== undefined && a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder
        }
        
        // 4. Fallback to original order
        return 0
      })
    }

    setAllOrders(prev => sortOrdersWithStatusPriority(updateOrderStatus(prev)))
    setMainOrders(prev => sortOrdersWithStatusPriority(updateOrderStatus(prev)))
    setAddOnOrders(prev => sortOrdersWithStatusPriority(updateOrderStatus(prev)))
    setUnscheduledOrders(prev => sortOrdersWithStatusPriority(updateOrderStatus(prev)))
    
    // Also update store containers with sorting
    setStoreContainers(prev => 
      prev.map(container => ({
        ...container,
        orders: sortOrdersWithStatusPriority(updateOrderStatus(container.orders))
      }))
    )

    // Get order title if not provided
    if (!orderTitle) {
      const findOrderTitle = (orders: any[]) => {
        const order = orders.find((o: any) => 
          o.cardId === orderId || o.id === orderId
        )
        if (order?.title) return order.title
        if (order?.productTitles) {
          try {
            const titles = JSON.parse(order.productTitles)
            return Array.isArray(titles) ? titles[0] : titles
          } catch (e) {
            return 'Order'
          }
        }
        return 'Order'
      }
      
      orderTitle = findOrderTitle(allOrders) || 
                  findOrderTitle(mainOrders) || 
                  findOrderTitle(addOnOrders) ||
                  'Order'
    }

    // Toast notifications for status changes (only for local user actions, not real-time updates)
    if (!isFromRealtime) {
      if (newStatus === 'completed') {
        toast.success(`${orderTitle} is Completed!`)
      } else if (newStatus === 'assigned') {
        const assignedTo = user?.name || user?.email || 'Unknown User'
        toast.success(`Assigned to ${assignedTo}`)
      }
    }
  }

  // Real-time updates hook - STABILIZED (moved here to access handleOrderStatusChange)
  const handleRealtimeUpdate = useCallback((update: any) => {
    console.log('🔄 Real-time update received:', update)
    
    // SUBTLE UPDATE: Update individual order instead of full refresh
    if (update.type === 'order_updated' && update.orderId) {
      console.log(`[REALTIME] Applying individual update to order ${update.orderId}`)
      
      // Create update data from the polling response
      const updateData = {
        status: update.status || 'unassigned',
        assignedTo: update.assignedTo,
        notes: update.notes,
        sortOrder: update.sortOrder
      }
      
      // CRITICAL FIX: Use handleOrderStatusChange instead of updateIndividualOrder
      // This ensures that completed orders move to bottom for all users in real-time
      if (update.status && ['unassigned', 'assigned', 'completed'].includes(update.status)) {
        console.log(`[REALTIME] Status change detected: ${update.orderId} -> ${update.status}`)
        
        // Apply status change with proper sorting (title will be found in handleOrderStatusChange)
        handleOrderStatusChange(update.orderId, update.status as 'unassigned' | 'assigned' | 'completed', undefined, true)
      } else if (update.sortOrder !== undefined) {
        // CRITICAL FIX: Handle sort order changes from drag reordering
        console.log(`[REALTIME] Sort order change detected: ${update.orderId} -> sortOrder: ${update.sortOrder}`)
        
        // Apply individual update with sort order and then re-sort all containers
        updateIndividualOrder(update.orderId, updateData, update.updatedBy || 'remote user')
        
        // Force re-sort all containers to reflect new order sequence
        setTimeout(() => {
          // Re-sort store containers by sortOrder
          setStoreContainers(prev => 
            prev.map(container => ({
              ...container,
              orders: container.orders.slice().sort((a, b) => {
                const aSortOrder = a.sortOrder || 9999
                const bSortOrder = b.sortOrder || 9999
                return aSortOrder - bSortOrder
              })
            }))
          )
          
          // Re-sort main arrays by sortOrder
          const sortByOrder = (orders: any[]) => 
            orders.slice().sort((a, b) => {
              const aSortOrder = a.sortOrder || 9999
              const bSortOrder = b.sortOrder || 9999
              return aSortOrder - bSortOrder
            })
          
          setMainOrders(prev => sortByOrder(prev))
          setAddOnOrders(prev => sortByOrder(prev))
          setAllOrders(prev => sortByOrder(prev))
          
          console.log(`[REALTIME] Re-sorted all containers for sortOrder change: ${update.orderId}`)
        }, 50) // Small delay to ensure individual update is applied first
        
      } else {
        // For other non-status updates, use the individual update method
        updateIndividualOrder(update.orderId, updateData, update.updatedBy || 'remote user')
      }
    } else if (update.type === 'order_created') {
      // For new orders, just log - no aggressive refresh
      console.log('[REALTIME] New order detected:', update.orderId, '- refresh manually if needed')
      
    } else if (update.type === 'order_deleted') {
      // Remove the deleted order from arrays
      console.log(`[REALTIME] Order ${update.orderId} deleted, removing from UI`)
      const removeOrder = (orders: any[]) => 
        orders.filter((order: any) => 
          order.cardId !== update.orderId && order.id !== update.orderId && order.orderId !== update.orderId
        )

      setAllOrders(prev => removeOrder(prev))
      setMainOrders(prev => removeOrder(prev))
      setAddOnOrders(prev => removeOrder(prev))
      setUnscheduledOrders(prev => removeOrder(prev))
      setStoreContainers(prev => 
        prev.map(container => ({
          ...container,
          orders: removeOrder(container.orders)
        }))
      )
    }
  }, [updateIndividualOrder])

  // Initialize WebSocket hook with the real-time handler
  const { isConnected, connectionStatus, updates, sendOptimisticUpdate } = useRealtimeWebSocket({
    enabled: realtimeEnabled,
    onUpdate: handleRealtimeUpdate
  })

  // Connection status logging
  console.log(`[REALTIME] Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`)

  // Handle order deletion from OrderDetailCard
  const handleOrderDelete = async (orderId: string) => {
    if (!tenant?.id) {
      toast.error("No tenant ID available")
      return
    }

    try {
      console.log(`Deleting order ${orderId}...`)
      toast.info("Deleting order...")
      
      // Call the delete API
      await deleteOrder(tenant.id, orderId)
      
      // Remove the order from all relevant arrays
      const removeOrder = (orders: any[]) => 
        orders.filter((order: any) => 
          order.cardId !== orderId && order.id !== orderId
        )

      setAllOrders(prev => removeOrder(prev))
      setMainOrders(prev => removeOrder(prev))
      setAddOnOrders(prev => removeOrder(prev))
      setUnscheduledOrders(prev => removeOrder(prev))
      
      // Also remove from store containers
      setStoreContainers(prev => 
        prev.map(container => ({
          ...container,
          orders: removeOrder(container.orders)
        })).filter(container => container.orders.length > 0)
      )
      
      toast.success("Order deleted successfully")
      console.log(`Order ${orderId} deleted successfully`)
      
    } catch (error) {
      console.error("Failed to delete order:", error)
      toast.error("Failed to delete order: " + (error as Error).message)
    }
  }

  // Auto-sort orders by resetting manual sort order and applying label-based sorting
  const handleSortOrders = async () => {
    if (!tenant?.id || !selectedDate || !stores.length) {
      toast.error("No store or date selected")
      return
    }

    setLoading(true)
    try {
      const storeId = selectedStore === "all" ? stores[0]?.id : selectedStore
      if (!storeId) {
        toast.error("No store selected")
        return
      }

      // Get all orders for the date
      const dateStr = selectedDate.split("-").reverse().join("/")
      console.log("Auto-sorting orders for date:", dateStr, "store:", storeId)
      
      // Reset all manual sort orders for this date by deleting them from order_card_states
      // This will cause the backend to fall back to the label-based priority sorting
      const response = await fetch(`/api/tenants/${tenant.id}/reset-manual-sort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          deliveryDate: dateStr,
          storeId: storeId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reset sort order')
      }

      toast.success("Manual sort order reset - orders now sorted by label priority")
      
      // Refresh the orders to show the new label-based sorting
      await handleRefreshFromDatabase()
      
    } catch (error) {
      console.error("Failed to auto-sort orders:", error)
      toast.error("Failed to auto-sort orders: " + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // Handle drag end for reordering and status changes
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    if (!tenant?.id) {
      toast.error("No tenant ID available")
      return
    }

    // Check if dropping into a status column (Unassigned, Prep, Complete)
    const statusColumnMap: Record<string, 'unassigned' | 'assigned' | 'completed'> = {
      'unassigned-column': 'unassigned',
      'assigned-column': 'assigned', 
      'completed-column': 'completed'
    }

    const newStatus = statusColumnMap[over.id as string]
    if (newStatus) {
      // Dropped into a status column - update status
      console.log(`[DRAG-DROP] Dropped ${active.id} into ${newStatus} column`)
      
      // Update the status and save to database
      handleOrderStatusChange(active.id as string, newStatus)
      
      // Also call the API directly to ensure it's saved
      const cardId = active.id as string
      const deliveryDate = selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : ''
      
      try {
        const response = await fetch(`/api/tenants/${tenant.id}/order-card-states/${cardId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            status: newStatus,
            assignedTo: newStatus === 'assigned' ? (user?.name || user?.email) : null,
            deliveryDate
          })
        })

        if (response.ok) {
          console.log(`[DRAG-DROP] Status saved to database: ${cardId} -> ${newStatus}`)
        } else {
          console.error('[DRAG-DROP] Failed to save status:', await response.text())
        }
      } catch (error) {
        console.error('[DRAG-DROP] Error saving status:', error)
      }
      
      return // Don't continue with reordering logic
    }

    try {
      // Find which store container the dragged item belongs to
      let foundInStoreContainer = false
      for (let containerIndex = 0; containerIndex < filteredStoreContainers.length; containerIndex++) {
        const container = filteredStoreContainers[containerIndex]
        const activeOrderIndex = container.orders.findIndex((order: any) => 
          (order.cardId || order.id) === active.id
        )

        if (activeOrderIndex !== -1) {
          // Found the order in this store container
          const newOrderIndex = container.orders.findIndex((order: any) => 
            (order.cardId || order.id) === over.id
          )

          if (newOrderIndex !== -1) {
            // Reorder within the same store container
            const newOrders = arrayMove(container.orders, activeOrderIndex, newOrderIndex)
            
            // Update the store containers state
            const newStoreContainers = [...storeContainers]
            const originalContainerIndex = newStoreContainers.findIndex(c => c.storeName === container.storeName)
            if (originalContainerIndex !== -1) {
              newStoreContainers[originalContainerIndex] = {
                ...newStoreContainers[originalContainerIndex],
                orders: newOrders
              }
              setStoreContainers(newStoreContainers)
              
              // Also update mainOrders state for backward compatibility
              const allMainOrdersFromContainers = newStoreContainers.flatMap(c => c.orders)
              setMainOrders(allMainOrdersFromContainers)
            }
            
            // Extract order IDs in new sequence for this store
            const orderIds = newOrders.map((order: any) => order.cardId || order.id)
            const deliveryDate = selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : ''
            
            // Auto-save the new order
            await reorderOrders(tenant.id, orderIds, deliveryDate)
            toast.success("Order sequence updated")
            foundInStoreContainer = true
            break
          }
        }
      }

             // If not found in store containers, check add-on orders
       if (!foundInStoreContainer) {
         const activeAddOnIndex = filteredAddOnOrders.findIndex((order: any) => 
           (order.cardId || order.id) === active.id
         )

         if (activeAddOnIndex !== -1) {
           // Reordering add-on orders
           const oldIndex = activeAddOnIndex
           const newIndex = filteredAddOnOrders.findIndex((order: any) => 
             (order.cardId || order.id) === over.id
           )

          if (newIndex !== -1) {
            const newAddOnOrders = arrayMove(filteredAddOnOrders, oldIndex, newIndex)
            setAddOnOrders(newAddOnOrders)
            
            // Extract order IDs in new sequence
            const orderIds = newAddOnOrders.map((order: any) => order.cardId || order.id)
            const deliveryDate = selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : ''
            
            // Auto-save the new order
            await reorderOrders(tenant.id, orderIds, deliveryDate)
            toast.success("Order sequence updated")
          }
        }
      }
    } catch (error) {
      console.error("Failed to reorder:", error)
      toast.error("Failed to update order sequence: " + (error as Error).message)
    }
  }

  // Check if reordering is enabled (only when showing all orders without filters)
  const isReorderingEnabled = !activeFilters.status && !activeFilters.stores?.length

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
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Order Controls
            </div>
                         {/* Real-time Status Indicator with Manual Toggle */}
             <div className="flex items-center gap-2 text-sm">
               <Button
                 variant="outline"
                 size="sm"
                 onClick={toggleRealtime}
                 className={`h-8 px-3 ${
                   realtimeEnabled 
                     ? 'border-green-500 text-green-700' 
                     : 'border-gray-300 text-gray-600'
                 }`}
               >
                                   <div className={`w-2 h-2 rounded-full mr-2 ${
                    realtimeEnabled && isConnected ? 'bg-green-500' : 'bg-gray-400'
                  }`} />
                  <span className="text-xs font-medium">
                    {realtimeEnabled ? (isConnected ? 'Live' : 'Connecting') : 'Off'}
                 </span>
               </Button>
                               {updates.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Last update: {updates[updates.length - 1]?.type}
                  </div>
                )}
             </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters Row */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <div className="flex gap-2">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = getTodayDate()
                    setSelectedDate(today)
                    console.log("Date set to today:", today)
                  }}
                  className="px-3 whitespace-nowrap"
                  title="Set to today's date"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentDate = new Date(selectedDate)
                    currentDate.setDate(currentDate.getDate() + 1)
                    const nextDay = currentDate.toISOString().split('T')[0]
                    setSelectedDate(nextDay)
                    console.log("Date set to next day:", nextDay)
                  }}
                  className="px-3 whitespace-nowrap"
                  title="Go to next day"
                >
                  Next Day
                </Button>
              </div>
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

          {/* Quick Actions - Collapsible */}
          <Collapsible open={!isQuickActionsCollapsed} onOpenChange={(open) => setIsQuickActionsCollapsed(!open)}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="flex items-center justify-between w-full p-0 h-auto hover:bg-transparent">
                <h3 className="text-sm font-medium">Quick Actions</h3>
                <ChevronDown className={`h-4 w-4 transition-transform ${isQuickActionsCollapsed ? '' : 'rotate-180'}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="flex flex-wrap gap-2">
              <Button 
                onClick={handleFetchOrders}
                disabled={loading || !stores.length}
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Fetch Orders (Date)
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleRefreshFromDatabase}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh from Database
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
                Update Orders for {selectedDate}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleLoadUnscheduledOrders} 
                disabled={loadingUnscheduled}
                className="gap-2"
              >
                {loadingUnscheduled ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                Load Unscheduled ({unscheduledOrders.length})
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleSortOrders} 
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <SortAsc className="h-4 w-4" />
                )}
                Auto-Sort Orders
              </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
                              <div className="flex gap-2">
                <Button onClick={handleFetchOrders} disabled={loading || !stores.length}>
                  <Download className="h-4 w-4 mr-2" />
                  Fetch Orders (Date)
                </Button>
              </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Container Controls */}
          {(filteredStoreContainers.length > 0 || filteredAddOnOrders.length > 0 || unscheduledOrders.length > 0) && (
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Order Containers</h3>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={expandAllContainers}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4 rotate-180" />
                  Expand All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={collapseAllContainers}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4" />
                  Collapse All
                </Button>
              </div>
            </div>
          )}
          
          {/* Time Window Containers - Enhanced Layout */}
          {filteredStoreContainers.map((container, containerIndex) => {
            // Enhanced color scheme and icons based on time window
            const getTimeWindowInfo = (timeWindow: string) => {
              switch (timeWindow?.toLowerCase()) {
                case 'morning':
                  return { 
                    icon: Sunrise, 
                    iconColor: 'text-amber-600', 
                    bg: 'bg-amber-50', 
                    border: 'border-amber-200',
                    description: '10:00-14:00'
                  }
                case 'sunday':
                  return { 
                    icon: Calendar, 
                    iconColor: 'text-green-600', 
                    bg: 'bg-green-50', 
                    border: 'border-green-200',
                    description: '11:00-15:00'
                  }
                case 'afternoon':
                  return { 
                    icon: Sun, 
                    iconColor: 'text-blue-600', 
                    bg: 'bg-blue-50', 
                    border: 'border-blue-200',
                    description: '14:00-18:00'
                  }
                case 'night':
                  return { 
                    icon: Moon, 
                    iconColor: 'text-purple-600', 
                    bg: 'bg-purple-50', 
                    border: 'border-purple-200',
                    description: '18:00-22:00'
                  }
                default:
                  return { 
                    icon: Clock, 
                    iconColor: 'text-gray-600', 
                    bg: 'bg-gray-50', 
                    border: 'border-gray-200',
                    description: 'Unscheduled'
                  }
              }
            }
            
            const timeWindow = container.timeWindow || 'Unscheduled'
            const timeInfo = getTimeWindowInfo(timeWindow)
            const displayTitle = container.containerKey || `${container.storeName} - ${container.orders.length}`
            const TimeIcon = timeInfo.icon
            const containerKey = container.containerKey || container.storeName
            const isCollapsed = collapsedContainers[containerKey] !== false // Default to collapsed (true)
            
            return (
              <Collapsible 
                key={containerKey} 
                open={!isCollapsed}
                onOpenChange={() => toggleContainer(containerKey)}
              >
                <Card className={`${timeInfo.border} border-2`}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className={`${timeInfo.bg} cursor-pointer hover:opacity-80 transition-opacity`}>
                      <CardTitle className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <TimeIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${timeInfo.iconColor}`} />
                          <Store className={`h-3 w-3 sm:h-4 sm:w-4 ${timeInfo.iconColor}`} />
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                          <span className="font-bold text-sm sm:text-base truncate">{displayTitle}</span>
                          <span className={`text-xs px-1 sm:px-2 py-1 rounded-full bg-white ${timeInfo.iconColor} border flex-shrink-0`}>
                            {container.orderCount || container.orders.length}
                          </span>
                          <span className={`hidden sm:inline text-xs px-1 py-1 rounded bg-white/80 ${timeInfo.iconColor} text-[10px] flex-shrink-0`}>
                            {timeInfo.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          {isReorderingEnabled && container.orders.length > 1 && (
                            <span className={`hidden lg:inline text-xs text-muted-foreground bg-white px-2 py-1 rounded border`}>
                              Drag to reorder
                            </span>
                          )}
                          <ChevronDown 
                            className={`h-4 w-4 ${timeInfo.iconColor} transition-transform ${isCollapsed ? '' : 'rotate-180'} flex-shrink-0`} 
                          />
                        </div>
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent>
                  {container.orders.length === 0 ? (
                    <div className="text-center py-8">
                      <Store className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No orders found for this store</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                    >
                      <SortableContext
                        items={container.orders.map((order: any) => order.cardId || order.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {container.orders.map((order: any) => {
                            // Debug logs removed - double-encoding fix completed
                            
                            return isReorderingEnabled ? (
                              <SortableOrderCard
                                key={order.cardId || order.id}
                                id={order.cardId || order.id}
                                order={order}
                                fields={orderFields}
                                isExpanded={false}
                                onStatusChange={handleOrderStatusChange}
                                onDelete={handleOrderDelete}
                                deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                                disabled={!isReorderingEnabled}
                              />
                            ) : (
                              <OrderDetailCard
                                key={order.cardId || order.id}
                                order={order}
                                fields={orderFields}
                                isExpanded={false}
                                onStatusChange={handleOrderStatusChange}
                                onDelete={handleOrderDelete}
                                deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                              />
                            )
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )
          })}
          
          {/* Fallback to legacy Main Orders if no store containers */}
          {filteredStoreContainers.length === 0 && filteredMainOrders.length > 0 && (
            <Collapsible 
              open={collapsedContainers['main-orders'] === false}
              onOpenChange={() => toggleContainer('main-orders')}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-blue-50 transition-colors">
                    <CardTitle className="flex items-center gap-1 sm:gap-2 min-w-0">
                      <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 flex-shrink-0" />
                      <span className="flex-1 text-sm sm:text-base truncate">Main Orders - {filteredMainOrders.length}</span>
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        {isReorderingEnabled && filteredMainOrders.length > 1 && (
                          <span className="hidden lg:inline text-xs text-muted-foreground bg-blue-100 px-2 py-1 rounded">
                            Drag to reorder
                          </span>
                        )}
                        <ChevronDown 
                          className={`h-4 w-4 text-blue-500 transition-transform ${collapsedContainers['main-orders'] === false ? 'rotate-180' : ''} flex-shrink-0`} 
                        />
                      </div>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext
                    items={filteredMainOrders.map(order => order.cardId || order.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {filteredMainOrders.map(order => (
                        isReorderingEnabled ? (
                          <SortableOrderCard
                            key={order.cardId || order.id}
                            id={order.cardId || order.id}
                            order={order}
                            fields={orderFields}
                            isExpanded={false}
                            onStatusChange={handleOrderStatusChange}
                            onDelete={handleOrderDelete}
                            deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                            disabled={!isReorderingEnabled}
                          />
                        ) : (
                          <OrderDetailCard
                            key={order.cardId || order.id}
                            order={order}
                            fields={orderFields}
                            isExpanded={false}
                            onStatusChange={handleOrderStatusChange}
                            onDelete={handleOrderDelete}
                            deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Add-ons Container */}
          <Collapsible 
            open={collapsedContainers['add-ons'] === false}
            onOpenChange={() => toggleContainer('add-ons')}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-orange-50 transition-colors">
                  <CardTitle className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500 flex-shrink-0" />
                    <span className="flex-1 text-sm sm:text-base truncate">Add-ons - {filteredAddOnOrders.length}</span>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {isReorderingEnabled && filteredAddOnOrders.length > 1 && (
                        <span className="hidden lg:inline text-xs text-muted-foreground bg-orange-100 px-2 py-1 rounded">
                          Drag to reorder
                        </span>
                      )}
                      <ChevronDown 
                        className={`h-4 w-4 text-orange-500 transition-transform ${collapsedContainers['add-ons'] === false ? 'rotate-180' : ''} flex-shrink-0`} 
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
              {filteredAddOnOrders.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No add-ons found</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis, restrictToParentElement]}
                >
                  <SortableContext
                    items={filteredAddOnOrders.map(order => order.cardId || order.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {filteredAddOnOrders.map(order => (
                        isReorderingEnabled ? (
                          <SortableOrderCard
                            key={order.cardId || order.id}
                            id={order.cardId || order.id}
                            order={order}
                            fields={orderFields}
                            isExpanded={false}
                            onStatusChange={handleOrderStatusChange}
                            onDelete={handleOrderDelete}
                            deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                            disabled={!isReorderingEnabled}
                          />
                        ) : (
                          <OrderDetailCard
                            key={order.cardId || order.id}
                            order={order}
                            fields={orderFields}
                            isExpanded={false}
                            onStatusChange={handleOrderStatusChange}
                            onDelete={handleOrderDelete}
                            deliveryDate={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : undefined}
                          />
                        )
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Unscheduled - All Container */}
          <Collapsible 
            open={collapsedContainers['unscheduled-all'] !== true} // Default to collapsed (true)
            onOpenChange={() => toggleContainer('unscheduled-all')}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-red-50 transition-colors">
                  <CardTitle className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-sm sm:text-base truncate">Unscheduled - All ({filteredUnscheduledOrders.length})</span>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <span className="text-xs text-muted-foreground bg-red-100 px-2 py-1 rounded">
                        No delivery date/timeslot
                      </span>
                      <ChevronDown 
                        className={`h-4 w-4 text-red-500 transition-transform ${collapsedContainers['unscheduled-all'] !== true ? 'rotate-180' : ''} flex-shrink-0`} 
                      />
                    </div>
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  {/* Built-in Search Bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by Shopify order name (#WF12345)..."
                        value={unscheduledSearchTerm}
                        onChange={(e) => setUnscheduledSearchTerm(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {filteredUnscheduledOrders.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {unscheduledOrders.length === 0 
                          ? "No unscheduled orders found. Click 'Load Unscheduled' to fetch from database."
                          : "No orders match your search criteria"
                        }
                      </p>
                      {unscheduledOrders.length === 0 && (
                        <Button 
                          onClick={handleLoadUnscheduledOrders} 
                          disabled={loadingUnscheduled}
                          className="mt-3 gap-2"
                          variant="outline"
                        >
                          {loadingUnscheduled ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          Load Unscheduled Orders
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredUnscheduledOrders.map(order => (
                        <OrderDetailCard
                          key={order.cardId || order.id}
                          order={order}
                          fields={orderFields}
                          isExpanded={false}
                          onStatusChange={handleOrderStatusChange}
                          onDelete={handleOrderDelete}
                          deliveryDate={undefined} // No delivery date for unscheduled orders
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 z-50 h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-300 ease-in-out hover:scale-110"
          size="icon"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
} 