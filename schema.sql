-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  settings TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users table (per tenant)
CREATE TABLE IF NOT EXISTS tenant_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'florist',
  permissions TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Orders table (per tenant)
CREATE TABLE IF NOT EXISTS tenant_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_order_id TEXT,
  customer_name TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Products table (per tenant)
CREATE TABLE IF NOT EXISTS tenant_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_product_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  stock_quantity INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Shopify stores table (per tenant)
CREATE TABLE IF NOT EXISTS shopify_stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  webhook_secret TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
); 