import React, { useState } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
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
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useAuth } from "../contexts/AuthContext"
import { ProductImageModal } from "./shared/ProductImageModal"

interface OrderDetailCardProps {
  order: any
  fields: OrderCardField[]
  isExpanded?: boolean
  onToggle?: () => void
  isAddOn?: boolean
  onStatusChange?: (orderId: string, newStatus: 'unassigned' | 'assigned' | 'completed') => void
}

export const OrderDetailCard: React.FC<OrderDetailCardProps> = ({
  order,
  fields,
  isExpanded = false,
  onToggle,
  isAddOn = false,
  onStatusChange,
}) => {
  const [expanded, setExpanded] = useState(isExpanded)
  const [status, setStatus] = useState<'unassigned' | 'assigned' | 'completed'>(
    order.status === 'completed' ? 'completed' : 
    order.assignedTo ? 'assigned' : 'unassigned'
  )
  const [notes, setNotes] = useState("")
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)
  const { user, tenant } = useAuth()

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't toggle if clicking on status buttons, textarea, or eye icon
    if ((e.target as HTMLElement).closest('.status-buttons') || 
        (e.target as HTMLElement).closest('.notes-textarea') ||
        (e.target as HTMLElement).closest('.eye-icon')) {
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
    
    // TODO: Update order status in backend
    // For now, just update local state
  }

  // Extract field value using configured shopifyFields paths
  const extractFieldValue = (shopifyData: any, fieldPath: string): any => {
    if (!shopifyData || !fieldPath) return null
    
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

    // Use configured shopifyFields if available
    if (field.shopifyFields && field.shopifyFields.length > 0) {
      const fieldPath = field.shopifyFields[0]
      let value = extractFieldValue(order.shopifyOrderData, fieldPath)
      
      // Apply transformation if specified
      if (field.transformation && field.transformationRule) {
        value = applyFieldTransformation(value, field.transformation, field.transformationRule)
      }
      
      // Return configured value or fallback to direct order property
      return value || order[field.id] || null
    }
    
    // Fallback to direct order property for fields without shopifyFields
    return order[field.id] || null
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
    // Express orders have yellow background regardless of status
    if (isExpressOrder) {
      switch (status) {
        case "assigned":
          return "bg-yellow-100 border-l-blue-500"
        case "completed":
          return "bg-yellow-200 border-l-green-500"
        default:
          return `bg-yellow-50 ${getBorderColor(difficultyValue)}`
      }
    }
    
    // Non-express orders use original logic
    switch (status) {
      case "assigned":
        return "bg-blue-50 border-l-blue-500"
      case "completed":
        return "bg-green-50 border-l-green-500"
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

  // Get assigned user name
  const assignedToValue = status === 'assigned' || status === 'completed' ? 
    (order.assignedTo || user?.name || user?.email || 'Unknown User') : null

  return (
    <>
    <Card className={`transition-all duration-200 hover:shadow-md border-l-4 cursor-pointer ${
      getCardStatusColor()
    }`}>
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
                {variantValue && (
                  <span className="text-xs sm:text-sm text-muted-foreground">{variantValue}</span>
                )}
                {isExpressOrder && expressTimeSlot && (
                  <Badge className="text-xs bg-yellow-200 text-yellow-900 border-yellow-400">
                    EX - {expressTimeSlot}
                  </Badge>
                )}
                {isAddOn && (
                  <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                    Add-on
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Status Buttons - Circular with Icons */}
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
        </div>

        {/* Difficulty Badge - Below status buttons */}
        {difficultyValue && (
          <div className="mt-3 flex justify-center">
            <Badge className={`text-xs ${getDifficultyColor(difficultyValue)}`}>
              {difficultyValue}
            </Badge>
          </div>
        )}

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
            <div className="mt-4 border-t pt-4 notes-textarea">
              <Textarea
                placeholder="Add admin notes or special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px] sm:min-h-[80px] resize-none border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs sm:text-sm"
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Product Image Modal */}
    <ProductImageModal
      isOpen={isImageModalOpen}
      onClose={() => setIsImageModalOpen(false)}
      shopifyProductId={order.productTitleId}
      shopifyVariantId={order.variantId}
      tenantId={tenant?.id}
    />
    </>
  )
} 