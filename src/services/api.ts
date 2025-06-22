// Client-side API service for connecting to D1 backend
import type {
  Tenant,
  User,
  Order,
  Store,
  ProductLabel,
  LoginRequest,
  LoginResponse,
  CreateTenantRequest,
  CreateUserRequest,
  CreateOrderRequest,
  OrderFilters,
} from "../types"
import {
  OrderCardField,
  getAllFields,
  OrderCardFieldType,
} from "../types/orderCardFields"
import { getStoredToken, removeStoredToken } from "./auth"

const API_BASE_URL =
  typeof window !== "undefined" && window.location.hostname.includes(".workers.dev")
    ? `https://${window.location.hostname}`
    : "http://localhost:8787"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(response.status, errorText)
  }

  return response.json()
}

// This function is intended for internal use within this service
async function authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  if (!token) {
    // On the client-side, we can redirect to login
    if (typeof window !== "undefined") {
      // To prevent redirect loops, only redirect if not already on the login page
      if (window.location.pathname !== "/login") {
        console.log("No token found, redirecting to login.")
        // Clear any lingering auth state
        removeStoredToken()
        localStorage.removeItem("auth_user")
        localStorage.removeItem("auth_tenant")
        // Redirect to login
        window.location.href = "/login"
      }
      // Throw an error to stop the current request process
      throw new Error("Redirecting to login.")
    } else {
      // In a non-window environment (like server-side rendering, though not our case),
      // just throw the error.
      throw new Error("No authentication token found")
    }
  }

  try {
    return await apiRequest<T>(endpoint, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Token is invalid, clear storage and redirect to login
      console.log("401 Unauthorized - clearing auth data")
      removeStoredToken()
      localStorage.removeItem("auth_user")
      localStorage.removeItem("auth_tenant")
      localStorage.removeItem("refresh_token")
      
      // Redirect to login page
      window.location.href = '/login'
    }
    throw error
  }
}

// Authentication
export async function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function logout(): Promise<void> {
  return apiRequest<void>("/api/auth/logout", {
    method: "POST",
  })
}

export async function refreshToken(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/refresh", {
    method: "POST",
  })
}

// Registration
export async function register(request: {
  email: string
  password: string
  name: string
  tenantDomain: string
  tenantName?: string
}): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

// Tenant management
export async function createTenant(request: CreateTenantRequest): Promise<Tenant> {
  return apiRequest<Tenant>("/api/tenants", {
    method: "POST",
    body: JSON.stringify(request),
  })
}

export async function getTenants(): Promise<Tenant[]> {
  return apiRequest<Tenant[]>("/api/tenants")
}

export async function getTenantById(id: string): Promise<Tenant> {
  return apiRequest<Tenant>(`/api/tenants/${id}`)
}

// User management
export async function getUsers(tenantId: string): Promise<User[]> {
  return authenticatedRequest<User[]>(`/api/tenants/${tenantId}/users`)
}

export async function createUser(
  tenantId: string,
  userData: Omit<User, "id" | "tenantId" | "createdAt" | "updatedAt" | "permissions"> & {
    password?: string
  }
): Promise<User> {
  return authenticatedRequest<User>(`/api/tenants/${tenantId}/users`, {
    method: "POST",
    body: JSON.stringify(userData),
  })
}

export async function getUserById(tenantId: string, userId: string): Promise<User> {
  return authenticatedRequest<User>(`/api/tenants/${tenantId}/users/${userId}`)
}

// Order management
export async function getOrders(tenantId: string, filters?: OrderFilters): Promise<Order[]> {
  const queryParams = filters
    ? `?${new URLSearchParams(filters as Record<string, string>).toString()}`
    : ""
  return authenticatedRequest<Order[]>(`/api/tenants/${tenantId}/orders${queryParams}`)
}

