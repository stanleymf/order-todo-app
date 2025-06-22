import React from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Input } from "../ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select"
import {
  Package,
  Clock,
  Hash,
  Calendar,
  Tag,
  User,
  AlertTriangle,
  Gift,
  MessageSquare,
  Circle,
  CheckCircle,
  Eye,
} from "lucide-react"
import type { OrderCardField } from "../../types/orderCardFields"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface OrderCardRendererProps {
  // Core data
  order: any
  fields: OrderCardField[]
  isExpanded: boolean
  isPreview?: boolean
  
  // UI state
  previewStatus?: "unassigned" | "assigned" | "completed"
  isSelected?: boolean
  
  // Data sources
  users?: Array<{ id: string; name: string }>
  difficultyLabels?: Array<{ id: string; name: string; color: string }>
  productTypeLabels?: Array<{ id: string; name: string; color: string }>
  
  // Event handlers
  onToggleExpanded?: () => void
  onStatusChange?: (status: "unassigned" | "assigned" | "completed") => void
  onSelect?: (orderId: string) => void
  onUpdate?: (orderId: string, updates: any) => void
  onCustomisationsChange?: (value: string) => void
  
  // Eye icon functionality
  onShowProductImage?: (shopifyProductId?: string, shopifyVariantId?: string) => void
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const getValueFromShopifyData = (sourcePath: string, data: any): any => {
  if (!sourcePath || !data) return undefined

  if (sourcePath.startsWith("product:")) {
    const productField = sourcePath.split(":")[1]
    const productValue = data.localProduct?.[productField]
    
    // Handle labelNames array - return the first label name
    if (productField === "labelNames" && Array.isArray(productValue)) {
      return productValue[0] || null
    }
    
    // Handle the new separated label fields
    if (productField === "difficultyLabel" || productField === "productTypeLabel") {
      const labelNames = data.localProduct?.labelNames || []
      const labelCategories = data.localProduct?.labelCategories || []
      
      if (productField === "difficultyLabel") {
        const difficultyLabels = labelNames.filter((name: string, index: number) => 
          labelCategories[index] === 'difficulty'
        )
        return difficultyLabels[0] || null
      }
      if (productField === "productTypeLabel") {
        const productTypeLabels = labelNames.filter((name: string, index: number) => 
          labelCategories[index] === 'productType'
        )
        return productTypeLabels[0] || null
      }
      return productValue || null
    }
    
    return productValue
  }

  if (sourcePath === "tags") {
    return Array.isArray(data.tags) ? data.tags.join(", ") : data.tags
  }
  if (sourcePath === "line_items.title") {
    return data.lineItems?.edges?.[0]?.node?.title
  }
  if (sourcePath === "line_items.variant_title") {
    return data.lineItems?.edges?.[0]?.node?.variant?.title
  }
  // For direct properties like 'name', 'createdAt', 'note'
  return data[sourcePath]
}

const applyTransformation = (value: any, field: OrderCardField): any => {
  if (field.transformation === "extract" && field.transformationRule) {
    if (typeof value !== "string") {
      return null
    }
    try {
      const regex = new RegExp(field.transformationRule)
      const match = value.match(regex)
      if (match && match[0]) {
        let extractedValue = match[0]

        if (field.type === "date") {
          const parts = extractedValue.split("/")
          let date
          // Handle dd/mm/yyyy format specifically
          if (parts.length === 3 && parts[2].length === 4) {
            const reformattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
            date = new Date(reformattedDate)
          } else {
            // Fallback for other formats
            date = new Date(extractedValue)
          }

          if (date && !isNaN(date.getTime())) {
            // Return a standard ISO string for reliable parsing later
            return date.toISOString()
          } else {
            return "Invalid Date"
          }
        }
        return extractedValue
      } else {
        return "No match"
      }
    } catch (e) {
      console.error("Invalid regex:", e)
      return "Invalid Regex"
    }
  }
  return value
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatusCirclesProps {
  previewStatus: "unassigned" | "assigned" | "completed"
  onStatusChange?: (status: "unassigned" | "assigned" | "completed") => void
  isPreview?: boolean
}

const StatusCircles: React.FC<StatusCirclesProps> = ({ 
  previewStatus, 
  onStatusChange, 
  isPreview = false 
}) => {
  if (!isPreview || !onStatusChange) {
    // Live mode - show static status
    return (
      <div className="flex items-center gap-2">
        {previewStatus === "assigned" && <User className="h-5 w-5 text-blue-500" />}
        {previewStatus === "completed" ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-gray-400" />
        )}
      </div>
    )
  }

  // Preview mode - show interactive status
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full p-1 ${
          previewStatus === "unassigned" ? "bg-gray-100" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onStatusChange("unassigned")
        }}
      >
        <Circle className="h-4 w-4 text-gray-400" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full p-1 ${
          previewStatus === "assigned" ? "bg-blue-100" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onStatusChange("assigned")
        }}
      >
        <User className="h-4 w-4 text-blue-500" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={`rounded-full p-1 ${
          previewStatus === "completed" ? "bg-green-100" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation()
          onStatusChange("completed")
        }}
      >
        <CheckCircle className="h-4 w-4 text-green-500" />
      </Button>
    </div>
  )
}

interface FieldRendererProps {
  field: OrderCardField
  value: any
  users: Array<{ id: string; name: string }>
  difficultyLabels: Array<{ id: string; name: string; color: string }>
  isPreview?: boolean
  onUpdate?: (fieldId: string, value: any) => void
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ 
  field, 
  value, 
  users, 
  difficultyLabels, 
  isPreview = false,
  onUpdate 
}) => {
  const getFieldIcon = () => {
    const icons: { [key: string]: React.ReactNode } = {
      productTitle: <Package className="h-4 w-4 text-muted-foreground" />,
      productVariantTitle: <Package className="h-4 w-4 text-muted-foreground" />,
      timeslot: <Clock className="h-4 w-4 text-muted-foreground" />,
      orderId: <Hash className="h-4 w-4 text-muted-foreground" />,
      orderDate: <Calendar className="h-4 w-4 text-muted-foreground" />,
      orderTags: <Tag className="h-4 w-4 text-muted-foreground" />,
      assignedTo: <User className="h-4 w-4 text-muted-foreground" />,
      difficultyLabel: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
      addOns: <Gift className="h-4 w-4 text-muted-foreground" />,
      customisations: <MessageSquare className="h-4 w-4 text-muted-foreground" />,
    }
    return icons[field.id] || <Package className="h-4 w-4 text-muted-foreground" />
  }

  const getPriorityColor = () => {
    if (field.id === "difficultyLabel" && value) {
      const label = difficultyLabels.find((l) => l.name === value)
      return label?.color || "#6b7280"
    }
    return "#6b7280"
  }

  const getAssignedUserName = () => {
    if (field.id === "assignedTo" && value) {
      const user = users.find((u) => u.id === value)
      return user?.name || value
    }
    return value
  }

  const renderValue = () => {
    if (value === undefined || value === null || value === "") {
      return <span className="text-muted-foreground italic">Not set</span>
    }

    switch (field.type) {
      case "select":
        if (field.id === "assignedTo") {
          return (
            <Select
              value={value}
              onValueChange={(newValue) => onUpdate?.(field.id, newValue)}
              disabled={!isPreview || !field.isEditable}
            >
              <SelectTrigger className="w-auto min-w-[120px]">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        if (field.id === "isCompleted") {
          return (
            <Select
              value={value ? "completed" : "pending"}
              onValueChange={(newValue) => onUpdate?.(field.id, newValue === "completed")}
              disabled={!isPreview || !field.isEditable}
            >
              <SelectTrigger className="w-auto min-w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        return <span>{String(value)}</span>

      case "textarea":
        if (field.id === "customisations") {
          return (
            <Textarea
              value={value}
              onChange={(e) => onUpdate?.(field.id, e.target.value)}
              placeholder="Add customisation notes..."
              className="min-h-[60px] resize-none"
              disabled={!isPreview || !field.isEditable}
            />
          )
        }
        return <span className="whitespace-pre-wrap">{String(value)}</span>

      case "date":
        if (typeof value === "string") {
          try {
            const date = new Date(value)
            if (!isNaN(date.getTime())) {
              return <span>{date.toLocaleDateString()}</span>
            }
          } catch (e) {
            // Fallback to raw value
          }
        }
        return <span>{String(value)}</span>

      case "tags":
        if (Array.isArray(value)) {
          return (
            <div className="flex flex-wrap gap-1">
              {value.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )
        }
        return <span>{String(value)}</span>

      case "status":
        return (
          <Badge variant={value ? "default" : "secondary"}>
            {value ? "Completed" : "Pending"}
          </Badge>
        )

      default:
        if (field.id === "difficultyLabel" && value) {
          return (
            <Badge style={{ backgroundColor: getPriorityColor(), color: "white" }}>
              {value}
            </Badge>
          )
        }
        if (field.id === "assignedTo" && value) {
          return <span className="font-medium">{getAssignedUserName()}</span>
        }
        return <span>{String(value)}</span>
    }
  }

  return (
    <div className="flex items-start gap-3 text-sm">
      {getFieldIcon()}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 mb-1">{field.label}</div>
        <div className="text-gray-600">{renderValue()}</div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OrderCardRenderer: React.FC<OrderCardRendererProps> = ({
  order,
  fields,
  isExpanded,
  isPreview = false,
  previewStatus = "unassigned",
  isSelected = false,
  users = [],
  difficultyLabels = [],
  productTypeLabels = [],
  onToggleExpanded,
  onStatusChange,
  onSelect,
  onUpdate,
  onCustomisationsChange,
  onShowProductImage,
}) => {
  const getFieldValue = (fieldId: string): any => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return ""

    let rawValue

    // Handle different data sources
    if (order.shopifyOrderData && field.shopifyFields && field.shopifyFields.length > 0) {
      const sourcePath = field.shopifyFields[0]
      rawValue = getValueFromShopifyData(sourcePath, order.shopifyOrderData)
    } else {
      // Fallback to direct order properties
      rawValue = order[fieldId] || order[field.id]
    }

    return applyTransformation(rawValue, field)
  }

  const productTitle = getFieldValue("productTitle")
  const productVariantTitle = getFieldValue("productVariantTitle")
  const difficultyLabelName = getFieldValue("difficultyLabel")
  const difficultyLabel = difficultyLabels.find((l) => l.name === difficultyLabelName)

  const getCardStyle = () => {
    if (previewStatus === "completed") return "border-green-500 bg-green-50"
    if (previewStatus === "assigned") return "border-blue-500 bg-blue-50"
    return "border-gray-200 bg-white"
  }

  const handleCardClick = () => {
    if (onSelect && order.id) {
      onSelect(order.id)
    }
    if (onToggleExpanded) {
      onToggleExpanded()
    }
  }

  const handleFieldUpdate = (fieldId: string, value: any) => {
    if (onUpdate && order.id) {
      onUpdate(order.id, { [fieldId]: value })
    }
    if (fieldId === "customisations" && onCustomisationsChange) {
      onCustomisationsChange(value)
    }
  }

  if (isExpanded) {
    return (
      <div className={`relative transition-all duration-200 ${getCardStyle()} ${
        isSelected ? "ring-2 ring-offset-2 ring-blue-500" : ""
      }`}>
        {/* Header */}
        <div className="p-4 border-b cursor-pointer" onClick={handleCardClick}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5" />
                {productTitle}
                {onShowProductImage && order.shopifyOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      const productId = order.shopifyOrderData.lineItems.edges[0].node.product.id
                      const variantId = order.shopifyOrderData.lineItems.edges[0].node.variant?.id
                      onShowProductImage(productId, variantId)
                    }}
                  >
                    <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                  </Button>
                )}
              </h3>
              {productVariantTitle && (
                <p className="text-sm text-muted-foreground mt-1">{productVariantTitle}</p>
              )}
            </div>
            <StatusCircles 
              previewStatus={previewStatus} 
              onStatusChange={onStatusChange}
              isPreview={isPreview}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {fields
            .filter(f => f.id !== 'productTitle' && f.id !== 'productVariantTitle' && f.isVisible)
            .map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={getFieldValue(field.id)}
                users={users}
                difficultyLabels={difficultyLabels}
                isPreview={isPreview}
                onUpdate={handleFieldUpdate}
              />
            ))}
        </div>

        {/* Difficulty Label Badge */}
        {difficultyLabel && (
          <div className="absolute bottom-4 right-4">
            <Badge style={{ backgroundColor: difficultyLabel.color, color: "white" }}>
              {difficultyLabel.name}
            </Badge>
          </div>
        )}
      </div>
    )
  }

  // Collapsed View
  return (
    <div 
      className={`relative transition-all duration-200 ${getCardStyle()} ${
        isSelected ? "ring-2 ring-offset-2 ring-blue-500" : ""
      } cursor-pointer`}
      onClick={handleCardClick}
    >
      <div className="p-3 relative min-h-[90px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 pr-16">
            <div className="text-base font-semibold text-gray-900 leading-tight flex items-center gap-2">
              {productTitle}
              {onShowProductImage && order.shopifyOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    const productId = order.shopifyOrderData.lineItems.edges[0].node.product.id
                    const variantId = order.shopifyOrderData.lineItems.edges[0].node.variant?.id
                    onShowProductImage(productId, variantId)
                  }}
                >
                  <Eye className="h-3 w-3 text-gray-500 hover:text-gray-700" />
                </Button>
              )}
            </div>
            <div className="text-sm text-gray-500 font-normal mt-1">
              {productVariantTitle}
            </div>
          </div>
          <div className="absolute top-3 right-3">
            <StatusCircles 
              previewStatus={previewStatus} 
              onStatusChange={onStatusChange}
              isPreview={isPreview}
            />
          </div>
        </div>
        
        {difficultyLabel && (
          <div className="absolute bottom-3 right-3">
            <Badge style={{ backgroundColor: difficultyLabel.color, color: "white" }}>
              {difficultyLabel.name}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
} 