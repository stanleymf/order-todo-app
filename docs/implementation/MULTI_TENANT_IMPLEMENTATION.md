# 🏗️ Multi-Tenant Implementation Plan

## 📋 **Implementation Overview**

This document outlines the detailed implementation plan for transitioning the Order To-Do App from single-tenant to multi-tenant architecture, specifically designed for Shopify multi-store compatibility.

---

## 🎯 **Implementation Goals**

### **Primary Objectives**
- ✅ **Multi-Store Support**: Handle multiple Shopify stores per tenant
- ✅ **Tenant Isolation**: Complete data separation between florist businesses
- ✅ **Shopify Compatibility**: Full compatibility with Shopify App Store requirements
- ✅ **Scalable Architecture**: Support hundreds of florist businesses
- ✅ **Security**: Enterprise-grade security and compliance

### **Technical Requirements**
- **Database**: PostgreSQL with schema-per-tenant isolation
- **Authentication**: JWT-based multi-tenant authentication
- **API**: RESTful API with tenant context
- **Frontend**: React with tenant-aware components
- **Shopify Integration**: Multi-store sync with webhooks

---

## 🏛️ **Architecture Design**

### **Multi-Tenant Data Model**

#### **Tenant Management**
```typescript
// Core tenant entity
interface Tenant {
  id: string;
  name: string;
  domain: string;
  subscription: Subscription;
  settings: TenantSettings;
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Subscription management
interface Subscription {
  plan: 'starter' | 'professional' | 'enterprise';
  features: string[];
  limits: {
    maxStores: number;        // Number of Shopify stores
    maxUsers: number;         // Number of users
    maxProducts: number;      // Number of products
    apiCallsPerDay: number;   // API rate limits
  };
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
  status: 'active' | 'past_due' | 'cancelled';
}

// Tenant-specific settings
interface TenantSettings {
  timezone: string;
  currency: string;
  language: string;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  businessHours: BusinessHours;
  defaultStore?: string;      // Default Shopify store
}
```

#### **Shopify Store Integration**
```typescript
// Shopify store within a tenant
interface ShopifyStore {
  id: string;
  tenantId: string;
  name: string;
  domain: string;
  shopifyShopId: string;
  accessToken: string;
  scopes: string[];
  status: 'active' | 'inactive' | 'suspended';
  settings: StoreSettings;
  syncSettings: SyncSettings;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Store-specific settings
interface StoreSettings {
  color: string;              // Visual identification
  timezone: string;
  currency: string;
  taxSettings: TaxSettings;
  shippingSettings: ShippingSettings;
  notificationSettings: NotificationSettings;
}

// Sync configuration
interface SyncSettings {
  autoSync: boolean;          // Automatic sync enabled
  syncInterval: number;       // Sync interval in minutes
  syncOrders: boolean;        // Sync orders
  syncProducts: boolean;      // Sync products
  syncCustomers: boolean;     // Sync customers
  webhookTopics: string[];    // Webhook subscriptions
}
```

#### **Enhanced User Model**
```typescript
// User with tenant context
interface User extends BaseEntity {
  tenantId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'florist' | 'viewer';
  permissions: Permission[];
  profile: UserProfile;
  preferences: UserPreferences;
  lastLoginAt: Date;
  isActive: boolean;
  assignedStores: string[];   // Stores this user can access
}

// User profile information
interface UserProfile {
  avatar?: string;
  phone?: string;
  position?: string;
  department?: string;
  skills: string[];           // Florist skills
  experience: number;         // Years of experience
  specialties: string[];      // Specialized areas
}

// User preferences
interface UserPreferences {
  defaultStore?: string;
  defaultView: 'orders' | 'products' | 'analytics';
  notificationSettings: NotificationSettings;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
```

### **Database Schema Design**

