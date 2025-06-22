import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Switch } from "./ui/switch"
import { Badge } from "./ui/badge"
import { Separator } from "./ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog"
import { Textarea } from "./ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import {
  Settings as SettingsIcon,
  Users,
  Store as StoreIcon,
  Shield,
  Bell,
  Palette,
  Database,
  Download,
  Upload,
  Trash2,
  Plus,
  Edit,
  Save,
  X,
  Eye,
  EyeOff,
  Key,
  Mail,
  Phone,
  MapPin,
  Clock,
  Globe,
  DollarSign,
  Calendar,
  CheckCircle,
  AlertCircle,
  Info,
  Webhook,
  RefreshCw,
  UserPlus,
  Link,
  FileText,
  Package,
  User as UserIcon,
  Tag,
  UserCheck,
  Layout,
  BarChart3,
  CreditCard,
  Loader2,
  XCircle,
  ArrowRight,
  Hash,
  Percent,
  Truck,
  RotateCcw,
  Building,
  Gift,
  ChevronsUpDown,
  Check,
  Package2,
  Palette as PaletteIcon,
  Text,
  List,
  Combine,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { useMobileView } from "./Dashboard"
import {
  getUsers,
  getStores,
  createUser,
  getOrderCardConfig,
  saveOrderCardConfig,
  getTenantSettings,
  updateTenantSettings,
  getProductLabels,
  createStore,
  registerShopifyWebhooks,
  fetchShopifyOrder,
} from "../services/api"
import type { User, Store, ProductLabel } from "../types"
import {
  getAllFields,
  type OrderCardField,
  type OrderCardFieldType,
} from "../types/orderCardFields"
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
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"

const userRoles = ["admin", "florist", "owner", "viewer"] as const
type UserRole = (typeof userRoles)[number]

type NewUser = {
  name: string
  email: string
  password?: string
  role: UserRole
}

type NewStore = {
  name: string
  type: "shopify"
  settings: {
    domain: string
    accessToken: string
    apiSecretKey: string
  }
}

