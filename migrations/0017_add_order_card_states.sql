-- Migration: Add order card states table for persistent assignments and notes
-- This table stores the status and notes for each individual order card (line item)

CREATE TABLE IF NOT EXISTS order_card_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    card_id TEXT NOT NULL, -- Unique identifier for each card (shopify_order_id-line_item_id-quantity_index)
    delivery_date TEXT NOT NULL, -- Format: DD/MM/YYYY
    status TEXT NOT NULL DEFAULT 'unassigned', -- 'unassigned', 'assigned', 'completed'
    assigned_to TEXT, -- User ID or name who is assigned
    assigned_by TEXT, -- User ID who made the assignment
    notes TEXT, -- Admin notes for this specific card
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one state record per card per tenant
    UNIQUE(tenant_id, card_id),
    
    -- Foreign key constraint (optional, depends on tenant table structure)
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_order_card_states_tenant_date ON order_card_states(tenant_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_order_card_states_card_id ON order_card_states(card_id);
CREATE INDEX IF NOT EXISTS idx_order_card_states_status ON order_card_states(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_card_states_updated ON order_card_states(updated_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_order_card_states_timestamp 
    AFTER UPDATE ON order_card_states
BEGIN
    UPDATE order_card_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END; 