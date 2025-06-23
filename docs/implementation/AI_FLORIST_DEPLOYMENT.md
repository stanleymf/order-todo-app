# 🌸 AI Florist - Deployment Guide

## 🚀 **Current Deployment Status**

### **Live Environment**
- **URL**: https://order-to-do.stanleytan92.workers.dev/ai-florist
- **Environment**: Production
- **Version**: 94119c7e-a1d4-4843-bd51-f052502ccdc7
- **Last Deployed**: 2025-01-13
- **Status**: ✅ Active and Functional

### **Deployment Details**
- **Frontend**: Cloudflare Pages
- **Backend**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Domain**: order-to-do.stanleytan92.workers.dev

---

## 🔧 **Deployment Commands**

### **Quick Deploy**
```bash
# Build and deploy to production
npm run deploy
```

### **Development Commands**
```bash
# Start local development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### **Database Operations**
```bash
# View saved products count
wrangler d1 execute order-todo-db --command "SELECT COUNT(*) FROM saved_products;"

# View recent products
wrangler d1 execute order-todo-db --command "SELECT title, tags, created_at FROM saved_products ORDER BY created_at DESC LIMIT 5;"

# Clear training data (if needed)
wrangler d1 execute order-todo-db --command "DELETE FROM saved_products;"

# Initialize database
curl -X POST https://order-to-do.stanleytan92.workers.dev/api/init-db
```

---

## 📁 **Project Structure**

### **Key Files for Deployment**
```
├── src/
│   ├── components/
│   │   └── AIFlorist.tsx          # Main AI Florist component
│   ├── services/
│   │   ├── api.ts                 # API client functions
│   │   ├── database-d1.ts         # Database operations
│   │   └── aiTrainingService.ts   # AI training logic
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── worker/
│   └── index.ts                   # Cloudflare Worker backend
├── wrangler.jsonc                 # Wrangler configuration
├── package.json                   # Dependencies and scripts
├── vite.config.ts                 # Vite build configuration
└── tailwind.config.ts             # Tailwind CSS configuration
```

### **Configuration Files**

#### **wrangler.jsonc**
```json
{
  "name": "order-to-do",
  "main": "worker/index.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "order-todo-db",
      "database_id": "eb64601c-2b31-42c6-bad9-acaa5d2b2d7b"
    }
  ],
  "env": {
    "JWT_SECRET": "your-super-secret-jwt-key-for-development-only"
  }
}
```

#### **package.json**
```json
{
  "name": "order-to-do-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "lucide-react": "^0.263.1",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-textarea": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.14",
    "postcss": "^8.4.24",
    "tailwindcss": "^3.3.2",
    "typescript": "^5.0.2",
    "vite": "^4.4.0",
    "wrangler": "^3.0.0"
  }
}
```

---

## 🌐 **Environment Setup**

### **Required Environment Variables**
```env
# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-for-development-only

# Node environment
NODE_ENV=production

# Database configuration (handled by wrangler.jsonc)
# D1_DATABASE_ID=eb64601c-2b31-42c6-bad9-acaa5d2b2d7b
```

### **Cloudflare Configuration**

#### **D1 Database**
- **Database Name**: order-todo-db
- **Database ID**: eb64601c-2b31-42c6-bad9-acaa5d2b2d7b
- **Binding**: DB
- **Type**: SQLite

#### **Workers Configuration**
- **Runtime**: Cloudflare Workers
- **Compatibility Date**: 2024-01-01
- **Memory**: 128MB
- **CPU Time**: 10ms

#### **Pages Configuration**
- **Framework**: React
- **Build Command**: npm run build
- **Output Directory**: dist
- **Root Directory**: /

---

## 🗄️ **Database Schema**

### **Required Tables**

#### **Saved Products Table**
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

#### **Product Labels Table**
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

#### **Product Label Mappings Table**
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

### **Database Initialization**
```bash
# Run database migrations
wrangler d1 execute order-todo-db --file=./schema.sql

# Create indexes for performance
wrangler d1 execute order-todo-db --command "
CREATE INDEX IF NOT EXISTS idx_saved_products_tenant_id ON saved_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_products_shopify_ids ON saved_products(shopify_product_id, shopify_variant_id);
CREATE INDEX IF NOT EXISTS idx_product_label_mappings_product_id ON product_label_mappings(saved_product_id);
CREATE INDEX IF NOT EXISTS idx_product_label_mappings_label_id ON product_label_mappings(label_id);
"
```

---

## 🔄 **Deployment Process**

### **Step 1: Pre-deployment Checklist**
- [ ] **Code Review**: All changes reviewed and tested
- [ ] **Database**: Schema migrations applied
- [ ] **Environment Variables**: All required variables set
- [ ] **Dependencies**: All dependencies installed
- [ ] **Build**: Application builds successfully

### **Step 2: Build Process**
```bash
# Install dependencies
npm install

# Run type checking
npm run type-check

# Build for production
npm run build

# Verify build output
ls -la dist/
```

### **Step 3: Deploy to Cloudflare**
```bash
# Deploy to Cloudflare Pages
npm run deploy

# Verify deployment
curl -I https://order-to-do.stanleytan92.workers.dev/ai-florist
```

### **Step 4: Post-deployment Verification**
- [ ] **Health Check**: Application loads without errors
- [ ] **Authentication**: Login functionality works
- [ ] **AI Florist**: Page accessible and functional
- [ ] **Database**: Training data loads correctly
- [ ] **API Endpoints**: All endpoints respond correctly

---

## 🧪 **Testing Deployment**

### **Health Check Commands**
```bash
# Check application health
curl -I https://order-to-do.stanleytan92.workers.dev/

