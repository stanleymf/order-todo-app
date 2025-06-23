# 🌸 AI Florist - Technical Implementation

## 🏗️ **Architecture Overview**

### **System Components**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (React)       │◄──►│   (Cloudflare   │◄──►│   (D1 SQLite)   │
│                 │    │   Workers)      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Florist    │    │   Training      │    │   Saved         │
│   Interface     │    │   Service       │    │   Products      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Data Flow**

1. **User Input** → Frontend captures customer description
2. **Training Data** → System analyzes saved products for patterns
3. **Prompt Engineering** → Builds structured prompts from user input
4. **Similarity Matching** → Finds most relevant existing products
5. **Design Generation** → Creates specifications and mock images
6. **Output** → Returns generated design with confidence scores

## 🔧 **Core Technologies**

### **Frontend Stack**
- **React 18**: Component-based UI framework
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components
- **Lucide React**: Icon library

### **Backend Stack**
- **Cloudflare Workers**: Serverless edge computing
- **Hono**: Fast web framework for Workers
- **Cloudflare D1**: SQLite database
- **JWT**: Authentication and authorization

### **Deployment**
- **Cloudflare Pages**: Static site hosting
- **Wrangler**: CLI for Cloudflare development
- **Vite**: Build tool and dev server

## 📁 **File Structure**

```
src/
├── components/
│   └── AIFlorist.tsx          # Main AI Florist component
├── services/
│   ├── api.ts                 # API client functions
│   ├── database-d1.ts         # Database operations
│   └── aiTrainingService.ts   # AI training logic
├── types/
│   └── index.ts               # TypeScript interfaces
└── contexts/
    └── AuthContext.tsx        # Authentication context

worker/
└── index.ts                   # Cloudflare Worker backend

docs/
└── implementation/
    ├── AI_FLORIST_OVERVIEW.md
    ├── AI_FLORIST_TECHNICAL.md
    ├── AI_FLORIST_API.md
    └── AI_FLORIST_TODO.md
```

## 🧠 **AI Training System**

### **Training Data Sources**

#### **1. Product Titles**
```typescript
// Extract patterns from titles
const extractTitlePatterns = (products: any[]) => {
  const patterns = [];
  for (const product of products) {
    const words = product.title.toLowerCase().split(' ');
    const flowers = words.filter(word => 
      ['rose', 'tulip', 'lily', 'peony', 'daisy', 'orchid', 'sunflower'].includes(word)
    );
    const occasions = words.filter(word => 
      ['wedding', 'birthday', 'anniversary', 'sympathy', 'celebration'].includes(word)
    );
    
    if (flowers.length > 0 || occasions.length > 0) {
      patterns.push({
        input: `Create a bouquet with ${flowers.join(', ')} for ${occasions.join(', ')}`,
        output: product.title,
        confidence: 0.8
      });
    }
  }
  return patterns;
};
```

#### **2. Product Descriptions**
```typescript
// Analyze detailed descriptions
const extractDescriptionPatterns = (products: any[]) => {
  return products
    .filter(product => product.description)
    .map(product => ({
      input: product.description,
      output: product.title,
      confidence: 0.75
    }));
};
```

#### **3. Product Tags**
```typescript
// Use structured tags for categorization
const extractTagPatterns = (products: any[]) => {
  return products
    .filter(product => product.tags && product.tags.length > 0)
    .map(product => ({
      input: `Tags: ${product.tags.join(', ')}`,
      output: product.title,
      confidence: 0.7
    }));
};
```

### **Style Detection Algorithm**

```typescript
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
```

### **Similarity Matching Algorithm**

```typescript
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
```

### **Confidence Calculation**

```typescript
const calculateConfidence = (products: any[]): number => {
  if (products.length === 0) return 0;
  
  // Calculate confidence based on data quality and quantity
  const hasImages = products.filter(p => p.imageUrl).length;
  const hasDescriptions = products.filter(p => p.description).length;
  const hasTags = products.filter(p => p.tags && p.tags.length > 0).length;
  
  const imageScore = hasImages / products.length;
  const descriptionScore = hasDescriptions / products.length;
  const tagScore = hasTags / products.length;
  
  return Math.min(0.95, (imageScore + descriptionScore + tagScore) / 3 + 0.3);
};
```

## 🎨 **Frontend Components**

### **Main Component: AIFlorist.tsx**

#### **State Management**
```typescript
interface AIFloristState {
  prompt: string;
  selectedStyle: string;
  selectedSize: string;
  selectedOccasion: string;
  selectedBudget: string;
  isGenerating: boolean;
  currentDesign: BouquetDesign | null;
  trainingStats: TrainingStats | null;
  savedProducts: any[];
}
```

#### **Key Functions**

##### **Load Training Data**
```typescript
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
```

##### **Generate Design**
```typescript
const handleGenerateDesign = async () => {
  if (!prompt.trim()) return;

  setIsGenerating(true);
  
  // Simulate AI generation with training data
  setTimeout(() => {
    const similarProduct = findSimilarProduct(prompt, savedProducts);
    const designSpecs = generateDesignSpecs(prompt, similarProduct);
    
    const mockDesign: BouquetDesign = {
      id: Date.now().toString(),
      prompt,
      generatedImage: similarProduct?.imageUrl || 'https://via.placeholder.com/400x600/FFE5E5/FF6B6B?text=AI+Generated+Bouquet',
      designSpecs,
      status: 'completed',
      confidence: trainingStats?.confidence || 0.85,
      modelVersion: 'v1.0-trained',
      generationTime: Math.random() * 20 + 10,
      cost: 0.05
    };
    
    setCurrentDesign(mockDesign);
    setIsGenerating(false);
  }, 3000);
};
```

