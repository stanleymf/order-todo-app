-- Create shopify_stores table for multi-tenant Shopify store management
-- Migration: 0009_create_shopify_stores_table.sql
-- Date: 2025-06-23

-- Shopify Stores table for storing store configurations and API credentials
CREATE TABLE IF NOT EXISTS shopify_stores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_domain TEXT NOT NULL,
  access_token TEXT NOT NULL,
  webhook_secret TEXT,
  sync_enabled BOOLEAN DEFAULT 1,
  settings TEXT DEFAULT '{}', -- JSON settings for webhooks, timezone, etc.
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_sync_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shopify_stores_tenant_id ON shopify_stores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_domain ON shopify_stores(shopify_domain);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_sync_enabled ON shopify_stores(sync_enabled);
CREATE INDEX IF NOT EXISTS idx_shopify_stores_created_at ON shopify_stores(created_at);

-- Unique constraint to prevent duplicate stores per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_stores_tenant_domain ON shopify_stores(tenant_id, shopify_domain); 