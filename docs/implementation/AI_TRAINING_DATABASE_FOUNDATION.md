# AI Training Database Foundation

## Overview
This document details the structure of the AI training database for both local development and D1 production environments. It is updated each time new tables are added.

---

## Core Tables

### 1. tenants
- `id` (TEXT, PK): Unique tenant identifier
- `name` (TEXT): Tenant name
- `domain` (TEXT): Unique domain
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 2. ai_flowers
- `id` (TEXT, PK): Unique flower ID
- `tenant_id` (TEXT, FK): Linked tenant
- `name` (TEXT): Flower name (e.g., "Red Rose")
- `variety` (TEXT): Flower variety (e.g., "Rose")
- `color` (TEXT): Color (e.g., "Red")
- `seasonality` (TEXT): Season
- `availability` (BOOLEAN): In stock
- `price_range` (TEXT): Budget tier
- `description` (TEXT): Description
- `image_url` (TEXT): Image
- `is_active` (BOOLEAN): Active status
- `usage_count` (INTEGER): Usage count
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 3. ai_styles
- `id` (TEXT, PK): Unique style ID
- `tenant_id` (TEXT, FK): Linked tenant
- `name` (TEXT): Style name
- `description` (TEXT): Description
- `color_palette` (TEXT): JSON array of colors
- `mood` (TEXT): Mood (e.g., "Romantic")
- `arrangement_style` (TEXT): Arrangement style
- `flair_elements` (TEXT): JSON array of decorative elements
- `is_active` (BOOLEAN): Active status
- `usage_count` (INTEGER): Usage count
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 4. ai_arrangement_types
- `id` (TEXT, PK): Unique type ID
- `tenant_id` (TEXT, FK): Linked tenant
- `name` (TEXT): Type name (e.g., "Wrapped Bouquet")
- `description` (TEXT): Description
- `category` (TEXT): Category (e.g., "Bouquet")
- `typical_size` (TEXT): Size
- `typical_flowers` (TEXT): JSON array of flowers
- `price_range` (TEXT): Budget tier
- `is_active` (BOOLEAN): Active status
- `usage_count` (INTEGER): Usage count
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 5. ai_occasions
- `id` (TEXT, PK): Unique occasion ID
- `tenant_id` (TEXT, FK): Linked tenant
- `name` (TEXT): Occasion name (e.g., "Wedding")
- `description` (TEXT): Description
- `typical_flowers` (TEXT): JSON array of flowers
- `typical_colors` (TEXT): JSON array of colors
- `seasonal_preferences` (TEXT): JSON object
- `price_sensitivity` (TEXT): Price sensitivity
- `is_active` (BOOLEAN): Active status
- `usage_count` (INTEGER): Usage count
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 6. ai_budget_tiers
- `id` (TEXT, PK): Unique budget tier ID
- `tenant_id` (TEXT, FK): Linked tenant
- `name` (TEXT): Budget tier name (e.g., "Budget")
- `min_price` (REAL): Minimum price
- `max_price` (REAL): Maximum price
- `description` (TEXT): Description
- `typical_flowers` (TEXT): JSON array of flowers
- `typical_arrangements` (TEXT): JSON array of arrangements
- `is_active` (BOOLEAN): Active status
- `usage_count` (INTEGER): Usage count
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 7. ai_customer_data
- `id` (TEXT, PK): Unique customer data ID
- `tenant_id` (TEXT, FK): Linked tenant
- `customer_id` (TEXT): Customer identifier
- `recipient_name` (TEXT): Recipient name
- `birthday` (TEXT): Birthday (YYYY-MM-DD)
- `anniversary` (TEXT): Anniversary (YYYY-MM-DD)
- `special_dates` (TEXT): JSON array of dates
- `preferences` (TEXT): JSON object of preferences
- `allergies` (TEXT): JSON array
- `favorite_flowers` (TEXT): JSON array
- `favorite_colors` (TEXT): JSON array
- `budget_preference` (TEXT): Budget preference
- `is_active` (BOOLEAN): Active status
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

### 8. ai_training_data
- `id` (TEXT, PK): Unique training data ID
- `tenant_id` (TEXT, FK): Linked tenant
- `data_type` (TEXT): Source type (manual, shopify, etc)
- `flowers` (TEXT): JSON array of flower IDs
- `style_id` (TEXT, FK): Style
- `arrangement_type_id` (TEXT, FK): Arrangement type
- `occasion_id` (TEXT, FK): Occasion
- `budget_tier_id` (TEXT, FK): Budget tier
- `customer_data_id` (TEXT, FK): Customer data
- `description` (TEXT): Description
- `image_url` (TEXT): Image
- `prompt` (TEXT): AI prompt
- `quality_score` (REAL): 0.0 to 1.0
- `is_active` (BOOLEAN): Active status
- `created_at` (TEXT): Creation timestamp
- `updated_at` (TEXT): Last update timestamp

