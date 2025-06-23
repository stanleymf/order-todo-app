// AI Training Service
// Handles training data management, model configuration, and analytics

import {
  getAIModelConfigs,
  createAIModelConfig,
  updateAIModelConfig,
  getAITrainingData,
  createAITrainingData,
  extractAITrainingDataFromProducts,
  getAITrainingDataStats,
  getAITrainingSessions,
  createAITrainingSession,
  getAIGeneratedDesigns,
  saveAIGeneratedDesign,
  getAIStyleTemplates,
  createAIStyleTemplate,
  getAIPromptTemplates,
  createAIPromptTemplate,
  getAIUsageAnalytics,
  recordAIGeneration,
  getFlowers,
  createFlower,
  deleteFlower
} from './api';

export interface AIModelConfig {
  id: string;
  tenant_id: string;
  name: string;
  model_type: 'dalle3' | 'gpt4' | 'custom';
  config_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AITrainingData {
  id: string;
  tenant_id: string;
  data_type: 'prompt' | 'image' | 'style' | 'feedback';
  content: string;
  metadata?: Record<string, any>;
  source_type?: 'manual' | 'shopify' | 'generated' | 'feedback';
  source_id?: string;
  quality_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AITrainingSession {
  id: string;
  tenant_id: string;
  model_config_id: string;
  session_name: string;
  status: 'pending' | 'training' | 'completed' | 'failed' | 'cancelled';
  training_data_count: number;
  training_progress: number;
  training_metrics?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AIGeneratedDesign {
  id: string;
  tenant_id: string;
  session_id?: string;
  prompt: string;
  generated_image_url?: string;
  generated_image_data?: string;
  style_parameters?: Record<string, any>;
  generation_metadata?: Record<string, any>;
  quality_rating?: number;
  feedback?: string;
  is_favorite: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIStyleTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  style_parameters: Record<string, any>;
  example_images?: string[];
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIPromptTemplate {
  id: string;
  tenant_id: string;
  name: string;
  template: string;
  variables?: string[];
  category: 'bouquet' | 'arrangement' | 'style' | 'occasion' | 'custom';
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface AIUsageAnalytics {
  id: string;
  tenant_id: string;
  date: string;
  model_type: string;
  generation_count: number;
  total_tokens: number;
  total_cost: number;
  average_rating: number;
  created_at: string;
}

export interface TrainingDataStats {
  total_products: number;
  total_prompts: number;
  total_images: number;
  total_feedback: number;
  quality_distribution: Record<string, number>;
  source_distribution: Record<string, number>;
}

export interface StyleEmbedding {
  style_name: string;
  colors: string[];
  flowers: string[];
  arrangement_type: string;
  mood: string;
  embedding: number[];
}

class AITrainingService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ===== MODEL CONFIGURATION =====

  async getModelConfigs(): Promise<AIModelConfig[]> {
    return await getAIModelConfigs(this.tenantId);
  }

  async createModelConfig(config: Omit<AIModelConfig, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AIModelConfig> {
    return await createAIModelConfig(this.tenantId, config);
  }

  async updateModelConfig(id: string, config: Partial<AIModelConfig>): Promise<AIModelConfig> {
    return await updateAIModelConfig(this.tenantId, id, config);
  }

  async setActiveModelConfig(id: string): Promise<void> {
    // This would need to be implemented in the backend
    await updateAIModelConfig(this.tenantId, id, { is_active: true });
  }

  // ===== TRAINING DATA MANAGEMENT =====

  async getTrainingData(filters?: {
    data_type?: string;
    source_type?: string;
    is_active?: boolean;
  }): Promise<AITrainingData[]> {
    return await getAITrainingData(this.tenantId, filters);
  }

  async createTrainingData(data: Omit<AITrainingData, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AITrainingData> {
    return await createAITrainingData(this.tenantId, data);
  }

  async extractTrainingDataFromProducts(): Promise<AITrainingData[]> {
    return await extractAITrainingDataFromProducts(this.tenantId);
  }

  async getTrainingDataStats(): Promise<TrainingDataStats> {
    return await getAITrainingDataStats(this.tenantId);
  }

  // ===== TRAINING SESSIONS =====

  async getTrainingSessions(): Promise<AITrainingSession[]> {
    return await getAITrainingSessions(this.tenantId);
  }

  async createTrainingSession(session: Omit<AITrainingSession, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AITrainingSession> {
    return await createAITrainingSession(this.tenantId, session);
  }

  async startTrainingSession(sessionId: string): Promise<void> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async getTrainingProgress(sessionId: string): Promise<AITrainingSession> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  // ===== GENERATED DESIGNS =====

  async getGeneratedDesigns(filters?: {
    session_id?: string;
    is_favorite?: boolean;
    is_approved?: boolean;
  }): Promise<AIGeneratedDesign[]> {
    return await getAIGeneratedDesigns(this.tenantId, filters);
  }

  async saveGeneratedDesign(design: Omit<AIGeneratedDesign, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AIGeneratedDesign> {
    return await saveAIGeneratedDesign(this.tenantId, design);
  }

  async updateDesignRating(designId: string, rating: number, feedback?: string): Promise<void> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async toggleDesignFavorite(designId: string): Promise<void> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  // ===== STYLE TEMPLATES =====

  async getStyleTemplates(): Promise<AIStyleTemplate[]> {
    return await getAIStyleTemplates(this.tenantId);
  }

  async createStyleTemplate(template: Omit<AIStyleTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AIStyleTemplate> {
    return await createAIStyleTemplate(this.tenantId, template);
  }

  async updateStyleTemplate(id: string, template: Partial<AIStyleTemplate>): Promise<AIStyleTemplate> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  // ===== PROMPT TEMPLATES =====

  async getPromptTemplates(category?: string): Promise<AIPromptTemplate[]> {
    return await getAIPromptTemplates(this.tenantId, category);
  }

  async createPromptTemplate(template: Omit<AIPromptTemplate, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>): Promise<AIPromptTemplate> {
    return await createAIPromptTemplate(this.tenantId, template);
  }

  async renderPromptTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  // ===== ANALYTICS =====

  async getUsageAnalytics(dateRange?: { start: string; end: string }): Promise<AIUsageAnalytics[]> {
    return await getAIUsageAnalytics(this.tenantId, dateRange);
  }

  async recordGeneration(metadata: {
    model_type: string;
    tokens_used: number;
    cost: number;
    rating?: number;
  }): Promise<void> {
    return await recordAIGeneration(this.tenantId, metadata);
  }

  // ===== STYLE EMBEDDINGS =====

  async generateStyleEmbeddings(): Promise<StyleEmbedding[]> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async findSimilarStyles(style: Partial<StyleEmbedding>, limit: number = 5): Promise<StyleEmbedding[]> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  // ===== UTILITY METHODS =====

  async generateTrainingPromptsFromProducts(): Promise<string[]> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async validateTrainingData(): Promise<{
    valid_count: number;
    invalid_count: number;
    issues: string[];
  }> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async exportTrainingData(format: 'json' | 'csv' = 'json'): Promise<string> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async importTrainingData(data: AITrainingData[], overwrite: boolean = false): Promise<{
    imported_count: number;
    skipped_count: number;
    errors: string[];
  }> {
    // This would need to be implemented in the backend
    throw new Error('Not implemented yet');
  }

  async getFlowers(): Promise<any[]> {
    return await getFlowers(this.tenantId);
  }

  async createFlower(flower: any): Promise<any> {
    return await createFlower(this.tenantId, flower);
  }

  async deleteFlower(flowerId: string): Promise<void> {
    return await deleteFlower(this.tenantId, flowerId);
  }
}

// Factory function to create service instance
export const createAITrainingService = (tenantId: string): AITrainingService => {
  return new AITrainingService(tenantId);
};

// Default export for convenience
export default AITrainingService;
