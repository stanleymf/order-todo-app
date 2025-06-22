import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import {
  CheckCircle,
  Package,
  Clock,
  Hash,
  Calendar,
  Tag,
  User,
  AlertTriangle,
  Eye,
  EyeOff,
  Circle,
  Gift,
  MessageSquare,
  Save,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useIsMobile } from "./hooks/use-mobile"
import { ProductImageModal } from "./shared/ProductImageModal"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface OrderCardPreviewProps {
  fields: OrderCardField[]
  onToggleFieldVisibility: (fieldId: string) => void
  onSave?: () => void
  isSaving?: boolean
  users?: Array<{ id: string; name: string }>
  difficultyLabels?: Array<{ id: string; name: string; color: string }>
  productTypeLabels?: Array<{ id:string; name: string; color: string }>
  currentUserId?: string
  realOrderData?: any
  stores: any[]
  onFetchOrder: () => void
  isFetching: boolean
  orderNameToFetch: string
  setOrderNameToFetch: (value: string) => void
  selectedStoreId: string
  setSelectedStoreId: (value: string) => void
}

type PreviewStatus = "unassigned" | "assigned" | "completed"

interface SampleOrder {
  id: string
  productTitle: string
  productVariantTitle: string
  timeslot: string
  orderId: string
  orderDate: string
  orderTags: string
  assignedTo?: string
  priorityLabel?: string
  addOns: string
  customisations: string
  isCompleted: boolean
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
      
      console.log(`🔍 Looking for ${productField} labels:`, {
        allLabelNames: labelNames,
        allLabelCategories: labelCategories,
        localProduct: data.localProduct
      })
      
