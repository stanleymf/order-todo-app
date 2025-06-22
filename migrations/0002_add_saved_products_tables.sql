-- Migration: Add saved products tables for product sync workflow
-- Date: 2024-01-13

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