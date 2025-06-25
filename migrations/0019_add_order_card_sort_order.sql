-- Migration 0019: Add sort_order to order_card_states table
-- This enables custom ordering of order cards by users

ALTER TABLE order_card_states 
ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Add index for performance when querying ordered cards
CREATE INDEX IF NOT EXISTS idx_order_card_states_sort 
ON order_card_states(tenant_id, delivery_date, sort_order);

-- Update existing records to have incremental sort_order based on creation time
UPDATE order_card_states 
SET sort_order = (
  SELECT COUNT(*) 
  FROM order_card_states AS sub 
  WHERE sub.tenant_id = order_card_states.tenant_id 
    AND sub.delivery_date = order_card_states.delivery_date 
    AND sub.created_at <= order_card_states.created_at
) * 10
WHERE sort_order = 0; 