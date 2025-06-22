import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
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
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Circle,
  Gift,
  MessageSquare,
} from "lucide-react"
import { OrderCardField, getFieldById } from "../types/orderCardFields"
import { useAuth } from "../contexts/AuthContext"
import { getOrderCardConfig } from "../services/api"
import { getAllFields } from "../types/orderCardFields"

interface OrderCardProps {
  order: any // Using 'any' for now, should be a proper Order type
  users?: Array<{ id: string; name: string }>
  difficultyLabels?: Array<{ id: string; name: string; color: string }>
  onUpdate?: (orderId: string, updates: any) => void
  isEditable?: boolean
  currentUserId?: string
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  users = [],
  difficultyLabels = [],
  onUpdate,
  isEditable = true,
  currentUserId,
}) => {
  const { tenant } = useAuth()
  const [isExpanded, setIsExpanded] = useState(false)
  const [fields, setFields] = useState<OrderCardField[]>([])
  const [transformedData, setTransformedData] = useState<any>({})

  useEffect(() => {
    const loadConfig = async () => {
      if (!tenant) return
      try {
        const config = await getOrderCardConfig(tenant.id)
        if (config && config.fields) {
          setFields(config.fields)
        } else {
          setFields(getAllFields())
        }
      } catch (error) {
        setFields(getAllFields())
      }
    }
    loadConfig()
  }, [tenant])

  const getValueFromShopifyData = (sourcePath: string, data: any) => {
    if (!sourcePath || !data) return undefined

    if (sourcePath === "tags") return Array.isArray(data.tags) ? data.tags.join(", ") : data.tags
    if (sourcePath === "line_items.title") return data.lineItems?.edges?.[0]?.node?.title
    if (sourcePath === "line_items.variant_title")
      return data.lineItems?.edges?.[0]?.node?.variant?.title
    return data[sourcePath]
  }

  const applyTransformation = (value: any, field: OrderCardField): any => {
    if (field.transformation === "extract" && field.transformationRule) {
      if (typeof value !== "string") return null
      try {
        const regex = new RegExp(field.transformationRule)
        const match = value.match(regex)
        if (match && match[0]) {
          let extractedValue = match[0]
          if (field.type === "date") {
            const parts = extractedValue.split("/")
            let date
            if (parts.length === 3 && parts[2].length === 4) {
              const reformattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`
              date = new Date(reformattedDate)
            } else {
              date = new Date(extractedValue)
            }
            return date && !isNaN(date.getTime()) ? date.toISOString() : "Invalid Date"
          }
          return extractedValue
        }
        return "No match"
      } catch (e) {
        return "Regex Error"
      }
    }
    return value
  }

  useEffect(() => {
    if (order && fields.length > 0) {
      const newTransformedData: { [key: string]: any } = {}
      fields.forEach((field) => {
        let value
        // Default to order properties if they exist (e.g., from DB)
        if (order[field.id] !== undefined) {
          value = order[field.id]
        }
        // Otherwise, try to map from Shopify data if available
        else if (order.shopifyOrderData && field.shopifyFields && field.shopifyFields.length > 0) {
          const shopifyPath = field.shopifyFields[0]
          value = getValueFromShopifyData(shopifyPath, order.shopifyOrderData)
        }
        newTransformedData[field.id] = applyTransformation(value, field)
      })
      setTransformedData(newTransformedData)
    }
  }, [order, fields])

  const getFieldIcon = (fieldId: string) => {
    switch (fieldId) {
      case "productTitle":
      case "productVariantTitle":
        return <Package className="h-4 w-4" />
      case "timeslot":
        return <Clock className="h-4 w-4" />
      case "orderId":
        return <Hash className="h-4 w-4" />
      case "orderDate":
        return <Calendar className="h-4 w-4" />
      case "orderTags":
        return <Tag className="h-4 w-4" />
      case "assignedTo":
        return <User className="h-4 w-4" />
      case "priorityLabel":
        return <AlertTriangle className="h-4 w-4" />
      case "addOns":
        return <Gift className="h-4 w-4" />
      case "customisations":
        return <MessageSquare className="h-4 w-4" />
      default:
        return null
    }
  }

  const getAssignedUserName = () => {
    const user = users.find((u) => u.id === transformedData.assignedTo)
    return user?.name || "Unassigned"
  }

  const getPriorityLabelName = () => {
    const label = difficultyLabels.find(
      (l) => l.name.toLowerCase() === String(transformedData.priorityLabel).toLowerCase()
    )
    return label?.name || "Not Set"
  }

  const getPriorityColor = () => {
    const label = difficultyLabels.find(
      (l) => l.name.toLowerCase() === String(transformedData.priorityLabel).toLowerCase()
    )
    return label?.color || "gray"
  }

  const renderValue = (field: OrderCardField) => {
    let value = transformedData[field.id]

    if (value === undefined || value === null) return "N/A"

    switch (field.type) {
      case "date":
        const date = new Date(value)
        return !isNaN(date.getTime())
          ? new Intl.DateTimeFormat("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            }).format(date)
          : String(value)
      case "select":
        if (field.id === "assignedTo") return getAssignedUserName()
        if (field.id === "priorityLabel") return getPriorityLabelName()
        return String(value)
      default:
        return String(value)
    }
  }

  const visibleFields = fields.filter((f) => f.isVisible)

  if (fields.length === 0) {
    return <div>Loading configuration...</div>
  }

  const CollapsedView = () => (
    <CardContent className="p-3 cursor-pointer" onClick={() => setIsExpanded(true)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-gray-900 leading-tight">
            {transformedData.productTitle || "No Product Title"}
          </div>
          <div className="text-sm text-gray-500 font-normal mt-1">
            {transformedData.productVariantTitle}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Status logic can be added here if needed */}
          {transformedData.priorityLabel && (
            <Badge
              variant="secondary"
              style={{ backgroundColor: getPriorityColor(), color: "white" }}
            >
              {getPriorityLabelName()}
            </Badge>
          )}
        </div>
      </div>
    </CardContent>
  )

  const ExpandedView = () => (
    <>
      <CardHeader className="pb-3 cursor-pointer">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Package className="h-5 w-5" />
              {transformedData.productTitle || "Untitled Product"}
            </CardTitle>
            {transformedData.product_label && (
              <Badge variant="secondary" className="mt-2">
                {transformedData.product_label}
              </Badge>
            )}
            {transformedData.productVariantTitle && (
              <p className="text-sm text-muted-foreground mt-1">
                {transformedData.productVariantTitle}
              </p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
            <ChevronUp className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleFields.map((field) => (
          <div key={field.id} className="flex items-start gap-2 text-sm">
            <div className="w-5 h-5 flex-shrink-0 text-muted-foreground">
              {getFieldIcon(field.id)}
            </div>
            <span className="font-medium w-32 flex-shrink-0">{field.label}:</span>
            {field.id === "priorityLabel" ? (
              <Badge
                variant="secondary"
                style={{ backgroundColor: getPriorityColor(), color: "white" }}
              >
                {renderValue(field)}
              </Badge>
            ) : (
              <span className="flex-1 break-words">{renderValue(field)}</span>
            )}
          </div>
        ))}
      </CardContent>
    </>
  )

  return <Card>{isExpanded ? <ExpandedView /> : <CollapsedView />}</Card>
}
