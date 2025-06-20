# 🌸 Order To-Do App - Architecture Document

## 📋 **Project Overview**

The **Order To-Do App** is a comprehensive florist order management system designed to streamline daily operations, optimize resource allocation, and provide actionable insights for florist businesses. The application follows a phased development approach to ensure robust foundation building and scalable growth.

---

## 🎯 **Development Phases**

### **Phase 1: Core Order Management & UI Foundation** ⭐ *Current Phase*
**Focus**: Perfecting UI/UX and backend logic for seamless florist order access

### **Phase 2: Product & Stock Management with Forecasting**
**Focus**: Recipe-based inventory management and demand forecasting

### **Phase 3: Shopify App Store Preparation**
**Focus**: Multi-tenant architecture and app store compliance

---

## 🏗️ **Phase 1: Core Order Management & UI Foundation**

### **🎯 Phase 1 Objectives**
- ✅ **Easy Order Access**: Florists can quickly view and manage their daily orders
- ✅ **Strong Foundation**: Robust architecture for multi-tenant app store deployment
- ✅ **Protected Routes**: Secure authentication and authorization system
- ✅ **UI/UX Perfection**: Intuitive, mobile-responsive interface

### **📊 Current Architecture Status**

#### **Frontend Architecture**
```
src/
├── components/
│   ├── Dashboard.tsx          # ✅ Main application shell
│   ├── OrdersView.tsx         # ✅ Core orders interface
│   ├── OrderCard.tsx          # ✅ Individual order component
│   ├── ProductManagement.tsx  # ✅ Shopify integration
│   ├── Analytics.tsx          # ✅ Performance metrics
│   └── ui/                    # ✅ 46 shadcn/ui components
├── utils/
│   ├── storage.ts             # ✅ Data management layer
│   └── shopifyApi.ts          # ✅ Shopify API integration
├── types/
│   └── index.ts               # ✅ TypeScript interfaces
└── data/
    └── mockData.ts            # ✅ Sample data
```

#### **Current Data Models**
```typescript
// Core Entities
interface User {
  id: string;
  name: string;
  role: 'admin' | 'florist';
  email: string;
}

interface Store {
  id: string;
  name: string;
  domain: string;
  color: string;
}

interface Product {
  id: string;
  name: string;
  variant: string;
  difficultyLabel: string;
  productTypeLabel: string;
  storeId: string;
  // Shopify fields...
}

interface Order {
  id: string;
  productId: string;
  timeslot: string;
  assignedFloristId?: string;
  status: 'pending' | 'assigned' | 'completed';
  date: string;
  storeId: string;
}
```

### **🔧 Phase 1 Technical Implementation**

#### **Authentication & Authorization**
```typescript
// Enhanced Auth System for Multi-Tenant
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  tenantId: string;        // Multi-tenant support
  permissions: string[];   // Role-based permissions
  sessionToken: string;    // JWT token
}

// Protected Route Component
interface ProtectedRouteProps {
  requiredRole: 'admin' | 'florist';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
```

#### **Enhanced Order Management**
```typescript
// Advanced Order Filtering
interface OrderFilters {
  date: string;
  storeId?: string;
  difficultyLabel?: string;
  productTypeLabel?: string;
  status?: OrderStatus;
  assignedFloristId?: string;
  searchQuery?: string;
}

// Batch Operations
interface BatchOperation {
  orderIds: string[];
  operation: 'assign' | 'unassign' | 'complete' | 'delete';
  targetFloristId?: string;
}
```

#### **Mobile-First UI Components**
```typescript
// Responsive Design System
interface ResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  mobileView: boolean;
  touchOptimized: boolean;
}

// Enhanced Order Card
interface OrderCardProps {
  order: Order;
  currentUser: User;
  onUpdate: (orderId: string, updates: Partial<Order>) => void;
  onAssign: (orderId: string, floristId: string) => void;
  isSelected?: boolean;
  onSelect?: (orderId: string) => void;
  batchMode?: boolean;
}
```

### **🚀 Phase 1 Deployment Architecture**

