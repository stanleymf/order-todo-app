// OpenAI Service for DALL-E 3 Integration
export interface OpenAIConfig {
  apiKey: string;
  model: 'dall-e-3';
  size: '1024x1024' | '1792x1024' | '1024x1792';
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
}

export interface GenerationRequest {
  prompt: string;
  style: string;
  size: string;
  occasion: string;
  budget: string;
  flowerTypes: string[];
  colorPalette: string[];
}

export interface GenerationResponse {
  id: string;
  prompt: string;
  generatedImage: string;
  confidence: number;
  designSpecs: any;
  generationTime: number;
  modelVersion: string;
  cost: number;
  status: 'completed' | 'failed' | 'processing';
  error?: string;
}

// Optimized prompt templates for floral arrangements
const createFloralPrompt = (request: GenerationRequest): string => {
  const { prompt, style, size, occasion, flowerTypes, colorPalette } = request;
  
  // Base prompt structure
  let basePrompt = `Create a beautiful ${style} floral bouquet`;
  
  // Add flower types if specified
  if (flowerTypes.length > 0) {
    basePrompt += ` featuring ${flowerTypes.join(', ')}`;
  }
  
  // Add color palette
  if (colorPalette.length > 0) {
    const colors = colorPalette.map(color => color.replace('#', '')).join(', ');
    basePrompt += ` in ${colors} colors`;
  }
  
  // Add size specification
  if (size) {
    basePrompt += `, ${size} size`;
  }
  
  // Add occasion context
  if (occasion) {
    basePrompt += `, perfect for ${occasion}`;
  }
  
  // Add style-specific enhancements
  const styleEnhancements: Record<string, string> = {
    romantic: 'with soft, dreamy lighting and elegant composition',
    modern: 'with clean lines, minimalist design, and contemporary styling',
    rustic: 'with natural, organic arrangement and earthy tones',
    elegant: 'with sophisticated design, premium flowers, and refined presentation',
    wild: 'with natural, garden-style arrangement and vibrant colors'
  };
  
  if (styleEnhancements[style]) {
    basePrompt += `, ${styleEnhancements[style]}`;
  }
  
  // Add technical specifications for better results
  basePrompt += `. Professional floral photography, high resolution, studio lighting, white background, commercial quality, perfect for e-commerce`;
  
  return basePrompt;
};

// Fallback image URLs for different styles
const getFallbackImage = (style: string): string => {
  const fallbackImages: Record<string, string> = {
    romantic: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop',
    modern: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=400&h=600&fit=crop',
    rustic: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop',
    elegant: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=400&h=600&fit=crop',
    wild: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop'
  };
  
  return fallbackImages[style] || fallbackImages.romantic;
};

// Mock OpenAI service for development (replace with real API calls)
export class OpenAIService {
  private config: OpenAIConfig;
  private isMockMode: boolean;

  constructor(config?: Partial<OpenAIConfig>) {
    // Get API key from environment or use empty string for mock mode
    const apiKey = config?.apiKey || (typeof window !== 'undefined' ? (window as any).OPENAI_API_KEY : '') || '';
    
    this.config = {
      apiKey,
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      ...config
    };
    
    // Use mock mode if no API key is provided
    this.isMockMode = !this.config.apiKey;
    
    if (this.isMockMode) {
      console.warn('OpenAI API key not found. Running in mock mode.');
    }
  }

  async generateImage(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = Date.now();
    const prompt = createFloralPrompt(request);
    
    try {
      if (this.isMockMode) {
        // Mock generation for development
        return await this.mockGeneration(request, prompt, startTime);
      } else {
        // Real OpenAI API call
        return await this.realGeneration(request, prompt, startTime);
      }
    } catch (error) {
      console.error('Generation failed:', error);
      return this.createErrorResponse(request, error as Error, startTime);
    }
  }

  private async mockGeneration(
    request: GenerationRequest, 
    prompt: string, 
    startTime: number
  ): Promise<GenerationResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    const generationTime = (Date.now() - startTime) / 1000;
    const fallbackImage = getFallbackImage(request.style);
    
    return {
      id: `mock-${Date.now()}`,
      prompt,
      generatedImage: fallbackImage,
      confidence: 0.85 + Math.random() * 0.1,
      designSpecs: {
        style: request.style,
        colorPalette: request.colorPalette,
        flowerTypes: request.flowerTypes,
        arrangement: 'round',
        size: request.size,
        occasion: request.occasion,
        budget: request.budget
      },
      generationTime,
      modelVersion: 'v1.0-mock',
      cost: 0.00,
      status: 'completed'
    };
  }

  private async realGeneration(
    request: GenerationRequest, 
    prompt: string, 
    startTime: number
  ): Promise<GenerationResponse> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        n: 1,
        size: this.config.size,
        quality: this.config.quality,
        style: this.config.style,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generationTime = (Date.now() - startTime) / 1000;
    
    // Calculate cost (DALL-E 3 pricing: $0.040 per 1024x1024 image)
    const cost = this.config.size === '1024x1024' ? 0.040 : 0.080;

    return {
      id: `dalle-${Date.now()}`,
      prompt,
      generatedImage: data.data[0].url,
      confidence: 0.90 + Math.random() * 0.05, // Higher confidence for real AI
      designSpecs: {
        style: request.style,
        colorPalette: request.colorPalette,
        flowerTypes: request.flowerTypes,
        arrangement: 'round',
        size: request.size,
        occasion: request.occasion,
        budget: request.budget
      },
      generationTime,
      modelVersion: 'v1.0-dalle3',
      cost,
      status: 'completed'
    };
  }

  private createErrorResponse(
    request: GenerationRequest, 
    error: Error, 
    startTime: number
  ): GenerationResponse {
    const generationTime = (Date.now() - startTime) / 1000;
    const fallbackImage = getFallbackImage(request.style);
    
    return {
      id: `error-${Date.now()}`,
      prompt: request.prompt,
      generatedImage: fallbackImage,
      confidence: 0.70, // Lower confidence for fallback
      designSpecs: {
        style: request.style,
        colorPalette: request.colorPalette,
        flowerTypes: request.flowerTypes,
        arrangement: 'round',
        size: request.size,
        occasion: request.occasion,
        budget: request.budget
      },
      generationTime,
      modelVersion: 'v1.0-fallback',
      cost: 0.00,
      status: 'failed',
      error: error.message
    };
  }

  // Get API usage and cost information
  async getUsage(): Promise<any> {
    if (this.isMockMode) {
      return {
        totalRequests: 0,
        totalCost: 0,
        remainingCredits: 'Mock mode'
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/usage', {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get usage:', error);
      return {
        totalRequests: 0,
        totalCost: 0,
        remainingCredits: 'Unknown'
      };
    }
  }
}

// Export singleton instance
export const openAIService = new OpenAIService(); 