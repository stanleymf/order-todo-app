-- Order Card Configuration table (per tenant)
CREATE TABLE IF NOT EXISTS order_card_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  custom_label TEXT,
  custom_options TEXT, -- JSON array for select fields
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, field_id)
);

-- Index for faster queries
CREATE INDEX idx_order_card_configs_tenant_id ON order_card_configs(tenant_id);
CREATE INDEX idx_order_card_configs_display_order ON order_card_configs(display_order); 