#### **Global Tables (Shared)**
```sql
-- Tenant management
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) UNIQUE NOT NULL,
  subscription_plan VARCHAR(50) DEFAULT 'starter',
  subscription_status VARCHAR(20) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Global user management
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'florist',
  permissions JSONB DEFAULT '[]',
  profile JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  last_login_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Shopify store management
CREATE TABLE shopify_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  shopify_shop_id VARCHAR(255) NOT NULL,
  access_token VARCHAR(500) NOT NULL,
  scopes JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  sync_settings JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, domain)
);
```

#### **Tenant-Specific Schemas**
```sql
-- Function to create tenant schema
CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create schema for tenant
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS tenant_%s', tenant_id);
  
  -- Create tenant-specific tables
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS tenant_%s.orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shopify_order_id VARCHAR(255),
      store_id UUID NOT NULL,
      product_id UUID NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      product_variant VARCHAR(255),
      timeslot VARCHAR(100),
      difficulty_label VARCHAR(50),
      product_type_label VARCHAR(50),
      remarks TEXT,
      assigned_florist_id UUID,
      assigned_at TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(20) DEFAULT ''pending'',
      date DATE NOT NULL,
      customer_data JSONB DEFAULT ''{}'',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )', tenant_id);
    
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS tenant_%s.products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shopify_product_id VARCHAR(255),
      store_id UUID NOT NULL,
      name VARCHAR(255) NOT NULL,
      variant VARCHAR(255),
      difficulty_label VARCHAR(50),
      product_type_label VARCHAR(50),
      recipe JSONB DEFAULT ''{}'',
      stock_levels JSONB DEFAULT ''[]'',
      forecast_data JSONB DEFAULT ''{}'',
      shopify_data JSONB DEFAULT ''{}'',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id)
    )', tenant_id);
    
  -- Add more tenant-specific tables...
END;
$$ LANGUAGE plpgsql;
```

---

## 🔐 **Authentication & Authorization**

### **Multi-Tenant Authentication Flow**
```typescript
// Authentication service
interface AuthService {
  // Login with tenant context
  login(credentials: LoginCredentials): Promise<AuthResult>;
  
  // Validate token with tenant access
  validateToken(token: string): Promise<JWTPayload>;
  
  // Refresh token
  refreshToken(refreshToken: string): Promise<AuthResult>;
  
  // Logout and revoke tokens
  logout(sessionToken: string): Promise<void>;
  
  // Switch between stores within tenant
  switchStore(storeId: string): Promise<AuthResult>;
}

// Enhanced JWT payload
interface JWTPayload {
  // Standard JWT claims
  iss: string;        // Issuer
  sub: string;        // Subject (user ID)
  aud: string;        // Audience (tenant ID)
  exp: number;        // Expiration
  iat: number;        // Issued at
  nbf: number;        // Not before
  
  // Custom claims
  tenantId: string;   // Tenant identifier
  userId: string;     // User identifier
  role: UserRole;     // User role
  permissions: Permission[]; // User permissions
  sessionId: string;  // Session identifier
  currentStoreId?: string; // Current store context
  assignedStores: string[]; // Stores user can access
}
```

### **Protected Route Components**
```typescript
// Multi-tenant route protection
interface ProtectedRouteProps {
  requiredRole?: UserRole;
  requiredPermissions?: Permission[];
  requiredStoreAccess?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

// Tenant-aware route component
export function ProtectedRoute({
  requiredRole,
  requiredPermissions,
  requiredStoreAccess,
  children,
  fallback,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { user, tenant, currentStore } = useAuth();
  
  // Check authentication
  if (!user || !tenant) {
    return <Navigate to={redirectTo} replace />;
  }
  
  // Check role
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  // Check permissions
  if (requiredPermissions && !hasPermissions(user, requiredPermissions)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  // Check store access
  if (requiredStoreAccess && !currentStore) {
    return <Navigate to="/select-store" replace />;
  }
  
  return <>{children}</>;
}
```

---

