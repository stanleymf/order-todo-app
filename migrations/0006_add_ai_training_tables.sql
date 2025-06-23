-- AI Training Database Foundation
-- Migration: 0006_add_ai_training_tables.sql

-- Add your AI training tables here. Example:
-- CREATE TABLE IF NOT EXISTS ai_model_configs (...);

-- AI Model Configurations table
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK(model_type IN ('dalle3', 'gpt4', 'custom')),
  config_data TEXT NOT NULL, -- JSON configuration
  is_active BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- AI Training Data table (stores training examples)
CREATE TABLE IF NOT EXISTS ai_training_data (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK(data_type IN ('prompt', 'image', 'style', 'feedback')),
  content TEXT NOT NULL, -- JSON or text content
  metadata TEXT, -- Additional metadata as JSON
  source_type TEXT CHECK(source_type IN ('manual', 'shopify', 'generated', 'feedback')),
  source_id TEXT, -- Reference to source (product_id, order_id, etc.)
  quality_score REAL DEFAULT 1.0, -- 0.0 to 1.0 quality rating
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- AI Training Sessions table
CREATE TABLE IF NOT EXISTS ai_training_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  model_config_id TEXT NOT NULL,
  session_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'training', 'completed', 'failed', 'cancelled')),
  training_data_count INTEGER DEFAULT 0,
  training_progress REAL DEFAULT 0.0, -- 0.0 to 1.0
  training_metrics TEXT, -- JSON metrics
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (model_config_id) REFERENCES ai_model_configs(id)
);

-- AI Generated Designs table
CREATE TABLE IF NOT EXISTS ai_generated_designs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  session_id TEXT,
  prompt TEXT NOT NULL,
  generated_image_url TEXT,
  generated_image_data TEXT, -- Base64 or binary data
  style_parameters TEXT, -- JSON style parameters
  generation_metadata TEXT, -- JSON metadata (model used, tokens, cost, etc.)
  quality_rating REAL, -- User rating 0.0 to 5.0
  feedback TEXT, -- User feedback
  is_favorite BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (session_id) REFERENCES ai_training_sessions(id)
);

-- AI Style Templates table
CREATE TABLE IF NOT EXISTS ai_style_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_parameters TEXT NOT NULL, -- JSON style configuration
  example_images TEXT, -- JSON array of image URLs
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- AI Prompt Templates table
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template TEXT NOT NULL, -- Template with placeholders
  variables TEXT, -- JSON array of variable names
  category TEXT CHECK(category IN ('bouquet', 'arrangement', 'style', 'occasion', 'custom')),
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- AI Training Feedback table
CREATE TABLE IF NOT EXISTS ai_training_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  design_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating REAL NOT NULL CHECK(rating >= 0.0 AND rating <= 5.0),
  feedback_type TEXT CHECK(feedback_type IN ('quality', 'style', 'accuracy', 'usefulness')),
  feedback_text TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (design_id) REFERENCES ai_generated_designs(id),
  FOREIGN KEY (user_id) REFERENCES tenant_users(id)
);

-- AI Usage Analytics table
CREATE TABLE IF NOT EXISTS ai_usage_analytics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  model_type TEXT NOT NULL,
  generation_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0.0,
  average_rating REAL DEFAULT 0.0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, date, model_type)
);

-- Indexes for performance
CREATE INDEX idx_ai_model_configs_tenant_id ON ai_model_configs(tenant_id);
CREATE INDEX idx_ai_training_data_tenant_id ON ai_training_data(tenant_id);
CREATE INDEX idx_ai_training_data_type ON ai_training_data(data_type);
CREATE INDEX idx_ai_training_sessions_tenant_id ON ai_training_sessions(tenant_id);
CREATE INDEX idx_ai_training_sessions_status ON ai_training_sessions(status);
CREATE INDEX idx_ai_generated_designs_tenant_id ON ai_generated_designs(tenant_id);
CREATE INDEX idx_ai_generated_designs_session_id ON ai_generated_designs(session_id);
CREATE INDEX idx_ai_style_templates_tenant_id ON ai_style_templates(tenant_id);
CREATE INDEX idx_ai_prompt_templates_tenant_id ON ai_prompt_templates(tenant_id);
CREATE INDEX idx_ai_training_feedback_tenant_id ON ai_training_feedback(tenant_id);
CREATE INDEX idx_ai_training_feedback_design_id ON ai_training_feedback(design_id);
CREATE INDEX idx_ai_usage_analytics_tenant_id ON ai_usage_analytics(tenant_id);
CREATE INDEX idx_ai_usage_analytics_date ON ai_usage_analytics(date);

