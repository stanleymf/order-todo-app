# 🚀 Quick Start Guide - Multi-Tenant Implementation

## 🎯 **Let's Begin Right Now!**

This guide provides immediate, actionable steps to start implementing multi-tenant architecture in your Order To-Do App.

---

## 📋 **Environment Status**

✅ **Node.js**: v24.1.0  
✅ **npm**: v11.3.0  
✅ **pnpm**: v10.6.2  
❌ **Docker**: Not installed  
❌ **PostgreSQL**: Not installed  

---

## 🚀 **Step 1: Database Setup Options**

Since PostgreSQL isn't installed, we have three options:

### **Option A: Install PostgreSQL Locally (Recommended)**
```bash
# Install PostgreSQL using Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb order_todo_app
```

### **Option B: Use Cloud Database (Quick Start)**
- **Supabase** (Free tier available)
- **Neon** (PostgreSQL as a service)
- **Railway** (Easy deployment)

### **Option C: Use SQLite for Development (Temporary)**
- Quick to set up
- Good for development
- Easy migration to PostgreSQL later

---

## 🎯 **Recommended Approach: Start with SQLite**

For immediate progress, let's start with SQLite and plan PostgreSQL migration:

### **1. Install SQLite Dependencies**
```bash
pnpm add better-sqlite3 @types/better-sqlite3
pnpm add -D @types/node
```

### **2. Create Database Schema**
```sql
-- Global tables (shared across all tenants)
CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  settings TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tenant-specific tables (we'll use tenant_id prefix)
CREATE TABLE tenant_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_order_id TEXT,
  customer_name TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE tenant_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  stock_quantity INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE tenant_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'florist',
  permissions TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE shopify_stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  webhook_secret TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### **3. Create Database Service**
```typescript
// src/services/database.ts
import Database from 'better-sqlite3';
import { join } from 'path';

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const dbPath = join(process.cwd(), 'data', 'order-todo.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables() {
    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT UNIQUE NOT NULL,
        subscription_plan TEXT DEFAULT 'starter',
        status TEXT DEFAULT 'active',
        settings TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add other table creation statements...
    `);
  }

  // Tenant management methods
  createTenant(tenantData: CreateTenantRequest): Tenant {
    const stmt = this.db.prepare(`
      INSERT INTO tenants (id, name, domain, subscription_plan, settings)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const tenantId = crypto.randomUUID();
    stmt.run(tenantId, tenantData.name, tenantData.domain, tenantData.subscriptionPlan, JSON.stringify(tenantData.settings));
    
    return this.getTenant(tenantId);
  }

  getTenant(tenantId: string): Tenant | null {
    const stmt = this.db.prepare('SELECT * FROM tenants WHERE id = ?');
    const result = stmt.get(tenantId) as Tenant | undefined;
    return result || null;
  }

  // Order management methods
  getOrders(tenantId: string, filters?: OrderFilters): Order[] {
    let query = 'SELECT * FROM tenant_orders WHERE tenant_id = ?';
    const params = [tenantId];

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.assignedTo) {
      query += ' AND assigned_to = ?';
      params.push(filters.assignedTo);
    }

    query += ' ORDER BY priority DESC, delivery_date ASC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Order[];
  }

  createOrder(tenantId: string, orderData: CreateOrderRequest): Order {
    const stmt = this.db.prepare(`
      INSERT INTO tenant_orders (id, tenant_id, shopify_order_id, customer_name, delivery_date, status, priority, assigned_to, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const orderId = crypto.randomUUID();
    stmt.run(
      orderId,
      tenantId,
      orderData.shopifyOrderId,
      orderData.customerName,
      orderData.deliveryDate,
      orderData.status || 'pending',
      orderData.priority || 0,
      orderData.assignedTo,
      orderData.notes
    );
    
    return this.getOrder(tenantId, orderId);
  }

  getOrder(tenantId: string, orderId: string): Order | null {
    const stmt = this.db.prepare('SELECT * FROM tenant_orders WHERE tenant_id = ? AND id = ?');
    const result = stmt.get(tenantId, orderId) as Order | undefined;
    return result || null;
  }

  updateOrder(tenantId: string, orderId: string, updates: Partial<Order>): Order | null {
    const order = this.getOrder(tenantId, orderId);
    if (!order) return null;

    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'tenant_id');
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof Order]);

    const stmt = this.db.prepare(`
      UPDATE tenant_orders 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE tenant_id = ? AND id = ?
    `);
    
    stmt.run(...values, tenantId, orderId);
    return this.getOrder(tenantId, orderId);
  }

  deleteOrder(tenantId: string, orderId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM tenant_orders WHERE tenant_id = ? AND id = ?');
    const result = stmt.run(tenantId, orderId);
    return result.changes > 0;
  }
}

// Singleton instance
export const databaseService = new DatabaseService();
```

---

## 🎯 **Step 2: Create Migration Service**

### **1. Install Migration Dependencies**
```bash
pnpm add uuid @types/uuid
```

### **2. Create Migration Service**
```typescript
// src/services/migration.ts
import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './database';
import { getOrders, getProducts, getUsers } from '../utils/storage';

export class MigrationService {
  async createDefaultTenant(): Promise<Tenant> {
    const defaultTenant: CreateTenantRequest = {
      name: 'Default Florist',
      domain: 'default-florist',
      subscriptionPlan: 'starter',
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        businessHours: {
          start: '09:00',
          end: '17:00'
        }
      }
    };

    return databaseService.createTenant(defaultTenant);
  }

  async migrateOrdersToTenant(tenantId: string): Promise<MigrationResult> {
    try {
      const existingOrders = getOrders();
      let migrated = 0;
      let errors = 0;

      for (const order of existingOrders) {
        try {
          const orderData: CreateOrderRequest = {
            shopifyOrderId: order.shopifyOrderId,
            customerName: order.customerName,
            deliveryDate: order.deliveryDate,
            status: order.status,
            priority: order.priority,
            assignedTo: order.assignedTo,
            notes: order.notes
          };

          databaseService.createOrder(tenantId, orderData);
          migrated++;
        } catch (error) {
          console.error(`Failed to migrate order ${order.id}:`, error);
          errors++;
        }
      }

      return {
        success: true,
        migrated,
        errors,
        message: `Migrated ${migrated} orders with ${errors} errors`
      };
    } catch (error) {
      return {
        success: false,
        migrated: 0,
        errors: 1,
        message: `Migration failed: ${error.message}`
      };
    }
  }

  async migrateProductsToTenant(tenantId: string): Promise<MigrationResult> {
    // Similar implementation for products
    return { success: true, migrated: 0, errors: 0, message: 'Products migration not implemented yet' };
  }

  async migrateUsersToTenant(tenantId: string): Promise<MigrationResult> {
    // Similar implementation for users
    return { success: true, migrated: 0, errors: 0, message: 'Users migration not implemented yet' };
  }

  async validateMigration(tenantId: string): Promise<ValidationResult> {
    const tenant = databaseService.getTenant(tenantId);
    if (!tenant) {
      return { valid: false, errors: ['Tenant not found'] };
    }

    const orders = databaseService.getOrders(tenantId);
    const originalOrders = getOrders();

    const errors: string[] = [];
    
    if (orders.length !== originalOrders.length) {
      errors.push(`Order count mismatch: ${orders.length} vs ${originalOrders.length}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      summary: {
        tenant: tenant.name,
        ordersMigrated: orders.length,
        productsMigrated: 0,
        usersMigrated: 0
      }
    };
  }
}

