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

// API configuration
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev"

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Base API request function with enhanced error handling
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Validate endpoint format
  if (!endpoint.startsWith('/')) {
    throw new Error(`Invalid endpoint format: ${endpoint}. Endpoint must start with '/'`)
  }

  // Check for missing tenant ID in tenant-specific endpoints
  if (endpoint.includes('/api/tenants/') && endpoint.includes('/undefined/')) {
    throw new Error(`Missing tenant ID in endpoint: ${endpoint}. Please ensure tenant context is loaded.`)
  }

  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    // Handle non-JSON responses (like HTML error pages)
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response but received ${contentType}. URL: ${url}`)
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`API Error ${response.status}: ${errorData.error || errorData.message || 'Unknown error'}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API Request failed for ${url}:`, error)
    throw error
  }
}

// Authenticated request function with enhanced validation
async function authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()
  
  if (!token) {
    throw new Error('Authentication token not found. Please log in again.')
  }

  // Validate endpoint format
  if (!endpoint.startsWith('/')) {
    throw new Error(`Invalid endpoint format: ${endpoint}. Endpoint must start with '/'`)
  }

  // Check for missing tenant ID in tenant-specific endpoints
  if (endpoint.includes('/api/tenants/') && endpoint.includes('/undefined/')) {
    throw new Error(`Missing tenant ID in endpoint: ${endpoint}. Please ensure tenant context is loaded.`)
  }

  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    // Handle non-JSON responses (like HTML error pages)
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(`Expected JSON response but received ${contentType}. URL: ${url}`)
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`API Error ${response.status}: ${errorData.error || errorData.message || 'Unknown error'}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Authenticated API Request failed for ${url}:`, error)
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

export async function updateUser(
  tenantId: string,
  userId: string,
  userData: Partial<User>
): Promise<User> {
  return authenticatedRequest<User>(`/api/tenants/${tenantId}/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(userData),
  })
}

export async function deleteUser(tenantId: string, userId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/users/${userId}`, {
    method: "DELETE",
  })
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
    const result = await apiRequest<any[]>(`/api/tenants/${tenantId}/orders-by-date?date=${formattedDate}`)
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
  orderData: Partial<Order>,
  currentUserId?: string
): Promise<Order> {
  const updateData = {
    ...orderData,
    updatedBy: currentUserId // Track who made the update
  }
  
  return authenticatedRequest<Order>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(updateData),
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

export async function testShopifyConnection(tenantId: string): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/test-shopify`)
}

export async function registerShopifyWebhooks(tenantId: string, storeId: string): Promise<Store> {
  return authenticatedRequest<Store>(`/api/tenants/${tenantId}/stores/${storeId}/register-webhooks`, {
    method: "POST",
  })
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
  if (!orderName) {
    throw new Error("Order name is required.")
  }

  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/stores/${storeId}/orders/lookup?name=${encodeURIComponent(orderName)}`
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

export async function createSampleProducts(tenantId: string): Promise<any> {
  return authenticatedRequest<any>(
    `/api/tenants/${tenantId}/sample-products`,
    {
      method: "POST",
    }
  )
}

// AI Generation
export async function generateAIDesign(tenantId: string, request: {
  prompt: string;
  style: string;
  size: string;
  occasion: string;
  budget: string;
  flowerTypes: string[];
  colorPalette: string[];
}): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/generate`, {
    method: "POST",
    body: JSON.stringify(request),
  })
}

// AI Training API Functions

export async function getAIModelConfigs(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/model-configs`)
}

export async function createAIModelConfig(tenantId: string, config: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/model-configs`, {
    method: "POST",
    body: JSON.stringify(config),
  })
}

export async function updateAIModelConfig(tenantId: string, configId: string, config: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/model-configs/${configId}`, {
    method: "PUT",
    body: JSON.stringify(config),
  })
}

export async function getAITrainingData(tenantId: string, filters?: any): Promise<any[]> {
  const queryParams = filters ? `?${new URLSearchParams(filters).toString()}` : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/training-data${queryParams}`)
}

