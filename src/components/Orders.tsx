import React, { useState, useEffect, useCallback, useRef } from "react"
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
import { getOrdersFromDbByDate, getStores, getOrderCardConfig, updateExistingOrders, deleteOrder, syncOrdersByDate, getUnscheduledOrders } from "../services/api"
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
  
  // NEW: Admin permission check for reordering
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'
  
  // NEW: Pending changes tracking for admin-only reordering
  const [pendingReorderChanges, setPendingReorderChanges] = useState<Record<string, number>>({})
  const [isSavingReorder, setIsSavingReorder] = useState(false)
  const [recentlySaved, setRecentlySaved] = useState(false)
  
  // NEW: Smart auto-refresh for cross-device sync (since backend doesn't broadcast sortOrder)
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState<number>(() => {
    // Initialize with stored timestamp if available
    const stored = localStorage.getItem('lastReorderSave')
    return stored ? parseInt(stored) : 0
  })
  const autoRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
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
                sortOrder: updateData.sortOrder !== undefined ? updateData.sortOrder : order.sortOrder // FIX: Handle sortOrder 0
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
      
      console.log(`[CROSS-DEVICE-SYNC] ✅ Refreshed ${(response.orders || response).length} orders for ${dateStr}`)
      toast.success("Orders refreshed from database", { duration: 1500 })
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

  // ENHANCED: Cross-device sync with real-time + localStorage fallback
  useEffect(() => {
    if (!tenant?.id || !selectedDate) {
      return
    }

    console.log(`[CROSS-DEVICE-SYNC] Starting enhanced cross-device sync (admin: ${isAdmin})`)
    
    const checkForReorderChanges = () => {
      // Check localStorage for admin save events (works for same-browser multi-tab scenarios)
      const storedTimestamp = localStorage.getItem('lastReorderSave')
      if (storedTimestamp) {
        const timestamp = parseInt(storedTimestamp)
        const isRecentChange = timestamp > Date.now() - 30000 // 30 seconds
        const isNewChange = timestamp > lastSaveTimestamp
        
        if (isNewChange && isRecentChange) {
          console.log(`[CROSS-DEVICE-SYNC] 🔄 Detected reorder changes (timestamp: ${timestamp}), refreshing...`)
          setLastSaveTimestamp(timestamp)
          handleRefreshFromDatabase()
          
          if (!isAdmin) {
            toast.info("Order sequence updated by admin", { duration: 2000 })
          }
        }
      }
    }

    // Initial check
    checkForReorderChanges()
    
    // Listen for immediate cross-tab reorder events (same browser)
    const handleReorderEvent = (event: CustomEvent) => {
      const { timestamp, adminId, adminName } = event.detail
      
      // CRITICAL FIX: Don't trigger cross-device sync for own saves (prevents interference)
      if (adminId === user?.id) {
        console.log(`[CROSS-DEVICE-SYNC] 🚫 Ignoring own save event from ${adminName} to prevent interference`)
        return
      }
      
      if (timestamp > lastSaveTimestamp) {
        console.log(`[CROSS-DEVICE-SYNC] 🚀 Cross-tab reorder detected from different admin: ${adminName}`)
        setLastSaveTimestamp(timestamp)
        handleRefreshFromDatabase()
        
        if (!isAdmin) {
          toast.info(`Order sequence updated by ${adminName}`, { duration: 2000 })
        }
      }
    }
    
    window.addEventListener('reorderSaved', handleReorderEvent as EventListener)
    
    // For non-admin devices: poll more frequently for admin changes
    // For admin devices: still poll but less frequently to detect changes from other admin sessions
    const pollInterval = isAdmin ? 5000 : 2000 // Admin: 5s, Non-admin: 2s
    
    autoRefreshIntervalRef.current = setInterval(checkForReorderChanges, pollInterval)

    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
      window.removeEventListener('reorderSaved', handleReorderEvent as EventListener)
    }
  }, [tenant?.id, selectedDate, isAdmin, lastSaveTimestamp, handleRefreshFromDatabase])

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current)
        autoRefreshIntervalRef.current = null
      }
    }
  }, [])

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
  const handleOrderStatusChange = (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed', orderTitle?: string, isFromRealtime = false, assignedTo?: string) => {
    // Update the order status AND assignedTo in all relevant arrays
    const updateOrderStatus = (orders: any[]) => 
      orders.map((order: any) => 
        (order.cardId === orderId || order.id === orderId) 
          ? { 
              ...order, 
              status: newStatus,
              // CRITICAL FIX: Preserve assignedTo from real-time updates, fallback to current user for local actions
              assignedTo: assignedTo !== undefined ? assignedTo : (newStatus === 'assigned' ? (user?.name || user?.email) : null)
            }
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
        // Use the assignedTo parameter if provided, otherwise use current user
        const toastAssignedTo = assignedTo || user?.name || user?.email || 'Unknown User'
        toast.success(`${orderTitle} Assigned to ${toastAssignedTo}`)
      }
    }
  }

  // SIMPLIFIED: Just like status buttons - no optimistic protection needed
  const handleOptimisticReorder = (orderId: string, newSortOrder: number) => {
    console.log(`[SIMPLE-DRAG] 🎯 Simple reorder: ${orderId} -> ${newSortOrder}`)
    
    // Apply immediate update (just like status buttons)
    handleOrderReorderChange(orderId, newSortOrder, false)
    
    // Background API save (just like status buttons)
    if (tenant?.id && selectedDate) {
      const deliveryDate = new Date(selectedDate).toLocaleDateString('en-GB')
      
      fetch(`/api/tenants/${tenant.id}/order-card-states/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          sortOrder: newSortOrder,
          deliveryDate
        })
      }).then(response => {
        if (response.ok) {
          console.log(`[SIMPLE-DRAG] ✅ API save completed`)
        } else {
          console.error(`[SIMPLE-DRAG] ❌ API save failed:`, response.status)
        }
      }).catch(error => {
        console.error(`[SIMPLE-DRAG] ❌ API save error:`, error)
      })
    }
  }

  // SIMPLIFIED: Copy status button pattern exactly - no protection needed
  const handleOrderReorderChange = (orderId: string, newSortOrder: number, isFromRealtime = false) => {
    console.log(`[REORDER-SIMPLE] ${isFromRealtime ? 'Remote' : 'Local'} reorder: ${orderId} -> sortOrder: ${newSortOrder}`)
    
         // NO PROTECTION - just like status buttons work perfectly
    
    // Update the order sortOrder in all relevant arrays (same pattern as handleOrderStatusChange)
    const updateOrderSortOrder = (orders: any[]) => 
      orders.map((order: any) => 
        (order.cardId === orderId || order.id === orderId) 
          ? { ...order, sortOrder: newSortOrder }
          : order
      )

    // Sort orders by sortOrder (same pattern as status function)  
    const sortOrdersByPosition = (orders: any[]) => {
      return orders.sort((a, b) => {
        const aSortOrder = a.sortOrder || 9999
        const bSortOrder = b.sortOrder || 9999
        return aSortOrder - bSortOrder
      })
    }

    // Update all arrays (same pattern as handleOrderStatusChange)
    setAllOrders((prev: any[]) => sortOrdersByPosition(updateOrderSortOrder(prev)))
    setMainOrders((prev: any[]) => sortOrdersByPosition(updateOrderSortOrder(prev)))
    setAddOnOrders((prev: any[]) => sortOrdersByPosition(updateOrderSortOrder(prev)))
    setUnscheduledOrders((prev: any[]) => sortOrdersByPosition(updateOrderSortOrder(prev)))
    
    // Also update store containers with sorting (same pattern as handleOrderStatusChange)
    setStoreContainers((prev: any[]) => 
      prev.map((container: any) => ({
        ...container,
        orders: sortOrdersByPosition(updateOrderSortOrder(container.orders))
      }))
    )

    console.log(`[REORDER-SIMPLE] ✅ Updated sortOrder for ${orderId}`)
  }

  // Real-time batch processing state
  const [updateBatch, setUpdateBatch] = useState<any>({})
  const updateBatchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentBatchRef = useRef<any>({}) // CRITICAL FIX: Ref to track current batch
  
  // CRITICAL FIX: Update ref whenever batch changes
  useEffect(() => {
    currentBatchRef.current = updateBatch
  }, [updateBatch])

  const processBatchedUpdates = useCallback(() => {
    const currentBatch = currentBatchRef.current // CRITICAL FIX: Use ref to get current state
    
    if (Object.keys(currentBatch).length === 0) {
      console.log(`[REALTIME-BATCH] No items in batch to process`)
      return
    }
    
    console.log(`[REALTIME-BATCH] Processing ${Object.keys(currentBatch).length} batched updates`)
    
    // Clear the batch immediately to prevent race conditions
    setUpdateBatch({})
    currentBatchRef.current = {} // CRITICAL FIX: Clear ref too
    
    // Apply all updates at once (sortOrder, status, assignedTo)
    const updateOrdersWithBatchedData = (orders: any[]) => 
      orders.map((order: any) => {
        const orderId = order.cardId || order.id || order.orderId
        const batchUpdate = currentBatch[orderId]
        if (batchUpdate) {
          console.log(`[REALTIME-BATCH] Applying ${orderId} ->`, batchUpdate)
          return { 
            ...order, 
            ...(batchUpdate.sortOrder !== undefined && { sortOrder: batchUpdate.sortOrder }),
            ...(batchUpdate.status && { status: batchUpdate.status }),
            ...(batchUpdate.assignedTo !== undefined && { assignedTo: batchUpdate.assignedTo })
          }
        }
        return order
      })

    // Update all arrays at once
    setAllOrders(prev => updateOrdersWithBatchedData(prev))
    setMainOrders(prev => updateOrdersWithBatchedData(prev))
    setAddOnOrders(prev => updateOrdersWithBatchedData(prev))
    setStoreContainers(prev => 
      prev.map(container => ({
        ...container,
        orders: updateOrdersWithBatchedData(container.orders)
      }))
    )

    // Then do ONE final re-sort
    const sortByOrder = (orders: any[]) => 
      orders.slice().sort((a: any, b: any) => {
        const aSortOrder = a.sortOrder || 9999
        const bSortOrder = b.sortOrder || 9999
        return aSortOrder - bSortOrder
      })

    setTimeout(() => {
      setMainOrders((prev: any[]) => sortByOrder(prev))
      setAddOnOrders((prev: any[]) => sortByOrder(prev))
      setAllOrders((prev: any[]) => sortByOrder(prev))
      
      // CRITICAL FIX: Also sort the storeContainers orders for visual reordering
      setStoreContainers((prev: any[]) => 
        prev.map((container: any) => ({
          ...container,
          orders: sortByOrder(container.orders)
        }))
      )
      
      console.log(`[REALTIME-BATCH] Final re-sort completed for ${Object.keys(currentBatch).length} orders (including storeContainers)`)
    }, 50)

  }, [])  // Keep empty dependency array but use ref for current state

  // Real-time updates hook - STABILIZED (moved here to access handleOrderStatusChange)
  const handleRealtimeUpdate = useCallback((update: any) => {
    const now = Date.now()
    console.log(`🔄 [REALTIME-TIMING] Update received at ${new Date(now).toISOString()} for order ${update.orderId || 'unknown'}`)
    console.log('🔄 Real-time update received:', update)
    
    // REMOVED TOGGLE-PROTECTION: No longer needed since we use proper API flow
    // Individual order-card-states API calls work naturally with real-time system
    console.log('[REALTIME-NATURAL] Processing update naturally (toggle protection removed)');
    
    // DEBUG: Log user identification details
    console.log(`[REALTIME-DEBUG] Current user: id=${user?.id}, email=${user?.email}, name=${user?.name}`)
    console.log(`[REALTIME-DEBUG] Update updatedBy: ${update.updatedBy}`)
    
    // DEBUG: Check if sortOrder is present in the update
    console.log(`[SORTORDER-DEBUG] update.sortOrder:`, update.sortOrder, `(type: ${typeof update.sortOrder})`)
    console.log(`[SORTORDER-DEBUG] update.changes:`, update.changes)
    
    // ANTI-LOOP: Skip updates from current user - BUT ONLY FOR STATUS CHANGES, NOT SORT ORDER
    // Sort order needs cross-device sync and sendOptimisticUpdate handles immediate conflicts
    const isOwnUpdate = update.updatedBy === user?.id || update.updatedBy === user?.email || update.updatedBy === user?.name
    
    if (update.type === 'order_updated') {
      // CRITICAL FIX: Handle drag operations with special logic
      const updateChanges = update.changes || update
      const isDragOperation = updateChanges._dragOperation === true
      const isRecentDragUpdate = isDragOperation && updateChanges._timestamp && (Date.now() - updateChanges._timestamp < 5000) // 5 second window
      
      if (isDragOperation) {
        console.log(`[REALTIME-ENHANCED] Drag operation detected: ${update.orderId}`)
        
        // ANTI-CONFLICT: Skip drag updates from same user if they're recent (already applied optimistically)
        if (isOwnUpdate && isRecentDragUpdate) {
          console.log(`[REALTIME-ENHANCED] Skipping recent own drag update: ${update.orderId}`)
          return
        }
        
        console.log(`[REALTIME-ENHANCED] Processing cross-device drag update: ${update.orderId}`)
      }
      
      // Only skip status updates from same user, allow all sortOrder updates for cross-device sync
      if (isOwnUpdate && update.status && !update.sortOrder && !isDragOperation) {
        console.log(`⏭️ [REALTIME-ENHANCED] Skipping own STATUS update from ${update.updatedBy}`)
        return
      }
      
      console.log(`📦 [REALTIME-ENHANCED] Processing order update: ${update.orderId}${isDragOperation ? ' (drag)' : ''}`)
      
      // Create update data from the polling response
      const updateData = {
        status: update.status || 'unassigned',
        assignedTo: update.assignedTo,
        notes: update.notes,
        sortOrder: update.sortOrder
      }
      
      // FIXED: Process both status AND sortOrder (drag-drop updates have both!)
      const hasStatusChange = update.status && ['unassigned', 'assigned', 'completed'].includes(update.status)
      const hasSortOrderChange = update.sortOrder !== undefined
      
      if (hasStatusChange && !hasSortOrderChange) {
        // Pure status change (no sortOrder) - but check for pending reorder changes
        const hasPendingReorderChange = pendingReorderChanges[update.orderId] !== undefined
        if (hasPendingReorderChange) {
          console.log(`[REALTIME-PROTECTION] ⚠️ Status change for ${update.orderId} but has pending reorder - allowing status change but protecting sortOrder`)
        }
        
        console.log(`[REALTIME] Pure status change detected: ${update.orderId} -> ${update.status}`)
        // CRITICAL FIX: Pass assignedTo from real-time update to preserve cross-device attribution
        console.log(`[REALTIME-ATTRIBUTION] Preserving assignedTo: ${update.assignedTo} for ${update.orderId}`)
        handleOrderStatusChange(update.orderId, update.status as 'unassigned' | 'assigned' | 'completed', undefined, true, update.assignedTo)
      } else if (hasSortOrderChange) {
        // CRITICAL FIX: Use direct handleOrderReorderChange instead of batch processing
        console.log(`[REALTIME-DIRECT] SortOrder update detected: ${update.orderId} -> sortOrder: ${update.sortOrder}${hasStatusChange ? ` (also status: ${update.status})` : ''}`)
        
        // Handle status change first if present
        if (hasStatusChange) {
          console.log(`[REALTIME-DIRECT] Processing status change: ${update.orderId} -> ${update.status}`)
          handleOrderStatusChange(update.orderId, update.status as 'unassigned' | 'assigned' | 'completed', undefined, true, update.assignedTo)
        }
        
        // CRITICAL FIX: Protect pending local drag changes from real-time snapback
        const hasPendingChange = pendingReorderChanges[update.orderId] !== undefined
        if (hasPendingChange) {
          console.log(`[REALTIME-PROTECTION] 🛡️ BLOCKING real-time sortOrder update for ${update.orderId} - has pending local change: ${pendingReorderChanges[update.orderId]} vs incoming: ${update.sortOrder}`)
          console.log(`[REALTIME-PROTECTION] 🛡️ All pending changes:`, Object.keys(pendingReorderChanges))
          return
        } else {
          console.log(`[REALTIME-PROTECTION] ✅ No pending change for ${update.orderId}, allowing real-time update: ${update.sortOrder}`)
        }
        
        // Additional protection: Block stale updates immediately after save, but NOT for database refreshes
        if (recentlySaved && !update.fromDatabaseRefresh) {
          console.log(`[REALTIME-PROTECTION] 🛡️ BLOCKING stale real-time update during post-save protection period for ${update.orderId}`)
          return
        }
        
        // DIRECT ANTI-LOOP: Skip own updates to prevent conflicts
        const isDefinitelyOwnUpdate = isOwnUpdate && update.updatedBy !== 'unknown' && update.updatedBy
        const timeSinceUpdate = update.updatedAt ? Date.now() - new Date(update.updatedAt).getTime() : 0
        const isRecentSortOrderUpdate = timeSinceUpdate < 10000 // 10 seconds
        
        if (isDefinitelyOwnUpdate && isRecentSortOrderUpdate) {
          console.log(`[REALTIME-DIRECT] ✅ SKIPPING definitely own recent update: ${update.orderId} (${Math.round(timeSinceUpdate/1000)}s ago)`)
          return
        }
        
        // DATABASE-FIRST: Apply sortOrder changes from D1 database via real-time
        console.log(`[REALTIME-DATABASE] ✅ Applying sortOrder from D1 database: ${update.orderId} -> ${update.sortOrder}`)
        handleOrderReorderChange(update.orderId, update.sortOrder, true)
        
        // Enhanced: Show cross-device reorder notification from database
        if (!isDefinitelyOwnUpdate) {
          const updateSource = update.updatedBy && update.updatedBy !== 'unknown' ? update.updatedBy : 'another admin'
          console.log(`[REALTIME-DATABASE] 🔄 Cross-device sortOrder update from D1 database by: ${updateSource}`)
        }
        
      } else {
        // Neither status nor sortOrder change - handle other field updates
        console.log(`[REALTIME] Other field update: ${update.orderId}`, updateData)
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

      setAllOrders((prev: any[]) => removeOrder(prev))
      setMainOrders((prev: any[]) => removeOrder(prev))
      setAddOnOrders((prev: any[]) => removeOrder(prev))
      setUnscheduledOrders((prev: any[]) => removeOrder(prev))
      setStoreContainers((prev: any[]) => 
        prev.map((container: any) => ({
          ...container,
          orders: removeOrder(container.orders)
        })).filter((container: any) => container.orders.length > 0)
      )
    }
  }, [updateIndividualOrder, user])

  // Initialize WebSocket hook with the real-time handler (RESTORED - this was working!)
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

      setAllOrders((prev: any[]) => removeOrder(prev))
      setMainOrders((prev: any[]) => removeOrder(prev))
      setAddOnOrders((prev: any[]) => removeOrder(prev))
      setUnscheduledOrders((prev: any[]) => removeOrder(prev))
      
      // Also remove from store containers
      setStoreContainers((prev: any[]) => 
        prev.map((container: any) => ({
          ...container,
          orders: removeOrder(container.orders)
        })).filter((container: any) => container.orders.length > 0)
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
  // NEW: Admin-only drag and drop with pending changes
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    if (!tenant?.id) {
      toast.error("No tenant ID available")
      return
    }

    // NEW: Admin permission check
    if (!isAdmin) {
      toast.error("Only administrators can reorder items")
      return
    }

    console.log(`[ADMIN-DRAG] Admin drag operation: ${active.id} -> ${over.id}`)

    // Check if dropping into a status column (status changes still work for all users)
    const statusColumnMap: Record<string, 'unassigned' | 'assigned' | 'completed'> = {
      'unassigned-column': 'unassigned',
      'assigned-column': 'assigned', 
      'completed-column': 'completed'
    }

    const newStatus = statusColumnMap[over.id as string]
    if (newStatus) {
      // Status changes work immediately for all users (existing functionality)
      console.log(`[STATUS-CHANGE] Dropped ${active.id} into ${newStatus} column`)
      
      handleOrderStatusChange(active.id as string, newStatus)
      
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
          console.log(`[STATUS-CHANGE] Status saved to database: ${cardId} -> ${newStatus}`)
        } else {
          console.error('[STATUS-CHANGE] Failed to save status:', await response.text())
        }
      } catch (error) {
        console.error('[STATUS-CHANGE] Error saving status:', error)
      }
      
      return // Don't continue with reordering logic
    }

    // NEW: Admin-only reordering with pending changes (no immediate API calls)
    try {
      console.log(`[ADMIN-REORDER] Processing admin reorder operation (pending changes only)`)
      
      let foundInStoreContainer = false
      
      // Find which store container the dragged item belongs to
      for (let containerIndex = 0; containerIndex < storeContainers.length; containerIndex++) {
        const container = storeContainers[containerIndex]
        const activeOrderIndex = container.orders.findIndex((order: any) => 
          (order.cardId || order.id) === active.id
        )

        if (activeOrderIndex !== -1) {
          console.log(`[ADMIN-REORDER] Found order ${active.id} in container: ${container.storeName}`)
          
          const newOrderIndex = container.orders.findIndex((order: any) => 
            (order.cardId || order.id) === over.id
          )

          if (newOrderIndex !== -1) {
            console.log(`[ADMIN-REORDER] Target position found at index ${newOrderIndex}`)
            
            // NEW: Only update local state and track pending changes
            const newOrders = arrayMove(container.orders, activeOrderIndex, newOrderIndex)
            const orderIds = newOrders.map((order: any) => order.cardId || order.id)
            
            console.log(`[ADMIN-REORDER] New local order sequence:`, orderIds)
            console.log(`[ADMIN-REORDER] 🛡️ Current pending changes before update:`, Object.keys(pendingReorderChanges))
            
            // Apply local visual updates only
            orderIds.forEach((orderId, index) => {
              const newSortOrder = (index + 1) * 10
              console.log(`[ADMIN-REORDER] 📝 Setting local update: ${orderId} -> sortOrder: ${newSortOrder}`)
              
              // Track as pending change FIRST (for protection)
              setPendingReorderChanges(prev => {
                const updated = { ...prev, [orderId]: newSortOrder }
                console.log(`[ADMIN-REORDER] 🛡️ Updated pending changes:`, Object.keys(updated))
                return updated
              })
              
              // Then update local state
              console.log(`[ADMIN-REORDER] 🎨 Applying visual update: ${orderId} -> sortOrder: ${newSortOrder}`)
              handleOrderReorderChange(orderId, newSortOrder, false)
            })

            toast.success("Reorder queued - Click 'Save Reorder' to apply changes", {
              duration: 4000
            })
            foundInStoreContainer = true
            break
          }
        }
      }

      // Handle add-on orders with same pending approach
      if (!foundInStoreContainer) {
        console.log(`[ADMIN-REORDER] Checking add-on orders`)
        
        const activeAddOnIndex = addOnOrders.findIndex((order: any) => 
          (order.cardId || order.id) === active.id
        )

        if (activeAddOnIndex !== -1) {
          console.log(`[ADMIN-REORDER] Found order ${active.id} in add-on orders`)
          
          const newIndex = addOnOrders.findIndex((order: any) => 
            (order.cardId || order.id) === over.id
          )

          if (newIndex !== -1) {
            console.log(`[ADMIN-REORDER] Reordering add-on orders: ${activeAddOnIndex} -> ${newIndex}`)
            
            const newAddOnOrders = arrayMove(addOnOrders, activeAddOnIndex, newIndex)
            const orderIds = newAddOnOrders.map((order: any) => order.cardId || order.id)
            
            console.log(`[ADMIN-REORDER] New add-on order sequence:`, orderIds)
            
            // Update local state only
            setAddOnOrders(newAddOnOrders)
            
            // Track pending changes for add-on orders
            orderIds.forEach((orderId, index) => {
              const newSortOrder = (index + 1) * 10
              console.log(`[ADMIN-REORDER] Add-on pending: ${orderId} -> sortOrder: ${newSortOrder}`)
              
              setPendingReorderChanges(prev => ({
                ...prev,
                [orderId]: newSortOrder
              }))
            })

            toast.success("Add-on reorder queued - Click 'Save Reorder' to apply changes", {
              duration: 4000
            })
          }
        } else {
          console.warn(`[ADMIN-REORDER] Order ${active.id} not found in any container`)
        }
      }
    } catch (error) {
      console.error("[ADMIN-REORDER] Failed to process reorder:", error)
      toast.error("Failed to process reorder: " + (error as Error).message)
    }
  }

  // DATABASE-FIRST: Save all pending reorder changes with state recovery
  const handleSaveReorder = async () => {
    if (!tenant?.id || Object.keys(pendingReorderChanges).length === 0) {
      return
    }

    if (!isAdmin) {
      toast.error("Only administrators can save reorder changes")
      return
    }

    setIsSavingReorder(true)
    const deliveryDate = selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB') : ''
    
    // CRITICAL: Store original state for rollback on failure
    const originalPendingChanges = { ...pendingReorderChanges }

    try {
      console.log(`[SAVE-REORDER] Saving ${Object.keys(pendingReorderChanges).length} pending changes to D1 database`)
      
      // Create bulk update API call for guaranteed real-time broadcast
      const response = await fetch(`/api/tenants/${tenant.id}/bulk-reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          changes: pendingReorderChanges,
          deliveryDate,
          adminId: user?.id,
          adminName: user?.name || user?.email,
          timestamp: Date.now()
        })
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`[SAVE-REORDER] ✅ Bulk reorder saved to D1 database:`, result)
        
        // DATABASE-FIRST: Refresh from database to ensure consistency
        await handleRefreshFromDatabase()
        
        // ENHANCED: Broadcast save timestamp for cross-device sync
        const saveTimestamp = Date.now()
        setLastSaveTimestamp(saveTimestamp)
        
        // Store in localStorage for cross-device detection (same-browser tabs)
        localStorage.setItem('lastReorderSave', saveTimestamp.toString())
        console.log(`[CROSS-DEVICE-SYNC] ✅ Broadcasting save timestamp: ${saveTimestamp}`)
        
        // Also dispatch a custom event for immediate same-browser detection
        window.dispatchEvent(new CustomEvent('reorderSaved', { 
          detail: { timestamp: saveTimestamp, adminId: user?.id, adminName: user?.name || user?.email }
        }))
        
        // Clear pending changes ONLY after successful database save and refresh
        setPendingReorderChanges({})
        
        // Add protection window to prevent stale real-time updates after save
        console.log('[SAVE-REORDER] 🔒 Activating post-save protection against stale updates')
        setRecentlySaved(true)
        setTimeout(() => {
          console.log('[SAVE-REORDER] 🔓 Deactivating post-save protection - allowing real-time updates')
          setRecentlySaved(false)
        }, 1000) // 1 second protection window (reduced since we fixed main interference)
        
        toast.success(`Reorder changes saved to database and synced to all devices`, {
          duration: 3000
        })
      } else {
        const errorText = await response.text()
        console.error('[SAVE-REORDER] Failed to save reorder:', response.status, errorText)
        
        // For now, fall back to individual API calls if bulk endpoint doesn't exist
        console.log('[SAVE-REORDER] Falling back to individual API calls')
        
        const updatePromises = Object.entries(pendingReorderChanges).map(async ([orderId, sortOrder]) => {
          const response = await fetch(`/api/tenants/${tenant.id}/order-card-states/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              sortOrder,
              deliveryDate,
              _bulkReorder: true,
              _adminReorder: true,
              _forceRealtime: true,
              _dragOperation: true,
              _adminId: user?.id,
              _adminName: user?.name || user?.email,
              _timestamp: Date.now()
            })
          })

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
          }

          return await response.json()
        })

        await Promise.all(updatePromises)
        console.log(`[SAVE-REORDER] ✅ Individual API calls completed`)
        
        // DATABASE-FIRST: Refresh from database after individual saves
        await handleRefreshFromDatabase()
        
        // ENHANCED: Broadcast save timestamp for cross-device sync
        const saveTimestamp = Date.now()
        setLastSaveTimestamp(saveTimestamp)
        
        // Store in localStorage for cross-device detection (same-browser tabs)
        localStorage.setItem('lastReorderSave', saveTimestamp.toString())
        console.log(`[CROSS-DEVICE-SYNC] ✅ Broadcasting save timestamp: ${saveTimestamp}`)
        
        // Also dispatch a custom event for immediate same-browser detection
        window.dispatchEvent(new CustomEvent('reorderSaved', { 
          detail: { timestamp: saveTimestamp, adminId: user?.id, adminName: user?.name || user?.email }
        }))
        
        setPendingReorderChanges({})
        
        // Add protection window here too for individual API calls
        console.log('[SAVE-REORDER] 🔒 Activating post-save protection after individual API calls')
        setRecentlySaved(true)
        setTimeout(() => {
          console.log('[SAVE-REORDER] 🔓 Deactivating post-save protection after individual calls')
          setRecentlySaved(false)
        }, 1000) // 1 second protection window (reduced since we fixed main interference)
        
        toast.success(`Reorder changes saved to database and syncing to other devices`, {
          duration: 3000
        })
      }
    } catch (error) {
      console.error('[SAVE-REORDER] Failed to save reorder changes to database:', error)
      
      // DATABASE-FIRST: Restore original state from database on failure
      console.log('[SAVE-REORDER] Restoring state from database due to save failure...')
      await handleRefreshFromDatabase()
      
      // Restore pending changes so user can retry
      setPendingReorderChanges(originalPendingChanges)
      
      toast.error("Failed to save reorder changes to database. State restored. Please try again.", {
        duration: 5000
      })
    } finally {
      setIsSavingReorder(false)
    }
  }

  // DATABASE-FIRST: Clear pending changes and restore from database
  const handleCancelReorder = async () => {
    if (Object.keys(pendingReorderChanges).length === 0) {
      return
    }

    console.log('[CANCEL-REORDER] Restoring state from D1 database...')
    
    // DATABASE-FIRST: Always refresh from database to ensure consistency
    await handleRefreshFromDatabase()
    setPendingReorderChanges({})
    
    toast.info("Pending reorder changes cancelled. Order restored from database.", {
      duration: 3000
    })
  }

  // NEW: Check if reordering is enabled (admin only, no filters)
  const isReorderingEnabled = isAdmin && !activeFilters.status && !activeFilters.stores?.length
  const hasPendingChanges = Object.keys(pendingReorderChanges).length > 0

  // CRITICAL FIX: Create handleOrderReorderChange - same pattern as handleOrderStatusChange
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
               {/* Last update text removed for cleaner UI */}
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
                Sort Orders
              </Button>
              
              {/* NEW: Admin Reorder Controls */}
              {isAdmin && (
                <>
                  <div className="h-4 border-l border-border mx-2" />
                  
                  {hasPendingChanges && (
                    <>
                      <Button 
                        onClick={handleSaveReorder}
                        disabled={isSavingReorder}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {isSavingReorder ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        Save Reorder ({Object.keys(pendingReorderChanges).length})
                      </Button>
                      
                      <Button 
                        variant="outline"
                        onClick={handleCancelReorder}
                        disabled={isSavingReorder}
                        className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
                      >
                        <Circle className="h-4 w-4" />
                        Cancel Changes
                      </Button>
                    </>
                  )}
                  
                  {!hasPendingChanges && isReorderingEnabled && (
                    <div className="px-3 py-2 bg-blue-100 text-blue-800 text-xs rounded-md">
                      Drag orders to reorder (Admin only)
                    </div>
                  )}
                  
                  {!isReorderingEnabled && !hasPendingChanges && (
                    <div className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-md">
                      Clear filters to enable reordering
                    </div>
                  )}
                </>
              )}
              
              {!isAdmin && (
                <div className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-md">
                  Only administrators can reorder
                </div>
              )}
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
            const isCollapsed = collapsedContainers[containerKey] === undefined ? true : collapsedContainers[containerKey] // Default to collapsed, but toggle properly
            
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