---

## Relationships
- All tables are linked to `tenants` for multi-tenancy.
- `ai_training_data` references all other category tables for rich training examples.

---

## Keeping This Document Updated
- Each time a new table is added via migration, update this document with:
  - Table name
  - Column names and types
  - Relationships (FKs)
- Document both local and D1 (Cloudflare) environments if there are differences.

---

## Last Updated
- 2024-06-22

---

*For questions or to update this doc, contact the dev team or your AI assistant.*

## Database Schema

### Core Tables

#### 1. AI Model Configurations (`ai_model_configs`)
Stores configuration settings for different AI models.

```sql
CREATE TABLE ai_model_configs (
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
```

**Purpose**: Configure different AI models (DALL-E 3, GPT-4, custom models) with specific parameters.

#### 2. AI Training Data (`ai_training_data`)
Stores training examples and feedback data.

```sql
CREATE TABLE ai_training_data (
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
```

**Purpose**: Store training examples, prompts, images, and feedback for AI model training.

#### 3. AI Training Sessions (`ai_training_sessions`)
Tracks training progress and sessions.

```sql
CREATE TABLE ai_training_sessions (
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
```

**Purpose**: Track training sessions, progress, and performance metrics.

#### 4. AI Generated Designs (`ai_generated_designs`)
Stores AI-generated floral designs and user feedback.

```sql
CREATE TABLE ai_generated_designs (
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
```

**Purpose**: Store generated designs, user ratings, and feedback for continuous improvement.

### Style and Template Tables

#### 5. AI Style Templates (`ai_style_templates`)
Predefined style configurations for consistent design generation.

```sql
CREATE TABLE ai_style_templates (
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
```

**Default Styles**:
- **Romantic Classic**: Traditional romantic bouquets with roses and soft colors
- **Modern Minimalist**: Clean, contemporary arrangements with bold lines
- **Rustic Natural**: Wild, garden-style arrangements with natural elements
- **Elegant Formal**: Sophisticated arrangements for special occasions
- **Tropical Vibrant**: Bright, exotic arrangements with tropical flowers

#### 6. AI Prompt Templates (`ai_prompt_templates`)
Template prompts for consistent AI generation.

```sql
CREATE TABLE ai_prompt_templates (
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
```

**Default Templates**:
- **Basic Bouquet**: `Create a beautiful {style} bouquet with {flowers} in {colors} colors for {occasion}`
- **Modern Arrangement**: `Design a {style} floral arrangement featuring {flowers} with {colors} color palette in a {container} container`
- **Style Specific**: `Generate a {style} floral design with {flowers} arranged in {arrangement} style using {colors} colors`

### Analytics and Feedback Tables

#### 7. AI Training Feedback (`ai_training_feedback`)
User feedback on generated designs for training improvement.

```sql
CREATE TABLE ai_training_feedback (
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
```

#### 8. AI Usage Analytics (`ai_usage_analytics`)
Track usage, costs, and performance metrics.

```sql
CREATE TABLE ai_usage_analytics (
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
```

## Data Flow

### 1. Training Data Collection
```
Shopify Products → Saved Products → AI Training Data
     ↓
Product Labels → Style Embeddings → Training Examples
     ↓
User Feedback → Quality Scores → Training Improvements
```

### 2. Model Training Process
```
Training Data → Model Configuration → Training Session
     ↓
Progress Tracking → Metrics Collection → Model Updates
     ↓
Generated Designs → User Feedback → Continuous Learning
```

### 3. Design Generation Workflow
```
User Prompt → Style Template → Prompt Template
     ↓
AI Model → Generated Design → Quality Rating
     ↓
User Feedback → Training Data → Model Improvement
```

## Implementation Components

### 1. AI Training Service (`src/services/aiTrainingService.ts`)
Comprehensive service for managing all AI training operations:

- **Model Configuration**: Create, update, and manage AI model settings
- **Training Data Management**: Extract, validate, and manage training examples
- **Training Sessions**: Create and monitor training progress
- **Style Templates**: Manage predefined style configurations
- **Prompt Templates**: Handle template-based prompt generation
- **Analytics**: Track usage, costs, and performance metrics

### 2. AI Training Manager Component (`src/components/AITrainingManager.tsx`)
React component for managing AI training through a user interface:

- **Overview Tab**: Training statistics and quick actions
- **Styles Tab**: Manage style templates and configurations
- **Prompts Tab**: Handle prompt templates and variables
- **Models Tab**: Configure AI models and parameters
- **Analytics Tab**: Monitor performance and usage metrics

