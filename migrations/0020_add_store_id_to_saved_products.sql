-- Migration: Add store_id to saved_products for store filtering
-- Version: 0020
-- Date: 2025-06-25

-- Create shopify_stores table if it doesn't exist (from migrations that might be missing)
CREATE TABLE IF NOT EXISTS shopify_stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  shopify_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  webhook_secret TEXT,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at DATETIME,
  settings TEXT DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Add store_id column to saved_products table
ALTER TABLE saved_products ADD COLUMN store_id TEXT;

-- Add foreign key constraint (note: SQLite doesn't support adding FK constraints to existing tables)
-- So we'll create an index instead for performance
CREATE INDEX IF NOT EXISTS idx_saved_products_store_id ON saved_products(store_id);

-- Update existing saved_products with the first available store ID
-- This is a best-effort approach for existing data
UPDATE saved_products 
SET store_id = (
  SELECT id 
  FROM shopify_stores 
  WHERE shopify_stores.tenant_id = saved_products.tenant_id 
  LIMIT 1
)
WHERE store_id IS NULL; 