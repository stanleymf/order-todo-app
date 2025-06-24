import React, { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Badge } from "./ui/badge"
import { Checkbox } from "./ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog"
import { Textarea } from "./ui/textarea"
import { Label } from "./ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import { Calendar as CalendarComponent } from "./ui/calendar"
import {
  Search,
  Filter,
  Plus,
  Download,
  Calendar,
  User as UserIcon,
  Package,
  Clock,
  Settings,
  Trash2,
  Users,
  CheckCircle,
  CalendarDays,
  Wifi,
  WifiOff,
  Gift,
  Database,
} from "lucide-react"
import { format } from "date-fns"
import { OrderCard } from "./OrderCard"
import { StoreSelector } from "./StoreSelector"
import { useMobileView } from "./Dashboard"
import { useAuth } from "../contexts/AuthContext"
import { useRealtimeUpdates } from "../hooks/use-realtime-updates"
import {
  getOrders,
  getUsers,
  getStores,
  getProductLabels,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderCardConfig,
  getOrdersByDate,
  getOrdersFromDbByDate,
  fetchShopifyOrder,
  getProductByShopifyIds,
  syncOrdersByDate,
  syncAllOrders,
  deleteOrdersByDate,
  clearAllOrders,
} from "../services/api"
import type { User, Order, Store, ProductLabel } from "../types"
import type { OrderCardField } from "../types/orderCardFields"
import { ProductImageModal } from "./shared/ProductImageModal"

// Interface for processed line items
interface ProcessedLineItem {
  orderId: string;
  lineItemId: string;
  productTitleId: string;
  variantId: string;
  title: string;
  quantity: number;
  price: number;
  isAddOn: boolean;
  shopifyOrderData: any;
  savedProductData?: any;
  cardId: string; // Unique identifier for each card
}

// Normalization utility: DB/REST order -> Shopify GraphQL structure
function normalizeOrderForConfig(order: any): any {
  if (!order) return order;
  // Clone to avoid mutating original
  const normalized = { ...order };

  // Normalize line_items to lineItems.edges[].node
  if (Array.isArray(order.shopifyOrderData?.line_items)) {
    normalized.shopifyOrderData = {
      ...order.shopifyOrderData,
      lineItems: {
        edges: order.shopifyOrderData.line_items.map((item: any) => ({ node: item }))
      }
    };
  }

  // Normalize name to formatted order number if available
  if (order.shopifyOrderData?.name && !order.shopifyOrderData?.name.startsWith('#')) {
    // Ensure shopifyOrderData is properly initialized
    if (!normalized.shopifyOrderData) {
      normalized.shopifyOrderData = { ...order.shopifyOrderData };
    }
    
    let formattedName = order.shopifyOrderData.name;
    
    // If the name is a long ID like "6180356718816", extract last 5 digits
    if (formattedName.length > 5 && /^\d+$/.test(formattedName)) {
      formattedName = formattedName.slice(-5);
    }
    
    normalized.shopifyOrderData = {
      ...normalized.shopifyOrderData,
      name: `#WF${formattedName}`
    };
  }

  // Copy tags if present
  if (order.shopifyOrderData?.tags) {
    normalized.shopifyOrderData.tags = order.shopifyOrderData.tags;
  }

  // Copy note if present
  if (order.shopifyOrderData?.note) {
    normalized.shopifyOrderData.note = order.shopifyOrderData.note;
  }

  // Copy customer fields if present
  if (order.shopifyOrderData?.customer) {
    normalized.shopifyOrderData.customer = order.shopifyOrderData.customer;
  }

  // Copy localProduct if present
  if (order.shopifyOrderData?.localProduct) {
    normalized.shopifyOrderData.localProduct = order.shopifyOrderData.localProduct;
  }

  return normalized;
}