### 3. Database Migration (`migrations/0006_add_ai_training_tables.sql`)
Complete database schema with:
- All required tables and relationships
- Default style templates and prompt templates
- Proper indexing for performance
- Data integrity constraints

## Training Data Sources

### 1. Shopify Products
- **Product Titles**: Extract flower types, colors, and styles
- **Product Descriptions**: Identify arrangement types and occasions
- **Product Images**: Reference for style consistency
- **Product Tags**: Categorize by style, difficulty, and type

### 2. User Generated Content
- **Manual Prompts**: User-created prompt examples
- **Design Feedback**: Ratings and comments on generated designs
- **Style Preferences**: User-selected style templates
- **Custom Templates**: User-defined prompt templates

### 3. AI Generated Content
- **Generated Designs**: AI-created floral arrangements
- **Style Variations**: Different interpretations of the same prompt
- **Quality Metrics**: Performance indicators and success rates

## Quality Assurance

### 1. Data Validation
- **Content Quality**: Validate training data quality scores
- **Source Verification**: Ensure data comes from reliable sources
- **Consistency Checks**: Maintain style and prompt consistency
- **Feedback Integration**: Incorporate user feedback for improvement

### 2. Performance Monitoring
- **Generation Success Rate**: Track successful vs failed generations
- **User Satisfaction**: Monitor average ratings and feedback
- **Cost Efficiency**: Track token usage and costs
- **Model Accuracy**: Measure style adherence and quality

### 3. Continuous Improvement
- **Feedback Loop**: Use user feedback to improve training data
- **Style Refinement**: Update style templates based on performance
- **Prompt Optimization**: Refine prompt templates for better results
- **Model Updates**: Retrain models with improved data

## Security and Privacy

### 1. Data Protection
- **Tenant Isolation**: All data is tenant-specific
- **API Key Security**: Keys stored locally, never on servers
- **Access Control**: Role-based access to training features
- **Data Encryption**: Sensitive data encrypted at rest

### 2. Usage Monitoring
- **Cost Tracking**: Monitor API usage and costs
- **Rate Limiting**: Prevent excessive API calls
- **Usage Analytics**: Track feature usage patterns
- **Alert System**: Notify on unusual usage patterns

## Next Steps

### Phase 1: Foundation (Current)
- ✅ Database schema implementation
- ✅ Basic training data management
- ✅ Style and prompt templates
- ✅ API service framework

### Phase 2: Data Collection
- [ ] Extract training data from saved products
- [ ] Implement user feedback collection
- [ ] Create data validation pipeline
- [ ] Build quality scoring system

### Phase 3: Model Training
- [ ] Implement training session management
- [ ] Create model configuration interface
- [ ] Build training progress monitoring
- [ ] Develop model performance analytics

### Phase 4: Advanced Features
- [ ] Style embedding generation
- [ ] Similar style matching
- [ ] Automated prompt optimization
- [ ] Advanced analytics dashboard

### Phase 5: Production Integration
- [ ] Real-time training data updates
- [ ] Automated model retraining
- [ ] Performance optimization
- [ ] Production deployment

## Usage Examples

### 1. Extract Training Data from Products
```typescript
const aiTrainingService = createAITrainingService(tenantId);
const extractedData = await aiTrainingService.extractTrainingDataFromProducts();
console.log(`Extracted ${extractedData.length} training examples`);
```

### 2. Create Style Template
```typescript
const styleTemplate = await aiTrainingService.createStyleTemplate({
  name: "Spring Garden",
  description: "Fresh spring flowers in natural arrangements",
  style_parameters: {
    colors: ["pink", "yellow", "white", "green"],
    flowers: ["tulips", "daffodils", "cherry blossoms", "freesia"],
    style: "natural",
    arrangement: "garden"
  }
});
```

### 3. Generate Design with Template
```typescript
const prompt = await aiTrainingService.renderPromptTemplate(
  'bouquet-basic',
  {
    style: 'romantic',
    flowers: 'roses and peonies',
    colors: 'pink and white',
    occasion: 'wedding'
  }
);
// Result: "Create a beautiful romantic bouquet with roses and peonies in pink and white colors for wedding"
```

## Conclusion

The AI Training Database Foundation provides a robust, scalable system for managing AI training data, model configurations, and analytics. This foundation enables:

- **Systematic Data Collection**: Structured approach to gathering training examples
- **Quality Management**: Comprehensive quality assurance and feedback systems
- **Performance Monitoring**: Detailed analytics and performance tracking
- **Continuous Improvement**: Feedback loops for ongoing model enhancement
- **Scalable Architecture**: Multi-tenant design supporting multiple florists

This system forms the backbone for advanced AI-powered floral design generation, enabling florists to create personalized, high-quality arrangements that match their unique style and customer preferences. 