export const migrationService = new MigrationService();
```

---

## 🎯 **Step 3: Update Types**

### **1. Create Multi-Tenant Types**
```typescript
// src/types/multi-tenant.ts
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
```

---

## 🎯 **Step 4: Create Migration Script**

### **1. Create Migration Command**
```typescript
// scripts/migrate-to-multi-tenant.ts
import { migrationService } from '../src/services/migration';

async function runMigration() {
  console.log('🚀 Starting migration to multi-tenant architecture...\n');

  try {
    // Step 1: Create default tenant
    console.log('📋 Creating default tenant...');
    const tenant = await migrationService.createDefaultTenant();
    console.log(`✅ Created tenant: ${tenant.name} (${tenant.id})\n`);

    // Step 2: Migrate orders
    console.log('📦 Migrating orders...');
    const orderResult = await migrationService.migrateOrdersToTenant(tenant.id);
    console.log(`✅ ${orderResult.message}\n`);

    // Step 3: Migrate products
    console.log('🛍️ Migrating products...');
    const productResult = await migrationService.migrateProductsToTenant(tenant.id);
    console.log(`✅ ${productResult.message}\n`);

    // Step 4: Migrate users
    console.log('👥 Migrating users...');
    const userResult = await migrationService.migrateUsersToTenant(tenant.id);
    console.log(`✅ ${userResult.message}\n`);

    // Step 5: Validate migration
    console.log('🔍 Validating migration...');
    const validation = await migrationService.validateMigration(tenant.id);
    
    if (validation.valid) {
      console.log('✅ Migration validation passed!');
      if (validation.summary) {
        console.log('📊 Migration Summary:');
        console.log(`   Tenant: ${validation.summary.tenant}`);
        console.log(`   Orders: ${validation.summary.ordersMigrated}`);
        console.log(`   Products: ${validation.summary.productsMigrated}`);
        console.log(`   Users: ${validation.summary.usersMigrated}`);
      }
    } else {
      console.log('❌ Migration validation failed:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
```

### **2. Add Script to package.json**
```json
{
  "scripts": {
    "migrate:to-multi-tenant": "tsx scripts/migrate-to-multi-tenant.ts",
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## 🎯 **Step 5: Run Migration**

### **1. Install Dependencies**
```bash
pnpm add better-sqlite3 @types/better-sqlite3 uuid @types/uuid tsx
```

### **2. Create Data Directory**
```bash
mkdir -p data
```

### **3. Run Migration**
```bash
pnpm run migrate:to-multi-tenant
```

---

## 🎯 **What's Next?**

After completing this migration:

1. **Week 2**: Implement authentication system
2. **Week 3**: Update data layer with tenant context
3. **Week 4**: Enhance UI components for multi-tenant support

### **Immediate Next Steps:**
1. Install the dependencies above
2. Create the database service files
3. Run the migration script
4. Test that existing functionality still works
5. Begin implementing the authentication system

Would you like me to help you implement any of these steps right now?