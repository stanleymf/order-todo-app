import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select"
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
  Circle,
  Gift,
  MessageSquare,
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"
import { useAuth } from "../contexts/AuthContext"

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
  if (!sourcePath || !data) return undefined
  if (sourcePath === "tags") return Array.isArray(data.tags) ? data.tags.join(", ") : data.tags
  if (sourcePath === "line_items.title") return data.lineItems?.edges?.[0]?.node?.title
  if (sourcePath === "line_items.variant_title") return data.lineItems?.edges?.[0]?.node?.variant?.title
  return data[sourcePath]
}

const applyTransformation = (value: any, field: OrderCardField): any => {
  if (field.transformation === "extract" && field.transformationRule) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const match = item.match(new RegExp(field.transformationRule));
          if (match) return match[0];
        }
      }
      return "Not set";
    }
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
    return "Not set";
  }
  if (Array.isArray(value)) return value.join(', ');
  return value ?? "Not set";
}

const StatusCircles: React.FC<{ status: OrderStatus; onStatusChange?: (status: OrderStatus) => void }> = ({ status, onStatusChange }) => {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 rounded-full ${status === "unassigned" ? "bg-gray-200" : "bg-gray-100"}`} onClick={() => onStatusChange?.("unassigned")}>
        <Circle className="h-3 w-3 text-gray-500" />
      </Button>
      <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 rounded-full ${status === "assigned" ? "bg-blue-200" : "bg-gray-100"}`} onClick={() => onStatusChange?.("assigned")}>
        <Circle className="h-3 w-3 text-blue-500" />
      </Button>
      <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 rounded-full ${status === "completed" ? "bg-green-200" : "bg-gray-100"}`} onClick={() => onStatusChange?.("completed")}>
        <CheckCircle className="h-3 w-3 text-green-500" />
      </Button>
    </div>
  )
}

const FieldRenderer: React.FC<{ field: OrderCardField; value: any; difficultyLabels: Array<{ id: string; name: string; color: string }>; users: Array<{ id: string; name: string }>; onUpdate?: (fieldId: string, value: any) => void }> = ({ field, value, difficultyLabels, users, onUpdate }) => {
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

  const renderValue = () => {
    if (field.type === "textarea" && field.isEditable) {
      return (
        <Textarea value={value || ""} onChange={(e) => onUpdate?.(field.id, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} className="mt-1 resize-none" onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
      )
    }
    if (field.type === "select" && field.isEditable) {
      return (
        <Select value={value || ""} onValueChange={(newValue) => onUpdate?.(field.id, newValue)} onOpenChange={(e) => e.stopPropagation()}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {field.id === "assignedTo" && users.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
            {field.id === "difficultyLabel" && difficultyLabels.map((label) => (
              <SelectItem key={label.id} value={label.id}>{label.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (field.type === "text" && field.isEditable) {
      return (
        <Input value={value || ""} onChange={(e) => onUpdate?.(field.id, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} className="mt-1" onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
      )
    }
    if (field.id === "assignedTo") {
      const user = users.find((u) => u.id === value)
      return <span className="text-blue-600 font-medium">{user?.name || ""}</span>
    }
    if (field.id === "difficultyLabel") {
      const label = difficultyLabels.find((l) => l.id === value)
      if (label) {
        return <Badge variant="secondary" style={{ backgroundColor: label.color, color: "white" }}>{label.name}</Badge>
      }
      return <span className="text-gray-400">Not assigned</span>
    }
    return <span className="text-gray-900">{value || "Not set"}</span>
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

const ExpandedView: React.FC<{ order: any; status: OrderStatus; onStatusChange: (status: OrderStatus) => void; fields: OrderCardField[]; users: Array<{ id: string; name: string }>; difficultyLabels: Array<{ id: string; name: string; color: string }>; getFieldValue: (fieldId: string) => any; onCustomisationsChange: (value: string) => void; onShowProductImage: (shopifyProductId?: string, shopifyVariantId?: string) => void; productLabel: { name: string; color: string } | null }> = ({ order, status, onStatusChange, fields, users, difficultyLabels, getFieldValue, onCustomisationsChange, onShowProductImage, productLabel }) => {
  const renderField = (field: OrderCardField) => {
    if (field.id === "difficultyLabel" || field.id === "productTypeLabel") {
      return (
        <div className="flex items-center gap-2 text-sm">
          {field.id === "difficultyLabel" ? <AlertTriangle className="h-4 w-4 text-muted-foreground" /> : <Package className="h-4 w-4 text-muted-foreground" />}
          <span className="font-medium">{field.label}:</span>
          {productLabel ? (
            <Badge variant="secondary" style={{ backgroundColor: productLabel.color, color: "white" }}>{productLabel.name}</Badge>
          ) : (
            <span className="text-gray-400">Not set</span>
          )}
        </div>
      )
    }
    const value = getFieldValue(field.id)
    return (
      <FieldRenderer key={field.id} field={field} value={value} difficultyLabels={difficultyLabels} users={users} />
    )
  }

  return (
    <>
      <CardHeader className="pb-3 cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              {getFieldValue("productTitle")}
              {order.shopifyOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={(e) => { e.stopPropagation(); const productId = order.shopifyOrderData.lineItems.edges[0].node.product.id; const variantId = order.shopifyOrderData.lineItems.edges[0].node.variant?.id; onShowProductImage(productId, variantId) }}>
                  <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
                </Button>
              )}
            </CardTitle>
            {getFieldValue("productVariantTitle") && (
              <p className="text-sm text-muted-foreground mt-1">{getFieldValue("productVariantTitle")}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusCircles status={status} onStatusChange={onStatusChange} />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="h-4 w-4" />
            {getFieldValue("orderId")}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.filter((field) => field.isVisible && !["productTitle", "productVariantTitle", "orderId", "assignedTo", "customisations"].includes(field.id)).map(renderField)}
        {(getFieldValue("assignedTo") || fields.find((f) => f.id === "customisations")?.isVisible) && (
          <div className="border-t pt-4 space-y-3">
            {getFieldValue("assignedTo") && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Assigned to:</span>
                <span className="text-blue-600 font-medium">{users.find((u) => u.id === getFieldValue("assignedTo"))?.name || ""}</span>
              </div>
            )}
            {fields.find((f) => f.id === "customisations")?.isVisible && (
              <div className="space-y-2">
                <Textarea id="customisations-textarea" value={getFieldValue("customisations")} onChange={(e) => onCustomisationsChange(e.target.value)} placeholder="Add extra notes..." className="mt-1 resize-none overflow-y-auto max-h-[500px] whitespace-pre-wrap" onClick={(e) => e.stopPropagation()} onFocus={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </>
  )
}

const CollapsedView: React.FC<{ order: any; status: OrderStatus; onStatusChange: (status: OrderStatus) => void; difficultyLabels?: Array<{ id: string; name: string; color: string }>; onShowProductImage: (shopifyProductId?: string, shopifyVariantId?: string) => void; productLabel: { name: string; color: string } | null; getFieldValue: (fieldId: string) => any }> = ({ order, status, onStatusChange, difficultyLabels = [], onShowProductImage, productLabel, getFieldValue }) => {
  const difficultyLabel = productLabel && productLabel.name && productLabel.color ? productLabel : null;

  return (
    <CardContent className="p-3 cursor-pointer relative min-h-[90px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0 pr-16">
          <div className="text-base font-semibold text-gray-900 leading-tight">{getFieldValue("productTitle")}</div>
          <div className="text-sm text-gray-500 font-normal mt-1">{getFieldValue("productVariantTitle")}</div>
          {order.shopifyOrderData?.lineItems?.edges?.[0]?.node?.product?.id && (
            <div className="mt-2">
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={(e) => { e.stopPropagation(); const productId = order.shopifyOrderData.lineItems.edges[0].node.product.id; const variantId = order.shopifyOrderData.lineItems.edges[0].node.variant?.id; onShowProductImage(productId, variantId) }}>
                <Eye className="h-4 w-4 text-gray-500 hover:text-gray-700" />
              </Button>
            </div>
          )}
        </div>
        <div className="absolute top-3 right-3">
          <StatusCircles status={status} onStatusChange={onStatusChange} />
        </div>
      </div>
      {difficultyLabel && (
        <div className="absolute bottom-3 right-3">
          <Badge style={{ backgroundColor: difficultyLabel.color, color: "white" }}>{difficultyLabel.name}</Badge>
        </div>
      )}
    </CardContent>
  )
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, fields, users = [], difficultyLabels = [], productTypeLabels = [], onUpdate, onShowProductImage }) => {
  const { tenant } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [status, setStatus] = useState<OrderStatus>("unassigned")
  const [productLabel, setProductLabel] = useState<{ name: string; color: string } | null>(null)

  useEffect(() => {
    const fetchProductLabelAndImage = async () => {
      if (!tenant?.id || !order) return;
      
      let shopifyProductId = order.shopifyProductId || order.product_id || order.productId;
      let shopifyVariantId = order.shopifyVariantId || order.variant_id || order.variantId;
      
      if (!shopifyProductId || !shopifyVariantId) {
        const lineItem = order.shopifyOrderData?.lineItems?.edges?.[0]?.node;
        if (lineItem) {
          shopifyProductId = lineItem.product?.id;
          shopifyVariantId = lineItem.variant?.id;
        }
      }
      
      if (shopifyProductId && shopifyProductId.includes('/')) {
        shopifyProductId = shopifyProductId.split('/').pop();
      }
      if (shopifyVariantId && shopifyVariantId.includes('/')) {
        shopifyVariantId = shopifyVariantId.split('/').pop();
      }
      
      if (!shopifyProductId || !shopifyVariantId) {
        console.log('OrderCard: Missing product or variant ID', { shopifyProductId, shopifyVariantId, orderKeys: Object.keys(order), lineItems: order.shopifyOrderData?.lineItems });
        return;
      }
      
      console.log('OrderCard: Fetching product label for', { shopifyProductId, shopifyVariantId });
      
      try {
        const jwt = localStorage.getItem("auth_token");
        const res = await fetch(`/api/tenants/${tenant.id}/saved-products/by-shopify-id?shopify_product_id=${shopifyProductId}&shopify_variant_id=${shopifyVariantId}`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
        });
        if (!res.ok) {
          console.log('OrderCard: API response not ok', { status: res.status, statusText: res.statusText });
          return;
        }
        const product = await res.json();
        console.log('OrderCard: Received product data', product);

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

        let label = null;
        for (let i = 0; i < cats.length; i++) {
          if (cats[i] === 'difficulty') {
            label = { name: names[i], color: colors[i] || '#e53e3e' };
            break;
          }
        }
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
        console.error('OrderCard: Error fetching product label', e);
        setProductLabel(null);
      }
    };
    fetchProductLabelAndImage();
  }, [tenant?.id, order]);

  const handleStatusChange = useCallback((newStatus: OrderStatus) => {
    setStatus(newStatus)
  }, [])

  const handleCustomisationsChange = useCallback((value: string) => {
    if (onUpdate && order.cardId) {
      onUpdate(order.cardId, { customisations: value })
    }
  }, [onUpdate, order.cardId])

  const getCardStyle = () => {
    if (status === "completed") return "border-green-500 bg-green-50"
    if (status === "assigned") return "border-blue-500 bg-blue-50"
    return "border-gray-200 bg-white"
  }

  const getFieldValue = useCallback((fieldId: string): any => {
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return ""

    if (fieldId === "difficultyLabel" || fieldId === "productTypeLabel") {
      console.log(`Field ${fieldId} (${field.label}): Using Saved Products data, not Shopify`)
      return null
    }

    let rawValue

    if (order.shopifyOrderData && field.shopifyFields && field.shopifyFields.length > 0) {
      const sourcePath = field.shopifyFields[0]
      rawValue = getValueFromShopifyData(sourcePath, order.shopifyOrderData)
      
      console.log(`Field ${fieldId} (${field.label}):`, {
        sourcePath,
        rawValue,
        hasShopifyOrderData: !!order.shopifyOrderData,
        shopifyFields: field.shopifyFields
      })
    } else {
      rawValue = order[fieldId] || order[field.id]
      
      console.log(`Field ${fieldId} (${field.label}):`, {
        sourcePath: 'direct order properties',
        rawValue,
        hasShopifyOrderData: !!order.shopifyOrderData,
        hasShopifyFields: !!(field.shopifyFields && field.shopifyFields.length > 0)
      })
    }

    const transformedValue = applyTransformation(rawValue, field)
    
    console.log(`Field ${fieldId} final value:`, transformedValue)
    
    return transformedValue
  }, [fields, order])

  return (
    <Card className={`${getCardStyle()} transition-all duration-200`} onClick={(e) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, button, [role="button"], [data-radix-trigger]')) {
        return
      }
      setIsExpanded(!isExpanded)
    }}>
      {!isExpanded ? (
        <CollapsedView order={order} status={status} onStatusChange={handleStatusChange} difficultyLabels={difficultyLabels} onShowProductImage={onShowProductImage} productLabel={productLabel} getFieldValue={getFieldValue} />
      ) : (
        <ExpandedView order={order} status={status} onStatusChange={handleStatusChange} fields={fields} users={users} difficultyLabels={difficultyLabels} getFieldValue={getFieldValue} onCustomisationsChange={handleCustomisationsChange} onShowProductImage={onShowProductImage} productLabel={productLabel} />
      )}
    </Card>
  )
}
