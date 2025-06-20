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
  CreateUserRequest
} from '../types/multi-tenant';

const API_BASE_URL = 'http://localhost:8787';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText);
  }

  return response.json();
}

// Authentication
export async function login(request: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function logout(): Promise<void> {
  return apiRequest<void>('/api/auth/logout', {
    method: 'POST',
  });
}

export async function refreshToken(): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/api/auth/refresh', {
    method: 'POST',
  });
}

// Tenant management
export async function createTenant(request: CreateTenantRequest): Promise<Tenant> {
  return apiRequest<Tenant>('/api/tenants', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getTenants(): Promise<Tenant[]> {
  return apiRequest<Tenant[]>('/api/tenants');
}

export async function getTenantById(id: string): Promise<Tenant> {
  return apiRequest<Tenant>(`/api/tenants/${id}`);
}

// User management
export async function createUser(tenantId: string, request: CreateUserRequest): Promise<User> {
  return apiRequest<User>(`/api/tenants/${tenantId}/users`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getUsers(tenantId: string): Promise<User[]> {
  return apiRequest<User[]>(`/api/tenants/${tenantId}/users`);
}

export async function getUserById(tenantId: string, userId: string): Promise<User> {
  return apiRequest<User>(`/api/tenants/${tenantId}/users/${userId}`);
}

// Order management (placeholder for future implementation)
export async function getOrders(tenantId: string, filters?: any, authToken?: string): Promise<Order[]> {
  const queryParams = filters ? `?${new URLSearchParams(filters).toString()}` : '';
  return apiRequest<Order[]>(`/api/tenants/${tenantId}/orders${queryParams}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

export async function getOrderById(tenantId: string, orderId: string, authToken?: string): Promise<Order> {
  return apiRequest<Order>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

export async function createOrder(tenantId: string, order: Partial<Order>, authToken?: string): Promise<Order> {
  return apiRequest<Order>(`/api/tenants/${tenantId}/orders`, {
    method: 'POST',
    body: JSON.stringify(order),
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

export async function updateOrder(tenantId: string, orderId: string, updates: Partial<Order>, authToken?: string): Promise<Order> {
  return apiRequest<Order>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

export async function deleteOrder(tenantId: string, orderId: string, authToken?: string): Promise<void> {
  await apiRequest<void>(`/api/tenants/${tenantId}/orders/${orderId}`, {
    method: 'DELETE',
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });
}

// Store management (placeholder for future implementation)
export async function getStores(tenantId: string): Promise<Store[]> {
  return apiRequest<Store[]>(`/api/tenants/${tenantId}/stores`);
}

// Product labels (placeholder for future implementation)
export async function getProductLabels(tenantId: string): Promise<ProductLabel[]> {
  return apiRequest<ProductLabel[]>(`/api/tenants/${tenantId}/product-labels`);
}

// Health check
export async function healthCheck(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/api/health');
} 