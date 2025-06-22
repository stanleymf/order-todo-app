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
  hashed_password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'florist',
  permissions TEXT,
  created_at TEXT NOT NULL,
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
  product_label TEXT,
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

-- Table for product labels (e.g., Difficulty, Product Type)
CREATE TABLE product_labels (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('difficulty', 'productType', 'custom')),
    color TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Indexes for faster queries
CREATE INDEX idx_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_stores_tenant_id ON shopify_stores(tenant_id);

-- Saved Products table (for products fetched from Shopify and saved locally)
CREATE TABLE IF NOT EXISTS saved_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  variant_title TEXT,
  description TEXT,
  price REAL NOT NULL,
  tags TEXT, -- JSON array of tags
  product_type TEXT,
  vendor TEXT,
  handle TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, shopify_product_id, shopify_variant_id)
);

-- Product Label Mappings (links saved products to their labels)
CREATE TABLE IF NOT EXISTS product_label_mappings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saved_product_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saved_product_id) REFERENCES saved_products(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES product_labels(id) ON DELETE CASCADE,
  UNIQUE(saved_product_id, label_id)
);

-- Indexes for the new tables
CREATE INDEX idx_saved_products_tenant_id ON saved_products(tenant_id);
CREATE INDEX idx_saved_products_shopify_ids ON saved_products(shopify_product_id, shopify_variant_id);
CREATE INDEX idx_product_label_mappings_product_id ON product_label_mappings(saved_product_id);
CREATE INDEX idx_product_label_mappings_label_id ON product_label_mappings(label_id); 