-- Insert default AI model configuration
INSERT OR IGNORE INTO ai_model_configs (id, tenant_id, name, model_type, config_data, is_active) VALUES 
('default-dalle3', 'default', 'Default DALL-E 3', 'dalle3', '{"model": "dall-e-3", "size": "1024x1024", "quality": "standard", "style": "vivid"}', true);

-- Insert default style templates
INSERT OR IGNORE INTO ai_style_templates (id, tenant_id, name, description, style_parameters, is_active) VALUES 
('romantic-classic', 'default', 'Romantic Classic', 'Traditional romantic bouquets with roses and soft colors', '{"colors": ["pink", "red", "white"], "flowers": ["roses", "peonies", "baby breath"], "style": "romantic", "arrangement": "round"}', true),
('modern-minimalist', 'default', 'Modern Minimalist', 'Clean, contemporary arrangements with bold lines', '{"colors": ["white", "green", "black"], "flowers": ["orchids", "succulents", "monstera"], "style": "modern", "arrangement": "asymmetric"}', true),
('rustic-natural', 'default', 'Rustic Natural', 'Wild, garden-style arrangements with natural elements', '{"colors": ["yellow", "orange", "brown"], "flowers": ["sunflowers", "daisies", "wildflowers"], "style": "rustic", "arrangement": "cascading"}', true),
('elegant-formal', 'default', 'Elegant Formal', 'Sophisticated arrangements for special occasions', '{"colors": ["purple", "white", "silver"], "flowers": ["lilies", "roses", "hydrangeas"], "style": "elegant", "arrangement": "formal"}', true),
('tropical-vibrant', 'default', 'Tropical Vibrant', 'Bright, exotic arrangements with tropical flowers', '{"colors": ["orange", "pink", "yellow"], "flowers": ["birds of paradise", "ginger", "heliconia"], "style": "tropical", "arrangement": "tropical"}', true);

-- Insert default prompt templates
INSERT OR IGNORE INTO ai_prompt_templates (id, tenant_id, name, template, variables, category, is_active) VALUES 
('bouquet-basic', 'default', 'Basic Bouquet', 'Create a beautiful {style} bouquet with {flowers} in {colors} colors for {occasion}', '["style", "flowers", "colors", "occasion"]', 'bouquet', true),
('arrangement-modern', 'default', 'Modern Arrangement', 'Design a {style} floral arrangement featuring {flowers} with {colors} color palette in a {container} container', '["style", "flowers", "colors", "container"]', 'arrangement', true),
('style-specific', 'default', 'Style Specific', 'Generate a {style} floral design with {flowers} arranged in {arrangement} style using {colors} colors', '["style", "flowers", "arrangement", "colors"]', 'style', true);

