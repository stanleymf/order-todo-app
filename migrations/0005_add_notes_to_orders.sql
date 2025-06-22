-- Migration: Add notes field to tenant_orders table
-- Date: 2025-01-15
-- Description: Add a notes field to store custom notes for each order

ALTER TABLE tenant_orders ADD COLUMN notes TEXT;

-- Add index for better performance when searching notes
CREATE INDEX idx_tenant_orders_notes ON tenant_orders(notes); 