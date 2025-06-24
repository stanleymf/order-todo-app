import React, { useState, useEffect, useCallback, useMemo } from "react"
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
import { syncShopifyProduct } from "../services/api"
import type { Order, User as UserType } from "../types"
import type { OrderCardField } from "../types/orderCardFields"

interface ProcessedOrder extends Order {
  shopifyOrderData?: any
  timeWindow?: string
  isExpress?: boolean
  storeData?: any
  storeId?: string
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
  const { tenant } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [localNotes, setLocalNotes] = useState(order.notes || "")
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

  // Field Mappings utility functions (from OrderCardPreview)
  const getValueFromShopifyData = (sourcePath: string, data: any): any => {
    if (!sourcePath || !data) {
      console.log('[FIELD-MAPPING] Missing sourcePath or data', { sourcePath, hasData: !!data })
      return null;
    }

    console.log('[FIELD-MAPPING] Starting extraction', { sourcePath, dataKeys: Object.keys(data) })

    const parts = sourcePath.split('.');
    let current: any = data;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log('[FIELD-MAPPING] Processing part', { part, currentType: typeof current, currentKeys: current && typeof current === 'object' ? Object.keys(current) : 'N/A' })
      
      if (current === null || typeof current === 'undefined') {
        console.log('[FIELD-MAPPING] Current is null/undefined, returning null')
        return null;
      }

      if (Array.isArray(current)) {
        // Check if the part is a numeric index
        const index = parseInt(part);
        if (!isNaN(index)) {
          // This is an array index
          if (index >= 0 && index < current.length) {
            current = current[index];
            console.log('[FIELD-MAPPING] Array index access', { index, newCurrent: current })
          } else {
            console.log('[FIELD-MAPPING] Array index out of bounds', { index, arrayLength: current.length })
            return null;
          }
        } else {
          // This is for arrays like note_attributes, which are {name, value} pairs
          // We assume the *next* part of the path is the 'name' we're looking for.
          const nextPart = parts[i + 1];
          if (nextPart) {
            const item = current.find(d => d.name === nextPart);
            current = item ? item.value : null;
            console.log('[FIELD-MAPPING] Array name-value processing', { nextPart, item, current })
            // We've used the next part, so we skip it in the next iteration
            i++; // Skip the next iteration
          } else {
            // If there's no next part, it means we're targeting the array itself (like 'tags')
            console.log('[FIELD-MAPPING] Returning array', current)
            return current;
          }
        }
      } else if (typeof current === 'object' && part in current) {
        current = current[part];
        console.log('[FIELD-MAPPING] Object property access', { part, newCurrent: current })
      } else {
        console.log('[FIELD-MAPPING] Property not found', { part, currentType: typeof current, currentKeys: current && typeof current === 'object' ? Object.keys(current) : 'N/A' })
        return null;
      }
    }

