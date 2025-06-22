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
import { getStoredToken } from "./auth"

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

async function authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  if (!token) {
    throw new Error("No authentication token found")
  }

  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
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
export async function getOrderCardConfig(tenantId: string): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/config/order-card`)
}

export async function saveOrderCardConfig(tenantId: string, config: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/config/order-card`, {
    method: "PUT",
    body: JSON.stringify(config),
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
  products: Array<{
    shopifyProductId: string
    shopifyVariantId: string
    title: string
    variantTitle?: string
    description?: string
    price: number
    tags?: string[]
    productType?: string
    vendor?: string
    handle?: string
  }>
): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/saved-products`, {
    method: "POST",
    body: JSON.stringify({ products }),
  })
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
