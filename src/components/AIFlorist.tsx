import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, Sparkles, Palette, Flower, ShoppingCart, Brain, Database, Settings, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSavedProducts, createSampleProducts, generateAIDesign } from '../services/api';

interface BouquetDesign {
  id: string;
  prompt: string;
  generatedImage: string;
  designSpecs: DesignSpecifications;
  status: 'completed' | 'failed' | 'processing';
  confidence: number;
  modelVersion: string;
  generationTime: number;
  cost: number;
  error?: string;
}

interface DesignSpecifications {
  style: string;
  colorPalette: string[];
  flowerTypes: string[];
  arrangement: string;
  size: string;
  occasion: string;
  budget: string;
}

interface TrainingStats {
  totalProducts: number;
  trainedStyles: string[];
  promptTemplates: number;
  lastTrained: string;
  confidence: number;
}

const AIFlorist: React.FC = () => {
  const { user, tenant } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('romantic');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOccasion, setSelectedOccasion] = useState('wedding');
  const [selectedBudget, setSelectedBudget] = useState('mid-range');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<BouquetDesign | null>(null);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [savedProducts, setSavedProducts] = useState<any[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySet, setIsApiKeySet] = useState(false);

  const styles = [
    { value: 'romantic', label: 'Romantic', description: 'Soft, dreamy, and intimate' },
    { value: 'modern', label: 'Modern', description: 'Clean, minimalist, and contemporary' },
    { value: 'rustic', label: 'Rustic', description: 'Natural, earthy, and charming' },
    { value: 'elegant', label: 'Elegant', description: 'Sophisticated and refined' },
    { value: 'wild', label: 'Wild', description: 'Free-flowing and natural' },
  ];

  const sizes = [
    { value: 'small', label: 'Small', description: 'Perfect for intimate occasions' },
    { value: 'medium', label: 'Medium', description: 'Great for birthdays and celebrations' },
    { value: 'large', label: 'Large', description: 'Ideal for weddings and events' },
    { value: 'extra-large', label: 'Extra Large', description: 'Statement pieces for special moments' },
  ];

  const occasions = [
    { value: 'wedding', label: 'Wedding', description: 'Bridal bouquets and ceremony flowers' },
    { value: 'birthday', label: 'Birthday', description: 'Celebratory and vibrant arrangements' },
    { value: 'anniversary', label: 'Anniversary', description: 'Romantic and meaningful designs' },
    { value: 'sympathy', label: 'Sympathy', description: 'Respectful and comforting arrangements' },
    { value: 'celebration', label: 'Celebration', description: 'Joyful and festive designs' },
  ];

  const budgets = [
    { value: 'budget', label: 'Budget', description: 'Beautiful designs under $50' },
    { value: 'mid-range', label: 'Mid-Range', description: 'Quality arrangements $50-$100' },
    { value: 'premium', label: 'Premium', description: 'Luxury designs $100-$200' },
    { value: 'luxury', label: 'Luxury', description: 'Exclusive pieces $200+' },
  ];

  // Load saved products for training
  useEffect(() => {
    if (tenant?.id) {
      loadSavedProducts();
    }
  }, [tenant?.id]);

  const loadSavedProducts = async () => {
    try {
      const products = await getSavedProducts(tenant!.id);
      setSavedProducts(products);
      
      // Calculate training stats
      const stats: TrainingStats = {
        totalProducts: products.length,
        trainedStyles: extractTrainedStyles(products),
        promptTemplates: generatePromptTemplates(products).length,
        lastTrained: new Date().toISOString(),
        confidence: calculateConfidence(products)
      };
      setTrainingStats(stats);
    } catch (error) {
      console.error('Failed to load saved products:', error);
    }
  };

  const handleCreateSampleProducts = async () => {
    if (!tenant?.id) return;
    
    try {
      await createSampleProducts(tenant.id);
      await loadSavedProducts(); // Reload products after creating samples
    } catch (error) {
      console.error('Failed to create sample products:', error);
    }
  };

  const extractTrainedStyles = (products: any[]): string[] => {
    const styleKeywords = ['romantic', 'modern', 'rustic', 'elegant', 'wild'];
    const foundStyles: string[] = [];
    
    for (const product of products) {
      const text = `${product.title} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
      for (const style of styleKeywords) {
        if (text.includes(style) && !foundStyles.includes(style)) {
          foundStyles.push(style);
        }
      }
    }
    
    return foundStyles;
  };

  const generatePromptTemplates = (products: any[]): any[] => {
    const templates = [];
    
    for (const product of products) {
      const words = product.title.toLowerCase().split(' ');
      const flowers = words.filter((word: string) => 
        ['rose', 'tulip', 'lily', 'peony', 'daisy', 'orchid', 'sunflower'].includes(word)
      );
      const occasions = words.filter((word: string) => 
        ['wedding', 'birthday', 'anniversary', 'sympathy', 'celebration'].includes(word)
      );
      
      if (flowers.length > 0 || occasions.length > 0) {
        templates.push({
          input: `Create a bouquet with ${flowers.join(', ')} for ${occasions.join(', ')}`,
          output: product.title,
          confidence: 0.8
        });
      }
    }
    
    return templates;
  };

  const calculateConfidence = (products: any[]): number => {
    if (products.length === 0) return 0;
    
    const hasImages = products.filter(p => p.imageUrl).length;
    const hasDescriptions = products.filter(p => p.description).length;
    const hasTags = products.filter(p => p.tags && p.tags.length > 0).length;
    
    const imageScore = hasImages / products.length;
    const descriptionScore = hasDescriptions / products.length;
    const tagScore = hasTags / products.length;
    
    return Math.min(0.95, (imageScore + descriptionScore + tagScore) / 3 + 0.3);
  };

  const findSimilarProduct = (prompt: string, savedProducts: any[]): any | null => {
    if (savedProducts.length === 0) return null;
    
    const promptLower = prompt.toLowerCase();
    let bestMatch = savedProducts[0];
    let bestScore = 0;
    
    for (const product of savedProducts) {
      let score = 0;
      const productText = `${product.title} ${product.description || ''} ${(product.tags || []).join(' ')}`.toLowerCase();
      
      // Score based on word overlap
      const promptWords = promptLower.split(/\s+/);
      const productWords = productText.split(/\s+/);
      
      for (const word of promptWords) {
        if (productWords.includes(word)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }
    
    return bestMatch;
  };

  const generateDesignSpecs = (prompt: string, similarProduct: any): DesignSpecifications => {
    const promptLower = prompt.toLowerCase();
    
    // Extract style
    const styles: Array<'romantic' | 'modern' | 'rustic' | 'elegant' | 'wild'> = ['romantic', 'modern', 'rustic', 'elegant', 'wild'];
    const style = styles.find(s => promptLower.includes(s)) || selectedStyle as any || 'romantic';
    
    // Extract flowers
    const flowerKeywords = ['rose', 'tulip', 'lily', 'peony', 'daisy', 'orchid', 'sunflower'];
    const flowerTypes = flowerKeywords.filter(flower => promptLower.includes(flower));
    
    // Extract size
    const sizes: Array<'small' | 'medium' | 'large' | 'extra-large'> = ['small', 'medium', 'large', 'extra-large'];
    const size = sizes.find(s => promptLower.includes(s)) || selectedSize as any || 'medium';
    
    // Extract occasion
    const occasions: Array<'wedding' | 'birthday' | 'anniversary' | 'sympathy' | 'celebration'> = ['wedding', 'birthday', 'anniversary', 'sympathy', 'celebration'];
    const occasion = occasions.find(o => promptLower.includes(o)) || selectedOccasion as any || 'celebration';
    
    // Extract budget
    const budgets: Array<'budget' | 'mid-range' | 'premium' | 'luxury'> = ['budget', 'mid-range', 'premium', 'luxury'];
    const budget = budgets.find(b => promptLower.includes(b)) || selectedBudget as any || 'mid-range';
    
    // Generate color palette based on style
    const colorPalettes: Record<string, string[]> = {
      romantic: ['#FF6B6B', '#FFE5E5', '#FFB3B3'],
      modern: ['#4A90E2', '#F5F5F5', '#2C3E50'],
      rustic: ['#8B4513', '#DEB887', '#F4A460'],
      elegant: ['#2C3E50', '#ECF0F1', '#BDC3C7'],
      wild: ['#FF6B6B', '#4ECDC4', '#45B7D1']
    };
    
    return {
      style,
      colorPalette: colorPalettes[style],
      flowerTypes: flowerTypes.length > 0 ? flowerTypes : ['Roses', 'Peonies'],
      arrangement: 'round',
      size,
      occasion,
      budget
    };
  };

  const handleGenerateDesign = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentDesign(null);
    
    try {
      const similarProduct = findSimilarProduct(prompt, savedProducts);
      const designSpecs = generateDesignSpecs(prompt, similarProduct);
      
      // Create generation request
      const generationRequest = {
        prompt,
        style: designSpecs.style,
        size: designSpecs.size,
        occasion: designSpecs.occasion,
        budget: designSpecs.budget,
        flowerTypes: designSpecs.flowerTypes,
        colorPalette: designSpecs.colorPalette
      };

      // Generate with backend API
      const result = await generateAIDesign(tenant!.id, generationRequest);
      
      setCurrentDesign({
        id: result.id,
        prompt: result.prompt,
        generatedImage: result.generatedImage,
        designSpecs: result.designSpecs,
        status: result.status,
        confidence: result.confidence,
        modelVersion: result.modelVersion,
        generationTime: result.generationTime,
        cost: result.cost,
        error: result.error
      });
    } catch (error) {
      console.error('Generation failed:', error);
      setCurrentDesign({
        id: `error-${Date.now()}`,
        prompt,
        generatedImage: 'https://via.placeholder.com/400x600/FFE5E5/FF6B6B?text=Generation+Failed',
        designSpecs: {
          style: 'romantic',
          colorPalette: ['#FF6B6B', '#FFE5E5', '#FFB3B3'],
          flowerTypes: ['Roses'],
          arrangement: 'round',
          size: 'medium',
          occasion: 'celebration',
          budget: 'mid-range'
        },
        status: 'failed',
        confidence: 0.5,
        modelVersion: 'v1.0-error',
        generationTime: 0,
        cost: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePurchase = () => {
    // TODO: Integrate with Shopify
    console.log('Purchase design:', currentDesign?.id);
  };

  const handleRefine = () => {
    // TODO: Implement refinement logic
    console.log('Refine design:', currentDesign?.id);
  };

  // Set API key for real AI generation
  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      // Store API key in localStorage for demo purposes
      localStorage.setItem('OPENAI_API_KEY', apiKey);
      (window as any).OPENAI_API_KEY = apiKey;
      setIsApiKeySet(true);
      setApiKey('');
    }
  };

  // Load API key on component mount
  useEffect(() => {
    const storedKey = localStorage.getItem('OPENAI_API_KEY');
    if (storedKey) {
      (window as any).OPENAI_API_KEY = storedKey;
      setIsApiKeySet(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="h-8 w-8 text-pink-500" />
            <h1 className="text-4xl font-bold text-gray-900">AI Florist</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Describe your dream bouquet and watch AI bring it to life. 
            Our AI understands your style and creates beautiful, personalized floral arrangements.
          </p>
        </div>

        {/* Training Stats */}
        {trainingStats && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Training Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-pink-600">{trainingStats.totalProducts}</div>
                  <div className="text-sm text-gray-600">Products Trained</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{trainingStats.trainedStyles.length}</div>
                  <div className="text-sm text-gray-600">Styles Learned</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{trainingStats.promptTemplates}</div>
                  <div className="text-sm text-gray-600">Prompt Templates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{Math.round(trainingStats.confidence * 100)}%</div>
                  <div className="text-sm text-gray-600">Confidence</div>
                </div>
              </div>
              {trainingStats.trainedStyles.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm text-gray-600 mb-2">Trained Styles:</div>
                  <div className="flex flex-wrap gap-2">
                    {trainingStats.trainedStyles.map((style) => (
                      <Badge key={style} variant="outline" className="capitalize">
                        {style}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {trainingStats.totalProducts === 0 && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">No training data available</p>
                  <Button onClick={handleCreateSampleProducts} variant="outline" size="sm">
                    <Database className="mr-2 h-4 w-4" />
                    Create Sample Products
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Prompt Builder */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flower className="h-5 w-5" />
                Design Your Bouquet
              </CardTitle>
              <CardDescription>
                Tell us about your dream bouquet and we'll create it for you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Prompt */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Describe your bouquet</Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., A romantic bouquet with soft pink roses and white peonies, perfect for a summer wedding..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              {/* Style Selection */}
              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div>
                          <div className="font-medium">{style.label}</div>
                          <div className="text-sm text-gray-500">{style.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Size Selection */}
              <div className="space-y-2">
                <Label>Size</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        <div>
                          <div className="font-medium">{size.label}</div>
                          <div className="text-sm text-gray-500">{size.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Occasion Selection */}
              <div className="space-y-2">
                <Label>Occasion</Label>
                <Select value={selectedOccasion} onValueChange={setSelectedOccasion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {occasions.map((occasion) => (
                      <SelectItem key={occasion.value} value={occasion.value}>
                        <div>
                          <div className="font-medium">{occasion.label}</div>
                          <div className="text-sm text-gray-500">{occasion.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget Selection */}
              <div className="space-y-2">
                <Label>Budget</Label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a budget" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget) => (
                      <SelectItem key={budget.value} value={budget.value}>
                        <div>
                          <div className="font-medium">{budget.label}</div>
                          <div className="text-sm text-gray-500">{budget.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={handleGenerateDesign}
                disabled={!prompt.trim() || isGenerating}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your bouquet...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Bouquet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Design Preview */}
          <div className="space-y-6">
            {isGenerating && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-pink-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Creating your bouquet...</h3>
                    <p className="text-gray-500">Our AI is designing something special for you</p>
                    {trainingStats && (
                      <div className="mt-4 text-sm text-gray-400">
                        Using {trainingStats.totalProducts} trained products • {Math.round(trainingStats.confidence * 100)}% confidence
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {currentDesign && !isGenerating && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Your Generated Bouquet</span>
                    <Badge variant={currentDesign.status === 'completed' ? 'default' : 'destructive'}>
                      {currentDesign.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Based on your description: "{currentDesign.prompt}"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Generated Image */}
                  <div className="relative">
                    <img
                      src={currentDesign.generatedImage}
                      alt="Generated bouquet"
                      className="w-full h-96 object-cover rounded-lg shadow-lg"
                    />
                    {currentDesign.status === 'failed' && (
                      <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex items-center justify-center rounded-lg">
                        <div className="text-center">
                          <div className="text-red-600 font-medium mb-2">Generation Failed</div>
                          <div className="text-sm text-red-500">{currentDesign.error}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Design Specifications */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Design Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Style:</span>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {currentDesign.designSpecs.style}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {currentDesign.designSpecs.size}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Occasion:</span>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {currentDesign.designSpecs.occasion}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">Budget:</span>
                        <Badge variant="outline" className="ml-2 capitalize">
                          {currentDesign.designSpecs.budget}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Flowers:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {currentDesign.designSpecs.flowerTypes.map((flower, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {flower}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Color Palette:</span>
                      <div className="flex gap-2 mt-1">
                        {currentDesign.designSpecs.colorPalette.map((color, index) => (
                          <div
                            key={index}
                            className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Generation Stats */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Generation time: {Math.round(currentDesign.generationTime)}s</div>
                      <div>Model version: {currentDesign.modelVersion}</div>
                      <div>Estimated cost: ${currentDesign.cost.toFixed(2)}</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleRefine}
                      variant="outline"
                      className="flex-1"
                    >
                      Refine Design
                    </Button>
                    <Button 
                      onClick={handlePurchase}
                      className="flex-1"
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Purchase Bouquet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!currentDesign && !isGenerating && (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center text-gray-500">
                    <Flower className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">Ready to create?</h3>
                    <p>Describe your dream bouquet and we'll bring it to life</p>
                    {trainingStats && (
                      <div className="mt-4 text-sm text-gray-400">
                        AI trained on {trainingStats.totalProducts} products
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIFlorist; 