#### **Current Setup**
```
Frontend (React + Vite)
    ↓
Cloudflare Workers (Edge)
    ↓
LocalStorage (Beta) → Database (Production)
    ↓
Shopify API (External)
```

#### **Production Architecture**
```
React App (CDN)
    ↓
API Gateway (Cloudflare Workers)
    ↓
Database (PostgreSQL/MySQL)
    ↓
Shopify API + Webhooks
```

---

## 📦 **Phase 2: Product & Stock Management with Forecasting**

### **🎯 Phase 2 Objectives**
- **Recipe Management**: Define ingredient lists for each product
- **Stock Forecasting**: Predict required materials based on order volume
- **Inventory Tracking**: Real-time stock level monitoring
- **Decision Support**: Actionable insights for florist managers

### **📊 Phase 2 Data Architecture**

#### **Enhanced Product Model**
```typescript
interface Product {
  // Existing fields...
  
  // New Phase 2 fields
  recipe: Recipe;
  stockLevels: StockLevel[];
  forecastData: ForecastData;
  seasonalAvailability: SeasonalData;
}

interface Recipe {
  id: string;
  productId: string;
  ingredients: RecipeIngredient[];
  instructions: string[];
  estimatedPrepTime: number; // minutes
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  yield: number; // number of products from one recipe
  version: string;
  lastUpdated: Date;
}

interface RecipeIngredient {
  id: string;
  name: string;
  category: 'flower' | 'greenery' | 'accessory' | 'vase' | 'packaging';
  quantity: number;
  unit: 'stems' | 'bunches' | 'pieces' | 'grams' | 'liters';
  requiredForProduct: number; // how many needed per product
  supplier?: string;
  costPerUnit?: number;
  leadTime?: number; // days
}

interface StockLevel {
  id: string;
  ingredientId: string;
  currentQuantity: number;
  minimumQuantity: number;
  maximumQuantity: number;
  unit: string;
  lastUpdated: Date;
  location?: string; // storage location
  expiryDate?: Date;
  supplier?: string;
}

interface ForecastData {
  productId: string;
  date: Date;
  predictedOrders: number;
  requiredIngredients: ForecastedIngredient[];
  confidence: number; // 0-1
  factors: ForecastFactor[];
}

interface ForecastedIngredient {
  ingredientId: string;
  requiredQuantity: number;
  currentStock: number;
  shortage: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  recommendedOrderQuantity: number;
}
```

#### **Order Forecasting System**
```typescript
interface ForecastingEngine {
  // Historical data analysis
  analyzeHistoricalOrders(dateRange: DateRange): OrderPattern[];
  
  // Seasonal adjustments
  applySeasonalFactors(baseForecast: number, date: Date): number;
  
  // Special events impact
  calculateEventImpact(date: Date, location: string): number;
  
  // Weather impact (future integration)
  applyWeatherFactors(forecast: number, weatherData: WeatherData): number;
}

interface OrderPattern {
  dayOfWeek: number;
  averageOrders: number;
  standardDeviation: number;
  seasonalMultiplier: number;
  specialEventMultiplier: number;
}
```

### **🔧 Phase 2 Technical Implementation**

#### **Recipe Management System**
```typescript
// Recipe CRUD Operations
interface RecipeService {
  createRecipe(productId: string, recipe: Omit<Recipe, 'id'>): Promise<Recipe>;
  updateRecipe(recipeId: string, updates: Partial<Recipe>): Promise<Recipe>;
  getRecipe(productId: string): Promise<Recipe>;
  duplicateRecipe(recipeId: string, newProductId: string): Promise<Recipe>;
  archiveRecipe(recipeId: string): Promise<void>;
}

// Stock Management
interface StockService {
  updateStockLevel(ingredientId: string, quantity: number): Promise<StockLevel>;
  getLowStockIngredients(threshold?: number): Promise<StockLevel[]>;
  calculateRequiredStock(date: Date): Promise<ForecastedIngredient[]>;
  generatePurchaseOrder(ingredients: ForecastedIngredient[]): Promise<PurchaseOrder>;
}
```

