import React, { useState } from "react"
import { Card, CardContent } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"
import {
  ChevronDown,
  ChevronUp,
  Package,
  Hash,
  Clock,
  Calendar,
  AlertTriangle,
  User,
  Gift,
  Eye,
  EyeOff,
} from "lucide-react"
import { OrderCardField } from "../types/orderCardFields"

interface OrderDetailCardProps {
  order: any
  fields: OrderCardField[]
  isExpanded?: boolean
  onToggle?: () => void
}

export const OrderDetailCard: React.FC<OrderDetailCardProps> = ({
  order,
  fields,
  isExpanded = false,
  onToggle,
}) => {
  const [expanded, setExpanded] = useState(isExpanded)

  const handleToggle = () => {
    setExpanded(!expanded)
    onToggle?.()
  }

  // Get field value from order data
  const getFieldValue = (field: OrderCardField): any => {
    if (!order) return null

    // Handle special mappings based on field ID
    switch (field.id) {
      case "productTitle":
        return order.shopifyOrderData?.lineItems?.edges?.[0]?.node?.title || 
               order.productTitle || 
               "Bouquet"
      
      case "orderId":
        return order.shopifyOrderData?.name || order.id || "N/A"
      
      case "timeslot":
        // Extract timeslot from tags
        const tags = order.shopifyOrderData?.tags || []
        const timeslotMatch = tags.find((tag: string) => 
          /\d{2}:\d{2}-\d{2}:\d{2}/.test(tag)
        )
        return timeslotMatch || "Not set"
      
      case "orderDate":
        // Extract date from tags in dd/mm/yyyy format
        const dateTags = order.shopifyOrderData?.tags || []
        const dateMatch = dateTags.find((tag: string) => 
          /\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/([0-9]{4})\b/.test(tag)
        )
        return dateMatch || new Date(order.createdAt).toLocaleDateString('en-GB')
      
      case "difficultyLabel":
        return order.difficultyLabel || "Easy"
      
      case "addOns":
        return order.addOns || "Not set"
      
      case "assignedTo":
        return order.assignedTo || "Windflower"
      
      case "productTypeLabel":
        return order.productTypeLabel || "Bouquet"
      
      default:
        return order[field.id] || "Not set"
    }
  }

  // Get field icon
  const getFieldIcon = (fieldId: string) => {
    switch (fieldId) {
      case "productTitle":
      case "productTypeLabel":
        return <Package className="h-4 w-4" />
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

  // Get visible fields
  const visibleFields = fields.filter(field => field.isVisible)
  
  // Get primary field (product title)
  const primaryField = visibleFields.find(f => f.id === "productTitle")
  const primaryValue = primaryField ? getFieldValue(primaryField) : "Order"

  return (
    <Card className="transition-all duration-200 hover:shadow-md border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        {/* Header Row - Always Visible */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold text-lg">{primaryValue}</h3>
              <p className="text-sm text-muted-foreground">
                {getFieldValue({ id: "productTypeLabel" } as OrderCardField)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Difficulty Badge - Always visible */}
            <Badge className={getDifficultyColor(getFieldValue({ id: "difficultyLabel" } as OrderCardField))}>
              {getFieldValue({ id: "difficultyLabel" } as OrderCardField)}
            </Badge>
            
            {/* Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggle}
              className="h-8 w-8"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {visibleFields
              .filter(field => !["productTitle", "productTypeLabel", "difficultyLabel"].includes(field.id))
              .map((field) => {
                const value = getFieldValue(field)
                const icon = getFieldIcon(field.id)
                
                return (
                  <div key={field.id} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {icon && <span className="text-muted-foreground">{icon}</span>}
                      <span className="text-sm font-medium">{field.label}:</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {value}
                      </span>
                    </div>
                  </div>
                )
              })}
            
            {/* Additional section for extra details */}
            <div className="mt-4 p-3 bg-muted/50 rounded-md">
              <p className="text-sm text-muted-foreground">
                {getFieldValue({ id: "customisations" } as OrderCardField) || "Not set"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 