export async function getOrdersByDate(tenantId: string, date: string): Promise<any[]> {
  // The date should be in dd/mm/yyyy format for the API
  const formattedDate = date.split("-").reverse().join("/")
  console.log(`Calling getOrdersByDate with tenantId: ${tenantId}, date: ${date}, formattedDate: ${formattedDate}`)
  
  try {
    const result = await authenticatedRequest<any[]>(`/api/tenants/${tenantId}/orders-by-date?date=${formattedDate}`)
    console.log(`getOrdersByDate response:`, result)
    return result
  } catch (error) {
    console.error(`Error in getOrdersByDate:`, error)
    throw error
  }
}

export async function createOrder(tenantId: string, orderData: CreateOrderRequest): Promise<Order> {
  return authenticatedRequest<Order>(`/api/tenants/${tenantId}/orders`, {
    method: "POST",
    body: JSON.stringify(orderData),
  })
}

export async function updateOrder(
  tenantId: string,
  orderId: string,
  orderData: Partial<Order>
): Promise<Order> {
  return authenticatedRequest<Order>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(orderData),
  })
}

export async function deleteOrder(tenantId: string, orderId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    method: "DELETE",
  })
}

// Store management
export async function getStores(tenantId: string): Promise<Store[]> {
  return authenticatedRequest<Store[]>(`/api/tenants/${tenantId}/stores`)
}

export async function createStore(
  tenantId: string,
  storeData: Omit<Store, "id" | "tenantId" | "createdAt" | "updatedAt">
): Promise<Store> {
  return authenticatedRequest<Store>(`/api/tenants/${tenantId}/stores`, {
    method: "POST",
    body: JSON.stringify(storeData),
  })
}

export async function updateStore(
  tenantId: string,
  storeId: string,
  storeData: Partial<Store>
): Promise<Store> {
  return authenticatedRequest<Store>(`/api/tenants/${tenantId}/stores/${storeId}`, {
    method: "PUT",
    body: JSON.stringify(storeData),
  })
}

export async function deleteStore(tenantId: string, storeId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/stores/${storeId}`, {
    method: "DELETE",
  })
}

export async function registerShopifyWebhooks(tenantId: string, storeId: string): Promise<Store> {
  return authenticatedRequest<Store>(
    `/api/tenants/${tenantId}/stores/${storeId}/register-webhooks`,
    {
      method: "POST",
    }
  )
}

// Product management
export async function getProducts(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/products`)
}

export async function createProduct(tenantId: string, productData: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/products`, {
    method: "POST",
    body: JSON.stringify(productData),
  })
}

export async function updateProduct(
  tenantId: string,
  productId: string,
  productData: any
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(productData),
  })
}

export async function deleteProduct(tenantId: string, productId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/products/${productId}`, {
    method: "DELETE",
  })
}

// Product labels management
export async function getProductLabels(tenantId: string): Promise<ProductLabel[]> {
  return authenticatedRequest<ProductLabel[]>(`/api/tenants/${tenantId}/product-labels`)
}

export async function createProductLabel(
  tenantId: string,
  labelData: Omit<ProductLabel, "id" | "tenantId" | "createdAt" | "updatedAt">
): Promise<ProductLabel> {
  return authenticatedRequest<ProductLabel>(`/api/tenants/${tenantId}/product-labels`, {
    method: "POST",
    body: JSON.stringify(labelData),
  })
}

export async function updateProductLabel(
  tenantId: string,
  labelId: string,
  labelData: Partial<ProductLabel>
): Promise<ProductLabel> {
  return authenticatedRequest<ProductLabel>(`/api/tenants/${tenantId}/product-labels/${labelId}`, {
    method: "PUT",
    body: JSON.stringify(labelData),
  })
}

export async function deleteProductLabel(tenantId: string, labelId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/product-labels/${labelId}`, {
    method: "DELETE",
  })
}

export async function syncProducts(
  tenantId: string,
  storeId: string,
  filters: {
    title?: string
    tag?: string
    page?: number
    limit?: number
    sinceId?: number
    pageInfo?: string
  }
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/stores/${storeId}/sync-products`, {
    method: "POST",
    body: JSON.stringify(filters),
  })
}