## 🛠️ **Implementation Steps**

### **Phase 1: Database Infrastructure (Week 1)**

#### **Step 1.1: Database Setup**
```bash
# 1. Set up PostgreSQL database
# 2. Create global tables
# 3. Set up connection pooling
# 4. Create tenant schema function
```

#### **Step 1.2: Migration Service**
```typescript
// Migration service for existing data
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

### **Phase 2: Authentication System (Week 2)**

#### **Step 2.1: Multi-Tenant Auth Service**
```typescript
// Enhanced authentication service
class MultiTenantAuthService {
  private db: Database;
  private jwtSecret: string;
  
  constructor(db: Database, jwtSecret: string) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }
  
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // 1. Validate credentials
    const user = await this.validateCredentials(credentials);
    
    // 2. Get tenant information
    const tenant = await this.getTenant(user.tenantId);
    
    // 3. Generate JWT token
    const token = this.generateToken(user, tenant);
    
    // 4. Create session
    await this.createSession(user.id, token);
    
    return { user, tenant, token };
  }
  
  async validateToken(token: string): Promise<JWTPayload> {
    // 1. Verify JWT signature
    const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;
    
    // 2. Check if user still exists and is active
    const user = await this.getUser(payload.userId);
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }
    
    // 3. Check if tenant is active
    const tenant = await this.getTenant(payload.tenantId);
    if (tenant.status !== 'active') {
      throw new Error('Tenant is not active');
    }
    
    return payload;
  }
}
```

#### **Step 2.2: Store Selection Component**
```typescript
// Store selector component
interface StoreSelectorProps {
  onStoreSelect: (storeId: string) => void;
  currentStore?: ShopifyStore;
}