#### **Forecasting Dashboard Components**
```typescript
// Stock Forecast Component
interface StockForecastProps {
  date: Date;
  storeId: string;
  onGenerateReport: (forecast: ForecastData) => void;
}

// Recipe Editor Component
interface RecipeEditorProps {
  productId: string;
  recipe?: Recipe;
  onSave: (recipe: Recipe) => void;
  onCancel: () => void;
}

// Inventory Dashboard Component
interface InventoryDashboardProps {
  storeId: string;
  view: 'current' | 'forecast' | 'alerts';
  dateRange: DateRange;
}
```

### **📊 Phase 2 UI/UX Features**

#### **Recipe Management Interface**
- **Visual Recipe Builder**: Drag-and-drop ingredient management
- **Ingredient Library**: Reusable ingredient database
- **Version Control**: Track recipe changes over time
- **Bulk Operations**: Update multiple recipes simultaneously

#### **Forecasting Dashboard**
- **Daily Forecast View**: Visual representation of predicted orders
- **Stock Requirements**: Color-coded ingredient requirements
- **Shortage Alerts**: Real-time notifications for low stock
- **Purchase Recommendations**: Automated ordering suggestions

#### **Inventory Management**
- **Real-time Stock Levels**: Live inventory tracking
- **Multi-location Support**: Manage stock across different storage areas
- **Supplier Integration**: Direct ordering from suppliers
- **Expiry Tracking**: Monitor ingredient freshness

---

## 🏪 **Phase 3: Shopify App Store Preparation**

### **🎯 Phase 3 Objectives**
- **Multi-Tenant Architecture**: Support multiple florist businesses
- **App Store Compliance**: Meet Shopify's app store requirements
- **Scalable Infrastructure**: Handle growth and multiple stores
- **Advanced Security**: Enterprise-grade security measures

### **📊 Phase 3 Architecture**

#### **Multi-Tenant Data Model**
```typescript
interface Tenant {
  id: string;
  name: string;
  domain: string;
  shopifyShopId: string;
  subscription: Subscription;
  settings: TenantSettings;
  createdAt: Date;
  status: 'active' | 'suspended' | 'cancelled';
}

interface Subscription {
  plan: 'starter' | 'professional' | 'enterprise';
  features: string[];
  limits: {
    maxStores: number;
    maxUsers: number;
    maxProducts: number;
    apiCallsPerDay: number;
  };
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: Date;
}

interface TenantSettings {
  timezone: string;
  currency: string;
  language: string;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
}

interface User {
  // Enhanced for multi-tenant
  id: string;
  tenantId: string;        // Multi-tenant support
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'florist' | 'viewer';
  permissions: Permission[];
  lastLoginAt: Date;
  isActive: boolean;
}
```

#### **Shopify App Integration**
```typescript
interface ShopifyAppConfig {
  appId: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  webhookTopics: string[];
  redirectUrl: string;
}

interface ShopifyInstallation {
  id: string;
  tenantId: string;
  shopDomain: string;
  accessToken: string;
  scopes: string[];
  installedAt: Date;
  uninstalledAt?: Date;
  webhookSubscriptions: WebhookSubscription[];
}

interface WebhookSubscription {
  id: string;
  topic: 'orders/create' | 'orders/updated' | 'products/create' | 'products/update';
  address: string;
  format: 'json' | 'xml';
  status: 'active' | 'inactive';
}
```

### **🔧 Phase 3 Technical Implementation**

#### **Multi-Tenant Architecture**
```typescript
// Tenant Isolation
interface TenantContext {
  tenantId: string;
  database: string; // Separate database per tenant
  cache: string;    // Separate cache namespace
  storage: string;  // Separate storage bucket
}

// Database Schema per Tenant
interface TenantDatabase {
  users: User[];
  stores: Store[];
  products: Product[];
  orders: Order[];
  recipes: Recipe[];
  stockLevels: StockLevel[];
  forecasts: ForecastData[];
}

// API Gateway with Tenant Routing
interface ApiGateway {
  authenticate(request: Request): Promise<AuthResult>;
  routeToTenant(tenantId: string, request: Request): Promise<Response>;
  validateSubscription(tenantId: string): Promise<boolean>;
  rateLimit(tenantId: string, endpoint: string): Promise<boolean>;
}
```

