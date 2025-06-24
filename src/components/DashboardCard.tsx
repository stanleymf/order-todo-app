import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import {
  Eye,
  Clock,
  User,
  Package,
  MapPin,
  Phone,
  Calendar,
  Star,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  Store,
  Tag,
  Zap,
} from "lucide-react"
import { format } from "date-fns"
import { ProductImageModal } from "./shared/ProductImageModal"
import type { Order, User as UserType } from "../types"
import type { OrderCardField } from "../types/orderCardFields"

interface ProcessedOrder extends Order {
  shopifyOrderData?: any
  timeWindow?: string
  isExpress?: boolean
  storeData?: any
  difficultyLabel?: string
  productTypeLabel?: string
}

interface DashboardCardProps {
  order: ProcessedOrder
  config: OrderCardField[]
  onUpdate: (orderId: string, updates: Partial<Order>) => Promise<void>
  florists: UserType[]
  currentUser: UserType | null
  isMobileView?: boolean
}

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

  // Get field values using config mappings
  const getFieldValue = (field: OrderCardField): string => {
    try {
      // Handle special fields first
      switch (field.name) {
        case 'difficultyLabel':
          return order.difficultyLabel || "Standard"
        case 'productTypeLabel':
          return order.productTypeLabel || "Arrangement"
        case 'timeWindow':
          return order.timeWindow || "Time not specified"
        case 'storeName':
          return order.storeData?.name || "Unknown Store"
        case 'customerName':
          return order.customerName || "No customer name"
        case 'deliveryDate':
          return order.deliveryDate || "Date not specified"
        case 'notes':
          return order.notes || "No notes added"
        case 'status':
          return order.status || "unassigned"
        case 'assignedTo':
          const assignedFlorist = florists.find(f => f.id === order.assignedTo)
          return assignedFlorist?.name || "Unassigned"
      }

      // Handle Shopify field mappings
      if (field.shopifyFields && order.shopifyOrderData) {
        for (const shopifyField of field.shopifyFields) {
          let value = getNestedValue(order.shopifyOrderData, shopifyField.path)
          
          if (value !== undefined && value !== null) {
            // Apply transformation if specified
            if (shopifyField.transform?.type === 'regex' && shopifyField.transform.pattern) {
              const regex = new RegExp(shopifyField.transform.pattern, 'i')
              const match = String(value).match(regex)
              value = match ? match[1] || match[0] : value
            }
            return String(value)
          }
        }
      }

      // Fallback to order properties
      const orderValue = getNestedValue(order, field.name)
      return orderValue !== undefined && orderValue !== null ? String(orderValue) : "Not specified"
    } catch (error) {
      console.error(`Error getting field value for ${field.name}:`, error)
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

  // Status update handlers
  const handleStatusUpdate = async (newStatus: 'unassigned' | 'assigned' | 'completed') => {
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

  const handleAssignmentUpdate = async (floristId: string) => {
    if (isUpdating) return
    
    setIsUpdating(true)
    try {
      await onUpdate(order.id, { 
        assignedTo: floristId,
        status: floristId ? 'assigned' : 'unassigned'
      })
    } catch (error) {
      console.error("Failed to update assignment:", error)
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

  // Get status colors and icons
  const getStatusConfig = () => {
    switch (order.status) {
      case 'completed':
        return {
          color: 'bg-green-500 hover:bg-green-600',
          icon: <CheckCircle className="h-3 w-3" />,
          text: 'Completed'
        }
      case 'assigned':
        return {
          color: 'bg-blue-500 hover:bg-blue-600',
          icon: <UserCheck className="h-3 w-3" />,
          text: 'Assigned'
        }
      default:
        return {
          color: 'bg-gray-400 hover:bg-gray-500',
          icon: <AlertTriangle className="h-3 w-3" />,
          text: 'Unassigned'
        }
    }
  }

  const statusConfig = getStatusConfig()

  // Get difficulty color
  const getDifficultyColor = () => {
    const difficulty = order.difficultyLabel?.toLowerCase()
    switch (difficulty) {
      case 'easy': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'hard': return 'text-red-600'
      case 'very hard': return 'text-purple-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <>
      <Card 
        className={`transition-all duration-200 hover:shadow-md border ${
          order.isExpress ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
        } ${isExpanded ? 'ring-2 ring-blue-500' : ''}`}
      >
        <CardHeader className={`pb-3 ${isMobileView ? 'p-3' : 'p-4'}`}>
          {/* Header Row */}
          <div className="flex items-center justify-between">
            {/* Left: Product Info and Labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {/* Store Indicator */}
                {order.storeData && (
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: order.storeData.color || '#3B82F6' }}
                    />
                    <span className={`text-xs text-gray-500 ${isMobileView ? 'hidden' : ''}`}>
                      {order.storeData.name}
                    </span>
                  </div>
                )}

                {/* Express Badge */}
                {order.isExpress && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    <Zap className="h-3 w-3 mr-1" />
                    Express
                  </Badge>
                )}

                {/* Time Window */}
                {order.timeWindow && (
                  <Badge variant="outline" className="text-blue-600 border-blue-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {order.timeWindow}
                  </Badge>
                )}
              </div>

              {/* Product Title */}
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
                  className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600"
                >
                  <Eye className="h-3 w-3" />
                </Button>

                {/* Product Image Modal Trigger */}
                {productInfo.productId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsProductImageModalOpen(true)}
                    className="p-1 h-6 w-6 text-gray-400 hover:text-gray-600"
                  >
                    <Package className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Variant Title */}
              {productInfo.variantTitle && (
                <p className={`text-gray-600 truncate ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  {productInfo.variantTitle}
                </p>
              )}

              {/* Labels Row */}
              <div className="flex items-center gap-2 mt-2">
                {/* Difficulty Label */}
                <Badge variant="outline" className={getDifficultyColor()}>
                  <Star className="h-3 w-3 mr-1" />
                  {order.difficultyLabel || 'Standard'}
                </Badge>

                {/* Product Type Label */}
                <Badge variant="outline" className="text-purple-600 border-purple-600">
                  <Tag className="h-3 w-3 mr-1" />
                  {order.productTypeLabel || 'Arrangement'}
                </Badge>
              </div>
            </div>

            {/* Right: Status Buttons */}
            <div className="flex flex-col gap-1">
              <Button
                size="sm"
                variant={order.status === 'unassigned' ? 'default' : 'outline'}
                onClick={() => handleStatusUpdate('unassigned')}
                disabled={isUpdating}
                className={`h-6 px-2 text-xs ${
                  order.status === 'unassigned' ? 'bg-gray-400 hover:bg-gray-500' : ''
                }`}
              >
                {statusConfig.icon}
              </Button>
              <Button
                size="sm"
                variant={order.status === 'assigned' ? 'default' : 'outline'}
                onClick={() => handleStatusUpdate('assigned')}
                disabled={isUpdating}
                className={`h-6 px-2 text-xs ${
                  order.status === 'assigned' ? 'bg-blue-500 hover:bg-blue-600' : ''
                }`}
              >
                <UserCheck className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant={order.status === 'completed' ? 'default' : 'outline'}
                onClick={() => handleStatusUpdate('completed')}
                disabled={isUpdating}
                className={`h-6 px-2 text-xs ${
                  order.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''
                }`}
              >
                <CheckCircle className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Expanded Content */}
        {isExpanded && (
          <CardContent className={`pt-0 border-t border-gray-100 ${isMobileView ? 'p-3' : 'p-4'}`}>
            <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {/* Customer & Order Info */}
              <div className="space-y-3">
                <h4 className={`font-medium text-gray-900 ${isMobileView ? 'text-sm' : ''}`}>
                  Order Details
                </h4>
                
                {config
                  .filter(field => field.visible && field.category === 'customer')
                  .map((field) => (
                    <div key={field.id} className="flex items-center gap-2">
                      {field.icon && (
                        <div className="text-gray-400">
                          {getFieldIcon(field.icon)}
                        </div>
                      )}
                      <div>
                        <span className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                          {field.label}:
                        </span>
                        <span className={`ml-1 font-medium ${isMobileView ? 'text-sm' : ''}`}>
                          {getFieldValue(field)}
                        </span>
                      </div>
                    </div>
                  ))}

                {/* Assignment Dropdown */}
                <div className="space-y-2">
                  <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    Assigned To:
                  </label>
                  <Select
                    value={order.assignedTo || ""}
                    onValueChange={handleAssignmentUpdate}
                    disabled={isUpdating}
                  >
                    <SelectTrigger className={isMobileView ? 'h-8 text-sm' : ''}>
                      <SelectValue placeholder="Select florist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {florists.map((florist) => (
                        <SelectItem key={florist.id} value={florist.id}>
                          {florist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes & Additional Fields */}
              <div className="space-y-3">
                <h4 className={`font-medium text-gray-900 ${isMobileView ? 'text-sm' : ''}`}>
                  Additional Information
                </h4>

                {/* Other config fields */}
                {config
                  .filter(field => field.visible && field.category !== 'customer' && field.name !== 'notes')
                  .map((field) => (
                    <div key={field.id} className="flex items-center gap-2">
                      {field.icon && (
                        <div className="text-gray-400">
                          {getFieldIcon(field.icon)}
                        </div>
                      )}
                      <div>
                        <span className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                          {field.label}:
                        </span>
                        <span className={`ml-1 font-medium ${isMobileView ? 'text-sm' : ''}`}>
                          {getFieldValue(field)}
                        </span>
                      </div>
                    </div>
                  ))}

                {/* Notes */}
                <div className="space-y-2">
                  <label className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    Notes:
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={handleNotesUpdate}
                    placeholder="Add notes..."
                    disabled={isUpdating}
                    className={`resize-none ${isMobileView ? 'h-16 text-sm' : 'h-20'}`}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Product Image Modal */}
      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        productId={productInfo.productId}
        variantId={productInfo.variantId}
      />
    </>
  )
}

// Helper function to render field icons
const getFieldIcon = (iconName: string) => {
  const iconProps = { className: "h-4 w-4" }
  
  switch (iconName) {
    case 'user': return <User {...iconProps} />
    case 'phone': return <Phone {...iconProps} />
    case 'map-pin': return <MapPin {...iconProps} />
    case 'calendar': return <Calendar {...iconProps} />
    case 'clock': return <Clock {...iconProps} />
    case 'package': return <Package {...iconProps} />
    case 'store': return <Store {...iconProps} />
    case 'tag': return <Tag {...iconProps} />
    case 'star': return <Star {...iconProps} />
    default: return <Package {...iconProps} />
  }
} 