export function StoreSelector({ onStoreSelect, currentStore }: StoreSelectorProps) {
  const { user, tenant } = useAuth();
  const [stores, setStores] = useState<ShopifyStore[]>([]);
  
  useEffect(() => {
    // Load user's assigned stores
    loadUserStores(user.assignedStores);
  }, [user]);
  
  return (
    <div className="store-selector">
      <Select value={currentStore?.id} onValueChange={onStoreSelect}>
        <SelectTrigger>
          <SelectValue placeholder="Select a store" />
        </SelectTrigger>
        <SelectContent>
          {stores.map(store => (
            <SelectItem key={store.id} value={store.id}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: store.settings.color }}
                />
                {store.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

### **Phase 3: Data Layer Updates (Week 3)**

#### **Step 3.1: Tenant-Aware Storage Service**
```typescript
// Enhanced storage service with tenant context
class TenantStorageService {
  private tenantId: string;
  private db: Database;
  
  constructor(tenantId: string, db: Database) {
    this.tenantId = tenantId;
    this.db = db;
  }
  
  // Order management with tenant context
  async getOrders(filters: OrderFilters): Promise<Order[]> {
    const schema = `tenant_${this.tenantId}`;
    const query = `
      SELECT * FROM ${schema}.orders 
      WHERE 1=1
      ${filters.date ? `AND date = $1` : ''}
      ${filters.storeId ? `AND store_id = $2` : ''}
      ${filters.status ? `AND status = $3` : ''}
      ORDER BY created_at DESC
    `;
    
    return this.db.query(query, [filters.date, filters.storeId, filters.status]);
  }
  
  async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const schema = `tenant_${this.tenantId}`;
    const query = `
      INSERT INTO ${schema}.orders (
        store_id, product_id, product_name, product_variant,
        timeslot, difficulty_label, product_type_label,
        remarks, date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    return this.db.query(query, [
      orderData.storeId, orderData.productId, orderData.productName,
      orderData.productVariant, orderData.timeslot, orderData.difficultyLabel,
      orderData.productTypeLabel, orderData.remarks, orderData.date,
      orderData.createdBy
    ]);
  }
}
```

#### **Step 3.2: Shopify Integration Service**
```typescript
// Multi-store Shopify integration
class MultiStoreShopifyService {
  private db: Database;
  
  constructor(db: Database) {
    this.db = db;
  }
  
  // Sync orders from all stores for a tenant
  async syncTenantOrders(tenantId: string): Promise<SyncResult> {
    const stores = await this.getTenantStores(tenantId);
    const results: SyncResult[] = [];
    
    for (const store of stores) {
      if (store.syncSettings.syncOrders) {
        const result = await this.syncStoreOrders(store);
        results.push(result);
      }
    }
    
    return this.aggregateResults(results);
  }
  
  // Sync orders from specific store
  async syncStoreOrders(store: ShopifyStore): Promise<SyncResult> {
    const apiService = new ShopifyApiService(store);
    
    try {
      // Get orders from Shopify
      const shopifyOrders = await apiService.getOrders({
        status: 'open',
        limit: 250
      });
      
      // Transform and save orders
      const savedOrders = await this.saveOrders(store.tenantId, store.id, shopifyOrders);
      
      // Update last sync time
      await this.updateStoreSyncTime(store.id);
      
      return {
        storeId: store.id,
        success: true,
        ordersSynced: savedOrders.length,
        errors: []
      };
    } catch (error) {
      return {
        storeId: store.id,
        success: false,
        ordersSynced: 0,
        errors: [error.message]
      };
    }
  }
}
```

### **Phase 4: UI Component Updates (Week 4)**

#### **Step 4.1: Tenant Context Provider**
```typescript
// Tenant context for React components
interface TenantContextType {
  tenant: Tenant | null;
  currentStore: ShopifyStore | null;
  stores: ShopifyStore[];
  setCurrentStore: (store: ShopifyStore) => void;
  switchStore: (storeId: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stores, setStores] = useState<ShopifyStore[]>([]);
  const [currentStore, setCurrentStore] = useState<ShopifyStore | null>(null);
  
  useEffect(() => {
    if (user) {
      loadTenantData(user.tenantId);
    }
  }, [user]);
  
  const switchStore = useCallback(async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      setCurrentStore(store);
      // Update auth context with new store
      await updateAuthStore(storeId);
    }
  }, [stores]);
  
  return (
    <TenantContext.Provider value={{
      tenant,
      currentStore,
      stores,
      setCurrentStore,
      switchStore
    }}>
      {children}
    </TenantContext.Provider>
  );
}
```

#### **Step 4.2: Enhanced Dashboard Component**
```typescript
// Multi-tenant dashboard
export function Dashboard({ user }: { user: User }) {
  const { tenant, currentStore, stores } = useTenant();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (currentStore) {
      loadStoreOrders(currentStore.id);
    }
  }, [currentStore]);
  
  if (!tenant) {
    return <div>Loading tenant data...</div>;
  }
  
  if (!currentStore) {
    return <StoreSelector />;
  }
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="tenant-info">
          <h1>{tenant.name}</h1>
          <span className="subscription-plan">{tenant.subscription.plan}</span>
        </div>
        
        <StoreSelector 
          currentStore={currentStore}
          stores={stores}
          onStoreSelect={switchStore}
        />
        
        <UserMenu user={user} />
      </header>
      
      <main className="dashboard-content">
        <Tabs defaultValue="orders">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="orders">
            <OrdersView storeId={currentStore.id} />
          </TabsContent>
          
          <TabsContent value="products">
            <ProductManagement storeId={currentStore.id} />
          </TabsContent>
          
          <TabsContent value="analytics">
            <Analytics storeId={currentStore.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
```

---

## 🔒 **Security Implementation**

### **Tenant Isolation Security**
```typescript
// Security middleware for API routes
interface SecurityMiddleware {
  // Validate tenant access
  validateTenantAccess(req: Request, res: Response, next: NextFunction): void;
  
  // Prevent cross-tenant data access
  preventCrossTenantAccess(req: Request, res: Response, next: NextFunction): void;
  
  // Validate store access within tenant
  validateStoreAccess(req: Request, res: Response, next: NextFunction): void;
  
  // Audit logging
  logDataAccess(userId: string, tenantId: string, action: string, resource: string): Promise<void>;
}

// API route protection
export function withTenantProtection(handler: RequestHandler): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract tenant from JWT token
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const payload = await authService.validateToken(token);
      
      // Add tenant context to request
      req.tenantId = payload.tenantId;
      req.userId = payload.userId;
      req.currentStoreId = payload.currentStoreId;
      
      // Validate tenant access
      await validateTenantAccess(payload.tenantId, req.path);
      
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}
```

### **Data Encryption**
```typescript
// Data encryption service
class DataEncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  
  // Encrypt sensitive data per tenant
  async encryptData(data: any, tenantId: string): Promise<string> {
    const key = await this.getTenantKey(tenantId);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from(tenantId));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    });
  }
  
  // Decrypt data for tenant
  async decryptData(encryptedData: string, tenantId: string): Promise<any> {
    const key = await this.getTenantKey(tenantId);
    const { encrypted, iv, authTag } = JSON.parse(encryptedData);
    
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAAD(Buffer.from(tenantId));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}
```

---

## 📊 **Testing Strategy**

### **Multi-Tenant Testing**
```typescript
// Test utilities for multi-tenant testing
class MultiTenantTestUtils {
  // Create test tenant
  static async createTestTenant(): Promise<Tenant> {
    const tenant = await tenantService.createTenant({
      name: 'Test Florist',
      domain: 'test-florist.myshopify.com',
      subscription: 'starter'
    });
    
    await createTenantSchema(tenant.id);
    return tenant;
  }
  
