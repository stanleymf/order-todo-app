import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip"
import { Label } from "./ui/label"
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
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useIsMobile } from "./hooks/use-mobile"
import { ProductImageModal } from "./shared/ProductImageModal"
import { useAuth } from "../contexts/AuthContext"

// Simple cache for product labels to prevent duplicate API calls
const productLabelCache = new Map<string, any>();
const pendingRequests = new Map<string, Promise<any>>();

interface OrderCardProps {
  order: any
  fields: OrderCardField[]
  users?: Array<{ id: string; name: string }>
  difficultyLabels?: Array<{ id: string; name: string; color: string }>
  productTypeLabels?: Array<{ id: string; name: string; color: string }>
  onUpdate?: (orderId: string, updates: any) => void
  onShowProductImage?: (shopifyProductId?: string, shopifyVariantId?: string) => void
}

type OrderStatus = "unassigned" | "assigned" | "completed"

const getValueFromShopifyData = (sourcePath: string, data: any): any => {
  if (!sourcePath || !data) {
    return null;
  }

  if (sourcePath.startsWith("product:")) {
    const productField = sourcePath.split(":")[1];
    const savedProductData = data.savedProductData;
    
    if (!savedProductData) return null;
    
    if (productField === "difficultyLabel" || productField === "productTypeLabel") {
      const labelNames = savedProductData.labelNames || [];
      const labelCategories = savedProductData.labelCategories || [];
      
      if (productField === "difficultyLabel") {
        const difficultyLabels = labelNames.filter((_name: string, index: number) => 
          labelCategories[index] === 'difficulty'
        );
        if (difficultyLabels.length > 0) {
          return difficultyLabels[0];
        }
        // Return a sensible default for difficulty if no label exists
        return "Standard";
      }
      
      if (productField === "productTypeLabel") {
        const productTypeLabels = labelNames.filter((_name: string, index: number) => 
          labelCategories[index] === 'productType'
        );
        if (productTypeLabels.length > 0) {
          return productTypeLabels[0];
        }
        // Return a sensible default for product type if no label exists
        return "Arrangement";
      }
    }
    
    return savedProductData[productField];
  }

  const parts = sourcePath.split('.');
  let current: any = data;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (current === null || typeof current === 'undefined') {
      return null;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part);
      if (!isNaN(index)) {
        if (index >= 0 && index < current.length) {
          current = current[index];
        } else {
          return null;
        }
      } else {
        const nextPart = parts[i + 1];
        if (nextPart) {
          const item = current.find(d => d.name === nextPart);
          current = item ? item.value : null;
          i++;
        } else {
          return current;
        }
      }
    } else if (typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }

  return current;
};

const applyTransformation = (value: any, field: OrderCardField): any => {
  // Handle special product label fields that depend on saved product data
  if (field.id === "difficultyLabel" || field.id === "productTypeLabel") {
    // These will be handled by the product label fetching logic
    return value || null;
  }

  if (field.transformation === "extract" && field.transformationRule) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const match = item.match(new RegExp(field.transformationRule));
          if (match) return match[0];
        }
      }
      return null; // Return null instead of "Not set" to let component handle display
    }
    if (typeof value === "string") {
      try {
        const regex = new RegExp(field.transformationRule);
        const match = value.match(regex);
        return match ? match[0] : null; // Return null instead of "Not set"
      } catch (e) {
        console.error("Invalid regex:", e);
        return "Invalid Regex";
      }
    }
    return null; // Return null instead of "Not set"
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value; // Let the component handle null/undefined display
};

