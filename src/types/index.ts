// Consolidated types for multi-tenant florist order management app
// All types are compatible with the multi-tenant architecture

// ===== TENANT & AUTHENTICATION TYPES =====

export interface Tenant {
  id: string
  name: string
  domain: string
  subscriptionPlan: "starter" | "professional" | "enterprise"
  status: "active" | "suspended" | "cancelled"
  settings: TenantSettings
  createdAt: string
  updatedAt: string
}

export interface TenantSettings {
  timezone: string
  currency: string
  businessHours: {
    start: string
    end: string
  }
  features: {
    analytics: boolean
    multiStore: boolean
    advancedReporting: boolean
  }
  orderCard?: any
}

export interface CreateTenantRequest {
  name: string
  domain: string
  subscriptionPlan?: string
  settings?: Partial<TenantSettings>
}

// Authentication types
export interface LoginRequest {
  email: string
  password: string
  tenantDomain?: string
}

export interface LoginResponse {
  success: boolean
  user?: User
  tenant?: Tenant
  accessToken?: string
  refreshToken?: string
  message?: string
  error?: string
}

export interface CreateUserRequest {
  email: string
  name: string
  password: string
  role: "owner" | "admin" | "florist" | "viewer"
  permissions?: Permission[]
}

// ===== USER & PERMISSIONS =====

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: "owner" | "admin" | "florist" | "viewer"
  permissions: Permission[]
  createdAt: string
  updatedAt: string
}

export type Permission =
  | "orders:read"
  | "orders:write"
  | "orders:delete"
  | "products:read"
  | "products:write"
  | "products:delete"
  | "users:read"
  | "users:write"
  | "users:delete"
  | "analytics:read"
  | "settings:read"
  | "settings:write"

// ===== STORE TYPES =====

export interface Store {
  id: string
  tenantId: string
  name: string
  type: "shopify" | "manual" | "other"
  status: "active" | "inactive"
  settings: StoreSettings
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

export interface StoreSettings {
  timezone: string
  currency: string
  businessHours: {
    start: string
    end: string
  }
  domain?: string
  address?: string
  phone?: string
  email?: string
  webhooks?: WebhookConfig[]
  accessToken?: string
  apiSecretKey?: string
}

export interface WebhookConfig {
  id: string
  topic: string
  address: string
  status: "active" | "inactive" | "error"
  lastTriggered?: string
}

export interface ShopifyStore {
  id: string
  tenantId: string
  shopifyDomain: string
  accessToken: string
  webhookSecret?: string
  syncEnabled: boolean
  lastSyncAt?: string
  createdAt: string
  updatedAt: string
}

// ===== PRODUCT TYPES =====

export interface Product {
  id: string
  tenantId: string
  name: string
  variant: string
  difficultyLabel: string
  productTypeLabel: string
  storeId: string

  // Shopify-specific fields
  shopifyId?: string
  handle?: string
  description?: string
  productType?: string
  vendor?: string
  tags?: string[]
  status?: "active" | "archived" | "draft"
  publishedAt?: string
  createdAt?: string
  updatedAt?: string

  // Shopify variant fields
  variants?: ProductVariant[]

  // Shopify images
  images?: ProductImage[]

  // Shopify metafields for custom data
  metafields?: ProductMetafield[]

  // Custom florist-specific metadata
  floristMetadata?: {
    difficultyLevel?: string
    estimatedTime?: number // in minutes
    specialInstructions?: string
    seasonalAvailability?: string[]
    materials?: string[]
  }
}

export interface SavedProduct {
  id: string
  tenantId: string
  shopifyProductId: string
  shopifyVariantId: string
  title: string
  variantTitle?: string
  description?: string
  price: number
  tags: string[]
  productType?: string
  vendor?: string
  handle?: string
  status: string
  // Image fields
  imageUrl?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  createdAt: string
  updatedAt: string
  labelIds?: string[]
  labelNames?: string[]
}

export interface ProductVariant {
  id: string
  shopifyId?: string
  title: string
  sku?: string
  price?: string
  compareAtPrice?: string
  inventoryQuantity?: number
  weight?: number
  weightUnit?: string
  requiresShipping?: boolean
  taxable?: boolean
  barcode?: string
  position?: number
  createdAt?: string
  updatedAt?: string
}

export interface ProductImage {
  id: string
  shopifyId?: string
  src: string
  alt?: string
  width?: number
  height?: number
  position?: number
  createdAt?: string
  updatedAt?: string
}

export interface ProductMetafield {
  id: string
  shopifyId?: string
  namespace: string
  key: string
  value: string
  type: string
  description?: string
  createdAt?: string
  updatedAt?: string
}

export interface ProductLabel {
  id: string
  tenantId: string
  name: string
  color: string
  description?: string
  category: "difficulty" | "productType" | "custom"
  priority: number
  createdAt: string
  updatedAt: string
}

// ===== ORDER TYPES =====

export interface Order {
  id: string
  tenantId: string
  shopifyOrderId?: string
  customerName: string
  deliveryDate: string
  status: "pending" | "assigned" | "in_progress" | "completed" | "cancelled"
  priority?: "low" | "medium" | "high"
  assignedTo?: string
  notes?: string
  createdAt: string
  updatedAt: string
  shopifyOrderData?: any // To store raw Shopify order for dynamic mapping
  totalPrice?: number
}

export interface CreateOrderRequest {
  shopifyOrderId?: string
  customerName: string
  deliveryDate: string
  status?: string
  priority?: number
  assignedTo?: string
  notes?: string
}

export interface OrderFilters {
  status?: string
  assignedTo?: string
  deliveryDate?: string
  priority?: number
}

// ===== ANALYTICS TYPES =====

export interface FloristStats {
  floristId: string
  floristName: string
  completedOrders: number
  averageCompletionTime: number // in minutes
  storeBreakdown?: { [storeId: string]: { orders: number; avgTime: number } }
}

export type TimeFrame = "daily" | "weekly" | "monthly"

// ===== MIGRATION & VALIDATION TYPES =====

export interface MigrationResult {
  success: boolean
  migrated: number
  errors: number
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  summary?: {
    tenant: string
    ordersMigrated: number
    productsMigrated: number
    usersMigrated: number
  }
}

export interface TenantFilters {
  status?: string
  subscriptionPlan?: string
  domain?: string
}

// ===== LEGACY COMPATIBILITY =====
// These types are kept for backward compatibility but should be phased out

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
}