  // Create test user
  static async createTestUser(tenantId: string, role: UserRole = 'florist'): Promise<User> {
    return userService.createUser({
      tenantId,
      name: 'Test User',
      email: 'test@example.com',
      role
    });
  }
  
  // Create test store
  static async createTestStore(tenantId: string): Promise<ShopifyStore> {
    return storeService.createStore({
      tenantId,
      name: 'Test Store',
      domain: 'test-store.myshopify.com',
      shopifyShopId: '123456789',
      accessToken: 'test-token'
    });
  }
  
  // Clean up test data
  static async cleanupTestData(tenantId: string): Promise<void> {
    await tenantService.deleteTenant(tenantId);
  }
}

// Multi-tenant test example
describe('Multi-Tenant Order Management', () => {
  let tenant1: Tenant;
  let tenant2: Tenant;
  let user1: User;
  let user2: User;
  
  beforeEach(async () => {
    // Create test tenants
    tenant1 = await MultiTenantTestUtils.createTestTenant();
    tenant2 = await MultiTenantTestUtils.createTestTenant();
    
    // Create test users
    user1 = await MultiTenantTestUtils.createTestUser(tenant1.id);
    user2 = await MultiTenantTestUtils.createTestUser(tenant2.id);
  });
  
  afterEach(async () => {
    // Clean up test data
    await MultiTenantTestUtils.cleanupTestData(tenant1.id);
    await MultiTenantTestUtils.cleanupTestData(tenant2.id);
  });
  
  it('should isolate data between tenants', async () => {
    // Create orders for tenant 1
    const order1 = await orderService.createOrder(tenant1.id, {
      productName: 'Rose Bouquet',
      date: '2025-01-15'
    });
    
    // Create orders for tenant 2
    const order2 = await orderService.createOrder(tenant2.id, {
      productName: 'Tulip Arrangement',
      date: '2025-01-15'
    });
    
    // Verify tenant 1 can only see their orders
    const tenant1Orders = await orderService.getOrders(tenant1.id);
    expect(tenant1Orders).toHaveLength(1);
    expect(tenant1Orders[0].id).toBe(order1.id);
    
    // Verify tenant 2 can only see their orders
    const tenant2Orders = await orderService.getOrders(tenant2.id);
    expect(tenant2Orders).toHaveLength(1);
    expect(tenant2Orders[0].id).toBe(order2.id);
  });
});
```

---

## 🚀 **Deployment Strategy**

### **Database Migration**
```bash
# 1. Backup existing data
pg_dump order_todo_app > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Create new database structure
psql order_todo_app < migrations/001_create_multi_tenant_schema.sql

