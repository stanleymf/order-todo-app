export interface Tenant {
  id: string;
  name: string;
  domain: string;
  subscriptionPlan: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  businessHours: {
    start: string;
    end: string;
  };
  features: {
    analytics: boolean;
    multiStore: boolean;
    advancedReporting: boolean;
  };
}

export interface CreateTenantRequest {
  name: string;
  domain: string;
  subscriptionPlan?: string;
  settings?: Partial<TenantSettings>;
}

// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
  tenantDomain?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  tenant?: Tenant;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  error?: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: 'owner' | 'admin' | 'florist' | 'viewer';
  permissions?: Permission[];
}

export interface Store {
  id: string;
  tenantId: string;
  name: string;
  type: 'shopify' | 'manual' | 'other';
  status: 'active' | 'inactive';
  settings: StoreSettings;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  timezone: string;
  currency: string;
  businessHours: {
    start: string;
    end: string;
  };
  address?: string;
  phone?: string;
  email?: string;
}

export interface ProductLabel {
  id: string;
  tenantId: string;
  name: string;
  category: 'difficulty' | 'productType' | 'custom';
  color: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  tenantId: string;
  shopifyOrderId?: string;
  customerName: string;
  deliveryDate: string;
  status: string;
  priority: number;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopifyStore {
  id: string;
  tenantId: string;
  shopifyDomain: string;
  accessToken: string;
  webhookSecret?: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'florist' | 'viewer';
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

export type Permission = 
  | 'orders:read'
  | 'orders:write'
  | 'orders:delete'
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'analytics:read'
  | 'settings:read'
  | 'settings:write';

export interface MigrationResult {
  success: boolean;
  migrated: number;
  errors: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  summary?: {
    tenant: string;
    ordersMigrated: number;
    productsMigrated: number;
    usersMigrated: number;
  };
}

export interface OrderFilters {
  status?: string;
  assignedTo?: string;
  deliveryDate?: string;
  priority?: number;
}

export interface CreateOrderRequest {
  shopifyOrderId?: string;
  customerName: string;
  deliveryDate: string;
  status?: string;
  priority?: number;
  assignedTo?: string;
  notes?: string;
}

export interface TenantFilters {
  status?: string;
  subscriptionPlan?: string;
  domain?: string;
} 