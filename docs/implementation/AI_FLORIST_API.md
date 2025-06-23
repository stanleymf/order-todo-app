# 🌸 AI Florist - API Reference

## 🔌 **API Endpoints**

### **Base URL**
```
https://order-to-do.stanleytan92.workers.dev
```

### **Authentication**
All API endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <jwt-token>
```

---

## 📊 **Training Data Endpoints**

### **Get Saved Products**
```http
GET /api/tenants/{tenantId}/saved-products
```

**Purpose**: Retrieve saved products for AI training

**Parameters**:
- `search` (optional): Search term for filtering products
- `productType` (optional): Filter by product type
- `vendor` (optional): Filter by vendor
- `hasLabels` (optional): Filter by label presence (true/false)

**Response**:
```json
[
  {
    "id": "product-123",
    "tenantId": "tenant-456",
    "shopifyProductId": "shopify-789",
    "shopifyVariantId": "variant-101",
    "title": "Romantic Rose Bouquet",
    "variantTitle": "Pink Roses",
    "description": "A beautiful romantic bouquet featuring soft pink roses...",
    "price": 89.99,
    "tags": ["romantic", "wedding", "pink", "roses"],
    "productType": "Bouquet",
    "vendor": "Windflower Florist",
    "handle": "romantic-rose-bouquet",
    "imageUrl": "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop",
    "imageAlt": "Romantic pink rose bouquet",
    "imageWidth": 400,
    "imageHeight": 600,
    "createdAt": "2025-01-13T10:30:00Z",
    "updatedAt": "2025-01-13T10:30:00Z",
    "labelIds": ["label-1", "label-2"],
    "labelNames": ["Difficulty: Easy", "Style: Romantic"]
  }
]
```

**Example Request**:
```bash
curl -X GET "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/saved-products?search=roses&hasLabels=true" \
  -H "Authorization: Bearer your-jwt-token"
```

### **Create Sample Products**
```http
POST /api/tenants/{tenantId}/sample-products
```

**Purpose**: Create sample products for testing AI training

**Request Body**: None (creates 8 predefined sample products)

**Response**:
```json
{
  "success": true,
  "message": "Created 8 sample products for AI training",
  "products": [
    {
      "id": "sample-1",
      "title": "Romantic Rose Bouquet",
      "description": "A beautiful romantic bouquet featuring soft pink roses...",
      "price": 89.99,
      "tags": ["romantic", "wedding", "pink", "roses", "peonies"],
      "imageUrl": "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop"
    }
    // ... 7 more sample products
  ]
}
```

**Example Request**:
```bash
curl -X POST "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/sample-products" \
  -H "Authorization: Bearer your-jwt-token"
```

### **Save Products**
```http
POST /api/tenants/{tenantId}/saved-products
```

**Purpose**: Save products from Shopify for AI training

**Request Body**:
```json
{
  "products": [
    {
      "shopifyProductId": "your-product-id",
      "shopifyVariantId": "your-variant-id",
      "title": "Your Product Title",
      "variantTitle": "Your Variant Title",
      "description": "Your product description",
      "price": 89.99,
      "tags": ["romantic", "wedding", "roses"],
      "productType": "Bouquet",
      "vendor": "Your Vendor",
      "handle": "your-product-handle",
      "imageUrl": "https://your-image-url.com/image.jpg",
      "imageAlt": "Image alt text",
      "imageWidth": 400,
      "imageHeight": 600
    }
  ]
}
```

**Response**:
```json
[
  {
    "id": "saved-product-123",
    "tenantId": "tenant-456",
    "shopifyProductId": "your-product-id",
    "shopifyVariantId": "your-variant-id",
    "title": "Your Product Title",
    "price": 89.99,
    "tags": ["romantic", "wedding", "roses"],
    "imageUrl": "https://your-image-url.com/image.jpg",
    "createdAt": "2025-01-13T10:30:00Z",
    "updatedAt": "2025-01-13T10:30:00Z"
  }
]
```

**Example Request**:
```bash
curl -X POST "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/saved-products" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "products": [
      {
        "shopifyProductId": "prod_123",
        "shopifyVariantId": "var_456",
        "title": "Romantic Rose Bouquet",
        "description": "Beautiful pink roses for weddings",
        "price": 89.99,
        "tags": ["romantic", "wedding", "roses"],
        "imageUrl": "https://example.com/image.jpg"
      }
    ]
  }'