    console.log('[FIELD-MAPPING] Final result', current)
    return current;
  };

  const applyTransformation = (value: any, field: OrderCardField): any => {
    if (field.transformation === "extract" && field.transformationRule) {
      // If the value is an array (like tags), search for the pattern in each element
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string') {
            const match = item.match(new RegExp(field.transformationRule));
            if (match) return match[0];
          }
        }
        return "Not set"; // No match found in the array
      }
      // Original logic for string values
      if (typeof value === "string") {
        try {
          const regex = new RegExp(field.transformationRule);
          const match = value.match(regex);
          return match ? match[0] : "Not set";
        } catch (e) {
          console.error("Invalid regex:", e);
          return "Invalid Regex";
        }
      }
      return "Not set"; // Can't apply regex to non-string, non-array
    }

    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value ?? "Not set";
  };

  // Field value getter using Field Mappings configuration
  const getFieldValue = (field: OrderCardField): string => {
    try {
      if (!order.shopifyOrderData) return "N/A"
      
      // Handle order-level fields first (not from Shopify data)
      if (field.id === 'customerName') {
        return order.customerName || "N/A"
      }
      if (field.id === 'orderNumber' || field.id === 'orderId') {
        return order.shopifyOrderId || "N/A"
      }
      if (field.id === 'status') {
        return order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || "N/A"
      }
      if (field.id === 'assignedTo') {
        const florist = florists.find(f => f.id === order.assignedTo)
        return florist ? florist.name : "Unassigned"
      }
      if (field.id === 'notes') {
        return order.notes || "No notes"
      }
      
      // Handle label fields from saved products
      if (field.id === 'difficultyLabel') {
        return productLabels.difficultyLabel || "Standard"
      }
      if (field.id === 'productTypeLabel') {
        return productLabels.productTypeLabel || "Arrangement"
      }
      
      // Handle Shopify fields using Field Mappings configuration
      if (field.shopifyFields && field.shopifyFields.length > 0) {
        for (const shopifyField of field.shopifyFields) {
          let value = getValueFromShopifyData(shopifyField, order.shopifyOrderData)
          
          if (value !== undefined && value !== null && value !== "") {
            // Apply transformation based on field configuration
            const transformedValue = applyTransformation(value, field)
            
            console.log(`[FIELD-MAPPING] ${field.id}:`, {
              fieldId: field.id,
              shopifyField,
              rawValue: value,
              transformation: field.transformation,
              transformationRule: field.transformationRule,
              transformedValue
            })
            
            if (transformedValue !== "Not set" && transformedValue !== null && transformedValue !== undefined) {
              return String(transformedValue)
            }
          }
        }
      }
      
      return "N/A"
    } catch (error) {
      console.error(`Error getting field value for ${field.id}:`, error)
      return "Error"
    }
  }

  // Get product information
  const getProductInfo = () => {
    try {
      // Check GraphQL format first (lineItems.edges)
      const graphQLLineItems = order.shopifyOrderData?.lineItems?.edges
      if (graphQLLineItems && graphQLLineItems.length > 0) {
        const firstItem = graphQLLineItems[0].node
        return {
          productTitle: firstItem.title || 'Unknown Product',
          variantTitle: firstItem.variant?.title || null,
          productId: firstItem.product?.id?.replace('gid://shopify/Product/', '') || null,
          variantId: firstItem.variant?.id?.replace('gid://shopify/ProductVariant/', '') || null
        }
      }
      
      // Fallback to REST format (line_items)
      const restLineItems = order.shopifyOrderData?.line_items
      if (restLineItems && restLineItems.length > 0) {
        const firstItem = restLineItems[0]
        return {
          productTitle: firstItem.title || 'Unknown Product',
          variantTitle: firstItem.variant_title || null,
          productId: firstItem.product_id?.toString() || null,
          variantId: firstItem.variant_id?.toString() || null
        }
      }
      
      return {
        productTitle: 'Unknown Product',
        variantTitle: null,
        productId: null,
        variantId: null
      }
    } catch (error) {
      console.error('Error getting product info:', error)
      return {
        productTitle: 'Error loading product',
        variantTitle: null,
        productId: null,
        variantId: null
      }
    }
  }

  // Get product labels from saved products
  const productLabels = useMemo(() => {
    try {
      if (order.savedProductData?.labelNames && order.savedProductData.labelNames.length > 0) {
        const difficultyIndex = order.savedProductData.labelCategories?.indexOf('difficulty')
        const productTypeIndex = order.savedProductData.labelCategories?.indexOf('productType')
        
        return {
          difficultyLabel: difficultyIndex !== -1 ? order.savedProductData.labelNames[difficultyIndex] : null,
          difficultyColor: difficultyIndex !== -1 ? order.savedProductData.labelColors[difficultyIndex] : null,
          productTypeLabel: productTypeIndex !== -1 ? order.savedProductData.labelNames[productTypeIndex] : null,
          productTypeColor: productTypeIndex !== -1 ? order.savedProductData.labelColors[productTypeIndex] : null
        }
      }
      
      // Fallback to processed order labels
      return {
        difficultyLabel: order.difficultyLabel || null,
        difficultyColor: null,
        productTypeLabel: order.productTypeLabel || null,
        productTypeColor: null
      }
    } catch (error) {
      console.error('Error processing product labels:', error)
      return {
        difficultyLabel: null,
        difficultyColor: null,
        productTypeLabel: null,
        productTypeColor: null
      }
    }
  }, [order.savedProductData, order.difficultyLabel, order.productTypeLabel])

  const productInfo = getProductInfo()

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

  // Notes update handler
  const handleNotesUpdate = async () => {
    if (localNotes === order.notes) return
    
    try {
      await onUpdate(order.id, { notes: localNotes })
    } catch (error) {
      console.error("Failed to update notes:", error)
      setLocalNotes(order.notes || "")
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

  // Handle eye icon click to open ProductImageModal
  const handleEyeIconClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card expansion
    setIsImageModalOpen(true)
  }

  // Handle card click for expand/collapse (white space)
  const handleCardClick = () => {
    setIsExpanded(!isExpanded)
  }

  // Handle notes click to prevent card collapse
  const handleNotesClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Handle sync product for ProductImageModal
  const handleSyncProduct = async (shopifyProductId: string) => {
    if (!tenant?.id) return
    try {
      await syncShopifyProduct(tenant.id, order.storeId || '', shopifyProductId)
    } catch (error) {
      console.error('Failed to sync product:', error)
      throw error
    }
  }

  // Check if order is express
  const isExpress = order.shopifyOrderData?.tags?.toLowerCase().includes('express') || false

  return (
    <>
      <Card 
        className={`transition-all duration-200 hover:shadow-md border cursor-pointer ${
          isExpress ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
        } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
        onClick={handleCardClick}
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
                  
                  {/* Eye icon for ProductImageModal */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEyeIconClick}
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
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusUpdate('pending')
                }}
                disabled={isUpdating}
                className={getStatusButtonStyle('pending').className}
              >
                {getStatusButtonStyle('pending').icon}
              </Button>

              {/* Assigned Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusUpdate('assigned')
                }}
                disabled={isUpdating}
                className={getStatusButtonStyle('assigned').className}
              >
                {getStatusButtonStyle('assigned').icon}
              </Button>

              {/* Completed Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusUpdate('completed')
                }}
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
                  {getFieldValue({ id: 'status' } as OrderCardField)}
                </p>
              </div>

              {/* Editable Notes */}
              <div onClick={handleNotesClick}>
                <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Notes:
                </label>
                <Textarea
                  value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  onBlur={handleNotesUpdate}
                  placeholder="Add order notes..."
                  className="mt-1 min-h-[80px] resize-none"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Product Image Modal */}
      <ProductImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        shopifyProductId={productInfo.productId}
        shopifyVariantId={productInfo.variantId}
        tenantId={tenant?.id}
        notes={localNotes}
        onNotesChange={setLocalNotes}
        onSave={async (notes) => {
          setLocalNotes(notes)
          await onUpdate(order.id, { notes })
        }}
        onSyncProduct={handleSyncProduct}
      />
    </>
  )
}

