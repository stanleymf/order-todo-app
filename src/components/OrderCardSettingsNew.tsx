import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Switch } from "./ui/switch"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible"
import { Alert } from "./ui/alert"
import {
    Save,
    Key,
    Phone,
    MapPin,
    Calendar,
    CheckCircle,
    AlertCircle,
    FileText,
    Package,
    User as UserIcon,
    Tag,
    CreditCard,
    Loader2,
    XCircle,
    Hash,
    Percent,
    Truck,
    RotateCcw,
    ChevronsUpDown,
    Check,
    Package2,
    List,
    AlertTriangle,
    ChevronDown,
    DollarSign,
    Link,
    Globe,
    Image,
    ClipboardList,
    Clock,
    Gift,
    MessageSquare,
    Mail,
    Plus,
    Trash2,
    GripVertical,
    Move
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import {
  getOrderCardConfig,
  saveOrderCardConfig,
  getProductLabels,
  getStores,
  getUsers,
  fetchShopifyOrder,
} from "../services/api"
import type { ProductLabel } from "../types"
import { OrderCardPreview } from "./OrderCardPreview"
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command"
import { cn } from "../lib/utils"
import { ScrollArea } from "./ui/scroll-area"
import { toast } from "sonner"
import { OrderCardField, ORDER_CARD_FIELDS, OrderCardFieldType } from "../types/orderCardFields"

// Predefined regex patterns for common extractions
const REGEX_PATTERNS = {
  timeslot: {
    pattern: "\\b(?:0?[0-9]|1[0-2]):[0-5][0-9]-(?:0?[0-9]|1[0-2]):[0-5][0-9]\\b",
    description: "Extract timeslot in format hh:mm-hh:mm (e.g., 09:30-11:30)",
    example: "09:30-11:30"
  },
  date: {
    pattern: "\\b(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/([0-9]{4})\\b",
    description: "Extract date in format dd/mm/yyyy (e.g., 25/12/2024)",
    example: "25/12/2024"
  },
  time: {
    pattern: "\\b(?:0?[0-9]|1[0-2]):[0-5][0-9]\\s*(?:AM|PM|am|pm)?\\b",
    description: "Extract time in format hh:mm or hh:mm AM/PM",
    example: "14:30 or 2:30 PM"
  },
  phone: {
    pattern: "\\b(?:\\+?[0-9]{1,3}[-.\\s]?)?(?:[0-9]{3,4}[-.\\s]?){2}[0-9]{4}\\b",
    description: "Extract phone numbers in various formats",
    example: "+1-555-123-4567 or 555-123-4567"
  },
  email: {
    pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b",
    description: "Extract email addresses",
    example: "customer@example.com"
  }
}

function getAllFields(): OrderCardField[] {
  // Return a deep clone to prevent mutation of the original constant
  return JSON.parse(JSON.stringify(ORDER_CARD_FIELDS))
}

interface ShopifyFieldOption {
  value: string
  label: string
}

interface ShopifyFieldCategory {
  name: string
  fields: ShopifyFieldOption[]
}

function getShopifyFieldOptions(): ShopifyFieldCategory[] {
  return [
    {
      name: "Product Labels",
      fields: [
        { value: "product:difficultyLabel", label: "Difficulty Label" },
        { value: "product:productTypeLabel", label: "Product Type Label" },
      ],
    },
    {
      name: "Core Order Fields",
      fields: [
        { value: "id", label: "Order ID" },
        { value: "name", label: "Order Name" },
        { value: "orderNumber", label: "Order Number" },
        { value: "createdAt", label: "Created At" },
        { value: "note", label: "Note" },
        { value: "tags", label: "Tags" },
        { value: "displayFulfillmentStatus", label: "Fulfillment Status" },
        { value: "displayFinancialStatus", label: "Financial Status" },
      ],
    },
    {
      name: "Product Information",
      fields: [
        { value: "lineItems.edges.0.node.title", label: "Product Title" },
        { value: "lineItems.edges.0.node.variant.title", label: "Product Variant" },
        { value: "lineItems.edges.0.node.variant.sku", label: "Product SKU" },
        { value: "lineItems.edges.0.node.quantity", label: "Quantity" },
      ],
    },
    {
      name: "Customer Information",
      fields: [
        { value: "shippingAddress.name", label: "Recipient Name" },
        { value: "shippingAddress.firstName", label: "First Name" },
        { value: "shippingAddress.lastName", label: "Last Name" },
        { value: "email", label: "Email" },
        { value: "phone", label: "Phone" },
        { value: "shippingAddress.address1", label: "Address Line 1" },
        { value: "shippingAddress.address2", label: "Address Line 2" },
        { value: "shippingAddress.city", label: "City" },
        { value: "shippingAddress.province", label: "Province/State" },
        { value: "shippingAddress.country", label: "Country" },
      ],
    },
    {
      name: "Note Attributes",
      fields: [
        { value: "noteAttributes.delivery_date", label: "Delivery Date" },
        { value: "noteAttributes.delivery_time", label: "Delivery Time" },
        { value: "noteAttributes.card_message", label: "Card Message" },
        { value: "noteAttributes.delivery_instructions", label: "Delivery Instructions" },
        { value: "noteAttributes.add_ons", label: "Add-Ons" },
        { value: "noteAttributes.timeslot", label: "Timeslot" },
        { value: "noteAttributes.recipient_name", label: "Recipient Name" },
        { value: "noteAttributes.occasion", label: "Occasion" },
      ],
    },
    {
      name: "Financial Information",
      fields: [
        { value: "totalPriceSet.shopMoney.amount", label: "Total Price" },
        { value: "subtotalPriceSet.shopMoney.amount", label: "Subtotal" },
        { value: "totalTaxSet.shopMoney.amount", label: "Total Tax" },
        { value: "totalDiscountsSet.shopMoney.amount", label: "Total Discounts" },
        { value: "currencyCode", label: "Currency" },
      ],
    },
  ]
}

export const OrderCardSettings: React.FC = () => {
  const { tenant } = useAuth()
  const [config, setConfig] = useState<OrderCardField[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productLabels, setProductLabels] = useState<ProductLabel[]>([])
  
  // Preview state
  const [isSaving, setIsSaving] = useState(false)
  const [stores, setStores] = useState<any[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [orderNameToFetch, setOrderNameToFetch] = useState<string>("")
  const [isFetching, setIsFetching] = useState(false)
  const [realOrderData, setRealOrderData] = useState<any>(null)
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([])

  // Field management state
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false)
  const [newFieldType, setNewFieldType] = useState<OrderCardFieldType>("text")
  const [newFieldGroup, setNewFieldGroup] = useState<string>("General")

  useEffect(() => {
    if (tenant?.id) {
      loadConfig()
      loadProductLabels()
      loadStores()
      loadUsers()
    }
  }, [tenant?.id])

  const loadConfig = async () => {
    if (!tenant) return
    try {
      setIsLoading(true)
      const data = await getOrderCardConfig(tenant.id)
      const allFields = getAllFields()
      const mergedConfig = allFields.map(field => {
        const savedField = data.fields?.find((f: any) => f.id === field.id)
        return savedField ? { ...field, ...savedField } : field
      })
      setConfig(mergedConfig)
    } catch (err) {
      setError("Failed to load order card configuration.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }
  
  const loadProductLabels = async () => {
    if (!tenant?.id) return;
    try {
      const labels = await getProductLabels(tenant.id)
      setProductLabels(labels)
    } catch (error) {
      console.error("Failed to load product labels:", error)
      toast.error("Failed to load product labels for order card config.")
    }
  }

  const loadStores = async () => {
    if (!tenant?.id) return;
    try {
      const storesData = await getStores(tenant.id)
      setStores(storesData)
      if (storesData.length > 0) {
        setSelectedStoreId(storesData[0].id)
      }
    } catch (error) {
      console.error("Failed to load stores:", error)
    }
  }

  const loadUsers = async () => {
    if (!tenant?.id) return;
    try {
      const usersData = await getUsers(tenant.id)
      setUsers(usersData)
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }

  const handleSaveConfig = async () => {
    if (!tenant) return
    try {
      setIsSaving(true)
      await saveOrderCardConfig(tenant.id, { fields: config })
      toast.success("Order card configuration saved successfully!")
    } catch (err) {
      toast.error("Failed to save configuration.")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleFieldChange = (id: string, key: keyof OrderCardField, value: any) => {
    setConfig(prevConfig =>
      prevConfig.map(field => (field.id === id ? { ...field, [key]: value } : field))
    )
  }

  const handleToggleFieldVisibility = (fieldId: string) => {
    setConfig(prevConfig =>
      prevConfig.map(field =>
        field.id === fieldId ? { ...field, isVisible: !field.isVisible } : field
      )
    )
  }

  const handleFetchOrder = async () => {
    if (!tenant?.id || !selectedStoreId || !orderNameToFetch) {
      toast.error("Please select a store and enter an order name")
      return
    }

    try {
      setIsFetching(true)
      const orderData = await fetchShopifyOrder(tenant.id, selectedStoreId, orderNameToFetch)
      console.log("Fetched Shopify Order Data:", JSON.stringify(orderData, null, 2))
      setRealOrderData(orderData)
      toast.success("Order data fetched successfully!")
    } catch (error) {
      console.error("Failed to fetch order:", error)
      toast.error("Failed to fetch order data")
    } finally {
      setIsFetching(false)
    }
  }

  // Field management functions
  const handleAddField = () => {
    const newField: OrderCardField = {
      id: `custom_${Date.now()}`,
      label: `New ${newFieldType} Field`,
      description: `Custom ${newFieldType} field`,
      type: newFieldType,
      isVisible: true,
      isSystem: false,
      isEditable: true,
    }
    setConfig(prev => [...prev, newField])
    setShowAddFieldDialog(false)
    setNewFieldType("text")
    setNewFieldGroup("General")
    toast.success("Field added successfully!")
  }

  const handleRemoveField = (fieldId: string) => {
    setConfig(prev => prev.filter(field => field.id !== fieldId))
    toast.success("Field removed successfully!")
  }

  // Regex processing function
  const applyRegexProcessing = (value: string, processor: any): string => {
    if (!processor || !processor.pattern || !value) return value

    try {
      const regex = new RegExp(processor.pattern, 'g')
      const matches = value.match(regex)
      
      if (matches && matches.length > 0) {
        // If outputFormat is specified, format the first match
        if (processor.outputFormat) {
          const match = matches[0]
          // Handle date formatting
          if (processor.outputFormat === "date") {
            const dateMatch = match.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              const [, day, month, year] = dateMatch
              return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            }
          }
          // Handle timeslot formatting
          if (processor.outputFormat === "timeslot") {
            return match // Return as-is for timeslot
          }
          return match
        }
        
        // Return first match by default
        return matches[0]
      }
      
      return "No match found"
    } catch (error) {
      console.error("Regex processing error:", error)
      return "Regex error"
    }
  }

  const handleDragStart = (fieldId: string) => {
    setDraggedFieldId(fieldId)
  }

  const handleDragOver = (e: React.DragEvent, targetFieldId: string) => {
    e.preventDefault()
    if (draggedFieldId && draggedFieldId !== targetFieldId) {
      const draggedIndex = config.findIndex(f => f.id === draggedFieldId)
      const targetIndex = config.findIndex(f => f.id === targetFieldId)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newConfig = [...config]
        const [draggedField] = newConfig.splice(draggedIndex, 1)
        newConfig.splice(targetIndex, 0, draggedField)
        setConfig(newConfig)
      }
    }
  }

  const handleDragEnd = () => {
    setDraggedFieldId(null)
  }

  const handleSaveFieldMappings = async () => {
    if (!tenant) return
    try {
      setIsSaving(true)
      await saveOrderCardConfig(tenant.id, { fields: config })
      toast.success("Field mappings saved successfully!")
    } catch (err) {
      toast.error("Failed to save field mappings.")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    )
  }

  if (error) {
    return <Alert variant="destructive">{error}</Alert>
  }

  // Convert config to ExternalOrderCardField format for preview
  const previewFields: OrderCardField[] = config.map(field => ({
    ...field
  }))

  return (
    <div className="space-y-6">
      {/* Live Preview First */}
      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            This is how your order card will look based on your configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrderCardPreview 
            fields={previewFields}
            onSave={handleSaveConfig}
            isSaving={isSaving}
            users={users}
            difficultyLabels={productLabels.filter(p => p.category === 'difficulty')}
            productTypeLabels={productLabels.filter(p => p.category === 'productType')}
            realOrderData={realOrderData}
            stores={stores}
            onFetchOrder={handleFetchOrder}
            isFetching={isFetching}
            orderNameToFetch={orderNameToFetch}
            setOrderNameToFetch={setOrderNameToFetch}
            selectedStoreId={selectedStoreId}
            setSelectedStoreId={setSelectedStoreId}
          />
        </CardContent>
      </Card>

      {/* Field Mappings & Visibility Second */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Order Card Field Mappings</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddFieldDialog(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Custom Field
              </Button>
              <Button 
                onClick={handleSaveFieldMappings} 
                disabled={isSaving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.map((field) => (
              <div
                key={field.id}
                className={`p-4 border rounded-lg ${
                  field.isVisible ? "bg-white" : "bg-gray-50"
                }`}
              >
                <FieldEditor 
                  field={field} 
                  onFieldChange={handleFieldChange}
                  productLabels={productLabels}
                />
                {field.id.startsWith('custom_') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(field.id)}
                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      {showAddFieldDialog && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <CardContent className="w-96 p-6">
            <CardHeader>
              <CardTitle>Add New Field</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <Label>Field Type</Label>
                <Select
                  value={newFieldType}
                  onValueChange={value => setNewFieldType(value as OrderCardFieldType)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="tags">Tags</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Group</Label>
                <Select value={newFieldGroup} onValueChange={setNewFieldGroup}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="General">General</SelectItem>
                    <SelectItem value="Details">Details</SelectItem>
                    <SelectItem value="Assignment">Assignment</SelectItem>
                    <SelectItem value="Labels">Labels</SelectItem>
                    <SelectItem value="Notes">Notes</SelectItem>
                    <SelectItem value="Status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddField} className="flex-1">
                  Add Field
                </Button>
                <Button variant="outline" onClick={() => setShowAddFieldDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const FieldEditor: React.FC<{
  field: OrderCardField
  onFieldChange: (id: string, key: keyof OrderCardField, value: any) => void
  productLabels: ProductLabel[]
}> = ({ field, onFieldChange, productLabels }) => {
  const shopifyFields = getShopifyFieldOptions()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-white">
      {/* Column 1: Order Card Fields */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{field.label}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={field.isVisible}
              onCheckedChange={() => onFieldChange(field.id, "isVisible", !field.isVisible)}
            />
            <span>Visible</span>
          </div>
        </div>

        {field.isVisible && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-medium">Display Label</Label>
              <Input
                value={field.label}
                onChange={e => onFieldChange(field.id, "label", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Column 2: Processor and Pattern */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">Data Processor</Label>
          <Switch
            checked={!!field.transformation}
            onCheckedChange={(checked) => {
              if (checked) {
                onFieldChange(field.id, "transformation", "extract")
              } else {
                onFieldChange(field.id, "transformation", undefined)
                onFieldChange(field.id, "transformationRule", undefined)
              }
            }}
          />
        </div>

        {field.transformation && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-medium">Processor Type</Label>
              <Select 
                value={field.transformation || "extract"} 
                onValueChange={(value: any) => onFieldChange(field.id, "transformation", value)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extract">Extract with Regex</SelectItem>
                  <SelectItem value="transform">Transform Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium">Regex Pattern</Label>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {Object.entries(REGEX_PATTERNS).map(([key, pattern]) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => onFieldChange(field.id, "transformationRule", pattern.pattern)}
                    className="text-xs h-6 px-2"
                    title={pattern.description}
                  >
                    {key}
                  </Button>
                ))}
              </div>
              <Input
                placeholder="Enter custom regex pattern..."
                value={field.transformationRule || ""}
                onChange={e => onFieldChange(field.id, "transformationRule", e.target.value)}
                className="h-8 text-sm"
              />
              {field.transformationRule && (
                <div className="text-xs text-gray-500 mt-1">
                  {Object.entries(REGEX_PATTERNS).find(([key, pattern]) => pattern.pattern === field.transformationRule)?.[1]?.description || "Custom pattern"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Column 3: Shopify Field Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">Shopify Data Field</Label>
        <ShopifyFieldCombobox
          value={field.shopifyFields?.join(',') || ''}
          onChange={value => onFieldChange(field.id, "shopifyFields", value.split(','))}
          fieldOptions={shopifyFields}
        />
        {field.shopifyFields && (
          <div className="text-xs text-muted-foreground mt-1">
            Maps to: {field.shopifyFields.join(', ')}
          </div>
        )}
      </div>
    </div>
  )
}

const ShopifyFieldCombobox: React.FC<{
  value: string
  onChange: (value: string) => void
  fieldOptions: ShopifyFieldCategory[]
}> = ({ value, onChange, fieldOptions }) => {
  const [open, setOpen] = useState(false)

  const selectedFields = useMemo(() => {
    const selectedValues = value ? value.split(',') : []
    return fieldOptions.flatMap(cat => cat.fields).filter(f => selectedValues.includes(f.value))
  }, [value, fieldOptions])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selectedFields.length > 0 ? selectedFields.map(f => f.label).join(', ') : "Select Shopify field..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search Shopify fields..." />
          <CommandList>
            <CommandEmpty>No field found.</CommandEmpty>
            {fieldOptions.map((category) => (
              <CommandGroup key={category.name} heading={category.name}>
                {category.fields.map((field) => (
                  <CommandItem
                    key={field.value}
                    value={field.value}
                    onSelect={() => {
                      onChange(field.value)
                      setOpen(false)
                    }}
                  >
                    {field.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 