##### **Design Specifications Generation**
```typescript
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
```

### **Training Statistics Component**

```typescript
interface TrainingStats {
  totalProducts: number;
  trainedStyles: string[];
  promptTemplates: number;
  lastTrained: string;
  confidence: number;
}
```

## 🗄️ **Database Schema**

### **Saved Products Table**
```sql
CREATE TABLE IF NOT EXISTS saved_products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  variant_title TEXT,
  description TEXT,
  price REAL NOT NULL,
  tags TEXT, -- JSON array of tags
  product_type TEXT,
  vendor TEXT,
  handle TEXT,
  status TEXT DEFAULT 'active',
  image_url TEXT,
  image_alt TEXT,
  image_width INTEGER,
  image_height INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, shopify_product_id, shopify_variant_id)
);
```

### **Product Labels Table**
```sql
CREATE TABLE IF NOT EXISTS product_labels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('difficulty', 'productType', 'custom')),
  color TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### **Product Label Mappings Table**
```sql
CREATE TABLE IF NOT EXISTS product_label_mappings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saved_product_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saved_product_id) REFERENCES saved_products(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES product_labels(id) ON DELETE CASCADE,
  UNIQUE(saved_product_id, label_id)
);
```

## 🔌 **API Integration**

### **Database Service Functions**

#### **Get Saved Products**
```typescript
async getSavedProducts(
  env: any,
  tenantId: string,
  filters?: {
    search?: string
    productType?: string
    vendor?: string
    hasLabels?: boolean
  }
): Promise<any[]>
```

#### **Save Products**
```typescript
async saveProducts(
  env: any,
  tenantId: string,
  products: Array<{
    shopifyProductId: string
    shopifyVariantId: string
    title: string
    variantTitle?: string
    description?: string
    price: number
    tags?: string[]
    productType?: string
    vendor?: string
    handle?: string
    imageUrl?: string
    imageAlt?: string
    imageWidth?: number
    imageHeight?: number
  }>
): Promise<any[]>
```

### **API Client Functions**

#### **Get Saved Products**
```typescript
export async function getSavedProducts(
  tenantId: string,
  filters?: {
    search?: string
    productType?: string
    vendor?: string
    hasLabels?: boolean
  }
): Promise<any[]>
```

#### **Create Sample Products**
```typescript
export async function createSampleProducts(tenantId: string): Promise<any>
```

## 🚀 **Performance Optimization**

### **Database Optimization**

#### **Indexes**
```sql
-- Indexes for faster queries
CREATE INDEX idx_saved_products_tenant_id ON saved_products(tenant_id);
CREATE INDEX idx_saved_products_shopify_ids ON saved_products(shopify_product_id, shopify_variant_id);
CREATE INDEX idx_product_label_mappings_product_id ON product_label_mappings(saved_product_id);
CREATE INDEX idx_product_label_mappings_label_id ON product_label_mappings(label_id);
```

#### **Query Optimization**
```typescript
// Optimized query with JOINs
const query = `
  SELECT sp.*, 
         GROUP_CONCAT(plm.label_id) as label_ids,
         GROUP_CONCAT(pl.name) as label_names
  FROM saved_products sp
  LEFT JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
  LEFT JOIN product_labels pl ON plm.label_id = pl.id
  WHERE sp.tenant_id = ?
  GROUP BY sp.id 
  ORDER BY sp.created_at DESC
`;
```

### **Frontend Optimization**

#### **Lazy Loading**
```typescript
// Load training data only when needed
useEffect(() => {
  if (tenant?.id) {
    loadSavedProducts();
  }
}, [tenant?.id]);
```

#### **Memoization**
```typescript
// Memoize expensive calculations
const trainingStats = useMemo(() => {
  if (!savedProducts.length) return null;
  
  return {
    totalProducts: savedProducts.length,
    trainedStyles: extractTrainedStyles(savedProducts),
    promptTemplates: generatePromptTemplates(savedProducts).length,
    lastTrained: new Date().toISOString(),
    confidence: calculateConfidence(savedProducts)
  };
}, [savedProducts]);
```

## 🔒 **Security Considerations**

### **Input Validation**
```typescript
// Sanitize user input
const sanitizePrompt = (prompt: string): string => {
  return prompt
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};
```

### **Authentication**
```typescript
// Protected route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### **Rate Limiting**
```typescript
// Implement rate limiting for generation requests
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
};
```

## 📊 **Monitoring and Logging**

### **Error Tracking**
```typescript
// Error boundary for React components
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AI Florist Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }

    return this.props.children;
  }
}
```

### **Performance Monitoring**
```typescript
// Track generation performance
const trackGeneration = (prompt: string, generationTime: number, confidence: number) => {
  console.log('Generation Metrics:', {
    prompt: prompt.substring(0, 100),
    generationTime,
    confidence,
    timestamp: new Date().toISOString()
  });
};
```

---

*Last Updated: 2025-01-13*
*Version: 1.0.0* 