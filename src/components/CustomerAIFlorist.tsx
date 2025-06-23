import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, Sparkles, Palette, Flower, ShoppingCart, Heart, Star, ArrowRight, Download, Share2 } from 'lucide-react';

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

const CustomerAIFlorist: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('romantic');
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedOccasion, setSelectedOccasion] = useState('wedding');
  const [selectedBudget, setSelectedBudget] = useState('mid-range');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<BouquetDesign | null>(null);
  const [generationHistory, setGenerationHistory] = useState<BouquetDesign[]>([]);

  const styles = [
    { value: 'romantic', label: 'Romantic', description: 'Soft, dreamy, and intimate', icon: '💕' },
    { value: 'modern', label: 'Modern', description: 'Clean, minimalist, and contemporary', icon: '✨' },
    { value: 'rustic', label: 'Rustic', description: 'Natural, earthy, and charming', icon: '🌿' },
    { value: 'elegant', label: 'Elegant', description: 'Sophisticated and refined', icon: '👑' },
    { value: 'wild', label: 'Wild', description: 'Free-flowing and natural', icon: '🌸' },
  ];

  const sizes = [
    { value: 'small', label: 'Small', description: 'Perfect for intimate occasions', price: '$25-50' },
    { value: 'medium', label: 'Medium', description: 'Great for birthdays and celebrations', price: '$50-100' },
    { value: 'large', label: 'Large', description: 'Ideal for weddings and events', price: '$100-200' },
    { value: 'extra-large', label: 'Extra Large', description: 'Statement pieces for special moments', price: '$200+' },
  ];

  const occasions = [
    { value: 'wedding', label: 'Wedding', description: 'Bridal bouquets and ceremony flowers', icon: '💒' },
    { value: 'birthday', label: 'Birthday', description: 'Celebratory and vibrant arrangements', icon: '🎂' },
    { value: 'anniversary', label: 'Anniversary', description: 'Romantic and meaningful designs', icon: '💑' },
    { value: 'sympathy', label: 'Sympathy', description: 'Respectful and comforting arrangements', icon: '🤍' },
    { value: 'celebration', label: 'Celebration', description: 'Joyful and festive designs', icon: '🎉' },
  ];

  const budgets = [
    { value: 'budget', label: 'Budget', description: 'Beautiful designs under $50', range: '$25-50' },
    { value: 'mid-range', label: 'Mid-Range', description: 'Quality arrangements $50-$100', range: '$50-100' },
    { value: 'premium', label: 'Premium', description: 'Luxury designs $100-$200', range: '$100-200' },
    { value: 'luxury', label: 'Luxury', description: 'Exclusive pieces $200+', range: '$200+' },
  ];

  const handleGenerateDesign = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentDesign(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const mockDesign: BouquetDesign = {
        id: `design-${Date.now()}`,
        prompt: prompt,
        generatedImage: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=800&h=800&fit=crop&crop=center',
        designSpecs: {
          style: selectedStyle,
          colorPalette: getColorPalette(selectedStyle),
          flowerTypes: getFlowerTypes(selectedStyle, selectedOccasion),
          arrangement: 'round',
          size: selectedSize,
          occasion: selectedOccasion,
          budget: selectedBudget
        },
        status: 'completed',
        confidence: 0.85 + Math.random() * 0.1,
        modelVersion: 'v1.0-dalle3',
        generationTime: 3.2,
        cost: 0.04
      };

      setCurrentDesign(mockDesign);
      setGenerationHistory(prev => [mockDesign, ...prev.slice(0, 4)]); // Keep last 5 designs
    } catch (error) {
      setCurrentDesign({
        id: `error-${Date.now()}`,
        prompt: prompt,
        generatedImage: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=800&h=800&fit=crop&crop=center',
        designSpecs: {
          style: selectedStyle,
          colorPalette: getColorPalette(selectedStyle),
          flowerTypes: getFlowerTypes(selectedStyle, selectedOccasion),
          arrangement: 'round',
          size: selectedSize,
          occasion: selectedOccasion,
          budget: selectedBudget
        },
        status: 'failed',
        confidence: 0.5,
        modelVersion: 'v1.0-error',
        generationTime: 0,
        cost: 0,
        error: 'Generation failed. Please try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getColorPalette = (style: string): string[] => {
    const palettes = {
      romantic: ['#FF6B9D', '#FFB3D1', '#FFE5F1', '#FFF0F5'],
      modern: ['#4A90E2', '#F5F5F5', '#2C3E50', '#E8F4FD'],
      rustic: ['#8B4513', '#DEB887', '#F4A460', '#F5DEB3'],
      elegant: ['#2C3E50', '#ECF0F1', '#BDC3C7', '#95A5A6'],
      wild: ['#FFD700', '#32CD32', '#FF6347', '#87CEEB']
    };
    return palettes[style as keyof typeof palettes] || palettes.romantic;
  };

  const getFlowerTypes = (style: string, occasion: string): string[] => {
    const flowers = {
      romantic: ['Roses', 'Peonies', 'Baby\'s Breath'],
      modern: ['Lilies', 'Orchids', 'Anthuriums'],
      rustic: ['Sunflowers', 'Daisies', 'Wildflowers'],
      elegant: ['Roses', 'Lilies', 'Orchids'],
      wild: ['Daisies', 'Sunflowers', 'Wildflowers']
    };
    return flowers[style as keyof typeof flowers] || flowers.romantic;
  };

  const handlePurchase = () => {
    // TODO: Integrate with Shopify or payment system
    alert('Purchase functionality coming soon! This would integrate with your Shopify store.');
  };

  const handleDownload = () => {
    if (currentDesign) {
      // Create a download link for the image
      const link = document.createElement('a');
      link.href = currentDesign.generatedImage;
      link.download = `bouquet-design-${currentDesign.id}.jpg`;
      link.click();
    }
  };

  const handleShare = () => {
    if (currentDesign && navigator.share) {
      navigator.share({
        title: 'My AI-Generated Bouquet Design',
        text: `Check out this beautiful ${currentDesign.designSpecs.style} bouquet I created with AI!`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="relative">
              <Sparkles className="h-10 w-10 text-pink-500" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full animate-pulse"></div>
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
              AI Florist
            </h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Describe your dream bouquet and watch our AI bring it to life. 
            Create stunning, personalized floral arrangements in seconds.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
              <span>4.9/5 rating</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-red-400 fill-current" />
              <span>10,000+ designs created</span>
            </div>
            <div className="flex items-center gap-1">
              <Flower className="h-4 w-4 text-green-400" />
              <span>Instant generation</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Design Form */}
          <Card className="h-fit shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Flower className="h-6 w-6 text-pink-500" />
                Design Your Bouquet
              </CardTitle>
              <CardDescription className="text-base">
                Tell us about your dream bouquet and we'll create something magical
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Prompt */}
              <div className="space-y-3">
                <Label htmlFor="prompt" className="text-base font-medium">
                  Describe your bouquet
                </Label>
                <Textarea
                  id="prompt"
                  placeholder="e.g., A romantic bouquet with soft pink roses and white peonies, perfect for a summer wedding with cascading baby's breath..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] text-base resize-none border-2 border-gray-200 focus:border-pink-300"
                />
              </div>

              {/* Style Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Style</Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-pink-300">
                    <SelectValue placeholder="Choose a style" />
                  </SelectTrigger>
                  <SelectContent>
                    {styles.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{style.icon}</span>
                          <div>
                            <div className="font-medium">{style.label}</div>
                            <div className="text-sm text-gray-500">{style.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Size Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Size</Label>
                <Select value={selectedSize} onValueChange={setSelectedSize}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-pink-300">
                    <SelectValue placeholder="Choose a size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        <div>
                          <div className="font-medium">{size.label}</div>
                          <div className="text-sm text-gray-500">{size.description}</div>
                          <div className="text-xs text-pink-600 font-medium">{size.price}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Occasion Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Occasion</Label>
                <Select value={selectedOccasion} onValueChange={setSelectedOccasion}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-pink-300">
                    <SelectValue placeholder="Choose an occasion" />
                  </SelectTrigger>
                  <SelectContent>
                    {occasions.map((occasion) => (
                      <SelectItem key={occasion.value} value={occasion.value}>
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{occasion.icon}</span>
                          <div>
                            <div className="font-medium">{occasion.label}</div>
                            <div className="text-sm text-gray-500">{occasion.description}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Budget Selection */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Budget</Label>
                <Select value={selectedBudget} onValueChange={setSelectedBudget}>
                  <SelectTrigger className="border-2 border-gray-200 focus:border-pink-300">
                    <SelectValue placeholder="Choose a budget" />
                  </SelectTrigger>
                  <SelectContent>
                    {budgets.map((budget) => (
                      <SelectItem key={budget.value} value={budget.value}>
                        <div>
                          <div className="font-medium">{budget.label}</div>
                          <div className="text-sm text-gray-500">{budget.description}</div>
                          <div className="text-xs text-green-600 font-medium">{budget.range}</div>
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
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    Creating your bouquet...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-3 h-5 w-5" />
                    Generate Bouquet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Design Preview */}
          <div className="space-y-6">
            {isGenerating && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <Loader2 className="h-16 w-16 animate-spin text-pink-500 mx-auto" />
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full opacity-20 animate-pulse"></div>
                    </div>
                    <h3 className="text-2xl font-semibold mb-3 text-gray-800">Creating your bouquet...</h3>
                    <p className="text-gray-600 mb-4">Our AI is designing something special for you</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentDesign && !isGenerating && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-2xl">Your Generated Bouquet</span>
                    <Badge variant={currentDesign.status === 'completed' ? 'default' : 'destructive'} className="text-sm">
                      {currentDesign.status === 'completed' ? 'Ready' : 'Error'}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-base">
                    Based on: "{currentDesign.prompt}"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Generated Image */}
                  <div className="relative group">
                    <img
                      src={currentDesign.generatedImage}
                      alt="Generated bouquet"
                      className="w-full h-96 object-cover rounded-xl shadow-lg group-hover:shadow-2xl transition-shadow duration-300"
                    />
                    {currentDesign.status === 'failed' && (
                      <div className="absolute inset-0 bg-red-50 bg-opacity-90 flex items-center justify-center rounded-xl">
                        <div className="text-center">
                          <div className="text-red-600 font-medium mb-2">Generation Failed</div>
                          <div className="text-sm text-red-500">{currentDesign.error}</div>
                        </div>
                      </div>
                    )}
                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-3">
                        <Button onClick={handleDownload} variant="secondary" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                        <Button onClick={handleShare} variant="secondary" size="sm">
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Design Specifications */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Design Details</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Style:</span>
                        <Badge variant="outline" className="capitalize">
                          {currentDesign.designSpecs.style}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Size:</span>
                        <Badge variant="outline" className="capitalize">
                          {currentDesign.designSpecs.size}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Occasion:</span>
                        <Badge variant="outline" className="capitalize">
                          {currentDesign.designSpecs.occasion}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Budget:</span>
                        <Badge variant="outline" className="capitalize">
                          {currentDesign.designSpecs.budget}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Flowers:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {currentDesign.designSpecs.flowerTypes.map((flower, index) => (
                          <Badge key={index} variant="secondary" className="text-sm">
                            {flower}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-medium">Color Palette:</span>
                      <div className="flex gap-3 mt-2">
                        {currentDesign.designSpecs.colorPalette.map((color, index) => (
                          <div
                            key={index}
                            className="w-8 h-8 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Generation Stats */}
                    <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
                      <div>Generation time: {Math.round(currentDesign.generationTime)}s</div>
                      <div>Model version: {currentDesign.modelVersion}</div>
                      <div>Estimated cost: ${currentDesign.cost.toFixed(2)}</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      onClick={handlePurchase}
                      className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      <ShoppingCart className="mr-2 h-5 w-5" />
                      Order This Bouquet
                    </Button>
                    <Button 
                      onClick={handleGenerateDesign}
                      variant="outline"
                      className="flex-1 h-12"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {!currentDesign && !isGenerating && (
              <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="text-center text-gray-500">
                    <div className="relative mb-6">
                      <Flower className="h-16 w-16 mx-auto opacity-50" />
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-rose-400 rounded-full opacity-10 animate-pulse"></div>
                    </div>
                    <h3 className="text-2xl font-semibold mb-3 text-gray-700">Ready to create?</h3>
                    <p className="text-lg mb-4">Describe your dream bouquet and we'll bring it to life</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                      <Star className="h-4 w-4" />
                      <span>AI-powered design</span>
                      <span>•</span>
                      <span>Instant generation</span>
                      <span>•</span>
                      <span>Professional quality</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recent Designs */}
        {generationHistory.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-center mb-8">Recent Designs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generationHistory.map((design) => (
                <Card key={design.id} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow">
                  <CardContent className="p-4">
                    <img
                      src={design.generatedImage}
                      alt="Generated bouquet"
                      className="w-full h-48 object-cover rounded-lg mb-4"
                    />
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 line-clamp-2">{design.prompt}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize text-xs">
                          {design.designSpecs.style}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentDesign(design)}>
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAIFlorist; 