// Analytics
export async function getAnalytics(
  tenantId: string,
  timeFrame: "daily" | "weekly" | "monthly" = "weekly"
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/analytics?timeFrame=${timeFrame}`)
}

export async function getFloristStats(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/analytics/florist-stats`)
}

// Configuration management
export async function getOrderCardConfig(tenantId: string): Promise<{ fields: OrderCardField[] }> {
  const response = await authenticatedRequest<{ config: any[] }>(
    `/api/tenants/${tenantId}/order-card-config`
  )

  if (!response.config || response.config.length === 0) {
    return { fields: getAllFields() }
  }

  // Check if the config is in the new format (OrderCardField objects)
  const firstField = response.config[0]
  if (firstField && firstField.id && firstField.label) {
    // New format: direct OrderCardField objects
    return { fields: response.config }
  }

  // Old format: field configs with field_id, custom_options, etc.
  const fields = response.config.map((fieldConfig: any): OrderCardField => {
    const customOptions = fieldConfig.custom_options
      ? JSON.parse(fieldConfig.custom_options)
      : {}

    const shopifyFields =
      customOptions.shopifyFields !== undefined && customOptions.shopifyFields !== null
        ? customOptions.shopifyFields
        : getDefaultShopifyFields(fieldConfig.field_id)

    return {
      id: fieldConfig.field_id,
      label: fieldConfig.custom_label || getDefaultFieldLabel(fieldConfig.field_id),
      description: getDefaultFieldDescription(fieldConfig.field_id),
      type: getDefaultFieldType(fieldConfig.field_id) as OrderCardFieldType,
      isVisible: !!fieldConfig.is_visible,
      isSystem: false, // Assuming all from this table are not system fields
      isEditable: getDefaultFieldEditable(fieldConfig.field_id),
      shopifyFields: shopifyFields,
      transformation: customOptions.transformation,
      transformationRule: customOptions.transformationRule,
    }
  })

  return { fields }
}

// Helper functions to get default field properties
function getDefaultFieldLabel(fieldId: string): string {
  const labels: { [key: string]: string } = {
    productTitle: "Product Title",
    productVariantTitle: "Product Variant Title",
    timeslot: "Timeslot",
    orderId: "Order ID",
    orderDate: "Order Date",
    orderTags: "Order Tags",
    assignedTo: "Assigned To",
    difficultyLabel: "Difficulty Label",
    productTypeLabel: "Product Type Label",
    addOns: "Add-Ons",
    customisations: "Customisations",
    isCompleted: "Completed",
  }
  return labels[fieldId] || fieldId
}

function getDefaultFieldDescription(fieldId: string): string {
  const descriptions: { [key: string]: string } = {
    productTitle: "Name of the product",
    productVariantTitle: "Specific variant of the product",
    timeslot: "Scheduled order preparation timeslot",
    orderId: "Unique order identifier",
    orderDate: "Date when order was placed",
    orderTags: "Tags associated with the order",
    assignedTo: "Florist assigned to this order",
    difficultyLabel: "Difficulty/Priority level",
    productTypeLabel: "Product type assigned to the product from Product Management",
    addOns: "Special requests or add-ons for the order",
    customisations: "Additional remarks and customisation notes",
    isCompleted: "Order completion status",
  }
  return descriptions[fieldId] || ""
}

function getDefaultFieldType(fieldId: string): string {
  const types: { [key: string]: string } = {
    productTitle: "text",
    productVariantTitle: "text",
    timeslot: "text",
    orderId: "text",
    orderDate: "date",
    orderTags: "tags",
    assignedTo: "select",
    difficultyLabel: "text",
    productTypeLabel: "text",
    addOns: "text",
    customisations: "textarea",
    isCompleted: "select",
  }
  return types[fieldId] || "text"
}

