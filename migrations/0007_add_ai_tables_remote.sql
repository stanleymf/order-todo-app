-- Add AI Training Tables to Remote Database
-- Migration: 0007_add_ai_tables_remote.sql

-- 1. FLOWERS TABLE - Every variety/color documented
CREATE TABLE IF NOT EXISTS ai_flowers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  variety TEXT NOT NULL,
  color TEXT NOT NULL,
  seasonality TEXT,
  availability BOOLEAN DEFAULT true,
  price_range TEXT,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 2. STYLES TABLE - Colors and flair
CREATE TABLE IF NOT EXISTS ai_styles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color_palette TEXT NOT NULL,
  mood TEXT,
  arrangement_style TEXT,
  flair_elements TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 3. TYPES TABLE - Types of arrangements
CREATE TABLE IF NOT EXISTS ai_arrangement_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  typical_size TEXT,
  typical_flowers TEXT,
  price_range TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 4. OCCASIONS TABLE
CREATE TABLE IF NOT EXISTS ai_occasions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  typical_flowers TEXT,
  typical_colors TEXT,
  seasonal_preferences TEXT,
  price_sensitivity TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5. BUDGET TIERS TABLE
CREATE TABLE IF NOT EXISTS ai_budget_tiers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  min_price REAL,
  max_price REAL,
  description TEXT,
  typical_flowers TEXT,
  typical_arrangements TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 6. CUSTOMER DATA TABLE - Recipient information
CREATE TABLE IF NOT EXISTS ai_customer_data (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  recipient_name TEXT,
  birthday TEXT, -- YYYY-MM-DD format
  anniversary TEXT, -- YYYY-MM-DD format
  special_dates TEXT, -- JSON array of special dates
  preferences TEXT, -- JSON object of flower/color preferences
  allergies TEXT, -- JSON array of allergies
  favorite_flowers TEXT, -- JSON array of favorite flowers
  favorite_colors TEXT, -- JSON array of favorite colors
  budget_preference TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default data for testing
INSERT OR IGNORE INTO ai_flowers (id, tenant_id, name, variety, color, seasonality, price_range, description) VALUES 
('rose-red', '84caf0bf-b8a7-448f-9a33-8697cb8d6918', 'Red Rose', 'Rose', 'Red', 'Year-round', 'Mid-range', 'Classic red rose, perfect for romantic occasions'),
('rose-white', '84caf0bf-b8a7-448f-9a33-8697cb8d6918', 'White Rose', 'Rose', 'White', 'Year-round', 'Mid-range', 'Pure white rose, elegant and timeless'),
('peony-pink', '84caf0bf-b8a7-448f-9a33-8697cb8d6918', 'Pink Peony', 'Peony', 'Pink', 'Spring', 'Premium', 'Beautiful pink peony, lush and romantic'),
('tulip-yellow', '84caf0bf-b8a7-448f-9a33-8697cb8d6918', 'Yellow Tulip', 'Tulip', 'Yellow', 'Spring', 'Budget', 'Bright yellow tulip, cheerful and spring-like'); 