-- 1. FLOWERS TABLE - Every variety/color documented
CREATE TABLE IF NOT EXISTS ai_flowers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "Red Rose", "White Peony"
  variety TEXT NOT NULL, -- e.g., "Rose", "Peony", "Tulip"
  color TEXT NOT NULL, -- e.g., "Red", "White", "Pink"
  seasonality TEXT, -- e.g., "Spring", "Year-round", "Summer"
  availability BOOLEAN DEFAULT true,
  price_range TEXT, -- e.g., "Budget", "Mid-range", "Premium"
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 2. STYLES TABLE - Colors and flair
CREATE TABLE IF NOT EXISTS ai_styles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "Romantic Classic", "Modern Minimalist"
  description TEXT,
  color_palette TEXT NOT NULL, -- JSON array of colors
  mood TEXT, -- e.g., "Romantic", "Elegant", "Playful"
  arrangement_style TEXT, -- e.g., "Round", "Cascading", "Asymmetric"
  flair_elements TEXT, -- JSON array of decorative elements
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 3. TYPES TABLE - Types of arrangements
CREATE TABLE IF NOT EXISTS ai_arrangement_types (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "Wrapped Bouquet", "Bridal Bouquet", "Vase Arrangement"
  description TEXT,
  category TEXT NOT NULL, -- e.g., "Bouquet", "Centerpiece", "Arrangement"
  typical_size TEXT, -- e.g., "Small", "Medium", "Large"
  typical_flowers TEXT, -- JSON array of common flowers
  price_range TEXT, -- e.g., "Budget", "Mid-range", "Premium"
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 4. OCCASIONS TABLE
CREATE TABLE IF NOT EXISTS ai_occasions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "Wedding", "Birthday", "Anniversary"
  description TEXT,
  typical_flowers TEXT, -- JSON array of flowers commonly used
  typical_colors TEXT, -- JSON array of colors commonly used
  seasonal_preferences TEXT, -- JSON object of seasonal preferences
  price_sensitivity TEXT, -- e.g., "Low", "Medium", "High"
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 5. BUDGET TIERS TABLE
CREATE TABLE IF NOT EXISTS ai_budget_tiers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL, -- e.g., "Budget", "Mid-range", "Premium", "Luxury"
  min_price REAL,
  max_price REAL,
  description TEXT,
  typical_flowers TEXT, -- JSON array of flowers in this price range
  typical_arrangements TEXT, -- JSON array of arrangement types
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- 7. TRAINING DATA TABLE - Combined training examples
CREATE TABLE IF NOT EXISTS ai_training_data (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK(data_type IN ('manual', 'shopify', 'generated', 'feedback')),
  flowers TEXT, -- JSON array of flower IDs
  style_id TEXT,
  arrangement_type_id TEXT,
  occasion_id TEXT,
  budget_tier_id TEXT,
  customer_data_id TEXT,
  description TEXT,
  image_url TEXT,
  prompt TEXT, -- Generated prompt for AI training
  quality_score REAL DEFAULT 1.0, -- 0.0 to 1.0
  is_active BOOLEAN DEFAULT true,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (style_id) REFERENCES ai_styles(id),
  FOREIGN KEY (arrangement_type_id) REFERENCES ai_arrangement_types(id),
  FOREIGN KEY (occasion_id) REFERENCES ai_occasions(id),
  FOREIGN KEY (budget_tier_id) REFERENCES ai_budget_tiers(id),
  FOREIGN KEY (customer_data_id) REFERENCES ai_customer_data(id)
);

-- Insert default data for testing
INSERT OR IGNORE INTO ai_flowers (id, tenant_id, name, variety, color, seasonality, price_range, description) VALUES 
('rose-red', 'default', 'Red Rose', 'Rose', 'Red', 'Year-round', 'Mid-range', 'Classic red rose, perfect for romantic occasions'),
('rose-white', 'default', 'White Rose', 'Rose', 'White', 'Year-round', 'Mid-range', 'Pure white rose, elegant and timeless'),
('peony-pink', 'default', 'Pink Peony', 'Peony', 'Pink', 'Spring', 'Premium', 'Beautiful pink peony, lush and romantic'),
('tulip-yellow', 'default', 'Yellow Tulip', 'Tulip', 'Yellow', 'Spring', 'Budget', 'Bright yellow tulip, cheerful and spring-like');

INSERT OR IGNORE INTO ai_styles (id, tenant_id, name, description, color_palette, mood, arrangement_style) VALUES 
('romantic-classic', 'default', 'Romantic Classic', 'Traditional romantic style with soft colors', '["pink", "red", "white"]', 'Romantic', 'Round'),
('modern-minimalist', 'default', 'Modern Minimalist', 'Clean contemporary style with bold lines', '["white", "green", "black"]', 'Modern', 'Asymmetric'),
('rustic-natural', 'default', 'Rustic Natural', 'Wild garden-style with natural elements', '["yellow", "orange", "brown"]', 'Rustic', 'Cascading');

INSERT OR IGNORE INTO ai_arrangement_types (id, tenant_id, name, description, category, typical_size, typical_flowers) VALUES 
('wrapped-bouquet', 'default', 'Wrapped Bouquet', 'Hand-tied bouquet wrapped in paper or ribbon', 'Bouquet', 'Medium', '["rose-red", "rose-white"]'),
('bridal-bouquet', 'default', 'Bridal Bouquet', 'Elegant bouquet for brides', 'Bouquet', 'Large', '["peony-pink", "rose-white"]'),
('vase-arrangement', 'default', 'Vase Arrangement', 'Flowers arranged in a vase', 'Arrangement', 'Medium', '["tulip-yellow", "rose-red"]');

INSERT OR IGNORE INTO ai_occasions (id, tenant_id, name, description, typical_flowers, typical_colors) VALUES 
('wedding', 'default', 'Wedding', 'Elegant arrangements for wedding celebrations', '["peony-pink", "rose-white"]', '["white", "pink", "ivory"]'),
('birthday', 'default', 'Birthday', 'Colorful and cheerful birthday arrangements', '["tulip-yellow", "rose-red"]', '["yellow", "pink", "orange"]'),
('anniversary', 'default', 'Anniversary', 'Romantic arrangements for anniversaries', '["rose-red", "rose-white"]', '["red", "pink", "white"]');

INSERT OR IGNORE INTO ai_budget_tiers (id, tenant_id, name, min_price, max_price, description) VALUES 
('budget', 'default', 'Budget', 0, 50, 'Affordable arrangements for everyday occasions'),
('mid-range', 'default', 'Mid-range', 50, 150, 'Quality arrangements for special occasions'),
('premium', 'default', 'Premium', 150, 300, 'Luxury arrangements for very special occasions'),
('luxury', 'default', 'Luxury', 300, 1000, 'Ultra-premium arrangements for exclusive events'); 