interface ShopifyFieldOption {
  value: string
  label: string
  icon: React.ComponentType<{ className?: string }>
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
        { value: "product:difficultyLabel", label: "Difficulty Label", icon: AlertTriangle },
        { value: "product:productTypeLabel", label: "Product Type Label", icon: Package2 },
      ],
    },
    {
      name: "Core Order Fields",
      fields: [
        { value: "id", label: "Order ID", icon: Hash },
        { value: "name", label: "Order Name", icon: FileText },
        { value: "order_number", label: "Order Number", icon: Hash },
        { value: "created_at", label: "Created At", icon: Calendar },
        { value: "updated_at", label: "Updated At", icon: Calendar },
        { value: "processed_at", label: "Processed At", icon: Calendar },
        { value: "cancelled_at", label: "Cancelled At", icon: Calendar },
        { value: "note", label: "Note", icon: FileText },
        { value: "tags", label: "Tags", icon: Tag },
        { value: "currency", label: "Currency", icon: DollarSign },
        { value: "total_price", label: "Total Price", icon: DollarSign },
        { value: "subtotal_price", label: "Subtotal Price", icon: DollarSign },
        { value: "total_tax", label: "Total Tax", icon: DollarSign },
        { value: "total_discounts", label: "Total Discounts", icon: DollarSign },
        { value: "total_weight", label: "Total Weight", icon: Package },
        { value: "financial_status", label: "Financial Status", icon: CreditCard },
        { value: "fulfillment_status", label: "Fulfillment Status", icon: Package },
        { value: "confirmed", label: "Confirmed", icon: CheckCircle },
        { value: "test", label: "Test Order", icon: AlertCircle },
        { value: "cancelled", label: "Cancelled", icon: XCircle },
        { value: "cancel_reason", label: "Cancel Reason", icon: AlertCircle },
        { value: "closed_at", label: "Closed At", icon: Calendar },
        { value: "location_id", label: "Location ID", icon: MapPin },
        { value: "source_name", label: "Source Name", icon: Link },
        { value: "source_identifier", label: "Source Identifier", icon: Hash },
        { value: "source_url", label: "Source URL", icon: Link },
        { value: "device_id", label: "Device ID", icon: Package },
        { value: "phone", label: "Phone", icon: Phone },
        { value: "landing_site", label: "Landing Site", icon: Globe },
        { value: "landing_site_ref", label: "Landing Site Ref", icon: Link },
        { value: "referring_site", label: "Referring Site", icon: Link },
        { value: "checkout_id", label: "Checkout ID", icon: CreditCard },
        { value: "checkout_token", label: "Checkout Token", icon: Key },
        { value: "client_details", label: "Client Details", icon: UserIcon },
        { value: "browser_ip", label: "Browser IP", icon: Globe },
        { value: "user_agent", label: "User Agent", icon: Package },
        { value: "accept_language", label: "Accept Language", icon: Globe },
        { value: "cart_token", label: "Cart Token", icon: Package },
        { value: "gateway", label: "Gateway", icon: CreditCard },
        { value: "processing_method", label: "Processing Method", icon: CreditCard },
        { value: "checkout_api_token", label: "Checkout API Token", icon: Key },
        { value: "reference", label: "Reference", icon: Hash },
        { value: "reference_label", label: "Reference Label", icon: Tag },
        { value: "customer_locale", label: "Customer Locale", icon: Globe },
        { value: "app_id", label: "App ID", icon: Package },
        { value: "billing_address", label: "Billing Address", icon: MapPin },
        { value: "shipping_address", label: "Shipping Address", icon: MapPin },
        { value: "line_items", label: "Line Items", icon: List },
        { value: "shipping_lines", label: "Shipping Lines", icon: Truck },
        { value: "discount_codes", label: "Discount Codes", icon: Percent },
        { value: "tax_lines", label: "Tax Lines", icon: DollarSign },
        { value: "note_attributes", label: "Note Attributes", icon: List },
        { value: "payment_gateway_names", label: "Payment Gateway Names", icon: CreditCard },
        { value: "total_line_items_price", label: "Total Line Items Price", icon: DollarSign },
        {
          value: "total_line_items_price_set",
          label: "Total Line Items Price Set",
          icon: DollarSign,
        },
        { value: "total_discounts_set", label: "Total Discounts Set", icon: DollarSign },
        { value: "total_shipping_price_set", label: "Total Shipping Price Set", icon: DollarSign },
        { value: "subtotal_price_set", label: "Subtotal Price Set", icon: DollarSign },
        { value: "total_price_set", label: "Total Price Set", icon: DollarSign },
        { value: "total_tax_set", label: "Total Tax Set", icon: DollarSign },
        { value: "total_tip_received", label: "Total Tip Received", icon: DollarSign },
        {
          value: "original_total_duties_set",
          label: "Original Total Duties Set",
          icon: DollarSign,
        },
        { value: "current_total_duties_set", label: "Current Total Duties Set", icon: DollarSign },
        { value: "admin_graphql_api_id", label: "Admin GraphQL API ID", icon: Hash },
        { value: "shipping_lines", label: "Shipping Lines", icon: Truck },
        { value: "fulfillments", label: "Fulfillments", icon: Package },
        { value: "refunds", label: "Refunds", icon: RotateCcw },
        { value: "customer", label: "Customer", icon: UserIcon },
      ],
    },
    {
      name: "Line Item Fields",
      fields: [
        { value: "line_items.id", label: "Line Item ID", icon: Hash },
        { value: "line_items.title", label: "Product Title", icon: Package2 },
        { value: "line_items.variant_title", label: "Variant Title", icon: PaletteIcon },
        { value: "line_items.name", label: "Line Item Name", icon: Text },
        { value: "line_items.sku", label: "SKU", icon: Hash },
        { value: "line_items.quantity", label: "Quantity", icon: Hash },
        { value: "line_items.price", label: "Price", icon: DollarSign },
        { value: "line_items.original_price", label: "Original Price", icon: DollarSign },
        { value: "line_items.total_discount", label: "Total Discount", icon: DollarSign },
        { value: "line_items.fulfillment_status", label: "Fulfillment Status", icon: Package },
        { value: "line_items.fulfillment_service", label: "Fulfillment Service", icon: Package },
        { value: "line_items.product_id", label: "Product ID", icon: Hash },
        { value: "line_items.variant_id", label: "Variant ID", icon: Hash },
        { value: "line_items.vendor", label: "Vendor", icon: Building },
        { value: "line_items.taxable", label: "Taxable", icon: DollarSign },
        { value: "line_items.gift_card", label: "Gift Card", icon: Gift },
        { value: "line_items.name", label: "Name", icon: Text },
        {
          value: "line_items.variant_inventory_management",
          label: "Variant Inventory Management",
          icon: Package,
        },
        { value: "line_items.properties", label: "Properties", icon: List },
        { value: "line_items.product_exists", label: "Product Exists", icon: CheckCircle },
        { value: "line_items.fulfillable_quantity", label: "Fulfillable Quantity", icon: Hash },
        { value: "line_items.grams", label: "Grams", icon: Package },
        { value: "line_items.weight", label: "Weight", icon: Package },
        { value: "line_items.weight_unit", label: "Weight Unit", icon: Package },
        { value: "line_items.requires_shipping", label: "Requires Shipping", icon: Truck },
        { value: "line_items.tax_lines", label: "Tax Lines", icon: DollarSign },
        { value: "line_items.discount_allocations", label: "Discount Allocations", icon: Percent },
        { value: "line_items.duties", label: "Duties", icon: DollarSign },
        { value: "line_items.admin_graphql_api_id", label: "Admin GraphQL API ID", icon: Hash },
      ],
    },
    {
      name: "Customer Information",
      fields: [
        { value: "customer.id", label: "Customer ID", icon: Hash },
        { value: "customer.email", label: "Customer Email", icon: Mail },
        { value: "customer.first_name", label: "Customer First Name", icon: UserIcon },
        { value: "customer.last_name", label: "Customer Last Name", icon: UserIcon },
        { value: "customer.phone", label: "Customer Phone", icon: Phone },
        { value: "customer.orders_count", label: "Orders Count", icon: Hash },
        { value: "customer.total_spent", label: "Total Spent", icon: DollarSign },
        { value: "customer.tags", label: "Customer Tags", icon: Tag },
        { value: "customer.note", label: "Customer Note", icon: FileText },
        { value: "customer.verified_email", label: "Verified Email", icon: CheckCircle },
        { value: "customer.multipass_identifier", label: "Multipass Identifier", icon: Key },
        { value: "customer.tax_exempt", label: "Tax Exempt", icon: DollarSign },
        { value: "customer.tax_exemptions", label: "Tax Exemptions", icon: DollarSign },
        { value: "customer.accepts_marketing", label: "Accepts Marketing", icon: Bell },
        { value: "customer.created_at", label: "Customer Created At", icon: Calendar },
        { value: "customer.updated_at", label: "Customer Updated At", icon: Calendar },
        { value: "customer.default_address", label: "Default Address", icon: MapPin },
        { value: "customer.addresses", label: "Addresses", icon: MapPin },
        {
          value: "customer.accepts_marketing_updated_at",
          label: "Accepts Marketing Updated At",
          icon: Calendar,
        },
        { value: "customer.marketing_opt_in_level", label: "Marketing Opt In Level", icon: Bell },
        { value: "customer.admin_graphql_api_id", label: "Admin GraphQL API ID", icon: Hash },
        { value: "customer.currency", label: "Currency", icon: DollarSign },
        { value: "customer.state", label: "State", icon: UserIcon },
      ],
    },
    {
      name: "Shipping Information",
      fields: [
        { value: "shipping_address.address1", label: "Shipping Address 1", icon: MapPin },
        { value: "shipping_address.address2", label: "Shipping Address 2", icon: MapPin },
        { value: "shipping_address.city", label: "Shipping City", icon: Building },
        { value: "shipping_address.company", label: "Shipping Company", icon: Building },
        { value: "shipping_address.country", label: "Shipping Country", icon: Globe },
        { value: "shipping_address.country_code", label: "Shipping Country Code", icon: Globe },
        { value: "shipping_address.first_name", label: "Shipping First Name", icon: UserIcon },
        { value: "shipping_address.last_name", label: "Shipping Last Name", icon: UserIcon },
        { value: "shipping_address.latitude", label: "Shipping Latitude", icon: MapPin },
        { value: "shipping_address.longitude", label: "Shipping Longitude", icon: MapPin },
        { value: "shipping_address.name", label: "Shipping Name", icon: UserIcon },
        { value: "shipping_address.phone", label: "Shipping Phone", icon: Phone },
        { value: "shipping_address.province", label: "Shipping Province", icon: MapPin },
        { value: "shipping_address.province_code", label: "Shipping Province Code", icon: MapPin },
        { value: "shipping_address.zip", label: "Shipping ZIP", icon: MapPin },
        { value: "shipping_lines.title", label: "Shipping Method", icon: Truck },
        { value: "shipping_lines.price", label: "Shipping Price", icon: DollarSign },
        { value: "shipping_lines.code", label: "Shipping Code", icon: Hash },
        { value: "shipping_lines.source", label: "Shipping Source", icon: Package },
        { value: "shipping_lines.carrier_identifier", label: "Carrier Identifier", icon: Truck },
        {
          value: "shipping_lines.requested_fulfillment_service_id",
          label: "Requested Fulfillment Service ID",
          icon: Package,
        },
        {
          value: "shipping_lines.discount_allocations",
          label: "Shipping Discount Allocations",
          icon: Percent,
        },
        { value: "shipping_lines.tax_lines", label: "Shipping Tax Lines", icon: DollarSign },
      ],
    },
    {
      name: "Billing Information",
      fields: [
        { value: "billing_address.address1", label: "Billing Address 1", icon: MapPin },
        { value: "billing_address.address2", label: "Billing Address 2", icon: MapPin },
        { value: "billing_address.city", label: "Billing City", icon: Building },
        { value: "billing_address.company", label: "Billing Company", icon: Building },
        { value: "billing_address.country", label: "Billing Country", icon: Globe },
        { value: "billing_address.country_code", label: "Billing Country Code", icon: Globe },
        { value: "billing_address.first_name", label: "Billing First Name", icon: UserIcon },
        { value: "billing_address.last_name", label: "Billing Last Name", icon: UserIcon },
        { value: "billing_address.latitude", label: "Billing Latitude", icon: MapPin },
        { value: "billing_address.longitude", label: "Billing Longitude", icon: MapPin },
        { value: "billing_address.name", label: "Billing Name", icon: UserIcon },
        { value: "billing_address.phone", label: "Billing Phone", icon: Phone },
        { value: "billing_address.province", label: "Billing Province", icon: MapPin },
        { value: "billing_address.province_code", label: "Billing Province Code", icon: MapPin },
        { value: "billing_address.zip", label: "Billing ZIP", icon: MapPin },
      ],
    },
    {
      name: "Payment & Financial",
      fields: [
        { value: "payment_gateway_names", label: "Payment Gateway Names", icon: CreditCard },
        { value: "processing_method", label: "Processing Method", icon: CreditCard },
        { value: "gateway", label: "Gateway", icon: CreditCard },
        { value: "financial_status", label: "Financial Status", icon: CreditCard },
        { value: "total_price", label: "Total Price", icon: DollarSign },
        { value: "subtotal_price", label: "Subtotal Price", icon: DollarSign },
        { value: "total_tax", label: "Total Tax", icon: DollarSign },
        { value: "total_discounts", label: "Total Discounts", icon: DollarSign },
        { value: "total_tip_received", label: "Total Tip Received", icon: DollarSign },
        { value: "currency", label: "Currency", icon: DollarSign },
        { value: "discount_codes", label: "Discount Codes", icon: Percent },
        { value: "tax_lines", label: "Tax Lines", icon: DollarSign },
      ],
    },
    {
      name: "Fulfillment & Status",
      fields: [
        { value: "fulfillment_status", label: "Fulfillment Status", icon: Package },
        { value: "fulfillments", label: "Fulfillments", icon: Package },
        { value: "refunds", label: "Refunds", icon: RotateCcw },
        { value: "confirmed", label: "Confirmed", icon: CheckCircle },
        { value: "cancelled", label: "Cancelled", icon: XCircle },
        { value: "cancel_reason", label: "Cancel Reason", icon: AlertCircle },
        { value: "closed_at", label: "Closed At", icon: Calendar },
        { value: "test", label: "Test Order", icon: AlertCircle },
      ],
    },
    {
      name: "Custom Fields & Attributes",
      fields: [
        { value: "note_attributes", label: "Note Attributes", icon: List },
        { value: "properties", label: "Properties", icon: List },
        { value: "tags", label: "Tags", icon: Tag },
        { value: "note", label: "Note", icon: FileText },
        { value: "custom:COMBINE", label: "Combine Fields", icon: Combine },
      ],
    },
  ]
}

