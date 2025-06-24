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
import { useAuth } from "../contexts/AuthContext"

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface OrderCardPreviewProps {
  fields: OrderCardField[]
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
  if (!sourcePath || !data) {
    console.log('getValueFromShopifyData: Missing sourcePath or data', { sourcePath, hasData: !!data })
    return null;
  }

  console.log('getValueFromShopifyData: Starting extraction', { sourcePath, dataKeys: Object.keys(data) })

  const parts = sourcePath.split('.');
  let current: any = data;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    console.log('getValueFromShopifyData: Processing part', { part, currentType: typeof current, currentKeys: current && typeof current === 'object' ? Object.keys(current) : 'N/A' })
    
    if (current === null || typeof current === 'undefined') {
      console.log('getValueFromShopifyData: Current is null/undefined, returning null')
      return null;
    }

    if (Array.isArray(current)) {
      // Check if the part is a numeric index
      const index = parseInt(part);
      if (!isNaN(index)) {
        // This is an array index
        if (index >= 0 && index < current.length) {
          current = current[index];
          console.log('getValueFromShopifyData: Array index access', { index, newCurrent: current })
        } else {
          console.log('getValueFromShopifyData: Array index out of bounds', { index, arrayLength: current.length })
          return null;
        }
      } else {
        // This is for arrays like note_attributes, which are {name, value} pairs
        // We assume the *next* part of the path is the 'name' we're looking for.
        const nextPart = parts[i + 1];
        if (nextPart) {
          const item = current.find(d => d.name === nextPart);
          current = item ? item.value : null;
          console.log('getValueFromShopifyData: Array name-value processing', { nextPart, item, current })
          // We've used the next part, so we skip it in the next iteration
          i++; // Skip the next iteration
        } else {
          // If there's no next part, it means we're targeting the array itself (like 'tags')
          console.log('getValueFromShopifyData: Returning array', current)
          return current;
        }
      }
    } else if (typeof current === 'object' && part in current) {
      current = current[part];
      console.log('getValueFromShopifyData: Object property access', { part, newCurrent: current })
    } else {
      console.log('getValueFromShopifyData: Property not found', { part, currentType: typeof current, currentKeys: current && typeof current === 'object' ? Object.keys(current) : 'N/A' })
      return null;
    }
  }

  console.log('getValueFromShopifyData: Final result', current)
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
          // Handle dd/mm/yyyy format by converting to yyyy-mm-dd
          if (typeof value === 'string' && value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            const [day, month, year] = value.split('/');
            const isoDate = `${year}-${month}-${day}`;
            return new Date(isoDate).toLocaleDateString();
          }
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
}) => {
  const isMobile = useIsMobile()

  return (
    <div
      className={`flex items-center gap-2 p-3 border rounded-lg bg-muted/40 ${
        isMobile ? "flex-col" : ""
      }`}
    >
      <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[200px]"}>
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
        className={isMobile ? "w-full" : "w-[180px]"}
        placeholder="Order Name (e.g. #1001)"
        value={orderNameToFetch}
        onChange={(e) => setOrderNameToFetch(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onFocus={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <Button
        onClick={onFetchOrder}
        disabled={isFetching}
        variant="outline"
        className={isMobile ? "w-full" : "w-[140px]"}
      >
        {isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Fetch Order
      </Button>
    </div>
  )
}

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
  productLabel: { name: string; color: string } | null
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
  productLabel,
}) => {
  const renderField = (field: OrderCardField) => {
    // If this is the difficultyLabel or productTypeLabel field, use productLabel if available
    if (field.id === "difficultyLabel" || field.id === "productTypeLabel") {
      return (
        <div className="flex items-center gap-2 text-sm">
          {field.id === "difficultyLabel" ? (
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">{field.label}:</span>
          {productLabel ? (
            <Badge
              variant="secondary"
              style={{ backgroundColor: productLabel.color, color: "white" }}
            >
              {productLabel.name}
            </Badge>
          ) : (
            <span className="text-gray-400">Not set</span>
          )}
        </div>
      )
    }
    // Default: use FieldRenderer
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
        {productLabel && (
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Badge
                variant="secondary"
                style={{ backgroundColor: productLabel.color, color: "white" }}
              >
                {productLabel.name}
              </Badge>
            </div>
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
  productLabel: { name: string; color: string } | null
}

const CollapsedView: React.FC<CollapsedViewProps> = ({
  sampleOrder,
  previewStatus,
  onStatusChange,
  difficultyLabels = [],
  realOrderData,
  handleShowProductImage,
  productLabel,
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
      {productLabel && (
        <div className="absolute bottom-3 right-3">
          <Badge style={{ backgroundColor: productLabel.color, color: "white" }}>
            {productLabel.name}
          </Badge>
        </div>
      )}
    </CardContent>
  )
}

export const OrderCardPreview: React.FC<OrderCardPreviewProps> = ({
  fields,
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

  const { tenant } = useAuth();
  const [productLabel, setProductLabel] = useState<{ name: string; color: string } | null>(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Effect to load real data into the preview
  useEffect(() => {
    if (realOrderData) {
      console.log('OrderCardPreview: Processing real order data', realOrderData)
      
      const newInitialValues: { [key: string]: any } = {}
      fields.forEach((field) => {
        // Start with a null value for all fields when real data is present
        newInitialValues[field.id] = null
        if (field.shopifyFields && field.shopifyFields.length > 0) {
          const shopifyPath = field.shopifyFields[0]
          const value = getValueFromShopifyData(shopifyPath, realOrderData)
          console.log(`OrderCardPreview: Field ${field.id} (${field.label})`, {
            shopifyPath,
            value,
            hasValue: value !== undefined && value !== null
          })
          if (value !== undefined && value !== null) {
            newInitialValues[field.id] = value
          }
        } else {
          console.log(`OrderCardPreview: Field ${field.id} (${field.label}) has no shopify fields mapping`)
        }
      })

      console.log('OrderCardPreview: New initial values', newInitialValues)

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
      setSampleOrder((prev) => {
        const newOrder = {
          ...prev, // Keep structure and things like id, isCompleted
          ...Object.fromEntries(fields.map((f) => [f.id, null])), // Reset all fields
          ...newInitialValues, // Apply new values
        }
        console.log('OrderCardPreview: Updated sample order', newOrder)
        return newOrder
      })
    } else {
      console.log('OrderCardPreview: No real order data available')
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

  // Effect to fetch product label for the current product/variant
  useEffect(() => {
    const fetchProductLabel = async () => {
      console.log('fetchProductLabel: effect triggered', { tenant, realOrderData });
      if (!tenant?.id || !realOrderData?.lineItems?.edges?.[0]?.node) {
        console.log('fetchProductLabel: missing tenant or order data', { tenant, realOrderData });
        return;
      }
      const shopifyProductId = realOrderData.lineItems.edges[0].node.product?.id?.split("/").pop();
      const shopifyVariantId = realOrderData.lineItems.edges[0].node.variant?.id?.split("/").pop();
      console.log('fetchProductLabel: extracted IDs', { shopifyProductId, shopifyVariantId });
      if (!shopifyProductId || !shopifyVariantId) {
        console.log('fetchProductLabel: missing product or variant ID');
        return;
      }
      try {
        const jwt = localStorage.getItem("auth_token");
        console.log('fetchProductLabel: making fetch', { tenantId: tenant.id, shopifyProductId, shopifyVariantId });
        const res = await fetch(`/api/tenants/${tenant.id}/saved-products/by-shopify-id?shopify_product_id=${shopifyProductId}&shopify_variant_id=${shopifyVariantId}`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json"
          }
        });
        console.log('fetchProductLabel: fetch response', res);
        if (!res.ok) {
          console.log('fetchProductLabel: response not ok', res.status, res.statusText);
          return;
        }
        const product = await res.json();
        console.log('fetchProductLabel: fetched product', product);
        // Find difficulty label first, then fallback to product type label
        let label = null;
        let names = [];
        let cats = [];
        let colors = [];
        if (Array.isArray(product.labelNames)) {
          names = product.labelNames;
        } else if (typeof product.labelNames === 'string') {
          names = product.labelNames.split(',');
        }
        if (Array.isArray(product.labelCategories)) {
          cats = product.labelCategories;
        } else if (typeof product.labelCategories === 'string') {
          cats = product.labelCategories.split(',');
        }
        if (Array.isArray(product.labelColors)) {
          colors = product.labelColors;
        } else if (typeof product.labelColors === 'string') {
          colors = product.labelColors.split(',');
        }
        // Try to find difficulty label
        for (let i = 0; i < cats.length; i++) {
          if (cats[i] === 'difficulty') {
            label = { name: names[i], color: colors[i] || '#e53e3e' };
            break;
          }
        }
        // Fallback to productType label
        if (!label) {
          for (let i = 0; i < cats.length; i++) {
            if (cats[i] === 'productType') {
              label = { name: names[i], color: colors[i] || '#3182ce' };
              break;
            }
          }
        }
        setProductLabel(label);
      } catch (e) {
        console.log('fetchProductLabel: error', e);
        setProductLabel(null);
      }
    };
    fetchProductLabel();
  }, [tenant?.id, realOrderData]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Memoized status change handler
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

    // Special handling for label fields - these come from Saved Products, not Shopify
    if (fieldId === "difficultyLabel" || fieldId === "productTypeLabel") {
      console.log(`Field ${fieldId} (${field.label}): Using Saved Products data, not Shopify`)
      return null // Return null so custom rendering can handle it
    }

    let rawValue

    // If there is real data, try to get the value from it based on the mapping
    if (realOrderData && field.shopifyFields && field.shopifyFields.length > 0) {
      // Use the first mapping for now. Can be enhanced later.
      const sourcePath = field.shopifyFields[0]
      rawValue = getValueFromShopifyData(sourcePath, realOrderData)
      
      // Debug logging
      console.log(`Field ${fieldId} (${field.label}):`, {
        sourcePath,
        rawValue,
        hasRealOrderData: !!realOrderData,
        shopifyFields: field.shopifyFields
      })
    } else {
      // Fallback to sample data if no real order is present
      rawValue = (sampleOrder as any)[fieldId]
      
      // Debug logging
      console.log(`Field ${fieldId} (${field.label}):`, {
        sourcePath: 'sample data',
        rawValue,
        hasRealOrderData: !!realOrderData,
        hasShopifyFields: !!(field.shopifyFields && field.shopifyFields.length > 0)
      })
    }

    const transformedValue = applyTransformation(rawValue, field)
    
    // Debug logging for final value
    console.log(`Field ${fieldId} final value:`, transformedValue)
    
    return transformedValue
  }, [fields, realOrderData, sampleOrder])

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
            productLabel={productLabel}
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
            productLabel={productLabel}
          />
        )}
      </Card>
      
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