```

---

## 🧠 **AI Generation Endpoints**

### **Generate Design (Future Implementation)**
```http
POST /api/tenants/{tenantId}/ai/generate
```

**Purpose**: Generate AI-powered bouquet design

**Request Body**:
```json
{
  "prompt": "A romantic bouquet with pink roses for a wedding",
  "style": "romantic",
  "size": "medium",
  "occasion": "wedding",
  "budget": "mid-range",
  "preferences": {
    "flowers": ["roses", "peonies"],
    "colors": ["pink", "white"],
    "arrangement": "round"
  }
}
```

**Response**:
```json
{
  "id": "generated-1705149000000",
  "prompt": "A romantic bouquet with pink roses for a wedding",
  "generatedImage": "https://generated-image-url.com/image.jpg",
  "confidence": 0.85,
  "designSpecs": {
    "style": "romantic",
    "colorPalette": ["#FF6B6B", "#FFE5E5", "#FFB3B3"],
    "flowerTypes": ["roses", "peonies"],
    "arrangement": "round",
    "size": "medium",
    "occasion": "wedding",
    "budget": "mid-range"
  },
  "generationTime": 15.2,
  "modelVersion": "v1.0-trained",
  "cost": 0.05,
  "similarProduct": {
    "id": "product-123",
    "title": "Romantic Rose Bouquet",
    "imageUrl": "https://similar-product-image.jpg"
  }
}
```

### **Refine Design (Future Implementation)**
```http
POST /api/tenants/{tenantId}/ai/refine
```

**Purpose**: Refine an existing AI-generated design

**Request Body**:
```json
{
  "designId": "generated-1705149000000",
  "changes": {
    "style": "modern",
    "colors": ["blue", "white"],
    "flowers": ["lilies", "orchids"],
    "size": "large"
  },
  "feedback": "Make it more modern and elegant"
}
```

**Response**:
```json
{
  "id": "refined-1705149100000",
  "originalDesignId": "generated-1705149000000",
  "prompt": "A modern elegant bouquet with blue and white lilies and orchids",
  "generatedImage": "https://refined-image-url.com/image.jpg",
  "confidence": 0.88,
  "designSpecs": {
    "style": "modern",
    "colorPalette": ["#4A90E2", "#F5F5F5", "#2C3E50"],
    "flowerTypes": ["lilies", "orchids"],
    "arrangement": "round",
    "size": "large",
    "occasion": "wedding",
    "budget": "mid-range"
  },
  "generationTime": 12.8,
  "modelVersion": "v1.0-trained",
  "cost": 0.05
}
```

---

## 📊 **Analytics Endpoints**

### **Get Training Statistics**
```http
GET /api/tenants/{tenantId}/ai/training-stats
```

**Purpose**: Get AI training statistics and performance metrics

**Response**:
```json
{
  "totalProducts": 8,
  "trainedStyles": ["romantic", "modern", "rustic", "elegant", "wild"],
  "promptTemplates": 12,
  "lastTrained": "2025-01-13T10:30:00Z",
  "confidence": 0.85,
  "performance": {
    "generationSuccessRate": 0.95,
    "averageGenerationTime": 15.2,
    "averageConfidence": 0.82,
    "totalGenerations": 150
  },
  "popularStyles": [
    { "style": "romantic", "count": 45, "percentage": 30 },
    { "style": "modern", "count": 30, "percentage": 20 },
    { "style": "rustic", "count": 25, "percentage": 17 }
  ],
  "popularFlowers": [
    { "flower": "roses", "count": 60, "percentage": 40 },
    { "flower": "peonies", "count": 35, "percentage": 23 },
    { "flower": "lilies", "count": 25, "percentage": 17 }
  ]
}
```

### **Get Generation History**
```http
GET /api/tenants/{tenantId}/ai/generations
```

**Purpose**: Get history of AI generations

**Parameters**:
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `style` (optional): Filter by style
- `dateFrom` (optional): Filter by start date
- `dateTo` (optional): Filter by end date

**Response**:
```json
{
  "generations": [
    {
      "id": "generated-1705149000000",
      "prompt": "A romantic bouquet with pink roses",
      "generatedImage": "https://image-url.com/image.jpg",
      "confidence": 0.85,
      "style": "romantic",
      "generationTime": 15.2,
      "cost": 0.05,
      "createdAt": "2025-01-13T10:30:00Z",
      "feedback": {
        "rating": 4,
        "comment": "Beautiful design!"
      }
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## 🏷️ **Label Management Endpoints**

### **Get Product Labels**
```http
GET /api/tenants/{tenantId}/labels
```

**Purpose**: Get all product labels for the tenant

**Parameters**:
- `category` (optional): Filter by category (difficulty, productType, custom)

**Response**:
```json
[
  {
    "id": "label-1",
    "tenantId": "tenant-123",
    "name": "Difficulty: Easy",
    "category": "difficulty",
    "color": "#10B981",
    "priority": 1,
    "createdAt": "2025-01-13T10:30:00Z",
    "updatedAt": "2025-01-13T10:30:00Z"
  },
  {
    "id": "label-2",
    "tenantId": "tenant-123",
    "name": "Style: Romantic",
    "category": "custom",
    "color": "#F59E0B",
    "priority": 2,
    "createdAt": "2025-01-13T10:30:00Z",
    "updatedAt": "2025-01-13T10:30:00Z"
  }
]
```

### **Create Product Label**
```http
POST /api/tenants/{tenantId}/labels
```

**Purpose**: Create a new product label

**Request Body**:
```json
{
  "name": "Style: Modern",
  "category": "custom",
  "color": "#3B82F6",
  "priority": 1
}
```

**Response**:
```json
{
  "id": "label-3",
  "tenantId": "tenant-123",
  "name": "Style: Modern",
  "category": "custom",
  "color": "#3B82F6",
  "priority": 1,
  "createdAt": "2025-01-13T10:30:00Z",
  "updatedAt": "2025-01-13T10:30:00Z"
}
```

### **Assign Label to Product**
```http
POST /api/tenants/{tenantId}/products/{productId}/labels
```

**Purpose**: Assign a label to a product

**Request Body**:
```json
{
  "labelId": "label-1"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Label assigned successfully"
}
```

---

## 🔍 **Search and Filter Endpoints**

### **Search Products**
```http
GET /api/tenants/{tenantId}/products/search
```

**Purpose**: Search products with advanced filtering

**Parameters**:
- `q` (required): Search query
- `style` (optional): Filter by style
- `flowers` (optional): Filter by flower types (comma-separated)
- `occasion` (optional): Filter by occasion
- `priceMin` (optional): Minimum price
- `priceMax` (optional): Maximum price
- `hasImages` (optional): Filter by image availability (true/false)

**Response**:
```json
{
  "products": [
    {
      "id": "product-123",
      "title": "Romantic Rose Bouquet",
      "description": "A beautiful romantic bouquet...",
      "price": 89.99,
      "tags": ["romantic", "wedding", "roses"],
      "imageUrl": "https://image-url.com/image.jpg",
      "style": "romantic",
      "flowers": ["roses", "peonies"],
      "occasion": "wedding",
      "confidence": 0.85
    }
  ],
  "total": 25,
  "filters": {
    "styles": ["romantic", "modern", "rustic"],
    "flowers": ["roses", "peonies", "lilies"],
    "occasions": ["wedding", "birthday", "anniversary"],
    "priceRange": {
      "min": 25.00,
      "max": 200.00
    }
  }
}
```

---

## 📈 **Feedback and Rating Endpoints**

### **Submit Design Rating**
```http
POST /api/tenants/{tenantId}/ai/ratings
```

**Purpose**: Submit customer rating for AI-generated design

**Request Body**:
```json
{
  "designId": "generated-1705149000000",
  "rating": 4,
  "feedback": "Beautiful design, but could be more colorful",
  "customerId": "customer-123",
  "improvements": ["more colors", "larger size"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rating submitted successfully",
  "rating": {
    "id": "rating-123",
    "designId": "generated-1705149000000",
    "rating": 4,
    "feedback": "Beautiful design, but could be more colorful",
    "customerId": "customer-123",
    "createdAt": "2025-01-13T10:30:00Z"
  }
}
```

### **Get Design Ratings**
```http
GET /api/tenants/{tenantId}/ai/ratings
```

**Purpose**: Get ratings for AI-generated designs

**Parameters**:
- `designId` (optional): Filter by specific design
- `rating` (optional): Filter by rating value (1-5)
- `dateFrom` (optional): Filter by start date
- `dateTo` (optional): Filter by end date

**Response**:
```json
{
  "ratings": [
    {
      "id": "rating-123",
      "designId": "generated-1705149000000",
      "rating": 4,
      "feedback": "Beautiful design!",
      "customerId": "customer-123",
      "createdAt": "2025-01-13T10:30:00Z"
    }
  ],
  "summary": {
    "averageRating": 4.2,
    "totalRatings": 45,
    "ratingDistribution": {
      "5": 20,
      "4": 15,
      "3": 8,
      "2": 2,
      "1": 0
    }
  }
}
```

---

## 🚨 **Error Responses**

### **Standard Error Format**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  },
  "timestamp": "2025-01-13T10:30:00Z"
}
```

### **Common Error Codes**
- `AUTHENTICATION_REQUIRED`: JWT token missing or invalid
- `INVALID_TENANT`: Tenant ID not found or access denied
- `PRODUCT_NOT_FOUND`: Product with specified ID not found
- `INVALID_INPUT`: Request body validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `GENERATION_FAILED`: AI generation failed
- `INSUFFICIENT_DATA`: Not enough training data

### **Example Error Response**
```json
{
  "error": "Product not found",
  "code": "PRODUCT_NOT_FOUND",
  "details": {
    "productId": "product-123"
  },
  "timestamp": "2025-01-13T10:30:00Z"
}
```

---

## 📊 **Rate Limiting**

### **Rate Limits**
- **Training Data Endpoints**: 100 requests per minute
- **AI Generation Endpoints**: 10 requests per minute
- **Analytics Endpoints**: 50 requests per minute
- **Feedback Endpoints**: 20 requests per minute

### **Rate Limit Headers**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642070400
```

### **Rate Limit Exceeded Response**
```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset": 1642070400
  },
  "timestamp": "2025-01-13T10:30:00Z"
}
```

---

## 🔧 **Client Libraries**

### **JavaScript/TypeScript**
```typescript
// Example API client usage
import { getSavedProducts, createSampleProducts } from './services/api';

// Get training data
const products = await getSavedProducts(tenantId, {
  search: 'roses',
  hasLabels: true
});

// Create sample data
const sampleData = await createSampleProducts(tenantId);
```

### **cURL Examples**
```bash
# Get saved products
curl -X GET "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/saved-products" \
  -H "Authorization: Bearer your-jwt-token"

# Create sample products
curl -X POST "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/sample-products" \
  -H "Authorization: Bearer your-jwt-token"

# Save products
curl -X POST "https://order-to-do.stanleytan92.workers.dev/api/tenants/tenant-123/saved-products" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{"products": [...]}'
```

---

*Last Updated: 2025-01-13*
*Version: 1.0.0* 