#### **Shopify App Store Features**
```typescript
// App Installation Flow
interface AppInstallationService {
  generateAuthUrl(shopDomain: string): string;
  handleCallback(code: string, shop: string): Promise<InstallationResult>;
  verifyWebhook(topic: string, body: string, headers: Headers): boolean;
  handleWebhook(topic: string, payload: any): Promise<void>;
}

// App Store Compliance
interface AppStoreCompliance {
  validatePrivacyPolicy(): boolean;
  validateTermsOfService(): boolean;
  validateDataHandling(): boolean;
  validateSecurityMeasures(): boolean;
  generateComplianceReport(): ComplianceReport;
}
```

### **🚀 Phase 3 Deployment Architecture**

#### **Scalable Infrastructure**
```
Load Balancer (Cloudflare)
    ↓
API Gateway (Multi-tenant routing)
    ↓
Application Servers (Auto-scaling)
    ↓
Database Cluster (Sharded by tenant)
    ↓
Cache Layer (Redis clusters)
    ↓
File Storage (S3-compatible)
    ↓
Shopify API + Webhooks
```

#### **Security Architecture**
```typescript
// Security Layers
interface SecurityConfig {
  authentication: {
    provider: 'oauth' | 'jwt' | 'shopify';
    sessionTimeout: number;
    refreshTokenRotation: boolean;
  };
  authorization: {
    rbac: boolean;
    abac: boolean;
    tenantIsolation: boolean;
  };
  dataProtection: {
    encryption: 'at-rest' | 'in-transit' | 'both';
    keyRotation: boolean;
    dataRetention: number;
  };
  monitoring: {
    auditLogs: boolean;
    anomalyDetection: boolean;
    rateLimiting: boolean;
  };
}
```

---

## 📅 **Implementation Roadmap**

### **Phase 1 Timeline: 4-6 weeks**
- **Week 1-2**: UI/UX perfection and mobile optimization
- **Week 3-4**: Authentication system and protected routes
- **Week 5-6**: Testing, bug fixes, and performance optimization

### **Phase 2 Timeline: 8-10 weeks**
- **Week 1-2**: Recipe management system
- **Week 3-4**: Stock tracking and inventory management
- **Week 5-6**: Forecasting engine development
- **Week 7-8**: Dashboard and reporting features
- **Week 9-10**: Testing and optimization

### **Phase 3 Timeline: 12-16 weeks**
- **Week 1-3**: Multi-tenant architecture design
- **Week 4-6**: Shopify app store integration
- **Week 7-9**: Security and compliance implementation
- **Week 10-12**: Scalability and performance optimization
- **Week 13-16**: Testing, documentation, and app store submission

---

## 🎯 **Success Metrics**

### **Phase 1 Metrics**
- **User Adoption**: 90% of florists use the app daily
- **Order Completion Time**: 20% reduction in order processing time
- **Mobile Usage**: 70% of orders managed via mobile
- **Error Rate**: < 1% system errors

### **Phase 2 Metrics**
- **Stock Accuracy**: 95% forecast accuracy
- **Waste Reduction**: 30% reduction in ingredient waste
- **Order Fulfillment**: 99% on-time order completion
- **Cost Savings**: 25% reduction in inventory costs

### **Phase 3 Metrics**
- **App Store Rating**: 4.5+ stars
- **Customer Retention**: 95% monthly retention rate
- **Revenue Growth**: 200% year-over-year growth
- **Market Share**: Top 3 florist management apps

---

## 🔮 **Future Considerations**

### **Advanced Features**
- **AI-Powered Forecasting**: Machine learning for demand prediction
- **IoT Integration**: Smart inventory sensors
- **Mobile App**: Native iOS/Android applications
- **Advanced Analytics**: Business intelligence dashboard

### **Scalability Plans**
- **Microservices Architecture**: Service decomposition
- **Event-Driven Architecture**: Real-time data processing
- **Global Deployment**: Multi-region infrastructure
- **API Marketplace**: Third-party integrations

This architecture document provides a comprehensive roadmap for building a world-class florist order management system that can scale from a single shop to a multi-tenant SaaS platform. 