# 3. Migrate existing data
node scripts/migrate-to-multi-tenant.js

# 4. Verify migration
node scripts/verify-migration.js

# 5. Update application
git pull origin main
pnpm install
pnpm build
pnpm deploy
```

### **Environment Configuration**
```env
# Multi-tenant configuration
DATABASE_URL=postgresql://user:password@localhost:5432/order_todo_app
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Shopify configuration
SHOPIFY_CLIENT_ID=your-shopify-client-id
SHOPIFY_CLIENT_SECRET=your-shopify-client-secret
SHOPIFY_SCOPES=read_orders,read_products,write_products

# Cloudflare configuration
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
```

---

## 📈 **Success Metrics**

### **Implementation Metrics**
- **Database Migration**: 100% data integrity maintained
- **Tenant Isolation**: 0 cross-tenant data leaks
- **Performance**: < 2s response time for all operations
- **Security**: 100% authentication and authorization working
- **Shopify Integration**: 100% multi-store sync working

### **Business Metrics**
- **User Adoption**: 90% of users successfully migrated
- **Feature Usage**: 95% of multi-tenant features working
- **Error Rate**: < 1% system errors
- **Performance**: No degradation in user experience

This implementation plan provides a comprehensive roadmap for transitioning to a multi-tenant architecture that's fully compatible with Shopify's multi-store requirements and ready for app store deployment.

# Multi-Tenant Implementation Guidelines

## Ensuring Tenant Compatibility for All Features

To maintain a robust multi-tenant architecture, all new features, endpoints, and database queries **must** be tenant-compatible. This ensures data isolation, security, and correct functionality for each tenant.

### 1. **API Design**
- **Always include `tenantId` in API routes** for any resource that is tenant-specific.
  - Example: `/api/tenants/:tenantId/orders`, `/api/tenants/:tenantId/ai/knowledge-base`
- Avoid global endpoints unless the data is truly shared across all tenants.
- Validate the `tenantId` parameter in every handler and return an error if missing or invalid.

### 2. **Database Access**
- **All queries must filter by `tenant_id`** (or equivalent) in the WHERE clause.
- Never fetch or mutate data without scoping to the current tenant.
- When creating new tables, always include a `tenant_id` column if the data is tenant-specific.
- Use parameterized queries to prevent SQL injection and ensure correct tenant scoping.

### 3. **Frontend Usage**
- Always pass the current `tenantId` when making API calls.
- Store and manage the active tenant context in global state (e.g., React context or Redux).
- Never display or allow access to data from other tenants.

### 4. **Testing for Tenant Isolation**
- Create test tenants and verify that data from one tenant is never visible to another.
- Use automated tests to check for tenant leaks in API responses and UI.
- Regularly audit endpoints and queries for missing tenant checks.

### 5. **Common Pitfalls**
- Forgetting to add `tenantId` to new API routes or database queries.
- Accidentally using global state or cache for tenant-specific data.
- Hardcoding tenant IDs in code or tests.

### 6. **Checklist for New Features**
- [ ] All new API endpoints include `tenantId` in the route.
- [ ] All database queries filter by `tenant_id`.
- [ ] Frontend passes `tenantId` in all relevant API calls.
- [ ] UI only shows data for the current tenant.
- [ ] Tests verify tenant isolation.

---

**Always review this checklist before merging or deploying new features.**

_Last updated: 2025-06-23_ 