      if (productField === "difficultyLabel") {
        const difficultyLabels = labelNames.filter((name: string, index: number) => 
          labelCategories[index] === 'difficulty'
        )
        console.log(`🎯 Found difficulty labels:`, difficultyLabels)
        return difficultyLabels[0] || null
      }
      if (productField === "productTypeLabel") {
        const productTypeLabels = labelNames.filter((name: string, index: number) => 
          labelCategories[index] === 'productType'
        )
        console.log(`🎯 Found product type labels:`, productTypeLabels)
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
  return null
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatusCirclesProps {
  previewStatus: PreviewStatus
  onStatusChange: (status: PreviewStatus) => void
}

const StatusCircles: React.FC<StatusCirclesProps> = ({ previewStatus, onStatusChange }) => {
  const isMobile = useIsMobile()
  const iconSize = isMobile ? "h-8 w-8" : "h-6 w-6"
  const buttonPadding = isMobile ? "p-2" : "p-1"

  return (
    <div className={`flex items-center ${isMobile ? "gap-3" : "gap-2"}`}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange("unassigned")
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full ${buttonPadding}`}
            >
              <Circle
                className={`transition-all ${iconSize} ${
                  previewStatus === "unassigned"
                    ? "fill-gray-400 text-gray-500"
                    : "text-gray-300"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Unassigned</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange("assigned")
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full ${buttonPadding}`}
            >
              <User
                className={`transition-all ${iconSize} ${
                  previewStatus === "assigned"
                    ? "fill-blue-500 text-white"
                    : "text-gray-300"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Assigned</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange("completed")
            }}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full ${buttonPadding}`}
            >
              <CheckCircle
                className={`transition-all ${iconSize} ${
                  previewStatus === "completed"
                    ? "fill-green-500 text-white"
                    : "text-gray-300"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Completed</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

interface FieldRendererProps {
  field: OrderCardField
  value: any
  difficultyLabels: Array<{ id: string; name: string; color: string }>
  users: Array<{ id: string; name: string }>
}

const FieldRenderer: React.FC<FieldRendererProps> = ({ field, value, difficultyLabels, users }) => {
  const getFieldIcon = () => {
    switch (field.id) {
      case "timeslot": return <Clock className="h-4 w-4 text-muted-foreground" />
      case "orderDate": return <Calendar className="h-4 w-4 text-muted-foreground" />
      case "orderTags": return <Tag className="h-4 w-4 text-muted-foreground" />
      case "addOns": return <Gift className="h-4 w-4 text-muted-foreground" />
      case "customisations": return <MessageSquare className="h-4 w-4 text-muted-foreground" />
      case "difficultyLabel": return <AlertTriangle className="h-4 w-4 text-muted-foreground" />
      case "productTypeLabel": return <Package className="h-4 w-4 text-muted-foreground" />
      default: return <Hash className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getPriorityColor = () => {
    const label = difficultyLabels.find((l) => l.id === value)
    return label?.color || "gray"
  }

  const getAssignedUserName = () => {
    if (!value) return ""
    const user = users.find((u) => u.id === value)
    return user?.name || ""
  }

  const getPriorityLabelName = () => {
    const label = difficultyLabels.find((l) => l.id === value)
    return label?.name || "Easy"
  }

  const renderValue = () => {
    if (!value && field.type !== 'textarea') return <span className="text-gray-400">Not set</span>
    
    switch (field.type) {
      case "date":
        try {
          return new Date(value).toLocaleDateString()
        } catch {
          return "Invalid Date"
        }
      case "select":
        if (field.id === "assignedTo") {
          return getAssignedUserName()
        }
        if (field.id === "priorityLabel") {
          return getPriorityLabelName()
        }
        if (field.id === "isCompleted") {
          return value === "true" ? "Completed" : "Pending"
        }
        return value || "Not set"
      case "textarea":
        return value || "No customisations"
      default:
        return value || "Not set"
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {getFieldIcon()}
      <span className="font-medium">{field.label}:</span>
      {field.id === "priorityLabel" && value ? (
        <Badge
          variant="secondary"
          style={{ backgroundColor: getPriorityColor(), color: "white" }}
        >
          {renderValue()}
        </Badge>
      ) : field.id === "addOns" ? (
        <span className="flex-1">{renderValue()}</span>
      ) : (
        <span>{renderValue()}</span>
      )}
    </div>
  )
}

interface FetchOrderControlsProps {
  stores: any[]
  selectedStoreId: string
  setSelectedStoreId: (value: string) => void
  orderNameToFetch: string
  setOrderNameToFetch: (value: string) => void
  onFetchOrder: () => void
  isFetching: boolean
}

const FetchOrderControls: React.FC<FetchOrderControlsProps> = ({
  stores,
  selectedStoreId,
  setSelectedStoreId,
  orderNameToFetch,
  setOrderNameToFetch,
  onFetchOrder,
  isFetching,
}) => (
  <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/40">
    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select a store" />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            {store.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Input
      className="w-[180px]"
      placeholder="Order Name (e.g. #1001)"
      value={orderNameToFetch}
      onChange={(e) => setOrderNameToFetch(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    />
    <Button onClick={onFetchOrder} disabled={isFetching} variant="outline" className="w-[140px]">
      {isFetching ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      Fetch Order
    </Button>
  </div>
)

interface FieldVisibilityControlsProps {
  fields: OrderCardField[]
  onToggleFieldVisibility: (fieldId: string) => void
}

const FieldVisibilityControls: React.FC<FieldVisibilityControlsProps> = ({
  fields,
  onToggleFieldVisibility,
}) => (
  <div className="space-y-3">
    <h4 className="font-medium">Field Visibility Controls</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center gap-2">
            {field.isVisible ? (
              <Eye className="h-4 w-4 text-green-600" />
            ) : (
              <EyeOff className="h-4 w-4 text-gray-400" />
            )}
            <span className="text-sm font-medium">{field.label}</span>
            {!field.isVisible && (
              <Badge variant="outline" className="text-xs">Hidden</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onToggleFieldVisibility(field.id)} className="text-xs">
            {field.isVisible ? "Hide" : "Show"}
          </Button>
        </div>
      ))}
    </div>
  </div>
)

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface ExpandedViewProps {
  sampleOrder: SampleOrder
  previewStatus: PreviewStatus
  onStatusChange: (status: PreviewStatus) => void
  fields: OrderCardField[]
  users: Array<{ id: string; name: string }>
  difficultyLabels: Array<{ id: string; name: string; color: string }>
  getFieldValue: (fieldId: string) => any
  onCustomisationsChange: (value: string) => void
  realOrderData?: any
  handleShowProductImage: (shopifyProductId?: string, shopifyVariantId?: string) => void
}

const ExpandedView: React.FC<ExpandedViewProps> = ({
  sampleOrder,
  previewStatus,
  onStatusChange,
  fields,
  users,
  difficultyLabels,
  getFieldValue,
  onCustomisationsChange,
  realOrderData,
  handleShowProductImage,
}) => {
  const renderField = (field: OrderCardField) => {
    const value = getFieldValue(field.id)
    return (
      <FieldRenderer
        key={field.id}
        field={field}
        value={value}
        difficultyLabels={difficultyLabels}
        users={users}
      />
    )
  }

  return (
    <>
      <CardHeader className="pb-3 cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              {sampleOrder.productTitle}
              {realOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    const productId = realOrderData.lineItems.edges[0].node.product.id
                    const variantId = realOrderData.lineItems.edges[0].node.variant?.id
                    handleShowProductImage(productId, variantId)
                  }}
                >
                  <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                </Button>
              )}
            </CardTitle>
            {sampleOrder.productVariantTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {sampleOrder.productVariantTitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusCircles previewStatus={previewStatus} onStatusChange={onStatusChange} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            {sampleOrder.orderId}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields
          .filter(
            (field) =>
              field.isVisible &&
              ![
                "productTitle",
                "productVariantTitle",
                "orderId",
                "assignedTo",
                "customisations",
              ].includes(field.id)
          )
          .map(renderField)}
        {(sampleOrder.assignedTo || fields.find((f) => f.id === "customisations")?.isVisible) && (
          <div className="border-t pt-4 space-y-3">
            {sampleOrder.assignedTo && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Assigned to:</span>
                <span className="text-blue-600 font-medium">
                  {users.find((u) => u.id === sampleOrder.assignedTo)?.name || ""}
                </span>
              </div>
            )}
            {fields.find((f) => f.id === "customisations")?.isVisible && (
              <div className="space-y-2">
                <Textarea
                  id="customisations-textarea"
                  value={getFieldValue("customisations")}
                  onChange={(e) => onCustomisationsChange(e.target.value)}
                  placeholder="Add extra notes..."
                  className="mt-1 min-h-[80px] whitespace-pre-wrap"
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </>
  )
}

interface CollapsedViewProps {
  sampleOrder: SampleOrder
  previewStatus: PreviewStatus
  onStatusChange: (status: PreviewStatus) => void
  difficultyLabels?: Array<{ id: string; name: string; color: string }>
  realOrderData?: any
  handleShowProductImage: (shopifyProductId?: string, shopifyVariantId?: string) => void
}

const CollapsedView: React.FC<CollapsedViewProps> = ({
  sampleOrder,
  previewStatus,
  onStatusChange,
  difficultyLabels = [],
  realOrderData,
  handleShowProductImage,
}) => {
  const difficultyLabel = difficultyLabels.find((l) => l.id === sampleOrder.priorityLabel)

  return (
    <CardContent className="p-3 cursor-pointer relative min-h-[90px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 pr-16">
          <div className="text-base font-semibold text-gray-900 leading-tight">
            {sampleOrder.productTitle}
          </div>
          <div className="text-sm text-gray-500 font-normal mt-1">
            {sampleOrder.productVariantTitle}
          </div>
          {realOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  const productId = realOrderData.lineItems.edges[0].node.product.id
                  const variantId = realOrderData.lineItems.edges[0].node.variant?.id
                  handleShowProductImage(productId, variantId)
                }}
              >
                <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-2 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <StatusCircles previewStatus={previewStatus} onStatusChange={onStatusChange} />
              </TooltipTrigger>
              <TooltipContent>Status: {previewStatus}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {difficultyLabel && (
        <div className="absolute bottom-3 right-3">
          <Badge style={{ backgroundColor: difficultyLabel.color, color: "white" }}>
            {difficultyLabel.name}
          </Badge>
        </div>
      )}
    </CardContent>
  )
}

export const OrderCardPreview: React.FC<OrderCardPreviewProps> = ({
  fields,
  onToggleFieldVisibility,
  onSave,
  isSaving,
  users = [],
  difficultyLabels = [],
  productTypeLabels = [],
  currentUserId,
  realOrderData,
  stores,
  onFetchOrder,
  isFetching,
  orderNameToFetch,
  setOrderNameToFetch,
  selectedStoreId,
  setSelectedStoreId,
}) => {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("assigned")
  
  // Product image modal state
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>()
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>()

  // Sample data for preview
  const [sampleOrder, setSampleOrder] = useState<SampleOrder>({
    id: "preview-1",
    productTitle: "Rose Bouquet",
    productVariantTitle: "Red Roses - Large",
    timeslot: "9:00 AM - 11:00 AM",
    orderId: "#ORD-2024-001",
    orderDate: "2024-01-15",
    orderTags: "VIP, Express",
    assignedTo: users.length > 0 ? users[0].id : undefined,
    priorityLabel: difficultyLabels.length > 0 ? difficultyLabels[0].id : undefined,
    addOns: "Extra foliage, special gift card",
    customisations: "Add extra notes and special wrapping",
    isCompleted: false,
  })

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Effect to load real data into the preview
  useEffect(() => {
    if (realOrderData) {
      const newInitialValues: { [key: string]: any } = {}
      fields.forEach((field) => {
        // Start with a null value for all fields when real data is present
        newInitialValues[field.id] = null
        if (field.shopifyFields && field.shopifyFields.length > 0) {
          const shopifyPath = field.shopifyFields[0]
          const value = getValueFromShopifyData(shopifyPath, realOrderData)
          if (value !== undefined && value !== null) {
            newInitialValues[field.id] = value
          }
        }
      })

      // Find the difficulty label from the fetched data and update the ID for the collapsed view
      const difficultyLabelName = newInitialValues.difficultyLabel
      if (difficultyLabelName) {
        const matchingLabel = difficultyLabels.find((l) => l.name === difficultyLabelName)
        if (matchingLabel) {
          newInitialValues.priorityLabel = matchingLabel.id
        }
      }

      // Important: replace the entire sampleOrder with new values
      // This prevents fallback to old sample data for unmapped fields.
      setSampleOrder((prev) => ({
        ...prev, // Keep structure and things like id, isCompleted
        ...Object.fromEntries(fields.map((f) => [f.id, null])), // Reset all fields
        ...newInitialValues, // Apply new values
      }))
    }
  }, [realOrderData, fields, difficultyLabels])

  // Effect to handle status changes (unassigned, assigned, completed)
  useEffect(() => {
    const assignedUser = currentUserId || (users.length > 0 ? users[0].id : undefined)
    switch (previewStatus) {
      case "unassigned":
        setSampleOrder((prev) => ({ 
          ...prev, 
          assignedTo: undefined, 
          isCompleted: false 
        }))
        break
      case "assigned":
        setSampleOrder((prev) => ({ 
          ...prev, 
          assignedTo: assignedUser, 
          isCompleted: false 
        }))
        break
      case "completed":
        setSampleOrder((prev) => ({ 
          ...prev, 
          assignedTo: assignedUser, 
          isCompleted: true 
        }))
        break
    }
  }, [previewStatus, currentUserId, users])

  // Memoized status change handler to prevent unnecessary re-renders
  const handleStatusChange = useCallback((status: PreviewStatus) => {
    setPreviewStatus(status)
  }, [])

  // Memoized customisations change handler
  const handleCustomisationsChange = useCallback((value: string) => {
    setSampleOrder((prev) => ({ ...prev, customisations: value }))
  }, [])

  // Product image modal handler
  const handleShowProductImage = useCallback((shopifyProductId?: string, shopifyVariantId?: string) => {
    setSelectedProductId(shopifyProductId)
    setSelectedVariantId(shopifyVariantId)
    setIsProductImageModalOpen(true)
  }, [])

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const getCardStyle = () => {
    if (sampleOrder.isCompleted) {
      return "border-green-500 bg-green-50"
    }
    if (sampleOrder.assignedTo) {
      return "border-blue-500 bg-blue-50"
    }
    return "border-gray-200 bg-white"
  }

  // Memoized field value getter to prevent unnecessary recalculations
  const getFieldValue = useCallback((fieldId: string): any => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return ""

    let rawValue
    let valueFromShopify = false

    // If there is real data, try to get the value from it based on the mapping
    if (realOrderData && field.shopifyFields && field.shopifyFields.length > 0) {
      const sourcePath = field.shopifyFields[0]
      
      // Use getValueFromShopifyData for all Shopify field mappings
      rawValue = getValueFromShopifyData(sourcePath, realOrderData)
      
      if (rawValue !== undefined && rawValue !== null) {
        valueFromShopify = true
      }
    }

    // If no value was derived from Shopify data, fall back to the sample data
    if (rawValue === undefined) {
      // Only fallback to sample data if there is NO real order data.
      if (!realOrderData) {
        rawValue = (sampleOrder as any)[fieldId]
      } else {
        rawValue = null // Explicitly set to null if real data is present but field has no value
      }
    }

    // Ensure array values (like tags) are joined into a string before transformation
    if (Array.isArray(rawValue)) {
      rawValue = rawValue.join(", ")
    }

    const transformedValue = applyTransformation(rawValue, field)

    if (transformedValue) {
      return transformedValue
    }

    // If transformation was attempted but failed, show N/A for clarity
    if (valueFromShopify && field.transformation === "extract") {
      return "N/A"
    }

    return rawValue
  }, [fields, realOrderData, sampleOrder])

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  const renderField = useCallback(
    (field: OrderCardField) => {
      const value = getFieldValue(field.id)
      return (
        <FieldRenderer
          key={field.id}
          field={field}
          value={value}
          difficultyLabels={difficultyLabels}
          users={users}
        />
      )
    },
    [getFieldValue, difficultyLabels, users]
  )

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Order Card Preview</h3>
        <Button size="sm" onClick={onSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Go Live"}
        </Button>
      </div>

      <FetchOrderControls
        stores={stores}
        selectedStoreId={selectedStoreId}
        setSelectedStoreId={setSelectedStoreId}
        orderNameToFetch={orderNameToFetch}
        setOrderNameToFetch={setOrderNameToFetch}
        onFetchOrder={onFetchOrder}
        isFetching={isFetching}
      />

      {/* The Card Preview */}
      <Card
        className={`${getCardStyle()} transition-all duration-200`}
        onClick={(e) => {
          // Don't toggle if clicking on form elements or their children
          const target = e.target as HTMLElement
          if (
            target.closest('input, textarea, select, button, [role="button"], [data-radix-trigger]')
          ) {
            return
          }
          setIsExpanded(!isExpanded)
        }}
      >
        {!isExpanded ? (
          <CollapsedView
            sampleOrder={sampleOrder}
            previewStatus={previewStatus}
            onStatusChange={handleStatusChange}
            difficultyLabels={difficultyLabels}
            realOrderData={realOrderData}
            handleShowProductImage={handleShowProductImage}
          />
        ) : (
          <ExpandedView
            sampleOrder={sampleOrder}
            previewStatus={previewStatus}
            onStatusChange={handleStatusChange}
            fields={fields}
            users={users}
            difficultyLabels={difficultyLabels}
            getFieldValue={getFieldValue}
            onCustomisationsChange={handleCustomisationsChange}
            realOrderData={realOrderData}
            handleShowProductImage={handleShowProductImage}
          />
        )}
      </Card>
      
      <FieldVisibilityControls
        fields={fields}
        onToggleFieldVisibility={onToggleFieldVisibility}
      />
      
      {/* Product Image Modal */}
      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        shopifyProductId={selectedProductId}
        shopifyVariantId={selectedVariantId}
      />
    </div>
  )
}