const iconMapping: { [key: string]: React.ComponentType<{ className?: string }> } = {
  productTitle: Package,
  productVariant: Palette,
  timeslot: Clock,
  orderId: Hash,
  orderDate: Calendar,
  orderTags: Tag,
  assignedTo: UserCheck,
  priority: AlertCircle,
  customisations: Edit,
  status: CheckCircle,
  default: FileText,
}

const getFieldIcon = (fieldId: string) => {
  const Icon = iconMapping[fieldId] || iconMapping.default
  return <Icon className="h-5 w-5 mr-3 text-gray-500" />
}

interface WebhookConfig {
  id: string
  topic: string
  address: string
  status: "active" | "inactive" | "error"
  lastTriggered?: string
}

export const Settings: React.FC = () => {
  const { tenant, user } = useAuth()
  const isMobile = useMobileView()
  const { tab = "general" } = useParams<{ tab: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(tab)
  const [users, setUsers] = useState<User[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [productLabels, setProductLabels] = useState<ProductLabel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newUser, setNewUser] = useState<NewUser>({
    name: "",
    email: "",
    role: "florist",
    password: "",
  })
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)

  const [newStore, setNewStore] = useState<NewStore>({
    name: "",
    type: "shopify",
    settings: { domain: "", accessToken: "", apiSecretKey: "" },
  })
  const [showAddStoreDialog, setShowAddStoreDialog] = useState(false)

  const [orderCardConfig, setOrderCardConfig] = useState<{
    fields: OrderCardField[]
    settings: {
      showTimeAndPriority: boolean
    }
  }>(() => ({ fields: getAllFields(), settings: { showTimeAndPriority: true } }))
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [popoverOpen, setPopoverOpen] = useState<Record<string, boolean>>({})
  const [searchTerm, setSearchTerm] = useState("")

  const shopifyFieldOptions = useMemo(() => getShopifyFieldOptions(), [])

  const [newCustomField, setNewCustomField] = useState({
    name: "",
    type: "text" as OrderCardFieldType,
  })

  const [previewOrderData, setPreviewOrderData] = useState<any>(null)
  const [selectedStoreId, setSelectedStoreId] = useState<string>("")
  const [orderNameToFetch, setOrderNameToFetch] = useState<string>("")
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    fetchData()
    loadOrderCardConfig()
  }, [tenant])

  useEffect(() => {
    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id)
    }
  }, [stores, selectedStoreId])

  useEffect(() => {
    setActiveTab(tab)
  }, [tab])

  const fetchData = async () => {
    if (!tenant?.id) return
    setIsLoading(true)
    try {
      const [usersData, storesData, labelsData] = await Promise.all([
        getUsers(tenant.id),
        getStores(tenant.id),
        getProductLabels(tenant.id),
      ])
      setUsers(usersData)
      setStores(storesData)
      setProductLabels(labelsData)
    } catch (err) {
      setError("Failed to fetch settings data.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOrderCardConfig = async () => {
    if (!tenant?.id) return
    try {
      const config = await getOrderCardConfig(tenant.id)
      if (config && config.fields && config.settings) {
        const savedFields = config.fields
        const defaultFields = getAllFields()

        const mergedFields = defaultFields.map((df) => {
          const savedField = savedFields.find((sf: OrderCardField) => sf.id === df.id)
          if (savedField) {
            return {
              ...df,
              isVisible: savedField.isVisible,
              shopifyFields: savedField.shopifyFields,
              transformation: savedField.transformation,
              transformationRule: savedField.transformationRule,
            }
          }
          return df
        })

        setOrderCardConfig({ fields: mergedFields, settings: config.settings })
      } else {
        setOrderCardConfig({ fields: getAllFields(), settings: { showTimeAndPriority: true } })
      }
    } catch (error) {
      console.error("Failed to load order card config:", error)
      setOrderCardConfig({ fields: getAllFields(), settings: { showTimeAndPriority: true } })
    }
  }

  const handleCreateUser = async () => {
    if (!tenant?.id || !newUser.email || !newUser.name || !newUser.password) {
      alert("Please fill in all required fields for the new user.")
      return
    }
    try {
      const userToCreate = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
      }
      const createdUser = await createUser(tenant.id, userToCreate)
      setUsers((prev) => [...prev, createdUser])
      setShowAddUserDialog(false)
      setNewUser({ name: "", email: "", role: "florist", password: "" })
    } catch (error) {
      console.error("Failed to create user:", error)
      alert("Failed to create user. Please check the console for details.")
    }
  }

  const handleAddStore = async () => {
    if (
      !tenant?.id ||
      !newStore.name ||
      !newStore.settings.domain ||
      !newStore.settings.accessToken
    ) {
      alert("Please fill in all store details.")
      return
    }
    try {
      const storeData: Omit<Store, "id" | "tenantId" | "createdAt" | "updatedAt"> = {
        name: newStore.name,
        type: newStore.type,
        status: "active",
        settings: {
          ...newStore.settings,
          timezone: "UTC",
          currency: "USD",
          businessHours: { start: "09:00", end: "17:00" },
        },
      }
      const createdStore = await createStore(tenant.id, storeData)
      setStores((prev) => [...prev, createdStore])
      setShowAddStoreDialog(false)
      setNewStore({
        name: "",
        type: "shopify",
        settings: { domain: "", accessToken: "", apiSecretKey: "" },
      })
    } catch (error) {
      console.error("Failed to add store:", error)
      alert("Failed to add store. Check console for details.")
    }
  }

  const handleRegisterWebhooks = async (storeId: string) => {
    if (!tenant?.id) return
    try {
      const updatedStore = await registerShopifyWebhooks(tenant.id, storeId)
      setStores((prevStores) => prevStores.map((s) => (s.id === storeId ? updatedStore : s)))
      alert("Webhooks registered successfully!")
    } catch (error) {
      console.error("Failed to register webhooks:", error)
      alert("Failed to register webhooks. Check the console for details.")
    }
  }

  const handleToggleFieldVisibility = (fieldId: string) => {
    setOrderCardConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, isVisible: !f.isVisible } : f)),
    }))
  }

  const handleSaveOrderCardConfig = async () => {
    if (!tenant) return
    setIsSaving(true)
    try {
      await saveOrderCardConfig(tenant.id, orderCardConfig)
      toast.success("Configuration saved successfully!", {
        description: "Your changes to the order card have been saved and are now live.",
      })
    } catch (error) {
      console.error("Failed to save order card config:", error)
      toast.error("Failed to save configuration", {
        description: "There was an error while saving your changes. Please try again.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleShopifyFieldMapping = (orderCardFieldId: string, shopifyField: string) => {
    setOrderCardConfig((prev) => {
      const newFields = prev.fields.map((f) => {
        if (f.id === orderCardFieldId) {
          const currentMapping = f.shopifyFields || []
          const isMapped = currentMapping.includes(shopifyField)

          if (shopifyField === "custom:COMBINE") {
            // Special handling for Combine Fields option
            return { ...f, shopifyFields: isMapped ? [] : [...currentMapping, shopifyField] }
          }

          const newMapping = isMapped
            ? currentMapping.filter((sf: string) => sf !== shopifyField)
            : [...currentMapping, shopifyField]

          return { ...f, shopifyFields: newMapping }
        }
        return f
      })
      return { ...prev, fields: newFields }
    })
    // Keep popover open for multi-select
    // setPopoverOpen(prev => ({ ...prev, [orderCardFieldId]: false }));
  }

  const getMappedFieldLabel = (shopifyFields: string[] | undefined): string => {
    if (!shopifyFields || shopifyFields.length === 0) return "Select field(s)"
    if (shopifyFields.length > 2) return `${shopifyFields.length} fields selected`

    const allOptions = shopifyFieldOptions.flatMap((cat) => cat.fields)
    return shopifyFields
      .map((sf) => {
        const option = allOptions.find((opt) => opt.value === sf)
        return option ? option.label : sf
      })
      .join(", ")
  }

  const handleTransformationChange = (
    fieldId: string,
    transformation: "extract" | "transform" | "none"
  ) => {
    setOrderCardConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === fieldId ? { ...f, transformation, transformationRule: "" } : f
      ),
    }))
  }

  const handleTransformationRuleChange = (fieldId: string, rule: string) => {
    setOrderCardConfig((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, transformationRule: rule } : f)),
    }))
  }

  const handleAddCustomField = () => {
    if (!newCustomField.name) {
      alert("Please enter a name for the custom field.")
      return
    }

    const newField: OrderCardField = {
      id: `custom_${newCustomField.name.toLowerCase().replace(/\s+/g, "_")}`,
      label: newCustomField.name,
      description: "Custom user-defined field",
      type: newCustomField.type,
      isVisible: true,
      isEditable: true,
      shopifyFields: [],
    }

    setOrderCardConfig((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }))

    setShowAddFieldDialog(false)
    setNewCustomField({ name: "", type: "text" })
  }

  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false)

  const handleFetchOrder = async () => {
    if (!tenant?.id || !selectedStoreId || !orderNameToFetch) {
      alert("Please select a store and enter an order name.")
      return
    }
    setIsFetching(true)
    try {
      const orderData = await fetchShopifyOrder(tenant.id, selectedStoreId, orderNameToFetch)
      setPreviewOrderData(orderData)
      alert("Order data fetched successfully!")
    } catch (error) {
      console.error("Failed to fetch Shopify order:", error)
      alert("Failed to fetch order. Check the console for details.")
    } finally {
      setIsFetching(false)
    }
  }

  const handleTabChange = (newTab: string) => {
    navigate(`/settings/${newTab}`)
  }

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <Button onClick={handleSaveOrderCardConfig} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          Save All Settings
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-md border">
          <TabsList className="inline-flex h-auto">
            <TabsTrigger value="general">
              <SettingsIcon className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="order-card">
              <Layout className="mr-2 h-4 w-4" />
              Order Card
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCard className="mr-2 h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>
        </ScrollArea>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Store Management</CardTitle>
              <CardDescription>
                Manage your Shopify store connections, API keys, and webhooks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Store List */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Connected Stores</h3>
                    <Dialog open={showAddStoreDialog} onOpenChange={setShowAddStoreDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" /> Add Store
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Shopify Store</DialogTitle>
                          <DialogDescription>
                            Enter your Shopify store details to connect.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="store-name">Store Name</Label>
                            <Input
                              id="store-name"
                              placeholder="My Awesome Flower Shop"
                              value={newStore.name}
                              onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="store-domain">Store Domain</Label>
                            <Input
                              id="store-domain"
                              placeholder="your-store.myshopify.com"
                              value={newStore.settings.domain}
                              onChange={(e) =>
                                setNewStore({
                                  ...newStore,
                                  settings: { ...newStore.settings, domain: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="access-token">Admin API Access Token</Label>
                            <Input
                              id="access-token"
                              type="password"
                              placeholder="shpat_..."
                              value={newStore.settings.accessToken}
                              onChange={(e) =>
                                setNewStore({
                                  ...newStore,
                                  settings: { ...newStore.settings, accessToken: e.target.value },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="api-secret-key">API Secret Key</Label>
                            <Input
                              id="api-secret-key"
                              type="password"
                              placeholder="shpss_..."
                              value={newStore.settings.apiSecretKey}
                              onChange={(e) =>
                                setNewStore({
                                  ...newStore,
                                  settings: { ...newStore.settings, apiSecretKey: e.target.value },
                                })
                              }
                            />
                          </div>
                          <Button onClick={handleAddStore} className="w-full">
                            Connect Store
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div className="grid gap-4">
                    {stores.map((s) => (
                      <Card key={s.id} className="p-4">
                        <CardHeader className="p-0 pb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{s.name}</CardTitle>
                              <CardDescription>
                                {s.settings.address || "No domain configured"}
                              </CardDescription>
                            </div>
                            <Badge variant={s.status === "active" ? "default" : "secondary"}>
                              {s.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="space-y-4">
                            {/* API Configuration */}
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center">
                                <Key className="h-4 w-4 mr-2" />
                                API Configuration
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Domain:</span>
                                  <span className="ml-2 font-mono">
                                    {s.settings.address || "Not set"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Access Token:</span>
                                  <span className="ml-2 font-mono">••••••••</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Secret Key:</span>
                                  <span className="ml-2 font-mono">••••••••</span>
                                </div>
                              </div>
                            </div>

                            {/* Webhook Status */}
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center">
                                <Webhook className="h-4 w-4 mr-2" />
                                Webhooks
                              </h4>
                              {s.settings.webhooks && s.settings.webhooks.length > 0 ? (
                                <div className="space-y-2">
                                  {s.settings.webhooks.map((wh: WebhookConfig) => (
                                    <div
                                      key={wh.id}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="font-mono">{wh.topic}</span>
                                      <Badge
                                        variant={wh.status === "active" ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {wh.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No webhooks configured.
                                </p>
                              )}
                              <Button
                                className="mt-2"
                                onClick={() => handleRegisterWebhooks(s.id)}
                                variant="outline"
                                size="sm"
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Register Webhooks
                              </Button>
                            </div>

                            {/* Webhook URL */}
                            <div>
                              <h4 className="font-semibold mb-2 flex items-center">
                                <Link className="h-4 w-4 mr-2" />
                                Webhook URL
                              </h4>
                              <div className="flex items-center space-x-2">
                                <Input
                                  value={`https://${window.location.hostname}/api/webhooks/shopify`}
                                  readOnly
                                  className="font-mono text-sm"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    navigator.clipboard.writeText(
                                      `https://${window.location.hostname}/api/webhooks/shopify`
                                    )
                                  }
                                >
                                  Copy
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Use this URL when configuring webhooks in your Shopify admin.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order-card" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderCardPreview
                fields={orderCardConfig.fields.filter((f) => f.isVisible)}
                onToggleFieldVisibility={handleToggleFieldVisibility}
                onSave={handleSaveOrderCardConfig}
                isSaving={isSaving}
                users={users.map((u) => ({ id: u.id, name: u.name }))}
                stores={stores}
                onFetchOrder={handleFetchOrder}
                isFetching={isFetching}
                orderNameToFetch={orderNameToFetch}
                setOrderNameToFetch={setOrderNameToFetch}
                selectedStoreId={selectedStoreId}
                setSelectedStoreId={setSelectedStoreId}
                realOrderData={previewOrderData}
                difficultyLabels={productLabels.filter((l) => l.category === "difficulty")}
                productTypeLabels={productLabels.filter((l) => l.category === "productType")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Field Mappings</CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddFieldDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Field
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {orderCardConfig.fields.map((field) => (
                <div key={field.id} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-gray-400">{getFieldIcon(field.id)}</div>
                      <div>
                        <Label htmlFor={`mapping-${field.id}`} className="font-semibold text-base">
                          {field.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">{field.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`visible-${field.id}`}
                          className="text-sm font-medium text-muted-foreground"
                        >
                          {field.isVisible ? "Visible" : "Hidden"}
                        </Label>
                        <Switch
                          id={`visible-${field.id}`}
                          checked={field.isVisible}
                          onCheckedChange={() => handleToggleFieldVisibility(field.id)}
                        />
                      </div>
                      {!field.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end pl-10">
                    <div>
                      <Label className="text-xs text-muted-foreground">Shopify Field</Label>
                      <Popover
                        open={popoverOpen[field.id]}
                        onOpenChange={(isOpen) =>
                          setPopoverOpen((p) => ({ ...p, [field.id]: isOpen }))
                        }
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={popoverOpen[field.id]}
                            className="w-full justify-between"
                          >
                            {getMappedFieldLabel(field.shopifyFields)}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Search Shopify fields..."
                              value={searchTerm}
                              onValueChange={setSearchTerm}
                            />
                            <CommandList>
                              <CommandEmpty>No results found.</CommandEmpty>
                              <ScrollArea className="h-64">
                                {shopifyFieldOptions
                                  .map((category) => ({
                                    ...category,
                                    fields: category.fields.filter((option) =>
                                      option.label.toLowerCase().includes(searchTerm.toLowerCase())
                                    ),
                                  }))
                                  .filter((category) => category.fields.length > 0)
                                  .map((category) => (
                                    <CommandGroup key={category.name} heading={category.name}>
                                      {category.fields.map((option) => (
                                        <CommandItem
                                          key={option.value}
                                          value={option.value}
                                          onSelect={(currentValue) => {
                                            handleShopifyFieldMapping(field.id, currentValue)
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.shopifyFields?.includes(option.value)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
                                          <option.icon className="mr-2 h-4 w-4" />
                                          {option.label}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  ))}
                              </ScrollArea>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data Processor</Label>
                      <Select
                        value={field.transformation || "none"}
                        onValueChange={(value: "extract" | "transform" | "none") => {
                          handleTransformationChange(field.id, value)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Processor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="extract">Extract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {field.transformation === "extract" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Extraction Rule (Regex)</Label>
                        <Input
                          placeholder="e.g. (d{2})/(d{2})"
                          value={field.transformationRule || ""}
                          onChange={(e) => {
                            handleTransformationRuleChange(field.id, e.target.value)
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage users and their roles.</CardDescription>
              </div>
              <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" /> Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {userRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateUser} className="w-full">
                      Create User
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell>{userItem.name}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{userItem.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" disabled={userItem.id === user?.id}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>Manage your subscription and view invoices.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Billing management is coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Field</DialogTitle>
            <DialogDescription>
              Create a new field to display on your order cards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-field-name">Field Name</Label>
              <Input
                id="custom-field-name"
                placeholder="e.g., Delivery Driver"
                value={newCustomField.name}
                onChange={(e) => setNewCustomField({ ...newCustomField, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-field-type">Field Type</Label>
              <Select
                value={newCustomField.type}
                onValueChange={(value: OrderCardFieldType) =>
                  setNewCustomField({ ...newCustomField, type: value })
                }
              >
                <SelectTrigger id="custom-field-type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Textarea</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="tags">Tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomField}>Add Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
