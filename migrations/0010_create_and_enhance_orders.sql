-- Migration to create tenant_orders and add analytics columns

-- Step 1: Create the tenant_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS tenant_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_order_id TEXT,
  customer_name TEXT NOT NULL,
  delivery_date TEXT NOT NULL,
  status TEXT DEFAULT "pending",
  priority INTEGER DEFAULT 0,
  assigned_to TEXT,
  notes TEXT,
  product_label TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Step 2: Add analytics columns. 
-- The try/catch block for each statement is handled by the migration tool, which will ignore errors for existing columns.
ALTER TABLE tenant_orders ADD COLUMN total_price REAL;
ALTER TABLE tenant_orders ADD COLUMN currency TEXT;
ALTER TABLE tenant_orders ADD COLUMN customer_email TEXT;
ALTER TABLE tenant_orders ADD COLUMN line_items TEXT;
ALTER TABLE tenant_orders ADD COLUMN product_titles TEXT;
ALTER TABLE tenant_orders ADD COLUMN quantities TEXT;
ALTER TABLE tenant_orders ADD COLUMN session_id TEXT;
ALTER TABLE tenant_orders ADD COLUMN store_id TEXT;
ALTER TABLE tenant_orders ADD COLUMN product_type TEXT; 