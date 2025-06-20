# 🏗️ Multi-Tenant Foundation Architecture

## 📋 **Strategic Decision: Multi-Tenant from Day One**

### **Why Multi-Tenant Now?**
- ✅ **Future-Proof**: Eliminates massive refactoring in Phase 3
- ✅ **Scalable**: Built for growth from the start
- ✅ **Cost-Effective**: Shared infrastructure reduces costs
- ✅ **Security**: Proper tenant isolation from the beginning
- ✅ **App Store Ready**: Shopify app store requirements met early

---

## 🏛️ **Multi-Tenant Architecture Design**

### **Database Strategy: Schema-per-Tenant**
```typescript
// Tenant Isolation Strategy
interface TenantDatabase {
  // Each tenant gets their own schema
  schema: `tenant_${tenantId}`;
  
  // Isolated tables per tenant
  tables: {
    users: User[];
    stores: Store[];
    products: Product[];
    orders: Order[];
    recipes: Recipe[];
    stockLevels: StockLevel[];
    forecasts: ForecastData[];
    auditLogs: AuditLog[];
  };
}

// Database Connection Management
interface DatabaseConnection {
  tenantId: string;
  schema: string;
  connection: Pool;
  isActive: boolean;
  lastUsed: Date;
}
```

### **Enhanced Data Models with Tenant Support**
```typescript
// Base Entity with Tenant Context
interface BaseEntity {
  id: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

// Enhanced User Model
interface User extends BaseEntity {
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'florist' | 'viewer';
  permissions: Permission[];
  lastLoginAt: Date;
  isActive: boolean;
  profile: UserProfile;
}

// Enhanced Store Model
interface Store extends BaseEntity {
  name: string;
  domain: string;
  color: string;
  settings: StoreSettings;
  shopifyIntegration: ShopifyIntegration;
  status: 'active' | 'inactive' | 'suspended';
}

// Enhanced Product Model
interface Product extends BaseEntity {
  name: string;
  variant: string;
  difficultyLabel: string;
  productTypeLabel: string;
  storeId: string;
  recipe?: Recipe;
  stockLevels: StockLevel[];
  forecastData: ForecastData[];
  shopifyData: ShopifyProductData;
}

// Enhanced Order Model
interface Order extends BaseEntity {
  productId: string;
  productName: string;
  productVariant: string;
  timeslot: string;
  difficultyLabel: string;
  productTypeLabel: string;
  remarks: string;
  assignedFloristId?: string;
  assignedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'assigned' | 'completed';
  date: string;
  storeId: string;
  customerData?: CustomerData;
}
```

---

## 🔐 **Protected Routes & Authentication System**

### **Multi-Tenant Authentication Flow**
```typescript
// Authentication Context
interface AuthContext {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  permissions: Permission[];
  sessionToken: string;
  refreshToken: string;
  lastActivity: Date;
}

// Protected Route Component
interface ProtectedRouteProps {
  requiredRole?: 'owner' | 'admin' | 'florist' | 'viewer';
  requiredPermissions?: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// Route Guard Implementation
interface RouteGuard {
  checkAuthentication(): boolean;
  checkTenantAccess(tenantId: string): boolean;
  checkPermissions(requiredPermissions: Permission[]): boolean;
  checkRole(requiredRole: UserRole): boolean;
  redirectToLogin(): void;
  redirectToUnauthorized(): void;
}
```

### **JWT Token Structure**
```typescript
interface JWTPayload {
  // Standard JWT claims
  iss: string;        // Issuer (app domain)
  sub: string;        // Subject (user ID)
  aud: string;        // Audience (tenant ID)
  exp: number;        // Expiration time
  iat: number;        // Issued at
  nbf: number;        // Not before
  
  // Custom claims
  tenantId: string;   // Tenant identifier
  userId: string;     // User identifier
  role: UserRole;     // User role
  permissions: Permission[]; // User permissions
  sessionId: string;  // Session identifier
}
```

---

## 🗄️ **Database Infrastructure**

