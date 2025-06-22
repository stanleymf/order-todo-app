import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Badge } from "@/components/ui/badge"
import { useMobileView } from "./Dashboard"
import type { Store } from "../types"

interface StoreSelectorProps {
  stores: Store[]
  selectedStoreId: string | null
  onStoreChange: (storeId: string | null) => void
  showOrderCounts?: boolean
  orderCounts?: { [storeId: string]: number }
}

// Generate a consistent color based on store ID
const generateStoreColor = (storeId: string): string => {
  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#ec4899",
    "#6366f1",
  ]
  const index = storeId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
}

export function StoreSelector({
  stores,
  selectedStoreId,
  onStoreChange,
  showOrderCounts = false,
  orderCounts = {},
}: StoreSelectorProps) {
  const { isMobileView } = useMobileView()

  return (
    <Select
      value={selectedStoreId || "all"}
      onValueChange={(value) => onStoreChange(value === "all" ? null : value)}
    >
      <SelectTrigger className={`${isMobileView ? "w-full" : "w-[280px]"}`}>
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center justify-between w-full">
            <span className={`${isMobileView ? "text-sm" : ""}`}>All Stores</span>
            {showOrderCounts && (
              <Badge variant="outline" className={`ml-2 ${isMobileView ? "text-xs" : ""}`}>
                {Object.values(orderCounts).reduce((sum, count) => sum + count, 0)}
              </Badge>
            )}
          </div>
        </SelectItem>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div
                  className={`${isMobileView ? "w-2 h-2 mr-1" : "w-3 h-3 mr-2"} rounded-full`}
                  style={{ backgroundColor: generateStoreColor(store.id) }}
                />
                <span className={`${isMobileView ? "text-sm" : ""}`}>{store.name}</span>
              </div>
              {showOrderCounts && orderCounts[store.id] !== undefined && (
                <Badge variant="outline" className={`ml-2 ${isMobileView ? "text-xs" : ""}`}>
                  {orderCounts[store.id]}
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
