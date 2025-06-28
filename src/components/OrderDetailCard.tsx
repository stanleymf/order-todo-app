import React, { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog"
import {
  Hash,
  Clock,
  Calendar,
  AlertTriangle,
  User,
  Gift,
  Circle,
  CheckCircle,
  UserCheck,
  Eye,
  Trash2,
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useAuth } from "../contexts/AuthContext"
import { ProductImageModal } from "./shared/ProductImageModal"

// Simple debounce utility
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout
  return (...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(null, args), wait)
  }
}

interface OrderDetailCardProps {
  order: any
  fields: OrderCardField[]
  isExpanded?: boolean
  onToggle?: () => void
  onStatusChange?: (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed') => void
  onDelete?: (orderId: string) => void
  deliveryDate?: string
}

export const OrderDetailCard: React.FC<OrderDetailCardProps> = ({
  order,
  fields,
  isExpanded = false,
  onToggle,
  onStatusChange,
  onDelete,
  deliveryDate,
}) => {
  // FOCUS: Only log the essential OrderDetailCard data
  React.useEffect(() => {
    if (isExpanded) {
      console.error(`[ORDERDETAIL-DEBUG] Expanded order: ${order?.shopifyOrderId}, GraphQL name: ${order?.shopifyOrderData?.name || 'MISSING'}`);
      
      // CRITICAL: Debug the exact data structure being received
      console.error('[ORDERDETAIL-CRITICAL] Complete order object:', {
        shopifyOrderId: order?.shopifyOrderId,
        cardId: order?.cardId,
        title: order?.title,
        hasShopifyOrderData: !!order?.shopifyOrderData,
        shopifyOrderDataType: typeof order?.shopifyOrderData,
        shopifyOrderDataName: order?.shopifyOrderData?.name,
        shopifyOrderDataKeys: order?.shopifyOrderData ? Object.keys(order.shopifyOrderData) : 'none',
        entireShopifyOrderData: order?.shopifyOrderData
      });
    }
  }, [isExpanded, order]);

  const [expanded, setExpanded] = useState(isExpanded)
  const [status, setStatus] = useState<'unassigned' | 'assigned' | 'completed'>(
    order.status || 'unassigned'
  )
  const [notes, setNotes] = useState(order.notes || "")
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // Swipe gesture state
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const swipeThreshold = 150 // pixels to trigger delete action
  
  // Textarea ref for auto-resizing
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // ENHANCED: Track save timing
  const lastSaveTimeRef = useRef<number>(0)

  const { user, tenant } = useAuth()

  // FORTIFIED: Auto-save function with better error handling and logging
  const saveCardState = async (newStatus?: string, newNotes?: string) => {
    if (!tenant?.id || !deliveryDate) {
      console.warn('[CARD-SAVE-FORTIFIED] Missing tenant ID or delivery date, skipping save')
      return
    }

    const cardId = order.cardId || order.id
    if (!cardId) {
      console.warn('[CARD-SAVE-FORTIFIED] Missing card ID, skipping save')
      return
    }

    const finalStatus = newStatus || status
    // FORTIFIED: Better assignment logic
    const shouldAssign = finalStatus === 'assigned' || finalStatus === 'completed'
    const assignedToUser = shouldAssign ? (user?.name || user?.email || 'Unknown User') : null

    // ENHANCED: Track save timing to detect rapid saves
    const saveStartTime = Date.now()
    const timeSinceLastSave = saveStartTime - (lastSaveTimeRef.current || 0)
    lastSaveTimeRef.current = saveStartTime
    
    console.log(`[CARD-SAVE-FORTIFIED] Starting save for ${cardId}:`, {
      status: finalStatus,
      assignedTo: assignedToUser,
      notes: newNotes !== undefined ? newNotes : notes,
      deliveryDate,
      timeSinceLastSave,
      isRapidSave: timeSinceLastSave < 1000 // Less than 1 second
    })

    setIsSaving(true)
    try {
      console.log(`[CARD-SAVE-FORTIFIED] Saving card ${cardId}:`, {
        status: finalStatus,
        assignedTo: assignedToUser,
        notes: newNotes !== undefined ? newNotes : notes,
        deliveryDate
      })

      // FORTIFIED: Save to order_card_states table with better payload
      const response = await fetch(`/api/tenants/${tenant.id}/order-card-states/${cardId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          status: finalStatus,
          notes: newNotes !== undefined ? newNotes : notes,
          assignedTo: assignedToUser,
          deliveryDate
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[CARD-SAVE-FORTIFIED] Failed to save card state:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      } else {
        const result = await response.json()
        const saveEndTime = Date.now()
        const saveDuration = saveEndTime - saveStartTime
        console.log(`[CARD-SAVE-FORTIFIED] Saved successfully in ${saveDuration}ms:`, result)
        
        // ENHANCED: Log the exact timestamp that was saved for debugging
        console.log(`[CARD-SAVE-FORTIFIED] Timestamp details:`, {
          savedTimestamp: result.updatedAt,
          verification: result.verification,
          cardId: result.cardId,
          status: result.status
        })
        
        // VERIFICATION: Trigger immediate polling check to verify real-time detection
        setTimeout(() => {
          console.log(`🔬 [SAVE-VERIFICATION] Checking if polling detects the saved change for ${cardId}`)
          console.log(`🔬 [SAVE-VERIFICATION] Look for timestamp: ${result.updatedAt} in next polling cycle`)
        }, 100)
      }
    } catch (error) {
      console.error('[CARD-SAVE-FORTIFIED] Error saving card state:', error)
      // Don't throw error to prevent UI breaks, but log it
    } finally {
      setIsSaving(false)
    }
  }

  // Debounced auto-save for notes
  const debouncedSaveNotes = useCallback(
    debounce((newNotes: string) => {
      saveCardState(undefined, newNotes)
    }, 1000),
    [status, deliveryDate, tenant?.id]
  )

  // Initialize state from order data - FIXED: Include order.cardId to detect when component gets different order
  useEffect(() => {
    setStatus(order.status || 'unassigned')
    setNotes(order.notes || "")
  }, [order.cardId, order.id, order.status, order.notes])

  // Auto-resize textarea when content changes or component expands
  useEffect(() => {
    if (textareaRef.current && expanded) {
      const textarea = textareaRef.current
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.max(60, textarea.scrollHeight)}px`
    }
  }, [notes, expanded])

  // Touch/Mouse gesture handlers
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true)
    setStartPosition({ x: clientX, y: clientY })
    setSwipeOffset(0)
  }

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return
    
    const deltaX = clientX - startPosition.x
    const deltaY = Math.abs(clientY - startPosition.y)
    
    // Only process horizontal swipe if it's more horizontal than vertical
    if (deltaY < 50 && deltaX > 0) {
      setSwipeOffset(Math.min(deltaX, swipeThreshold * 1.5))
    }
  }

  const handleEnd = () => {
    if (!isDragging) return
    
    setIsDragging(false)
    
    if (swipeOffset >= swipeThreshold) {
      // Trigger delete confirmation
      setShowDeleteConfirm(true)
    }
    
    // Reset swipe offset
    setSwipeOffset(0)
  }

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start swipe gesture if clicking on textarea or other interactive elements
    if ((e.target as HTMLElement).closest('.notes-textarea') || 
        (e.target as HTMLElement).closest('.status-buttons') ||
        (e.target as HTMLElement).closest('.eye-icon') ||
        (e.target as HTMLElement).closest('textarea') ||
        (e.target as HTMLElement).closest('button')) {
      return
    }
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY)
  }

  const handleMouseUp = () => {
    handleEnd()
  }

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start swipe gesture if touching textarea or other interactive elements
    if ((e.target as HTMLElement).closest('.notes-textarea') || 
        (e.target as HTMLElement).closest('.status-buttons') ||
        (e.target as HTMLElement).closest('.eye-icon') ||
        (e.target as HTMLElement).closest('textarea') ||
        (e.target as HTMLElement).closest('button')) {
      return
    }
    const touch = e.touches[0]
    handleStart(touch.clientX, touch.clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    handleMove(touch.clientX, touch.clientY)
  }

  const handleTouchEnd = () => {
    handleEnd()
  }

  // Mouse leave event to reset swipe
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false)
      setSwipeOffset(0)
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on status buttons, textarea, eye icon, or during swipe
    if ((e.target as HTMLElement).closest('.status-buttons') || 
        (e.target as HTMLElement).closest('.notes-textarea') ||
        (e.target as HTMLElement).closest('.eye-icon') ||
        swipeOffset > 10) {
      return
    }
    
    setExpanded(!expanded)
    onToggle?.()
  }

  const handleEyeClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsImageModalOpen(true)
  }

  const handleStatusChange = (newStatus: 'unassigned' | 'assigned' | 'completed') => {
    // If clicking the same status button, reset to unassigned
    const finalStatus = status === newStatus ? 'unassigned' : newStatus
    setStatus(finalStatus)
    
    // Call parent callback to update stats
    if (onStatusChange) {
      onStatusChange(order.cardId || order.id, finalStatus)
    }
    
    // CRITICAL FIX: Save to database for real-time sync
    saveCardState(finalStatus)
  }

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes)
    debouncedSaveNotes(newNotes)
  }

  const handleDeleteConfirm = () => {
    if (onDelete) {
      onDelete(order.cardId || order.id)
    }
    setShowDeleteConfirm(false)
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  // Extract field value using configured shopifyFields paths
  const extractFieldValue = (shopifyData: any, fieldPath: string): any => {
    if (!shopifyData || !fieldPath) return null
    
    // Handle direct properties first (like 'name', 'tags', 'note')
    if (!fieldPath.includes('.')) {
      return shopifyData[fieldPath]
    }
    
    // Handle custom attributes (like noteAttributes.delivery_date, noteAttributes.timeslot)
    if (fieldPath.startsWith('noteAttributes.')) {
      const attributeName = fieldPath.split('.')[1]
      const customAttributes = shopifyData.customAttributes
      if (Array.isArray(customAttributes)) {
        const attribute = customAttributes.find((attr: any) => attr.key === attributeName)
        return attribute?.value || null
      }
      return null
    }
    
    // Handle shipping address fields
    if (fieldPath.startsWith('shippingAddress.')) {
      const addressField = fieldPath.split('.')[1]
      return shopifyData.shippingAddress?.[addressField] || null
    }
    
    // Handle customer fields
    if (fieldPath.startsWith('customer.')) {
      const customerField = fieldPath.split('.')[1]
      return shopifyData.customer?.[customerField] || null
    }
    
    // Handle pricing fields
    if (fieldPath.includes('PriceSet.shopMoney.amount')) {
      const priceType = fieldPath.split('.')[0] // totalPriceSet, subtotalPriceSet, etc.
      return shopifyData[priceType]?.shopMoney?.amount || null
    }
    
    // Handle special GraphQL paths for backward compatibility
    if (fieldPath.includes('lineItems.edges')) {
      const lineItems = shopifyData.lineItems?.edges
      if (lineItems && lineItems.length > 0) {
        const firstItem = lineItems[0]?.node
        if (fieldPath === 'lineItems.edges.0.node.title') {
          return firstItem?.title
        }
        if (fieldPath === 'lineItems.edges.0.node.variant.title') {
          return firstItem?.variant?.title
        }
        if (fieldPath === 'lineItems.edges.0.node.variant.sku') {
          return firstItem?.variant?.sku
        }
        if (fieldPath === 'lineItems.edges.0.node.quantity') {
          return firstItem?.quantity
        }
        if (fieldPath === 'lineItems.edges.0.node.product.productType') {
          return firstItem?.product?.productType
        }
      }
      return null
    }
    
    // Handle nested paths with dot notation
    const pathParts = fieldPath.split(".")
    let value = shopifyData
    
    for (const part of pathParts) {
      if (value && typeof value === "object") {
        // Handle arrays - if we encounter an array, take the first item
        if (Array.isArray(value)) {
          if (value.length === 0) {
            value = null
            break
          }
          // Handle array index notation like "edges.0.node"
          if (/^\d+$/.test(part)) {
            const index = parseInt(part, 10)
            value = value[index] || null
          } else {
            value = value[0]
            if (value && typeof value === "object") {
              value = value[part]
            }
          }
        } else {
          value = value[part]
        }
      } else {
        value = null
        break
      }
    }
    
    return value
  }

  // Apply field transformations
  const applyFieldTransformation = (value: any, transformation: string | undefined, transformationRule: string | undefined): any => {
    if (!value || !transformation || !transformationRule) return value
    
    if (transformation === "extract" && typeof value === "string") {
      const regex = new RegExp(transformationRule)
      const match = value.match(regex)
      return match ? match[0] : null
    }
    
    if (transformation === "extract" && Array.isArray(value)) {
      const regex = new RegExp(transformationRule)
      const found = value.find(item => typeof item === "string" && regex.test(item))
      return found || null
    }
    
    return value
  }

  // Get field value using the configured mapping
  const getFieldValue = (field: OrderCardField): any => {
    if (!order) return null

    // For most fields, prioritize direct order properties from backend processing
    const directOrderValue = order[field.id]
    
    // Special handling for orderId - prioritize name from shopifyOrderData (like #WF123)
    if (field.id === 'orderId') {
      // First try to get name from GraphQL data
      const graphQLName = extractFieldValue(order.shopifyOrderData, 'name');
      if (graphQLName) {
        return graphQLName;
      }
      
      // If no GraphQL name available, try to construct order name from shopifyOrderId
      // For Shopify orders, try to create a recognizable format
      if (order.shopifyOrderId) {
        // If it's a long numeric ID, try to make it more readable
        const numericId = String(order.shopifyOrderId);
        if (numericId.length > 10) {
          // Take last 6 digits and prefix with #WF
          const shortId = numericId.slice(-6);
          return `#WF${shortId}`;
        }
        return `#${numericId}`;
      }
      
      return order.orderNumber || directOrderValue || 'Unknown Order';
    }
    
    // For fields that should primarily use direct order properties
    const directOrderFields = ['productTitle', 'productVariantTitle', 'difficultyLabel', 'assignedTo']
    
    if (directOrderFields.includes(field.id) && directOrderValue) {
      return directOrderValue
    }

    // Use configured shopifyFields if available
    if (field.shopifyFields && field.shopifyFields.length > 0) {
      const fieldPath = field.shopifyFields[0]
      let value = extractFieldValue(order.shopifyOrderData, fieldPath)
      
      // Apply transformation if specified
      if (field.transformation && field.transformationRule) {
        value = applyFieldTransformation(value, field.transformation, field.transformationRule)
      }
      
      // Return configured value or fallback to direct order property
      return value || directOrderValue || null
    }
    
    // Fallback to direct order property for fields without shopifyFields
    return directOrderValue || null
  }

  // Get field icon
  const getFieldIcon = (fieldId: string) => {
    switch (fieldId) {
      case "orderId":
        return <Hash className="h-4 w-4" />
      case "timeslot":
        return <Clock className="h-4 w-4" />
      case "orderDate":
        return <Calendar className="h-4 w-4" />
      case "difficultyLabel":
        return <AlertTriangle className="h-4 w-4" />
      case "assignedTo":
        return <User className="h-4 w-4" />
      case "addOns":
        return <Gift className="h-4 w-4" />
      default:
        return null
    }
  }

  // Get difficulty label color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "hard":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get border color based on difficulty
  const getBorderColor = (difficulty: string) => {
    if (!difficulty) return "border-l-gray-400"
    
    switch (difficulty?.toLowerCase()) {
      case "easy":
        return "border-l-green-500"
      case "medium":
        return "border-l-yellow-500"
      case "hard":
        return "border-l-red-500"
      default:
        return "border-l-gray-400"
    }
  }

  // Get card background color based on status and express
  const getCardStatusColor = () => {
    // Wedding orders have light pink background - HIGHEST PRIORITY
    const isWeddingOrder = order.isWeddingProduct
    if (isWeddingOrder) {
      switch (status) {
        case "assigned":
          return "bg-pink-200 border-l-blue-500"
        case "completed":
          return "bg-pink-300 border-l-green-500"
        default:
          return `bg-pink-50 ${getBorderColor(difficultyValue)}`
      }
    }
    
    // Express orders have yellow background regardless of status
    if (isExpressOrder) {
      switch (status) {
        case "assigned":
          return "bg-yellow-200 border-l-blue-500"
        case "completed":
          return "bg-yellow-300 border-l-green-500"
        default:
          return `bg-yellow-50 ${getBorderColor(difficultyValue)}`
      }
    }
    
    // Non-express orders use original logic with darker colors
    switch (status) {
      case "assigned":
        return "bg-blue-100 border-l-blue-500"
      case "completed":
        return "bg-green-100 border-l-green-500"
      default:
        return `bg-white ${getBorderColor(difficultyValue)}`
    }
  }

  // Get visible fields
  const visibleFields = fields.filter(field => field.isVisible)
  
  // Get primary fields - Use direct line item data instead of field mappings
  const difficultyField = visibleFields.find(f => f.id === "difficultyLabel")
  
  // Use the unique line item data directly from the backend
  const primaryValue = order.title || "Order"  // This is unique per line item
  const variantValue = order.variantTitle      // This is unique per line item
  const difficultyValue = order.difficultyLabel || (difficultyField ? getFieldValue(difficultyField) : null)
  
  // Express order data
  const isExpressOrder = order.isExpressOrder || false
  const expressTimeSlot = order.expressTimeSlot
  
  // Pickup order data
  const isPickupOrder = order.isPickupOrder || false
  
  // Add-on classification
  const isAddOn = order.isAddOn || false

  // Get assigned user name
  const assignedToValue = status === 'assigned' || status === 'completed' ? 
    (order.assignedTo || user?.name || user?.email || 'Unknown User') : null

  return (
    <>
    {/* Swipe Container */}
    <div 
      ref={cardRef}
      className="relative overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ userSelect: 'none' }}
    >
      {/* Delete Action Background */}
      <div 
        className="absolute inset-y-0 left-0 bg-red-500 flex items-center justify-start pl-6 transition-all duration-200"
        style={{
          width: `${Math.min(swipeOffset, swipeThreshold * 1.5)}px`,
          opacity: swipeOffset > 0 ? 1 : 0
        }}
      >
        <Trash2 
          className={`text-white transition-all duration-200 ${
            swipeOffset >= swipeThreshold ? 'scale-125' : 'scale-100'
          }`} 
          size={20} 
        />
      </div>
      
      {/* Main Card */}
      <Card 
        className={`transition-all duration-200 hover:shadow-md border-l-4 cursor-pointer relative ${
          getCardStatusColor()
        }`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
      >
      <CardContent className="p-4" onClick={handleCardClick}>
        {/* Header Row - Always Visible */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Eye Icon for Product Image */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 mt-1 flex-shrink-0 eye-icon hover:bg-blue-100"
              onClick={handleEyeClick}
              title="View product image"
            >
              <Eye className="h-4 w-4 text-blue-600" />
            </Button>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base md:text-lg leading-tight">{primaryValue}</h3>
              <div className="flex items-center gap-1 sm:gap-2 mt-1 flex-wrap">
                {variantValue && variantValue !== "Default Title" && variantValue.trim() !== "" && (
                  <span className="text-xs sm:text-sm text-muted-foreground">{variantValue}</span>
                )}
                {isExpressOrder && expressTimeSlot && (
                  <Badge className="text-xs bg-yellow-200 text-yellow-900 border-yellow-400">
                    EX - {expressTimeSlot}
                  </Badge>
                )}
                {isPickupOrder && (
                  <Badge variant="secondary" className="text-xs bg-pink-100 text-pink-800">
                    Pickup
                  </Badge>
                )}
                {isAddOn && (
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                    Add-on
                  </Badge>
                )}
              </div>
              
              {/* Consolidated Items (Top-Up, Corsage, Boutonniere) - Show below variant title */}
              {order.topUpItems && order.topUpItems.length > 0 && (
                <div className="mt-2 space-y-1">
                  {order.topUpItems.map((topUpItem: any, index: number) => (
                    <div key={index} className="flex items-center gap-1 text-xs text-gray-600">
                      <span className="text-gray-400">•</span>
                      <span>{topUpItem.title} x {topUpItem.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Status Buttons and Difficulty Badge - Circular with Icons */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 sm:gap-2 status-buttons flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-md transition-all duration-200 ${
                  status === 'unassigned' 
                    ? 'bg-white text-gray-700 border border-gray-300 shadow-lg' 
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusChange('unassigned')
                }}
                title="Unassigned"
              >
                <Circle className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-md transition-all duration-200 ${
                  status === 'assigned' 
                    ? 'bg-blue-500 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-400 hover:bg-blue-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusChange('assigned')
                }}
                title="Assigned"
              >
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full shadow-md transition-all duration-200 ${
                  status === 'completed' 
                    ? 'bg-green-500 text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-400 hover:bg-green-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusChange('completed')
                }}
                title="Completed"
              >
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
            
            {/* Difficulty Badge - Below status buttons, right aligned */}
            {difficultyValue && (
              <Badge className={`text-xs ${getDifficultyColor(difficultyValue)}`}>
                {difficultyValue}
              </Badge>
            )}
          </div>
        </div>

        {/* Assigned To Field - Show when status is assigned or completed */}
        {(status === 'assigned' || status === 'completed') && assignedToValue && (
          <div className="mt-3 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs sm:text-sm font-medium">Assigned To:</span>
            <span className="text-xs sm:text-sm text-muted-foreground">{assignedToValue}</span>
          </div>
        )}

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {visibleFields
              .filter(field => !["productTitle", "productVariantTitle", "productTypeLabel", "difficultyLabel", "assignedTo"].includes(field.id))
              .map((field) => {
                const value = getFieldValue(field)
                const icon = getFieldIcon(field.id)
                
                // Skip fields with no value
                if (!value || value === "Not set" || value === "") return null
                
                return (
                  <div key={field.id} className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {icon && <span className="text-muted-foreground flex-shrink-0">{icon}</span>}
                      <span className="text-xs sm:text-sm font-medium flex-shrink-0">{field.label}:</span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {Array.isArray(value) ? value.join(", ") : value}
                      </span>
                    </div>
                  </div>
                )
              })}
            
            {/* Additional section for existing notes/customizations */}
            {(order.customisations) && (
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  {order.customisations}
                </p>
              </div>
            )}

            {/* Editable Notes Section - Only visible when expanded */}
            <div className="mt-4 border-t pt-4 notes-textarea" style={{ userSelect: 'text' }}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Admin Notes:
                </label>
                <span className="text-xs text-gray-500">
                  Shift+Enter for new line
                </span>
              </div>
                              <Textarea
                ref={textareaRef}
                placeholder="Add admin notes or special instructions..."
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                onKeyDown={(e) => {
                  // Allow Shift+Enter for new lines
                  if (e.key === 'Enter' && e.shiftKey) {
                    // Let the default behavior handle the new line
                    return
                  }
                  // Prevent other key events from bubbling up
                  e.stopPropagation()
                }}
                className="min-h-[60px] sm:min-h-[80px] max-h-none resize-none border border-gray-200 rounded-md bg-white p-3 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 text-xs sm:text-sm hover:border-gray-300 transition-colors whitespace-pre-wrap overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                disabled={isSaving}
                style={{ 
                  userSelect: 'text',
                  height: 'auto',
                  minHeight: '60px'
                }}
                rows={1}
                onInput={(e) => {
                  // Auto-resize textarea based on content
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = `${Math.max(60, target.scrollHeight)}px`
                }}
              />
              {isSaving && (
                <p className="text-xs text-gray-500 mt-1">Saving...</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>

    {/* Product Image Modal */}
    <ProductImageModal
      isOpen={isImageModalOpen}
      onClose={() => setIsImageModalOpen(false)}
      shopifyProductId={order.productTitleId}
      shopifyVariantId={order.variantId}
      tenantId={tenant?.id}
    />

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this order?</AlertDialogTitle>
          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
} 