function getDefaultFieldEditable(fieldId: string): boolean {
  const editableFields = ["timeslot", "assignedTo", "addOns", "customisations", "isCompleted"]
  return editableFields.includes(fieldId)
}

function getDefaultShopifyFields(fieldId: string): string[] {
  const shopifyFields: { [key: string]: string[] } = {
    productTitle: ["line_items.title"],
    productVariantTitle: ["line_items.variant_title"],
    orderId: ["name"],
    orderDate: ["created_at"],
    orderTags: ["tags"],
    difficultyLabel: ["product:difficultyLabel"],
    productTypeLabel: ["product:productTypeLabel"],
    addOns: ["note_attributes"],
    customisations: ["note"],
    isCompleted: ["fulfillment_status"],
  }
  return shopifyFields[fieldId] || []
}

export async function saveOrderCardConfig(tenantId: string, config: any): Promise<any> {
  // Extract the fields array from the config object
  const fields = config.fields || config
  
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/order-card-config`, {
    method: "POST",
    body: JSON.stringify({ config: fields }),
  })
}

export async function getTenantSettings(tenantId: string): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/settings`)
}

export async function updateTenantSettings(tenantId: string, settings: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/settings`, {
    method: "PUT",
    body: JSON.stringify(settings),
  })
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/api/health")
}

// Database test
export async function testDatabase(): Promise<{ message: string; tenantCount: number }> {
  return apiRequest<{ message: string; tenantCount: number }>("/api/test-d1")
}

export const fetchShopifyOrder = async (
  tenantId: string,
  storeId: string,
  orderName: string,
): Promise<any> => {
  // Ensure orderName is just the number, without prefixes like '#' or 'WF'
  const numericOrderName = orderName.replace(/[^0-9]/g, "")
  if (!numericOrderName) {
    throw new Error("Invalid order name format. Please use a valid order number.")
  }

  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/stores/${storeId}/orders/lookup?name=${numericOrderName}`
  )
}

// Saved Products management
export async function saveProducts(
  tenantId: string,
  products: any[]
): Promise<any> {
  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/saved-products`,
    {
      method: "POST",
      body: JSON.stringify({ products }),
    }
  )
}

export async function getSavedProducts(
  tenantId: string,
  filters?: {
    search?: string
    productType?: string
    vendor?: string
    hasLabels?: boolean
  }
): Promise<any[]> {
  const queryParams = filters
    ? `?${new URLSearchParams(filters as Record<string, string>).toString()}`
    : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/saved-products${queryParams}`)
}

export async function getSavedProduct(tenantId: string, productId: string): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/saved-products/${productId}`)
}

export async function deleteSavedProduct(tenantId: string, productId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/saved-products/${productId}`, {
    method: "DELETE",
  })
}

export async function addProductLabel(
  tenantId: string,
  productId: string,
  labelId: string
): Promise<boolean> {
  return authenticatedRequest<boolean>(
    `/api/tenants/${tenantId}/saved-products/${productId}/labels/${labelId}`,
    {
      method: "POST",
    }
  )
}

export async function removeProductLabel(
  tenantId: string,
  productId: string,
  labelId: string
): Promise<boolean> {
  return authenticatedRequest<boolean>(
    `/api/tenants/${tenantId}/saved-products/${productId}/labels/${labelId}`,
    {
      method: "DELETE",
    }
  )
}

export async function getProductByShopifyIds(
  tenantId: string,
  shopifyProductId: string,
  shopifyVariantId: string
): Promise<any | null> {
  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/saved-products/by-shopify-ids?productId=${shopifyProductId}&variantId=${shopifyVariantId}`
  )
}

export async function syncShopifyProduct(
  tenantId: string,
  storeId: string,
  shopifyProductId: string
): Promise<any> {
  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/stores/${storeId}/sync-product`,
    {
      method: "POST",
      body: JSON.stringify({ shopifyProductId }),
    }
  )
}
