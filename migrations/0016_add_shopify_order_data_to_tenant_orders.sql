-- Migration: Add shopify_order_data column to tenant_orders
ALTER TABLE tenant_orders ADD COLUMN shopify_order_data TEXT; 