export function OrdersView() {
  const { user: currentUser, tenant } = useAuth()

  // Early return if no user
  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-900">No user found</div>
          <div className="text-sm text-gray-500">Please log in to view orders</div>
        </div>
      </div>
    )
  }

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date())
  const [selectedStore, setSelectedStore] = useState<string>("all")
  const [selectedDifficultyLabel, setSelectedDifficultyLabel] = useState<string>("all")
  const [selectedProductTypeLabel, setSelectedProductTypeLabel] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [orders, setOrders] = useState<Order[]>([])
  const [todoCards, setTodoCards] = useState<any[]>([])
  const [mainOrderCards, setMainOrderCards] = useState<ProcessedLineItem[]>([])
  const [addOnCards, setAddOnCards] = useState<ProcessedLineItem[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [florists, setFlorists] = useState<User[]>([])
  const [productLabels, setProductLabels] = useState<ProductLabel[]>([])
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false)
  const [orderCardConfig, setOrderCardConfig] = useState<OrderCardField[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [processingOrders, setProcessingOrders] = useState<boolean>(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [fetchFeedback, setFetchFeedback] = useState<string | null>(null)
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>()
  const [showDebug, setShowDebug] = useState(false)

  // Get mobile view context
  const { isMobileView } = useMobileView()

  // Define data fetching functions first
  const loadData = useCallback(async () => {
    if (!tenant?.id) {
      setError("No tenant found")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const [usersData, storesData, labelsData, configData] = await Promise.all([
      getUsers(tenant.id),
      getStores(tenant.id),
      getProductLabels(tenant.id),
      getOrderCardConfig(tenant.id)
    ]);

    setFlorists(usersData)
    setStores(storesData)
    setProductLabels(labelsData)
    setOrderCardConfig(configData.fields || [])
    setLoading(false)
  }, [tenant?.id])

  // Helper function to process line items from Shopify order data
  const processLineItems = useCallback((shopifyOrderData: any): ProcessedLineItem[] => {
    const lineItems: ProcessedLineItem[] = []
    
    if (!shopifyOrderData?.line_items || !Array.isArray(shopifyOrderData.line_items)) {
      return lineItems
    }
    
    shopifyOrderData.line_items.forEach((lineItem: any, lineItemIndex: number) => {
      // Create individual cards for each quantity
      for (let i = 0; i < (lineItem.quantity || 1); i++) {
        const cardId = `${shopifyOrderData.id}-${lineItem.id}-${i}`
        
        lineItems.push({
          orderId: shopifyOrderData.id,
          lineItemId: lineItem.id,
          productTitleId: lineItem.product_title_id || lineItem.product_id?.toString(),
          variantId: lineItem.variant_id?.toString(),
          title: lineItem.title || lineItem.name,
          quantity: 1, // Individual quantity
          price: parseFloat(lineItem.price || '0'),
          isAddOn: false, // Will be determined later
          shopifyOrderData: shopifyOrderData,
          cardId: cardId
        })
      }
    })
    
    return lineItems
  }, [])

  // Helper function to classify line items as add-ons
  const classifyLineItems = useCallback(async (lineItems: ProcessedLineItem[], tenantId: string): Promise<ProcessedLineItem[]> => {
    const classifiedItems: ProcessedLineItem[] = []
    
    for (const item of lineItems) {
      try {
        // Fetch saved product data to check for add-on label
        const savedProduct = await getProductByShopifyIds(
          tenantId,
          item.productTitleId,
          item.variantId
        )
        
        // Check if it's an add-on by looking for "Add-Ons" label
        const isAddOn = savedProduct?.labelNames?.includes("Add-Ons") || false
        
        classifiedItems.push({
          ...item,
          isAddOn,
          savedProductData: savedProduct
        })
      } catch (error) {
        console.warn(`Failed to classify line item ${item.cardId}:`, error)
        // If classification fails, treat as main product
        classifiedItems.push({
          ...item,
          isAddOn: false
        })
      }
    }
    
    return classifiedItems
  }, [])

  // Helper function to separate main items and add-ons
  const separateMainAndAddOns = useCallback((classifiedItems: ProcessedLineItem[]) => {
    const mainItems = classifiedItems.filter(item => !item.isAddOn)
    const addOns = classifiedItems.filter(item => item.isAddOn)
    
    return { mainItems, addOns }
  }, [])

  // Helper function to get add-ons for a specific order
  const getAddOnsForOrder = useCallback((orderId: string, allAddOns: ProcessedLineItem[]) => {
    return allAddOns.filter(addOn => addOn.orderId === orderId)
  }, [])

  // Helper to reload orders after sync/delete
  const processOrdersReload = useCallback(async (dateTag?: string) => {
    if (!tenant?.id) return;
    try {
      const tag = dateTag || (() => {
        const [year, month, day] = selectedDate.split("-");
        return `${day}/${month}/${year}`;
      })();
      const todoData = await getOrdersFromDbByDate(tenant.id, tag);
      setTodoCards(todoData);
      
      // Process the database orders into mainOrderCards and addOnCards
      const allLineItems: ProcessedLineItem[] = [];
      
      for (const order of todoData) {
        // Each order from the database is already a line item card
        const lineItem: ProcessedLineItem = {
          orderId: order.orderId,
          lineItemId: order.lineItemId,
          productTitleId: order.productTitleId,
          variantId: order.variantId,
          title: order.title,
          quantity: order.quantity,
          price: order.price,
          isAddOn: false, // Will be determined by classification
          shopifyOrderData: order.shopifyOrderData,
          cardId: order.cardId
        };
        
        allLineItems.push(lineItem);
      }
      
      // Classify line items as add-ons or main products
      const classifiedItems = await classifyLineItems(allLineItems, tenant.id);
      
      // Separate main items and add-ons
      const { mainItems, addOns } = separateMainAndAddOns(classifiedItems);
      
      setMainOrderCards(mainItems);
      setAddOnCards(addOns);
      
      console.log(`Processed ${mainItems.length} main order cards and ${addOns.length} add-on cards from database`);
      console.log('Fetched orders from DB:', todoData.map(o => ({ id: o.id, deliveryDate: o.deliveryDate })));
      console.log('Selected date for filtering:', selectedDate);
    } catch (error) {
      setError('Failed to reload orders');
    }
  }, [tenant?.id, selectedDate, classifyLineItems, separateMainAndAddOns]);

  // --- Updated Fetch Orders logic ---
  const fetchOrders = useCallback(async () => {
    if (!tenant?.id) {
      setError("No tenant found");
      return;
    }
    setProcessingOrders(true);
    setError(null);
    setFetchFeedback(null);
    try {
      // Convert selectedDate (yyyy-mm-dd) to dd/mm/yyyy
      const [year, month, day] = selectedDate.split("-");
      const dateTag = `${day}/${month}/${year}`;
      let responses = [];
      if (!selectedStore || selectedStore === "all") {
        // Fetch for all stores
        if (!stores.length) throw new Error("No stores configured");
        for (const store of stores) {
          const resp = await syncOrdersByDate(tenant.id, store.id, dateTag);
          responses.push({ store: store.name, ...resp });
        }
      } else {
        // Fetch for specific store
        const store = stores.find(s => s.id === selectedStore);
        if (!store) throw new Error("Selected store not found");
        const resp = await syncOrdersByDate(tenant.id, selectedStore, dateTag);
        responses.push({ store: store.name, ...resp });
      }
      // After sync, reload orders for the date
      await processOrdersReload(dateTag);
      setFetchFeedback(`Fetched orders for ${selectedStore === "all" ? "all stores" : stores.find(s => s.id === selectedStore)?.name || "store"}.`);
      // Log responses for debugging
      console.log("Sync responses:", responses);
    } catch (error: any) {
      setError('Failed to fetch orders: ' + (error?.message || error));
      setFetchFeedback(null);
    } finally {
      setProcessingOrders(false);
    }
  }, [tenant?.id, selectedStore, selectedDate, stores, processOrdersReload]);

  // --- Sync All Orders and Categorize by Delivery Date ---
  const syncAllOrdersByDate = useCallback(async () => {
    if (!tenant?.id) {
      setError("No tenant found");
      return;
    }
    setProcessingOrders(true);
    setError(null);
    setFetchFeedback(null);
    try {
      let responses = [];
      if (!selectedStore || selectedStore === "all") {
        // Sync all orders for all stores
        if (!stores.length) throw new Error("No stores configured");
        for (const store of stores) {
          const resp = await syncAllOrders(tenant.id, store.id);
          responses.push({ store: store.name, ...resp });
        }
      } else {
        // Sync all orders for specific store
        const store = stores.find(s => s.id === selectedStore);
        if (!store) throw new Error("Selected store not found");
        const resp = await syncAllOrders(tenant.id, selectedStore);
        responses.push({ store: store.name, ...resp });
      }
      
      setFetchFeedback(`Synced all orders for ${selectedStore === "all" ? "all stores" : stores.find(s => s.id === selectedStore)?.name || "store"}. Orders categorized by delivery date.`);
      // Log responses for debugging
      console.log("Sync all responses:", responses);
    } catch (error: any) {
      setError('Failed to sync all orders: ' + (error?.message || error));
      setFetchFeedback(null);
    } finally {
      setProcessingOrders(false);
    }
  }, [tenant?.id, selectedStore, stores]);

  // --- Clear All Orders (Fresh Start) ---
  const clearAllOrdersData = useCallback(async () => {
    if (!tenant?.id) {
      setError("No tenant found");
      return;
    }
    setProcessingOrders(true);
    setError(null);
    setFetchFeedback(null);
    try {
      const response = await clearAllOrders(tenant.id);
      setFetchFeedback(`${response.message} Database cleared successfully!`);
      
      // Clear local state
      setOrders([]);
      setTodoCards([]);
      setMainOrderCards([]);
      setAddOnCards([]);
      
      console.log("Clear all orders response:", response);
    } catch (error: any) {
      setError('Failed to clear orders: ' + (error?.message || error));
      setFetchFeedback(null);
    } finally {
      setProcessingOrders(false);
    }
  }, [tenant?.id]);

  // Now define the handler that uses them
  const handleRealtimeUpdate = useCallback((update: any) => {
    if (update.type === 'order_updated' && update.order && update.order.cardId) {
      setTodoCards(prevCards =>
        prevCards.map(card =>
          card.cardId === update.order.cardId ? { ...card, ...update.order } : card
        )
      );
      
      // Also update main order cards and add-on cards
      setMainOrderCards(prevCards =>
        prevCards.map(card =>
          card.cardId === update.order.cardId ? { ...card, ...update.order } : card
        )
      );
      
      setAddOnCards(prevCards =>
        prevCards.map(card =>
          card.cardId === update.order.cardId ? { ...card, ...update.order } : card
        )
      );
    }
  }, [])

  // Finally, use the handler in the hook
  const { isConnected, updates } = useRealtimeUpdates({
    enabled: true,
    pollInterval: 3000,
    onUpdate: handleRealtimeUpdate,
  });

  // Initial data load effect
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderUpdate = async (orderId: string, updates: any) => {
    if (!tenant?.id || !currentUser?.id) return
    
    try {
      // Update the order in the database
      await updateOrder(tenant.id, orderId, updates, currentUser.id)
      
      // Update local state to reflect changes
      setMainOrderCards(prevCards =>
        prevCards.map(card =>
          card.cardId === orderId
            ? { ...card, ...updates }
            : card
        )
      )
      
      // Also update add-on cards if needed
      setAddOnCards(prevCards =>
        prevCards.map(card =>
          card.cardId === orderId
            ? { ...card, ...updates }
            : card
        )
      )
    } catch (error) {
      console.error('Failed to update order:', error)
      setError('Failed to update order')
    }
  }

  // Handle status filter clicks
  const handleStatusFilter = (status: string) => {
    if (selectedStatus === status) {
      setSelectedStatus("all")
    } else {
      setSelectedStatus(status)
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCalendarDate(date)
      setSelectedDate(date.toISOString().split("T")[0])
    }
  }

  // Batch selection handlers
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
    setSelectedOrderIds(new Set())
  }

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrderIds(newSelected)
  }

  const selectAllOrders = () => {
    setSelectedOrderIds(new Set(orders.map((order) => order.id)))
  }

  const clearSelection = () => {
    setSelectedOrderIds(new Set())
  }

  const batchAssignToMe = () => {
    // TODO: Implement with D1 API
    console.log("Batch assign to me:", Array.from(selectedOrderIds))
  }

  const batchUnassign = () => {
    // TODO: Implement with D1 API
    console.log("Batch unassign:", Array.from(selectedOrderIds))
  }

  // Filter orders based on selected criteria
  const filteredOrders = orders.filter((order) => {
    if (selectedStatus !== "all" && order.status !== selectedStatus) return false
    if (selectedDate && order.deliveryDate !== selectedDate) return false
    if (searchQuery && !order.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
      return false
    return true
  })

  const filteredTodoCards = todoCards.filter((card) => {
    if (selectedStatus !== "all" && card.status !== selectedStatus) return false
    // we can add more client side filters here if needed
    if (searchQuery && !card.customerName.toLowerCase().includes(searchQuery.toLowerCase()))
      return false
    return true
  })

  // Filter main order cards and add-on cards
  const filteredMainOrderCards = mainOrderCards.filter((card) => {
    if (selectedStatus !== "all" && card.shopifyOrderData?.status !== selectedStatus) return false
    if (searchQuery && !card.title.toLowerCase().includes(searchQuery.toLowerCase()))
      return false
    return true
  })

  const filteredAddOnCards = addOnCards.filter((card) => {
    if (selectedStatus !== "all" && card.shopifyOrderData?.status !== selectedStatus) return false
    if (searchQuery && !card.title.toLowerCase().includes(searchQuery.toLowerCase()))
      return false
    return true
  })

  // --- Bulk Delete logic ---
  const handleBulkDelete = async () => {
    if (!tenant?.id) return;
    setBulkDeleteLoading(true);
    setError(null);
    try {
      const [year, month, day] = selectedDate.split("-");
      const dateTag = `${day}/${month}/${year}`;
      await deleteOrdersByDate(tenant.id, dateTag);
      await processOrdersReload(dateTag);
      setShowDeleteConfirm(false);
    } catch (error) {
      setError('Failed to delete orders');
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleShowProductImage = useCallback((shopifyProductId?: string, shopifyVariantId?: string) => {
    // Always pass only the numeric ID (strip gid://.../)
    const numericProductId = shopifyProductId ? shopifyProductId.split('/').pop() : undefined
    const numericVariantId = shopifyVariantId ? shopifyVariantId.split('/').pop() : undefined
    setSelectedProductId(numericProductId)
    setSelectedVariantId(numericVariantId)
    setIsProductImageModalOpen(true)
  }, [])

  // Pick a sample order for debug (first main order card if available)
  const sampleOrder = mainOrderCards.length > 0 ? mainOrderCards[0] : (orders.length > 0 ? orders[0] : null)

  // Determine if current user is admin
  const isAdmin = currentUser && currentUser.role === 'admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <div className="text-sm text-gray-500 mt-2">Loading orders...</div>
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
          <Button onClick={loadData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${isMobileView ? "space-y-4" : ""}`}>
      {/* Debug Panel (admin only) */}
      {isAdmin && (
        <div className="mb-4 p-3 border rounded bg-gray-50 text-xs">
          <button
            className="mb-2 px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => setShowDebug((v) => !v)}
          >
            {showDebug ? "Hide" : "Show"} Debug Panel
          </button>
          {showDebug && (
            <div className="overflow-x-auto max-h-96 mt-2">
              <div className="mb-2">
                <strong>Order Card Config:</strong>
                <pre className="bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(orderCardConfig, null, 2)}</pre>
              </div>
              <div>
                <strong>Sample Order Data:</strong>
                <pre className="bg-gray-100 p-2 rounded overflow-x-auto">{JSON.stringify(sampleOrder, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Real-time Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className={`font-bold ${isMobileView ? "text-lg" : "text-2xl"}`}>Orders</h1>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <span className={`text-xs ${isConnected ? "text-green-600" : "text-gray-500"}`}>
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
        {updates.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {updates.length} update{updates.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Header with stats */}
      <div className={`grid grid-cols-1 ${isMobileView ? "grid-cols-2 gap-2" : "md:grid-cols-4 gap-4"}`}>
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 ${isMobileView ? "pb-1" : ""}`}>
            <CardTitle className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Total Orders</CardTitle>
            <Package className={`text-muted-foreground ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
          </CardHeader>
          <CardContent className={isMobileView ? "pt-1" : ""}>
            <div className={`font-bold ${isMobileView ? "text-lg" : "text-2xl"}`}>{mainOrderCards.length}</div>
          </CardContent>
        </Card>
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 ${isMobileView ? "pb-1" : ""}`}>
            <CardTitle className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Add-Ons</CardTitle>
            <Gift className={`text-muted-foreground ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
          </CardHeader>
          <CardContent className={isMobileView ? "pt-1" : ""}>
            <div className={`font-bold ${isMobileView ? "text-lg" : "text-2xl"}`}>{addOnCards.length}</div>
          </CardContent>
        </Card>
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 ${isMobileView ? "pb-1" : ""}`}>
            <CardTitle className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Completed</CardTitle>
            <CheckCircle className={`text-muted-foreground ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
          </CardHeader>
          <CardContent className={isMobileView ? "pt-1" : ""}>
            <div className={`font-bold ${isMobileView ? "text-lg" : "text-2xl"}`}>
              {mainOrderCards.filter((card) => card.shopifyOrderData?.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card className={isMobileView ? "p-3" : ""}>
          <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 ${isMobileView ? "pb-1" : ""}`}>
            <CardTitle className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Pending</CardTitle>
            <CalendarDays className={`text-muted-foreground ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
          </CardHeader>
          <CardContent className={isMobileView ? "pt-1" : ""}>
            <div className={`font-bold ${isMobileView ? "text-lg" : "text-2xl"}`}>
              {mainOrderCards.filter((card) => card.shopifyOrderData?.status === "pending").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className={isMobileView ? "pb-3" : ""}>
          <CardTitle className={isMobileView ? "text-base" : ""}>Filters</CardTitle>
        </CardHeader>
        <CardContent className={`space-y-4 ${isMobileView ? "space-y-3" : ""}`}>
          <div className={`grid grid-cols-1 ${isMobileView ? "gap-3" : "md:grid-cols-2 lg:grid-cols-4 gap-4"}`}>
            {/* Date Picker */}
            <div className="space-y-2">
              <label className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`justify-start text-left font-normal ${isMobileView ? "h-9 text-sm" : "w-full"}`}>
                    <CalendarDays className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                    {calendarDate ? format(calendarDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={calendarDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Store Filter */}
            <div className="space-y-2">
              <label className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Store</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className={isMobileView ? "h-9 text-sm" : ""}>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className={isMobileView ? "h-9 text-sm" : ""}>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className={`font-medium ${isMobileView ? "text-xs" : "text-sm"}`}>Search</label>
              <div className="relative">
                <Search className={`absolute left-2 top-2.5 text-muted-foreground ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-8 ${isMobileView ? "h-9 text-sm" : ""}`}
                />
              </div>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-2"}`}>
            <Button
              variant={selectedStatus === "all" ? "default" : "outline"}
              size={isMobileView ? "sm" : "sm"}
              onClick={() => handleStatusFilter("all")}
              className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}
            >
              All
            </Button>
            <Button
              variant={selectedStatus === "pending" ? "default" : "outline"}
              size={isMobileView ? "sm" : "sm"}
              onClick={() => handleStatusFilter("pending")}
              className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}
            >
              Pending
            </Button>
            <Button
              variant={selectedStatus === "in_progress" ? "default" : "outline"}
              size={isMobileView ? "sm" : "sm"}
              onClick={() => handleStatusFilter("in_progress")}
              className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}
            >
              In Progress
            </Button>
            <Button
              variant={selectedStatus === "completed" ? "default" : "outline"}
              size={isMobileView ? "sm" : "sm"}
              onClick={() => handleStatusFilter("completed")}
              className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}
            >
              Completed
            </Button>
          </div>

          {/* Fetch Orders Button & Bulk Delete */}
          <div className="flex justify-center pt-4 gap-4">
            <Button 
              onClick={fetchOrders} 
              disabled={processingOrders || !stores.length}
              className={`${isMobileView ? "w-full text-sm h-9" : "w-full md:w-auto"}`}
            >
              {processingOrders ? (
                <>
                  <div className={`animate-spin rounded-full border-b-2 border-white mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}></div>
                  {isMobileView ? "Fetching..." : "Fetching Orders..."}
                </>
              ) : (
                <>
                  <Package className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  {isMobileView ? `Fetch ${selectedDate}` : `Fetch Orders for ${selectedDate}`}
                </>
              )}
            </Button>
            <Button 
              onClick={syncAllOrdersByDate} 
              disabled={processingOrders || !stores.length}
              variant="outline"
              className={`${isMobileView ? "w-full text-sm h-9" : "w-full md:w-auto"}`}
            >
              {processingOrders ? (
                <>
                  <div className={`animate-spin rounded-full border-b-2 border-white mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}></div>
                  {isMobileView ? "Syncing..." : "Syncing All Orders..."}
                </>
              ) : (
                <>
                  <CalendarDays className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  {isMobileView ? "Sync All" : "Sync All Orders"}
                </>
              )}
            </Button>
            <Button 
              onClick={clearAllOrdersData} 
              disabled={processingOrders || !stores.length}
              variant="secondary"
              className={`${isMobileView ? "w-full text-sm h-9" : "w-full md:w-auto"}`}
            >
              {processingOrders ? (
                <>
                  <div className={`animate-spin rounded-full border-b-2 border-white mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}></div>
                  {isMobileView ? "Clearing..." : "Clearing DB..."}
                </>
              ) : (
                <>
                  <Database className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  {isMobileView ? "Clear DB" : "Clear All Orders"}
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkDeleteLoading}
              className={`${isMobileView ? "w-full text-sm h-9" : "w-full md:w-auto"}`}
            >
              {bulkDeleteLoading ? (
                <>
                  <div className={`animate-spin rounded-full border-b-2 border-white mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  Bulk Delete
                </>
              )}
            </Button>
          </div>
          {fetchFeedback && (
            <div className="flex justify-center pt-2">
              <span className="text-green-600 text-sm">{fetchFeedback}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader className={isMobileView ? "pb-3" : ""}>
          <div className={`flex justify-between items-center ${isMobileView ? "flex-col gap-3 items-start" : ""}`}>
            <CardTitle className={isMobileView ? "text-base" : ""}>Main Orders</CardTitle>
            <div className={`flex gap-2 ${isMobileView ? "flex-wrap w-full" : ""}`}>
              <Button
                variant={isBatchMode ? "default" : "outline"}
                size="sm"
                onClick={toggleBatchMode}
                className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}
              >
                {isBatchMode ? "Exit Batch Mode" : "Batch Mode"}
              </Button>
              {isBatchMode && (
                <>
                  <Button size="sm" onClick={selectAllOrders} className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}>
                    Select All
                  </Button>
                  <Button size="sm" onClick={clearSelection} className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={batchAssignToMe} className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}>
                    Assign to Me
                  </Button>
                  <Button size="sm" onClick={batchUnassign} className={isMobileView ? "text-xs px-2 py-1 h-7" : ""}>
                    Unassign
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className={isMobileView ? "pt-0" : ""}>
          {filteredMainOrderCards.length === 0 ? (
            <div className="text-center py-8">
              <p className={`text-muted-foreground ${isMobileView ? "text-sm" : ""}`}>No main orders found for the selected criteria.</p>
              <p className={`text-muted-foreground mt-2 ${isMobileView ? "text-xs" : "text-sm"}`}>
                Select a date to fetch orders.
              </p>
            </div>
          ) : (
            <div className={`space-y-4 ${isMobileView ? "space-y-3" : ""}`}>
              {filteredMainOrderCards.map((order) => (
                <OrderCard
                  key={order.cardId}
                  order={normalizeOrderForConfig(order)}
                  fields={orderCardConfig}
                  users={florists}
                  difficultyLabels={productLabels.filter(p => p.category === 'difficulty')}
                  productTypeLabels={productLabels.filter(p => p.category === 'productType')}
                  onShowProductImage={handleShowProductImage}
                  onUpdate={handleOrderUpdate}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add-Ons Processing Container */}
      {filteredAddOnCards.length > 0 && (
        <Card>
          <CardHeader className={isMobileView ? "pb-3" : ""}>
            <div className={`flex justify-between items-center ${isMobileView ? "flex-col gap-3 items-start" : ""}`}>
              <CardTitle className={isMobileView ? "text-base" : ""}>
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4" />
                  Add-Ons for Processing
                </div>
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {filteredAddOnCards.length} add-on{filteredAddOnCards.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className={isMobileView ? "pt-0" : ""}>
            <div className={`space-y-4 ${isMobileView ? "space-y-3" : ""}`}>
              {filteredAddOnCards.map((card) => (
                <OrderCard
                  key={card.cardId}
                  order={normalizeOrderForConfig(card)}
                  fields={orderCardConfig}
                  users={florists}
                  difficultyLabels={productLabels.filter(p => p.category === 'difficulty')}
                  productTypeLabels={productLabels.filter(p => p.category === 'productType')}
                  onShowProductImage={handleShowProductImage}
                  onUpdate={handleOrderUpdate}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all orders for <b>{selectedDate}</b>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={bulkDeleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleteLoading}>
              {bulkDeleteLoading ? "Deleting..." : "Delete All"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        shopifyProductId={selectedProductId}
        shopifyVariantId={selectedVariantId}
        tenantId={tenant?.id}
      />
    </div>
  )
}