export async function createAITrainingData(tenantId: string, data: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/training-data`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function extractAITrainingDataFromProducts(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/training-data/extract-products`, {
    method: "POST",
  })
}

export async function getAITrainingDataStats(tenantId: string): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/training-data/stats`)
}

export async function getAITrainingSessions(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/training-sessions`)
}

export async function createAITrainingSession(tenantId: string, session: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/training-sessions`, {
    method: "POST",
    body: JSON.stringify(session),
  })
}

export async function getAIGeneratedDesigns(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/generated-designs`);
}

export async function updateAIGeneratedDesign(tenantId: string, designId: string, updates: { rating: number, feedback: string }): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/generated-designs/${designId}`, {
    method: "PUT",
    body: JSON.stringify({
      quality_rating: updates.rating,
      feedback: updates.feedback,
    }),
  });
}

export async function getAIStyleTemplates(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/style-templates`)
}

export async function createAIStyleTemplate(tenantId: string, template: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/style-templates`, {
    method: "POST",
    body: JSON.stringify(template),
  })
}

export async function getAIPromptTemplates(tenantId: string, category?: string): Promise<any[]> {
  const queryParams = category ? `?category=${category}` : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/prompt-templates${queryParams}`)
}

export async function createAIPromptTemplate(tenantId: string, template: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/prompt-templates`, {
    method: "POST",
    body: JSON.stringify(template),
  })
}

export async function getAIUsageAnalytics(tenantId: string, dateRange?: { start: string; end: string }): Promise<any[]> {
  const params = new URLSearchParams()
  if (dateRange) {
    params.append('start_date', dateRange.start)
    params.append('end_date', dateRange.end)
  }
  const queryParams = params.toString() ? `?${params.toString()}` : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/usage-analytics${queryParams}`)
}

export async function recordAIGeneration(tenantId: string, metadata: any): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/usage`, {
    method: "POST",
    body: JSON.stringify(metadata),
  })
}

// ===== PHOTO UPLOAD API ENDPOINTS =====

export async function uploadFloristPhoto(tenantId: string, formData: FormData): Promise<any> {
  const token = getStoredToken()
  if (!token) {
    throw new Error("No authentication token found")
  }

  const url = `${API_BASE_URL}/api/tenants/${tenantId}/photos/upload`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type for FormData, let browser set it with boundary
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ApiError(response.status, errorText)
  }

  return response.json()
}

export async function getFloristPhotos(
  tenantId: string, 
  filters?: {
    photo_id?: string
    status?: string
    date_range?: { start: string; end: string }
    user_id?: string
  }
): Promise<any[]> {
  const queryParams = filters
    ? `?${new URLSearchParams(filters as Record<string, string>).toString()}`
    : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/photos${queryParams}`)
}

export async function updatePhotoDescription(
  tenantId: string, 
  photoId: string, 
  description: any
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/photos/${photoId}/description`, {
    method: "POST",
    body: JSON.stringify(description),
  })
}

export async function assessPhotoQuality(
  tenantId: string, 
  photoId: string, 
  assessment: any
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/photos/${photoId}/quality`, {
    method: "POST",
    body: JSON.stringify(assessment),
  })
}

export async function getDailyUploadGoals(
  tenantId: string, 
  date: string
): Promise<any | null> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/photos/goals?date=${date}`)
}

export async function getUploadStatistics(
  tenantId: string, 
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  const queryParams = dateRange
    ? `?start=${dateRange.start}&end=${dateRange.end}`
    : ""
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/photos/statistics${queryParams}`)
}

export async function createTrainingDataFromPhoto(
  tenantId: string, 
  photoId: string, 
  extraction: any
): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/photos/${photoId}/training-data`, {
    method: "POST",
    body: JSON.stringify(extraction),
  })
}

export async function getFlowers(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/flowers`);
}

export async function createFlower(tenantId: string, flower: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/flowers`, {
    method: "POST",
    body: JSON.stringify(flower),
  });
}

export async function deleteFlower(tenantId: string, flowerId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/flowers/${flowerId}`, {
    method: "DELETE"
  });
}

