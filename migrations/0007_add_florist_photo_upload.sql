-- Florist Photo Upload System
-- Migration: 0007_add_florist_photo_upload.sql

-- Florist Photo Uploads table
CREATE TABLE IF NOT EXISTS florist_photo_uploads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  original_file_size INTEGER NOT NULL, -- in bytes
  compressed_file_size INTEGER NOT NULL, -- in bytes
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  image_metadata TEXT, -- JSON metadata (EXIF, GPS, etc.)
  upload_status TEXT NOT NULL DEFAULT 'uploaded' CHECK(upload_status IN ('uploaded', 'processing', 'approved', 'rejected', 'archived')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES tenant_users(id)
);

-- Photo Descriptions table (florist-provided descriptions)
CREATE TABLE IF NOT EXISTS photo_descriptions (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL, -- Short title (e.g., "Wedding Bouquet")
  description TEXT NOT NULL, -- Detailed description
  flowers_used TEXT, -- JSON array of flower types
  colors TEXT, -- JSON array of colors
  style TEXT, -- Style category (romantic, modern, rustic, etc.)
  occasion TEXT, -- Occasion (wedding, birthday, sympathy, etc.)
  arrangement_type TEXT, -- Arrangement type (bouquet, centerpiece, etc.)
  difficulty_level TEXT CHECK(difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  special_techniques TEXT, -- JSON array of techniques used
  materials_used TEXT, -- JSON array of materials (vase, ribbon, etc.)
  customer_preferences TEXT, -- Any customer-specific requirements
  price_range TEXT, -- Price range (budget, mid-range, premium)
  season TEXT, -- Seasonal relevance
  tags TEXT, -- JSON array of custom tags
  is_public BOOLEAN DEFAULT true, -- Whether to use in public training data
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES tenant_users(id)
);

-- Photo Quality Assessment table
CREATE TABLE IF NOT EXISTS photo_quality_assessment (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  assessed_by TEXT NOT NULL, -- user_id of assessor
  technical_quality REAL CHECK(technical_quality >= 0.0 AND technical_quality <= 5.0), -- Image quality (lighting, focus, etc.)
  composition_quality REAL CHECK(composition_quality >= 0.0 AND composition_quality <= 5.0), -- Composition and framing
  design_quality REAL CHECK(design_quality >= 0.0 AND design_quality <= 5.0), -- Floral design quality
  training_value REAL CHECK(training_value >= 0.0 AND training_value <= 5.0), -- Value for AI training
  overall_score REAL CHECK(overall_score >= 0.0 AND overall_score <= 5.0), -- Overall quality score
  quality_notes TEXT, -- Detailed feedback
  improvement_suggestions TEXT, -- Suggestions for better photos
  is_approved_for_training BOOLEAN DEFAULT false,
  assessment_date TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (assessed_by) REFERENCES tenant_users(id)
);

-- Photo Training Data Mapping table
CREATE TABLE IF NOT EXISTS photo_training_mapping (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  training_data_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK(mapping_type IN ('prompt', 'style', 'feedback', 'example')),
  confidence_score REAL DEFAULT 1.0, -- How confident we are in this mapping
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
  FOREIGN KEY (training_data_id) REFERENCES ai_training_data(id) ON DELETE CASCADE
);

-- Daily Upload Goals table
CREATE TABLE IF NOT EXISTS daily_upload_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  target_count INTEGER DEFAULT 1, -- Target photos per day
  actual_count INTEGER DEFAULT 0, -- Actual photos uploaded
  goal_status TEXT DEFAULT 'pending' CHECK(goal_status IN ('pending', 'in_progress', 'completed', 'missed')),
  streak_count INTEGER DEFAULT 0, -- Consecutive days meeting goal
  notes TEXT, -- Any notes about the day's uploads
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES tenant_users(id),
  UNIQUE(tenant_id, user_id, date)
);

-- Upload Statistics table
CREATE TABLE IF NOT EXISTS upload_statistics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD format
  total_uploads INTEGER DEFAULT 0,
  approved_uploads INTEGER DEFAULT 0,
  rejected_uploads INTEGER DEFAULT 0,
  total_file_size INTEGER DEFAULT 0, -- Total compressed file size
  average_quality_score REAL DEFAULT 0.0,
  upload_time_distribution TEXT, -- JSON array of upload times
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES tenant_users(id),
  UNIQUE(tenant_id, user_id, date)
);

-- Indexes for performance
CREATE INDEX idx_florist_photo_uploads_tenant_id ON florist_photo_uploads(tenant_id);
CREATE INDEX idx_florist_photo_uploads_user_id ON florist_photo_uploads(user_id);
CREATE INDEX idx_florist_photo_uploads_status ON florist_photo_uploads(upload_status);
CREATE INDEX idx_florist_photo_uploads_created_at ON florist_photo_uploads(created_at);
CREATE INDEX idx_photo_descriptions_photo_id ON photo_descriptions(photo_id);
CREATE INDEX idx_photo_descriptions_tenant_id ON photo_descriptions(tenant_id);
CREATE INDEX idx_photo_quality_assessment_photo_id ON photo_quality_assessment(photo_id);
CREATE INDEX idx_photo_quality_assessment_tenant_id ON photo_quality_assessment(tenant_id);
CREATE INDEX idx_photo_training_mapping_photo_id ON photo_training_mapping(photo_id);
CREATE INDEX idx_photo_training_mapping_training_data_id ON photo_training_mapping(training_data_id);
CREATE INDEX idx_daily_upload_goals_tenant_user_date ON daily_upload_goals(tenant_id, user_id, date);
CREATE INDEX idx_upload_statistics_tenant_user_date ON upload_statistics(tenant_id, user_id, date);

-- Insert default upload goals
INSERT OR IGNORE INTO daily_upload_goals (id, tenant_id, user_id, date, target_count, goal_status) VALUES 
('default-goal', 'default', 'default', date('now'), 1, 'pending'); 