const StatusCircles: React.FC<{
  status: OrderStatus
  onStatusChange: (status: OrderStatus) => void
}> = ({ status, onStatusChange }) => {
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
            <Button variant="ghost" size="icon" className={`rounded-full ${buttonPadding}`}>
              <Circle
                className={`transition-all ${iconSize} ${
                  status === "unassigned"
                    ? "fill-gray-400 text-gray-400"
                    : "text-gray-300 hover:text-gray-400"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Unassigned</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange("assigned")
            }}
          >
            <Button variant="ghost" size="icon" className={`rounded-full ${buttonPadding}`}>
              <Circle
                className={`transition-all ${iconSize} ${
                  status === "assigned"
                    ? "fill-blue-500 text-blue-500"
                    : "text-gray-300 hover:text-blue-400"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Assigned</p></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            asChild
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange("completed")
            }}
          >
            <Button variant="ghost" size="icon" className={`rounded-full ${buttonPadding}`}>
              <CheckCircle
                className={`transition-all ${iconSize} ${
                  status === "completed"
                    ? "fill-green-500 text-white"
                    : "text-gray-300 hover:text-green-400"
                }`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Completed</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

const FieldRenderer: React.FC<{
  field: OrderCardField
  value: any
  difficultyLabels: Array<{ id: string; name: string; color: string }>
  users: Array<{ id: string; name: string }>
  onUpdate?: (fieldId: string, value: any) => void
}> = ({ field, value, users, onUpdate }) => {
  const getFieldIcon = () => {
    const iconMap: { [key: string]: React.ElementType } = {
      productTitle: Package,
      productVariantTitle: Gift,
      timeslot: Clock,
      orderId: Hash,
      orderDate: Calendar,
      orderTags: Tag,
      assignedTo: User,
      difficultyLabel: AlertTriangle,
      customisations: MessageSquare,
    }
    return iconMap[field.id] || Package
  }

  const getPriorityColor = () => {
    if (!value || typeof value !== 'string') return 'bg-gray-100 text-gray-800'
    const priority = value.toLowerCase()
    if (priority.includes('easy')) return 'bg-green-100 text-green-800'
    if (priority.includes('medium')) return 'bg-yellow-100 text-yellow-800'
    if (priority.includes('hard')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getAssignedUserName = () => {
    if (!value) return "Unassigned"
    const user = users.find(u => u.id === value)
    return user ? user.name : value
  }

  const renderValue = () => {
    switch (field.type) {
      case "select":
        if (field.id === "assignedTo") {
          if (field.isEditable && onUpdate) {
            return (
              <Select value={value || ""} onValueChange={(newValue) => onUpdate(field.id, newValue)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
          return <span className="text-sm text-muted-foreground">{getAssignedUserName()}</span>
        }
        break

      case "textarea":
        if (field.isEditable && onUpdate) {
          return (
            <Textarea
              value={value || ""}
              onChange={(e) => onUpdate(field.id, e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className="w-full"
            />
          )
        }
        return <p className="text-sm text-muted-foreground">{value || "No notes added"}</p>

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
        return <span className="text-sm text-muted-foreground">{value || "No tags"}</span>

      default:
        if (field.id === "difficultyLabel" && value) {
          return (
            <Badge className={getPriorityColor()}>
              {value}
            </Badge>
          )
        }
        
        // Handle specific field fallbacks to avoid "Not set"
        if (!value || value === "") {
          switch (field.id) {
            case "orderDate":
            case "deliveryDate":
              return <span className="text-sm text-muted-foreground italic">Date not specified</span>
            case "customerName":
              return <span className="text-sm text-muted-foreground italic">No customer name</span>
            case "orderNumber":
            case "orderId":
              return <span className="text-sm text-muted-foreground italic">No order number</span>
            case "notes":
              return <span className="text-sm text-muted-foreground italic">No notes</span>
            case "timeslot":
              return <span className="text-sm text-muted-foreground italic">No timeslot</span>
            case "deliveryTimeSlot":
              return <span className="text-sm text-muted-foreground italic">No delivery time</span>
            case "productVariantTitle":
              return <span className="text-sm text-muted-foreground italic">Standard</span>
            default:
              return <span className="text-sm text-muted-foreground italic">Not specified</span>
          }
        }
        
        return <span className="text-sm text-muted-foreground">{value}</span>
    }
  }

  const Icon = getFieldIcon()

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <Label className="text-xs font-medium text-muted-foreground">
          {field.label}
        </Label>
        {renderValue()}
      </div>
    </div>
  )
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  fields,
  users = [],
  difficultyLabels = [],
  onUpdate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Debug log for state changes
  useEffect(() => {
    console.log(`OrderCard ${order.id} - isExpanded changed to:`, isExpanded)
  }, [isExpanded, order.id])
  const [status, setStatus] = useState<OrderStatus>("assigned")
  const [isProductImageModalOpen, setIsProductImageModalOpen] = useState(false)
  const [selectedProductId] = useState<string | undefined>()
  const [selectedVariantId] = useState<string | undefined>()

  const { tenant } = useAuth()

  const getFieldValue = useCallback((fieldId: string): any => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return null

    let rawValue = null
    
    if (field.shopifyFields && field.shopifyFields.length > 0) {
      const sourcePath = field.shopifyFields[0]
      rawValue = getValueFromShopifyData(sourcePath, order.shopifyOrderData || order)
    } else {
      rawValue = order[fieldId] || order[field.id]
    }

    return applyTransformation(rawValue, field)
  }, [order, fields])

  useEffect(() => {
    if (order.assignedTo) {
      setStatus(order.isCompleted ? "completed" : "assigned")
    } else {
      setStatus("unassigned")
    }
  }, [order])

  useEffect(() => {
    const fetchProductLabel = async () => {
      if (!tenant?.id || !order.shopifyOrderData) return

      let shopifyProductId = order.productTitleId
      let shopifyVariantId = order.variantId

      if (!shopifyProductId || !shopifyVariantId) {
        const lineItem = order.shopifyOrderData.lineItems?.edges?.[0]?.node
        if (lineItem) {
          shopifyProductId = lineItem.product?.id
          shopifyVariantId = lineItem.variant?.id
        }
      }

      if (shopifyProductId && shopifyProductId.includes('/')) {
        shopifyProductId = shopifyProductId.split('/').pop()
      }
      if (shopifyVariantId && shopifyVariantId.includes('/')) {
        shopifyVariantId = shopifyVariantId.split('/').pop()
      }

      if (!shopifyProductId || !shopifyVariantId) return

      // Check if we already have saved product data to avoid unnecessary API calls
      if (order.shopifyOrderData.savedProductData) return

      // Create cache key
      const cacheKey = `${tenant.id}-${shopifyProductId}-${shopifyVariantId}`;

      // Check cache first
      if (productLabelCache.has(cacheKey)) {
        const cachedProduct = productLabelCache.get(cacheKey);
        if (order.shopifyOrderData && !order.shopifyOrderData.savedProductData) {
          order.shopifyOrderData.savedProductData = {
            labelNames: cachedProduct.labelNames || [],
            labelCategories: cachedProduct.labelCategories || [],
            labelColors: cachedProduct.labelColors || [],
          }
        }
        return;
      }

      // Check if request is already pending
      if (pendingRequests.has(cacheKey)) {
        try {
          const product = await pendingRequests.get(cacheKey);
          if (order.shopifyOrderData && !order.shopifyOrderData.savedProductData) {
            order.shopifyOrderData.savedProductData = {
              labelNames: product.labelNames || [],
              labelCategories: product.labelCategories || [],
              labelColors: product.labelColors || [],
            }
          }
        } catch (error) {
          console.error("Failed to fetch product label from pending request:", error)
        }
        return;
      }

      try {
        const jwt = localStorage.getItem("auth_token")
        const fetchPromise = fetch(`/api/tenants/${tenant.id}/saved-products/by-shopify-id?shopify_product_id=${shopifyProductId}&shopify_variant_id=${shopifyVariantId}`, {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json"
          }
        }).then(res => res.ok ? res.json() : Promise.reject('Network error'));

        // Store the pending request
        pendingRequests.set(cacheKey, fetchPromise);
        
        const product = await fetchPromise;
        
        // Cache the result
        productLabelCache.set(cacheKey, product);
        
        // Clean up pending request
        pendingRequests.delete(cacheKey);
        
        if (order.shopifyOrderData && !order.shopifyOrderData.savedProductData) {
          order.shopifyOrderData.savedProductData = {
            labelNames: product.labelNames || [],
            labelCategories: product.labelCategories || [],
            labelColors: product.labelColors || [],
          }
        }
        
      } catch (error) {
        console.error("Failed to fetch product label:", error)
        // Clean up pending request on error
        pendingRequests.delete(cacheKey);
      }
    }

    // Fetch product label data with caching
    fetchProductLabel()
  }, [tenant?.id, order?.id])

  const handleStatusChange = (newStatus: OrderStatus) => {
    setStatus(newStatus)
    if (onUpdate) {
      const updates: any = {}
      switch (newStatus) {
        case "unassigned":
          updates.assignedTo = null
          updates.isCompleted = false
          break
        case "assigned":
          updates.assignedTo = "current-user"
          updates.isCompleted = false
          break
        case "completed":
          updates.assignedTo = "current-user"
          updates.isCompleted = true
          break
      }
      onUpdate(order.cardId || order.id, updates)
    }
  }

  const handleFieldUpdate = (fieldId: string, value: any) => {
    if (onUpdate) {
      onUpdate(order.cardId || order.id, { [fieldId]: value })
    }
  }

  const getCardStyle = () => {
    switch (status) {
      case "completed":
        return "border-green-200 bg-green-50/50"
      case "assigned":
        return "border-blue-200 bg-blue-50/50"
      case "unassigned":
        return "border-gray-200 bg-gray-50/50"
      default:
        return "border-gray-200"
    }
  }

  const productTitle = getFieldValue('productTitle') || 'Unknown Product'
  const productVariant = getFieldValue('productVariantTitle') || ''
  const difficultyLabel = getFieldValue('difficultyLabel')
  const visibleFields = fields.filter(field => field.isVisible && field.id !== 'productTitle' && field.id !== 'productVariantTitle')

  // Error boundary to prevent white screen
  const safeRender = (renderFn: () => React.ReactNode) => {
    try {
      return renderFn()
    } catch (error) {
      console.error('OrderCard render error:', error)
      return <span className="text-red-500 text-sm">Error rendering field</span>
    }
  }

  const getDifficultyBadge = () => {
    if (!difficultyLabel) return null
    
    const getPriorityColor = () => {
      const priority = difficultyLabel.toLowerCase()
      if (priority.includes('easy')) return 'bg-green-100 text-green-800'
      if (priority.includes('medium')) return 'bg-yellow-100 text-yellow-800'
      if (priority.includes('hard')) return 'bg-red-100 text-red-800'
      return 'bg-gray-100 text-gray-800'
    }

    return (
      <Badge className={getPriorityColor()}>
        {difficultyLabel}
      </Badge>
    )
  }

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md ${getCardStyle()}`}
    >
      {isExpanded ? (
        <>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {productTitle}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  console.log('Expand button clicked, current state:', isExpanded)
                  setIsExpanded(!isExpanded)
                }}
              >
                <EyeOff className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="flex justify-center">
                <StatusCircles status={status} onStatusChange={handleStatusChange} />
              </div>

              <div className="space-y-2">
                {visibleFields.map((field) => (
                  <div key={field.id}>
                    {safeRender(() => (
                      <FieldRenderer
                        field={field}
                        value={getFieldValue(field.id)}
                        difficultyLabels={difficultyLabels}
                        users={users}
                        onUpdate={handleFieldUpdate}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </>
      ) : (
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h3 className="font-medium text-sm truncate">{productTitle}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={() => {
                    console.log('Collapse button clicked, current state:', isExpanded)
                    setIsExpanded(!isExpanded)
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
              
              {productVariant && productVariant !== "Default Title" && productVariant.trim() !== "" && (
                <p className="text-xs text-muted-foreground truncate mb-1">{productVariant}</p>
              )}
              
              {getDifficultyBadge() && (
                <div className="mt-1">
                  {getDifficultyBadge()}
                </div>
              )}
            </div>
            
            <div className="flex-shrink-0">
              <StatusCircles status={status} onStatusChange={handleStatusChange} />
            </div>
          </div>
        </CardContent>
      )}

      <ProductImageModal
        isOpen={isProductImageModalOpen}
        onClose={() => setIsProductImageModalOpen(false)}
        shopifyProductId={selectedProductId}
        shopifyVariantId={selectedVariantId}
        tenantId={tenant?.id}
      />
    </Card>
  )
}