export async function getPromptTemplates(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/prompt-templates`);
}

export async function createPromptTemplate(tenantId: string, prompt: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/prompt-templates`, {
    method: "POST",
    body: JSON.stringify(prompt),
  });
}

export async function deletePromptTemplate(tenantId: string, promptId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/prompt-templates/${promptId}`, {
    method: "DELETE"
  });
}

export async function getModelConfigs(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/model-configs`);
}

export async function createModelConfig(tenantId: string, config: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/model-configs`, {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function deleteModelConfig(tenantId: string, configId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/model-configs/${configId}`, {
    method: "DELETE"
  });
}

export async function getAIStyles(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/styles`);
}

export async function createAIStyle(tenantId: string, style: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/styles`, {
    method: "POST",
    body: JSON.stringify(style),
  });
}

export async function deleteAIStyle(tenantId: string, styleId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/styles/${styleId}`, {
    method: "DELETE"
  });
}

export async function getAIArrangementTypes(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/arrangement-types`);
}

export async function createAIArrangementType(tenantId: string, type: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/arrangement-types`, {
    method: "POST",
    body: JSON.stringify(type),
  });
}

export async function deleteAIArrangementType(tenantId: string, typeId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/arrangement-types/${typeId}`, {
    method: "DELETE"
  });
}

export async function getAIOccasions(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/occasions`);
}

export async function createAIOccasion(tenantId: string, occasion: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/occasions`, {
    method: "POST",
    body: JSON.stringify(occasion),
  });
}

export async function deleteAIOccasion(tenantId: string, occasionId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/occasions/${occasionId}`, {
    method: "DELETE"
  });
}

// --- AI Budget Tiers API Endpoints ---
export async function getAIBudgetTiers(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/budget-tiers`);
}

export async function createAIBudgetTier(tenantId: string, budgetTier: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/budget-tiers`, {
    method: "POST",
    body: JSON.stringify(budgetTier),
  });
}

export async function deleteAIBudgetTier(tenantId: string, budgetTierId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/budget-tiers/${budgetTierId}`, {
    method: "DELETE"
  });
}

// --- AI Customer Data API Endpoints ---
export async function getAICustomerData(tenantId: string): Promise<any[]> {
  return authenticatedRequest<any[]>(`/api/tenants/${tenantId}/ai/customer-data`);
}

export async function createAICustomerData(tenantId: string, customerData: any): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/ai/customer-data`, {
    method: "POST",
    body: JSON.stringify(customerData),
  });
}

export async function deleteAICustomerData(tenantId: string, customerDataId: string): Promise<void> {
  return authenticatedRequest<void>(`/api/tenants/${tenantId}/ai/customer-data/${customerDataId}`, {
    method: "DELETE"
  });
}

// --- Shopify Analytics API Endpoints ---
export async function getShopifyAnalytics(tenantId: string, filters: {
  dateRange?: string;
  compareWith?: string;
  productType?: string;
  storeId?: string;
}): Promise<any> {
  const queryParams = new URLSearchParams();
  if (filters.dateRange) queryParams.append('dateRange', filters.dateRange);
  if (filters.compareWith) queryParams.append('compareWith', filters.compareWith);
  if (filters.productType) queryParams.append('productType', filters.productType);
  if (filters.storeId) queryParams.append('storeId', filters.storeId);
  
  const queryString = queryParams.toString();
  const url = queryString ? `/api/tenants/${tenantId}/shopify/analytics?${queryString}` : `/api/tenants/${tenantId}/shopify/analytics`;
  
  return authenticatedRequest<any>(url);
}

export async function createTrainingSessionFromAnalytics(tenantId: string, sessionData: {
  selectedProducts: string[];
  selectedOccasions: string[];
  selectedStyles: string[];
  sessionName: string;
  priority: 'high' | 'medium' | 'low';
}): Promise<any> {
  return authenticatedRequest<any>(`/api/tenants/${tenantId}/shopify/analytics/training-session`, {
    method: "POST",
    body: JSON.stringify(sessionData),
  });
}