### **Database Schema Design**
```sql
-- Tenant Management
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  shopify_shop_id VARCHAR(255),
  subscription_plan VARCHAR(50) DEFAULT 'starter',
  status VARCHAR(20) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Management (Global)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'florist',
  permissions JSONB DEFAULT '[]',
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Tenant-specific schemas
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS tenant_%s', tenant_id);
  
  -- Create tenant-specific tables
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS tenant_%s.stores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      domain VARCHAR(255) NOT NULL,
      color VARCHAR(7) NOT NULL,
      settings JSONB DEFAULT ''{}'',
      shopify_integration JSONB DEFAULT ''{}'',
      status VARCHAR(20) DEFAULT ''active'',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )', tenant_id);
    
  -- Add more tenant-specific tables...
END;
$$ LANGUAGE plpgsql;
```

### **Database Connection Pool Management**
```typescript
// Connection Pool Manager
interface DatabasePoolManager {
  // Get connection for specific tenant
  getConnection(tenantId: string): Promise<Pool>;
  
  // Release connection back to pool
  releaseConnection(tenantId: string, connection: Pool): void;
  
  // Health check for all pools
  healthCheck(): Promise<PoolHealthStatus[]>;
  
  // Cleanup inactive connections
  cleanup(): Promise<void>;
}

// Tenant-aware Query Builder
interface TenantQueryBuilder {
  tenantId: string;
  
  // Set tenant context
  forTenant(tenantId: string): TenantQueryBuilder;
  
  // Build queries with tenant isolation
  select(table: string): QueryBuilder;
  insert(table: string, data: any): QueryBuilder;
  update(table: string, data: any): QueryBuilder;
  delete(table: string): QueryBuilder;
  
  // Execute with tenant context
  execute(): Promise<any>;
}
```

---

## 🚀 **Implementation Strategy**

### **Phase 1 Implementation Steps**

#### **Step 1: Database Infrastructure (Week 1)**
```typescript
// 1. Set up multi-tenant database schema
interface DatabaseSetup {
  createTenantTables(tenantId: string): Promise<void>;
  migrateExistingData(): Promise<void>;
  setupConnectionPools(): Promise<void>;
  createIndexes(): Promise<void>;
}

// 2. Tenant management service
interface TenantService {
  createTenant(tenantData: CreateTenantRequest): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant>;
  updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant>;
  deleteTenant(tenantId: string): Promise<void>;
  listTenants(filters?: TenantFilters): Promise<Tenant[]>;
}
```

#### **Step 2: Authentication System (Week 2)**
```typescript
// 1. Multi-tenant auth service
interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthResult>;
  logout(sessionToken: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  validateToken(token: string): Promise<JWTPayload>;
  revokeToken(token: string): Promise<void>;
}

// 2. Protected route components
interface ProtectedRouteComponents {
  AuthProvider: React.FC<{ children: React.ReactNode }>;
  ProtectedRoute: React.FC<ProtectedRouteProps>;
  TenantRoute: React.FC<TenantRouteProps>;
  RoleBasedRoute: React.FC<RoleBasedRouteProps>;
}
```

#### **Step 3: Data Layer Updates (Week 3)**
```typescript
// 1. Tenant-aware storage service
interface TenantStorageService {
  // Order management with tenant context
  getOrders(tenantId: string, filters: OrderFilters): Promise<Order[]>;
  createOrder(tenantId: string, orderData: CreateOrderRequest): Promise<Order>;
  updateOrder(tenantId: string, orderId: string, updates: Partial<Order>): Promise<Order>;
  deleteOrder(tenantId: string, orderId: string): Promise<void>;
  
  // Product management with tenant context
  getProducts(tenantId: string, filters: ProductFilters): Promise<Product[]>;
  createProduct(tenantId: string, productData: CreateProductRequest): Promise<Product>;
  updateProduct(tenantId: string, productId: string, updates: Partial<Product>): Promise<Product>;
  deleteProduct(tenantId: string, productId: string): Promise<void>;
}

// 2. Tenant context provider
interface TenantContextProvider {
  currentTenant: Tenant | null;
  setTenant(tenant: Tenant): void;
  clearTenant(): void;
  isTenantActive(): boolean;
}
```

