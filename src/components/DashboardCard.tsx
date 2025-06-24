import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import {
  Eye,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle,
  UserCheck,
} from "lucide-react"
import { ProductImageModal } from "./shared/ProductImageModal"
import { useAuth } from "../contexts/AuthContext"
import type { Order, User as UserType } from "../types"
import type { OrderCardField } from "../types/orderCardFields"

interface ProcessedOrder extends Order {
  shopifyOrderData?: any
  timeWindow?: string
  isExpress?: boolean
  storeData?: any
  difficultyLabel?: string
  productTypeLabel?: string
  savedProductData?: {
    labelNames: string[]
    labelCategories: string[]
    labelColors: string[]
  }
}

interface DashboardCardProps {
  order: ProcessedOrder
  config: OrderCardField[]
  onUpdate: (orderId: string, updates: Partial<Order>) => Promise<void>
  florists: UserType[]
  currentUser: UserType | null
  isMobileView?: boolean
}

// Cache for product label API calls
const productLabelCache = new Map<string, any>()
const pendingRequests = new Map<string, Promise<any>>()

export function DashboardCard({
  order,
  config,
  onUpdate,
  florists,
  currentUser,
  isMobileView = false
}: DashboardCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [notes, setNotes] = useState(order.notes || "")
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false)
  const [productLabels, setProductLabels] = useState<{
    difficultyLabel?: string
    difficultyColor?: string
    productTypeLabel?: string
    productTypeColor?: string
  }>({})

  const { tenant } = useAuth()

  // Get field values using config mappings
  const getFieldValue = (field: OrderCardField): string => {
    try {
      // Handle special fields first
      switch (field.id) {
        case 'difficultyLabel':
          return productLabels.difficultyLabel || "Standard"
        case 'productTypeLabel':
          return productLabels.productTypeLabel || "Arrangement"
        case 'timeslot':
          return order.timeWindow || extractTimeslotFromTags() || "Time not specified"
        case 'orderDate':
          return order.deliveryDate || extractDateFromTags() || "Date not specified"
        case 'addOns':
          return extractAddOnsFromData() || "Not set"
        case 'notes':
          return order.notes || "Not set"
        case 'isCompleted':
          return order.status === 'completed' ? 'Completed' : 'Pending'
        case 'assignedTo':
          const assignedFlorist = florists.find(f => f.id === order.assignedTo)
          return assignedFlorist?.name || "Unassigned"
      }

      // Handle Shopify field mappings
      if (field.shopifyFields && order.shopifyOrderData) {
        for (const shopifyField of field.shopifyFields) {
          let value = getNestedValue(order.shopifyOrderData, shopifyField)
          
          if (value !== undefined && value !== null) {
            // Apply transformation if specified
            if (field.transformation === 'extract' && field.transformationRule) {
              const regex = new RegExp(field.transformationRule, 'i')
              const match = String(value).match(regex)
              value = match ? match[1] || match[0] : value
            }
            return String(value)
          }
        }
      }

      // Fallback to order properties
      const orderValue = getNestedValue(order, field.id)
      return orderValue !== undefined && orderValue !== null ? String(orderValue) : "Not specified"
    } catch (error) {
      console.error(`Error getting field value for ${field.id}:`, error)
      return "Error loading field"
    }
  }

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => {
      if (current && typeof current === 'object' && key in current) {
        return current[key]
      }
      return undefined
    }, obj)
  }

  // Extract timeslot from tags
  const extractTimeslotFromTags = (): string | null => {
    if (!order.shopifyOrderData?.tags) return null
    const timePattern = /\b(\d{1,2}:\d{2}-\d{1,2}:\d{2})\b/
    const match = order.shopifyOrderData.tags.match(timePattern)
    return match ? match[1] : null
  }

  // Extract date from tags
  const extractDateFromTags = (): string | null => {
    if (!order.shopifyOrderData?.tags) return null
    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/
    const match = order.shopifyOrderData.tags.match(datePattern)
    return match ? match[1] : null
  }

  // Extract add-ons from order data
  const extractAddOnsFromData = (): string | null => {
    // Check line items for add-ons
    if (order.shopifyOrderData?.line_items) {
      const addOns = order.shopifyOrderData.line_items
        .filter((item: any) => item.title?.toLowerCase().includes('add'))
        .map((item: any) => item.title)
      if (addOns.length > 0) {
        return addOns.join(', ')
      }
    }
    return null
  }

  // Get product title and variant for display
  const getProductInfo = () => {
    if (order.shopifyOrderData?.line_items?.[0]) {
      const firstItem = order.shopifyOrderData.line_items[0]
      return {
        productTitle: firstItem.title || firstItem.name || "Product",
        variantTitle: firstItem.variant_title || "",
        productId: firstItem.product_id,
        variantId: firstItem.variant_id,
      }
    }
    return {
      productTitle: "Product",
      variantTitle: "",
      productId: undefined,
      variantId: undefined,
    }
  }

  const productInfo = getProductInfo()

  // Fetch product labels from saved products API
  const fetchProductLabels = useCallback(async () => {
    if (!tenant?.id || !productInfo.productId || !productInfo.variantId) return

    const cacheKey = `${productInfo.productId}-${productInfo.variantId}`
    
    // Check cache first
    if (productLabelCache.has(cacheKey)) {
      const cached = productLabelCache.get(cacheKey)
      if (cached?.labelNames && cached?.labelCategories && cached?.labelColors) {
        const difficultyIndex = cached.labelCategories.findIndex((cat: string) => cat === 'difficulty')
        const productTypeIndex = cached.labelCategories.findIndex((cat: string) => cat === 'productType')
        
        setProductLabels({
          difficultyLabel: difficultyIndex >= 0 ? cached.labelNames[difficultyIndex] : undefined,
          difficultyColor: difficultyIndex >= 0 ? cached.labelColors[difficultyIndex] : undefined,
          productTypeLabel: productTypeIndex >= 0 ? cached.labelNames[productTypeIndex] : undefined,
          productTypeColor: productTypeIndex >= 0 ? cached.labelColors[productTypeIndex] : undefined,
        })
      }
      return
    }

    // Check if request is already pending
    if (pendingRequests.has(cacheKey)) {
      try {
        const result = await pendingRequests.get(cacheKey)
        if (result?.labelNames && result?.labelCategories && result?.labelColors) {
          const difficultyIndex = result.labelCategories.findIndex((cat: string) => cat === 'difficulty')
          const productTypeIndex = result.labelCategories.findIndex((cat: string) => cat === 'productType')
          
          setProductLabels({
            difficultyLabel: difficultyIndex >= 0 ? result.labelNames[difficultyIndex] : undefined,
            difficultyColor: difficultyIndex >= 0 ? result.labelColors[difficultyIndex] : undefined,
            productTypeLabel: productTypeIndex >= 0 ? result.labelNames[productTypeIndex] : undefined,
            productTypeColor: productTypeIndex >= 0 ? result.labelColors[productTypeIndex] : undefined,
          })
        }
      } catch (error) {
        console.error("Error waiting for pending request:", error)
      }
      return
    }

    try {
      const jwt = localStorage.getItem("auth_token")
      const fetchPromise = fetch(`/api/tenants/${tenant.id}/saved-products/by-shopify-id?shopify_product_id=${productInfo.productId}&shopify_variant_id=${productInfo.variantId}`, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json"
        }
      }).then(res => res.ok ? res.json() : Promise.reject('Network error'))

      // Store the pending request
      pendingRequests.set(cacheKey, fetchPromise)
      
      const result = await fetchPromise
      
      // Cache the result
      productLabelCache.set(cacheKey, result)
      
      // Clean up pending request
      pendingRequests.delete(cacheKey)
      
      if (result?.labelNames && result?.labelCategories && result?.labelColors) {
        const difficultyIndex = result.labelCategories.findIndex((cat: string) => cat === 'difficulty')
        const productTypeIndex = result.labelCategories.findIndex((cat: string) => cat === 'productType')
        
        setProductLabels({
          difficultyLabel: difficultyIndex >= 0 ? result.labelNames[difficultyIndex] : undefined,
          difficultyColor: difficultyIndex >= 0 ? result.labelColors[difficultyIndex] : undefined,
          productTypeLabel: productTypeIndex >= 0 ? result.labelNames[productTypeIndex] : undefined,
          productTypeColor: productTypeIndex >= 0 ? result.labelColors[productTypeIndex] : undefined,
        })
      }
      
    } catch (error) {
      console.error("Failed to fetch product labels:", error)
      // Clean up pending request on error
      pendingRequests.delete(cacheKey)
    }
  }, [tenant?.id, productInfo.productId, productInfo.variantId])

  // Fetch product labels on mount
  useEffect(() => {
    fetchProductLabels()
  }, [fetchProductLabels])

  // Status update handlers
  const handleStatusUpdate = async (newStatus: 'pending' | 'assigned' | 'completed') => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      const updates: Partial<Order> = { status: newStatus }
      
      // Auto-assign to current user when setting to assigned or completed
      if ((newStatus === 'assigned' || newStatus === 'completed') && currentUser) {
        updates.assignedTo = currentUser.id
      }
      
      await onUpdate(order.id, updates)
    } catch (error) {
      console.error("Failed to update status:", error)
    } finally {
      setIsUpdating(false)
    }
  }



  const handleNotesUpdate = async () => {
    if (isUpdating || notes === order.notes) return
    
    setIsUpdating(true)
    try {
      await onUpdate(order.id, { notes })
    } catch (error) {
      console.error("Failed to update notes:", error)
      setNotes(order.notes || "") // Revert on error
    } finally {
      setIsUpdating(false)
    }
  }

  // Get status button styles
  const getStatusButtonStyle = (status: 'pending' | 'assigned' | 'completed') => {
    const isActive = order.status === status
    switch (status) {
      case 'pending':
        return {
          className: `w-10 h-10 rounded-full ${isActive ? 'bg-gray-400 hover:bg-gray-500' : 'bg-white border-2 border-gray-300 hover:border-gray-400'} transition-colors`,
          icon: <AlertTriangle className={`h-4 w-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
        }
      case 'assigned':
        return {
          className: `w-10 h-10 rounded-full ${isActive ? 'bg-blue-500 hover:bg-blue-600' : 'bg-white border-2 border-blue-300 hover:border-blue-400'} transition-colors`,
          icon: <UserCheck className={`h-4 w-4 ${isActive ? 'text-white' : 'text-blue-400'}`} />
        }
      case 'completed':
        return {
          className: `w-10 h-10 rounded-full ${isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-white border-2 border-green-300 hover:border-green-400'} transition-colors`,
          icon: <CheckCircle className={`h-4 w-4 ${isActive ? 'text-white' : 'text-green-400'}`} />
        }
    }
  }

  // Check if order is express
  const isExpress = order.shopifyOrderData?.tags?.toLowerCase().includes('express') || false

  return (
    <>
      <Card 
        className={`transition-all duration-200 hover:shadow-md border ${
          isExpress ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
        } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
      >
        <CardHeader className={`pb-3 ${isMobileView ? 'p-3' : 'p-4'}`}>
          {/* Collapsed State */}
          <div className="flex items-center justify-between">
            {/* Left: Product Info and Eye Icon */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Product Title and Variant */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-semibold text-gray-900 truncate ${
                    isMobileView ? 'text-sm' : 'text-base'
                  }`}>
                    {productInfo.productTitle}
                  </h3>
                  
                  {/* Eye icon for expansion */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600 flex-shrink-0"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
                
                {/* Variant Title */}
                {productInfo.variantTitle && (
                  <p className={`text-gray-600 truncate ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    {productInfo.variantTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Horizontal Status Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Pending Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusUpdate('pending')}
                disabled={isUpdating}
                className={getStatusButtonStyle('pending').className}
              >
                {getStatusButtonStyle('pending').icon}
              </Button>

              {/* Assigned Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusUpdate('assigned')}
                disabled={isUpdating}
                className={getStatusButtonStyle('assigned').className}
              >
                {getStatusButtonStyle('assigned').icon}
              </Button>

              {/* Completed Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleStatusUpdate('completed')}
                disabled={isUpdating}
                className={getStatusButtonStyle('completed').className}
              >
                {getStatusButtonStyle('completed').icon}
              </Button>
            </div>
          </div>

          {/* Difficulty Label (below status buttons) */}
          {productLabels.difficultyLabel && (
            <div className="flex justify-end mt-2">
              <Badge 
                variant="outline" 
                style={{ 
                  backgroundColor: productLabels.difficultyColor ? `${productLabels.difficultyColor}20` : undefined,
                  borderColor: productLabels.difficultyColor || undefined,
                  color: productLabels.difficultyColor || undefined
                }}
              >
                {productLabels.difficultyLabel}
              </Badge>
            </div>
          )}
        </CardHeader>

        {/* Expanded Content */}
        {isExpanded && (
          <CardContent className={`pt-0 border-t border-gray-100 ${isMobileView ? 'p-3' : 'p-4'}`}>
            <div className="space-y-4">
              {/* Product Title */}
              <div>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Product Title:
                </label>
                <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                  {productInfo.productTitle}
                </p>
              </div>

              {/* Variant Title */}
              {productInfo.variantTitle && (
                <div>
                  <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    Variant Title:
                  </label>
                  <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                    {productInfo.variantTitle}
                  </p>
                </div>
              )}

              {/* Timeslot */}
              <div>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Timeslot:
                </label>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                    {getFieldValue({ id: 'timeslot' } as OrderCardField)}
                  </p>
                </div>
              </div>

              {/* Order Date */}
              <div>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Order Date:
                </label>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                    {getFieldValue({ id: 'orderDate' } as OrderCardField)}
                  </p>
                </div>
              </div>

              {/* Difficulty Label */}
              {productLabels.difficultyLabel && (
                <div>
                  <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    Difficulty Label:
                  </label>
                  <Badge 
                    variant="outline" 
                    style={{ 
                      backgroundColor: productLabels.difficultyColor ? `${productLabels.difficultyColor}20` : undefined,
                      borderColor: productLabels.difficultyColor || undefined,
                      color: productLabels.difficultyColor || undefined
                    }}
                  >
                    {productLabels.difficultyLabel}
                  </Badge>
                </div>
              )}

              {/* Add-Ons */}
              <div>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Add-Ons:
                </label>
                <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                  {getFieldValue({ id: 'addOns' } as OrderCardField)}
                </p>
              </div>

              {/* Status */}
              <div>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Status:
                </label>
                <p className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                  {order.status === 'completed' ? 'Completed' : order.status === 'assigned' ? `Assigned${currentUser && order.assignedTo === currentUser.id ? ` to ${currentUser.name}` : ''}` : 'Pending'}
                </p>
              </div>

              {/* Editable Notes Textbox */}
              <div className="space-y-2">
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Notes:
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesUpdate}
                  onClick={(e) => e.stopPropagation()} // Prevent collapse on click
                  placeholder="Add notes..."
                  disabled={isUpdating}
                  className={`resize-none min-h-[60px] ${isMobileView ? 'text-sm' : ''}`}
                  style={{ minHeight: '60px' }}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Product Image Modal */}
      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        shopifyProductId={productInfo.productId}
        shopifyVariantId={productInfo.variantId}
      />
    </>
  )
}

