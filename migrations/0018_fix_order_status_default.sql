-- Migration: Fix default status value in tenant_orders table
-- Change default from "pending" to "unassigned" to match order_card_states table

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- Since the database is currently empty, this is safe to do

-- 1. Create new table with correct schema
CREATE TABLE tenant_orders_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_order_id TEXT,
  customer_name TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT "unassigned",  -- Changed from "pending" to "unassigned"
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  notes TEXT,
  product_label TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, 
  total_price REAL, 
  currency TEXT, 
  customer_email TEXT, 
  line_items TEXT, 
  product_titles TEXT, 
  quantities TEXT, 
  session_id TEXT, 
  store_id TEXT, 
  product_type TEXT, 
  shopify_order_data TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 2. Copy data from old table (if any exists)
INSERT INTO tenant_orders_new 
SELECT 
  id, tenant_id, shopify_order_id, customer_name, delivery_date,
  CASE 
    WHEN status = 'pending' THEN 'unassigned'
    ELSE COALESCE(status, 'unassigned')
  END as status,
  priority, assigned_to, notes, product_label, created_at, updated_at,
  total_price, currency, customer_email, line_items, product_titles,
  quantities, session_id, store_id, product_type, shopify_order_data
FROM tenant_orders;

-- 3. Drop old table and rename new one
DROP TABLE tenant_orders;
ALTER TABLE tenant_orders_new RENAME TO tenant_orders;

-- 4. Recreate any indexes that might have existed
-- (Add indexes here if needed in the future) 