#### **Step 4: UI Component Updates (Week 4)**
```typescript
// 1. Tenant-aware components
interface TenantAwareComponents {
  TenantSelector: React.FC<TenantSelectorProps>;
  TenantHeader: React.FC<TenantHeaderProps>;
  TenantSettings: React.FC<TenantSettingsProps>;
  UserManagement: React.FC<UserManagementProps>;
}

// 2. Enhanced existing components
interface EnhancedComponents {
  Dashboard: React.FC<{ tenantId: string }>;
  OrdersView: React.FC<{ tenantId: string }>;
  ProductManagement: React.FC<{ tenantId: string }>;
  Analytics: React.FC<{ tenantId: string }>;
}
```

---

## 🔒 **Security & Compliance**

### **Tenant Isolation Security**
```typescript
// Security middleware
interface SecurityMiddleware {
  // Tenant isolation check
  validateTenantAccess(req: Request, res: Response, next: NextFunction): void;
  
  // Data access control
  validateDataAccess(userId: string, tenantId: string, resourceId: string): Promise<boolean>;
  
  // Cross-tenant access prevention
  preventCrossTenantAccess(req: Request, res: Response, next: NextFunction): void;
  
  // Audit logging
  logDataAccess(userId: string, tenantId: string, action: string, resource: string): Promise<void>;
}

// Data encryption
interface DataEncryption {
  encryptSensitiveData(data: any, tenantId: string): Promise<string>;
  decryptSensitiveData(encryptedData: string, tenantId: string): Promise<any>;
  rotateEncryptionKeys(tenantId: string): Promise<void>;
}
```

### **Compliance Features**
```typescript
// GDPR Compliance
interface GDPRCompliance {
  exportUserData(userId: string, tenantId: string): Promise<UserDataExport>;
  deleteUserData(userId: string, tenantId: string): Promise<void>;
  anonymizeUserData(userId: string, tenantId: string): Promise<void>;
  getDataRetentionPolicy(tenantId: string): Promise<DataRetentionPolicy>;
}

// Audit Trail
interface AuditTrail {
  logUserAction(userId: string, tenantId: string, action: AuditAction): Promise<void>;
  getAuditLogs(tenantId: string, filters: AuditFilters): Promise<AuditLog[]>;
  exportAuditLogs(tenantId: string, dateRange: DateRange): Promise<AuditLogExport>;
}
```

---

## 📊 **Migration Strategy**

### **From Current Single-Tenant to Multi-Tenant**
```typescript
// Migration service
interface MigrationService {
  // Create default tenant for existing data
  createDefaultTenant(): Promise<Tenant>;
  
  // Migrate existing data to tenant schema
  migrateOrdersToTenant(tenantId: string): Promise<MigrationResult>;
  migrateProductsToTenant(tenantId: string): Promise<MigrationResult>;
  migrateUsersToTenant(tenantId: string): Promise<MigrationResult>;
  
  // Validate migration integrity
  validateMigration(tenantId: string): Promise<ValidationResult>;
  
  // Rollback migration if needed
  rollbackMigration(tenantId: string): Promise<void>;
}
```

### **Data Migration Steps**
1. **Backup Current Data**: Create complete backup of existing data
2. **Create Default Tenant**: Set up tenant for existing business
3. **Migrate Data**: Move all existing data to tenant-specific schema
4. **Update References**: Update all foreign key references
5. **Validate Integrity**: Ensure data consistency
6. **Update Application**: Deploy multi-tenant version
7. **Test Thoroughly**: Verify all functionality works with tenant isolation

---

## 🎯 **Benefits of Multi-Tenant Foundation**

### **Immediate Benefits**
- ✅ **Future-Ready**: No major refactoring needed for Phase 3
- ✅ **Security**: Proper data isolation from day one
- ✅ **Scalability**: Built to handle multiple businesses
- ✅ **Cost-Effective**: Shared infrastructure reduces costs

### **Long-term Benefits**
- ✅ **App Store Ready**: Meets Shopify app store requirements
- ✅ **Enterprise Features**: Advanced security and compliance
- ✅ **Market Expansion**: Easy to onboard new florist businesses
- ✅ **Revenue Growth**: Subscription-based pricing model

This multi-tenant foundation ensures your Order To-Do App is built for success from the very beginning, with a solid architecture that can scale from a single florist shop to a thriving SaaS platform serving hundreds of businesses. 