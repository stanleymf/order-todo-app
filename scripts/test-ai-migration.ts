import { D1Database } from '@cloudflare/workers-types';

// This script tests the AI training database migration
async function testAIMigration() {
  console.log('Testing AI Training Database Migration...');
  
  // Read the migration file
  const migrationSQL = `
-- AI Training Database Foundation
-- Migration: 0006_add_ai_training_tables.sql

-- AI Model Configurations table
CREATE TABLE IF NOT EXISTS ai_model_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK(model_type IN ('dalle3', 'gpt4', 'custom')),
  config_data TEXT NOT NULL, -- JSON configuration
  is_active BOOLEAN DEFAULT false,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default style templates
INSERT OR IGNORE INTO ai_style_templates (id, tenant_id, name, description, style_parameters, is_active) VALUES 
('romantic-classic', 'default', 'Romantic Classic', 'Traditional romantic bouquets with roses and soft colors', '{"colors": ["pink", "red", "white"], "flowers": ["roses", "peonies", "baby breath"], "style": "romantic", "arrangement": "round"}', true),
('modern-minimalist', 'default', 'Modern Minimalist', 'Clean, contemporary arrangements with bold lines', '{"colors": ["white", "green", "black"], "flowers": ["orchids", "succulents", "monstera"], "style": "modern", "arrangement": "asymmetric"}', true),
('rustic-natural', 'default', 'Rustic Natural', 'Wild, garden-style arrangements with natural elements', '{"colors": ["yellow", "orange", "brown"], "flowers": ["sunflowers", "daisies", "wildflowers"], "style": "rustic", "arrangement": "cascading"}', true);

-- Insert default prompt templates
INSERT OR IGNORE INTO ai_prompt_templates (id, tenant_id, name, template, variables, category, is_active) VALUES 
('bouquet-basic', 'default', 'Basic Bouquet', 'Create a beautiful {style} bouquet with {flowers} in {colors} colors for {occasion}', '["style", "flowers", "colors", "occasion"]', 'bouquet', true),
('arrangement-modern', 'default', 'Modern Arrangement', 'Design a {style} floral arrangement featuring {flowers} with {colors} color palette in a {container} container', '["style", "flowers", "colors", "container"]', 'arrangement', true);
`;

  console.log('Migration SQL prepared successfully');
  console.log('Tables to be created:');
  console.log('- ai_model_configs');
  console.log('- ai_training_data');
  console.log('- ai_style_templates');
  console.log('- ai_prompt_templates');
  console.log('');
  console.log('Default data to be inserted:');
  console.log('- 3 style templates (romantic-classic, modern-minimalist, rustic-natural)');
  console.log('- 2 prompt templates (bouquet-basic, arrangement-modern)');
  console.log('');
  console.log('To run this migration, use:');
  console.log('npx wrangler d1 execute order-todo-db --file=migrations/0006_add_ai_training_tables.sql --remote');
  console.log('');
  console.log('Or manually execute the SQL in your D1 database console.');
}

testAIMigration().catch(console.error); 