# Test AI Florist page
curl -I https://order-to-do.stanleytan92.workers.dev/ai-florist

# Test API endpoints
curl -X GET "https://order-to-do.stanleytan92.workers.dev/api/health"

# Check database connectivity
wrangler d1 execute order-todo-db --command "SELECT COUNT(*) FROM saved_products;"
```

### **Functional Testing**
```bash
# Test sample product creation
curl -X POST "https://order-to-do.stanleytan92.workers.dev/api/tenants/test-tenant/sample-products" \
  -H "Authorization: Bearer test-token"

# Test saved products retrieval
curl -X GET "https://order-to-do.stanleytan92.workers.dev/api/tenants/test-tenant/saved-products" \
  -H "Authorization: Bearer test-token"
```

### **Performance Testing**
```bash
# Test page load time
curl -w "@curl-format.txt" -o /dev/null -s "https://order-to-do.stanleytan92.workers.dev/ai-florist"

# Test API response time
curl -w "@curl-format.txt" -o /dev/null -s "https://order-to-do.stanleytan92.workers.dev/api/health"
```

---

## 🔍 **Monitoring and Logs**

### **Cloudflare Analytics**
- **Access**: Cloudflare Dashboard → Analytics
- **Metrics**: Page views, bandwidth, requests
- **Real-time**: Live traffic monitoring

### **Worker Logs**
```bash
# View recent worker logs
wrangler tail

# Filter logs by function
wrangler tail --format=pretty

# Export logs to file
wrangler tail --format=json > logs.json
```

### **Database Monitoring**
```bash
# Check database size
wrangler d1 execute order-todo-db --command "PRAGMA page_count;"

# Check table sizes
wrangler d1 execute order-todo-db --command "
SELECT 
  name,
  sqlite_compileoption_used('ENABLE_FTS5') as fts5_enabled,
  length(sql) as sql_length
FROM sqlite_master 
WHERE type='table';
"

# Monitor query performance
wrangler d1 execute order-todo-db --command "PRAGMA query_only = 1;"
```

---

## 🚨 **Troubleshooting**

### **Common Issues**

#### **1. Build Failures**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build cache
rm -rf dist .vite
npm run build
```

#### **2. Database Connection Issues**
```bash
# Check database binding
wrangler d1 execute order-todo-db --command "SELECT 1;"

# Verify database exists
wrangler d1 list

# Recreate database if needed
wrangler d1 delete order-todo-db
wrangler d1 create order-todo-db
```

#### **3. Deployment Failures**
```bash
# Check wrangler configuration
wrangler whoami

# Verify project settings
wrangler pages project list

# Check deployment status
wrangler pages deployment list
```

#### **4. API Errors**
```bash
# Test API endpoints
curl -X GET "https://order-to-do.stanleytan92.workers.dev/api/health"

# Check worker logs
wrangler tail

# Verify environment variables
wrangler secret list
```

### **Debug Commands**
```bash
# Local development with debugging
npm run dev

# Test database operations locally
wrangler d1 execute order-todo-db --local --command "SELECT * FROM saved_products;"

# Test worker locally
wrangler dev

# Check build output
npm run build && ls -la dist/
```

---

## 🔒 **Security Considerations**

### **Environment Variables**
- [ ] **JWT Secret**: Use strong, unique secret
- [ ] **Database Credentials**: Secure database access
- [ ] **API Keys**: Store sensitive keys as secrets

### **Access Control**
- [ ] **Authentication**: JWT-based authentication
- [ ] **Authorization**: Tenant-based access control
- [ ] **Rate Limiting**: API rate limiting implemented

### **Data Protection**
- [ ] **Input Validation**: All inputs sanitized
- [ ] **SQL Injection**: Parameterized queries used
- [ ] **XSS Protection**: Content Security Policy

---

## 📊 **Performance Optimization**

### **Build Optimization**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-select', '@radix-ui/react-textarea']
        }
      }
    },
    minify: 'terser',
    sourcemap: false
  }
});
```

### **Database Optimization**
```sql
-- Add indexes for performance
CREATE INDEX idx_saved_products_tenant_id ON saved_products(tenant_id);
CREATE INDEX idx_saved_products_created_at ON saved_products(created_at);
CREATE INDEX idx_product_labels_tenant_id ON product_labels(tenant_id);
```

### **Caching Strategy**
```typescript
// Implement caching for training data
const cacheKey = `training-data-${tenantId}`;
const cachedData = await caches.default.match(cacheKey);
if (cachedData) {
  return cachedData.json();
}
```

---

## 🔄 **CI/CD Pipeline**

### **GitHub Actions Workflow**
```yaml
name: Deploy AI Florist

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: order-to-do
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### **Environment Secrets**
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID
- `JWT_SECRET`: JWT secret for authentication

---

## 📈 **Scaling Considerations**

### **Current Limits**
- **D1 Database**: 1GB storage, 1000 requests/second
- **Workers**: 128MB memory, 10ms CPU time
- **Pages**: 100 requests/second, 100MB bundle size

### **Scaling Strategies**
- **Database**: Implement read replicas for high traffic
- **Caching**: Add Redis for frequently accessed data
- **CDN**: Use Cloudflare CDN for static assets
- **Load Balancing**: Implement multiple worker instances

---

*Last Updated: 2025-01-13*
*Version: 1.0.0*
*Status: Production Ready* 