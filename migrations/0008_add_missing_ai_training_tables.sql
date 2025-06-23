-- Add missing AI training tables to remote database

-- AI Training Data table
CREATE TABLE IF NOT EXISTS ai_training_data (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('prompt', 'image', 'style', 'feedback')),
    content TEXT NOT NULL,
    metadata TEXT, -- JSON
    source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'shopify', 'generated', 'feedback')),
    source_id TEXT,
    quality_score REAL DEFAULT 0.5,
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- AI Training Sessions table
CREATE TABLE IF NOT EXISTS ai_training_sessions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    model_config_id TEXT,
    session_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'training', 'completed', 'failed', 'cancelled')),
    training_data_count INTEGER DEFAULT 0,
    training_progress REAL DEFAULT 0,
    training_metrics TEXT, -- JSON
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (model_config_id) REFERENCES ai_model_configs(id) ON DELETE SET NULL
);

-- AI Generated Designs table
CREATE TABLE IF NOT EXISTS ai_generated_designs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    session_id TEXT,
    prompt TEXT NOT NULL,
    generated_image_url TEXT,
    generated_image_data TEXT, -- Base64 encoded image
    style_parameters TEXT, -- JSON
    generation_metadata TEXT, -- JSON
    quality_rating REAL,
    feedback TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    is_approved BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES ai_training_sessions(id) ON DELETE SET NULL
);

-- AI Style Templates table
CREATE TABLE IF NOT EXISTS ai_style_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    style_parameters TEXT NOT NULL, -- JSON
    example_images TEXT, -- JSON array of URLs
    is_active BOOLEAN DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- AI Prompt Templates table
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    variables TEXT, -- JSON array
    category TEXT DEFAULT 'custom' CHECK (category IN ('bouquet', 'arrangement', 'style', 'occasion', 'custom')),
    is_active BOOLEAN DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- AI Model Configs table
CREATE TABLE IF NOT EXISTS ai_model_configs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    model_type TEXT DEFAULT 'dalle3' CHECK (model_type IN ('dalle3', 'dalle2', 'gpt4', 'custom')),
    config_data TEXT NOT NULL, -- JSON
    is_active BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- AI Usage Analytics table
CREATE TABLE IF NOT EXISTS ai_usage_analytics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    date TEXT NOT NULL,
    model_type TEXT NOT NULL,
    generation_count INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    average_rating REAL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_training_data_tenant_id ON ai_training_data(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_training_data_type ON ai_training_data(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_training_sessions_tenant_id ON ai_training_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_designs_tenant_id ON ai_generated_designs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_style_templates_tenant_id ON ai_style_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_templates_tenant_id ON ai_prompt_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_configs_tenant_id ON ai_model_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_analytics_tenant_id ON ai_usage_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_analytics_date ON ai_usage_analytics(date); 