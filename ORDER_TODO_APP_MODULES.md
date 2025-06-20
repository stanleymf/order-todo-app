# 📋 Order To-Do App - Complete Module Documentation

## 🏗️ **Core Application Structure**

### **Main App Files**
- **`src/App.tsx`** - Main application component, handles routing and authentication
- **`src/main.tsx`** - Entry point, renders the app to DOM
- **`index.html`** - HTML template
- **`src/index.css`** - Global styles and Tailwind CSS

---

## 🎯 **Business Logic Components**

### **Dashboard & Navigation**
- **`src/components/Dashboard.tsx`** - Main dashboard with tab navigation (Orders, Analytics, Products)
- **`src/components/Login.tsx`** - Authentication component
- **`src/components/Navigation.tsx`** - Navigation bar component
- **`src/components/StoreSelector.tsx`** - Multi-store selection component

### **Core Features**
- **`src/components/OrdersView.tsx`** ⭐ **Main Orders Dashboard** - Enhanced with:
  - **Multi-field search functionality** (Order ID, product name, variant, remarks, labels)
  - **Batch assignment mode** with checkbox selection and bulk operations
  - **Hierarchical sorting system** with 5-level priority
  - **Status filtering** (All, Pending, Assigned, Completed)
  - **Dual-label filtering** (Date, Store, Difficulty, Product Type)
  - **Real-time order count display**
- **`src/components/OrderCard.tsx`** - Individual order display and management with:
  - **Personalized highlighting** for current user's assigned orders
  - **Batch selection support** with checkboxes
  - **Enhanced mobile responsiveness**
  - **Visual status indicators**
- **`src/components/ProductManagement.tsx`** ⭐ **Shopify-Friendly Product Management** - Enhanced with:
  - **Shopify API integration** for product synchronization
  - **Multi-store product management** with store filtering
  - **Shopify product details** (ID, handle, status, variants, images)
  - **Direct Shopify admin links** for each product
  - **Metafield management** for florist-specific metadata
  - **Product sync controls** with real-time status
  - **Advanced search** across Shopify fields
  - **Product label management** (Admin-only)
- **`src/components/Analytics.tsx`** - Florist performance analytics and reporting

---

## 🎨 **UI Component Library** (46 components)

### **Form Components**
- **`src/components/ui/button.tsx`**
- **`src/components/ui/input.tsx`**
- **`src/components/ui/textarea.tsx`**
- **`src/components/ui/label.tsx`**
- **`src/components/ui/select.tsx`**
- **`src/components/ui/checkbox.tsx`**
- **`src/components/ui/radio-group.tsx`**
- **`src/components/ui/switch.tsx`**
- **`src/components/ui/form.tsx`**
- **`src/components/ui/input-otp.tsx`**
- **`src/components/ui/slider.tsx`**

### **Layout Components**
- **`src/components/ui/card.tsx`**
- **`src/components/ui/sheet.tsx`**
- **`src/components/ui/dialog.tsx`**
- **`src/components/ui/drawer.tsx`**
- **`src/components/ui/tabs.tsx`**
- **`src/components/ui/accordion.tsx`**
- **`src/components/ui/collapsible.tsx`**
- **`src/components/ui/sidebar.tsx`**
- **`src/components/ui/resizable.tsx`**
- **`src/components/ui/separator.tsx`**

### **Navigation Components**
- **`src/components/ui/navigation-menu.tsx`**
- **`src/components/ui/menubar.tsx`**
- **`src/components/ui/breadcrumb.tsx`**
- **`src/components/ui/dropdown-menu.tsx`**
- **`src/components/ui/context-menu.tsx`**
- **`src/components/ui/pagination.tsx`**

### **Display Components**
- **`src/components/ui/table.tsx`**
- **`src/components/ui/badge.tsx`**
- **`src/components/ui/avatar.tsx`**
- **`src/components/ui/calendar.tsx`**
- **`src/components/ui/chart.tsx`**
- **`src/components/ui/carousel.tsx`**
- **`src/components/ui/progress.tsx`**
- **`src/components/ui/alert.tsx`**
- **`src/components/ui/alert-dialog.tsx`**
- **`src/components/ui/skeleton.tsx`**

### **Interactive Components**
- **`src/components/ui/command.tsx`**
- **`src/components/ui/popover.tsx`**
- **`src/components/ui/tooltip.tsx`**
- **`src/components/ui/hover-card.tsx`**
- **`src/components/ui/scroll-area.tsx`**
- **`src/components/ui/toggle.tsx`**
- **`src/components/ui/toggle-group.tsx`**
- **`src/components/ui/sonner.tsx`** (toast notifications)
- **`src/components/ui/aspect-ratio.tsx`**

---

## 🔧 **Data & Business Logic**

### **Data Models & Types**
- **`src/types/index.ts`** ⭐ **Core TypeScript Interfaces**:
  - `User` (admin/florist roles)
  - `Store` (multi-store support)
  - `Product` (with difficulty & product type labels)
  - `Order` (inherits labels from products)
  - `ProductLabel` (categorized by difficulty/productType)
  - `FloristStats`, `AuthState`
  - **Shopify-specific interfaces**: `ProductVariant`, `ProductImage`, `ProductMetafield`

### **Data Management**
- **`src/utils/storage.ts`** ⭐ **Core Data Layer** (446 lines):
  - Authentication functions
  - **Dual-label filtering**: `getOrdersByDateStoreAndLabels()`
  - **Label management**: `updateProductDifficultyLabel()`, `updateProductTypeLabel()`
  - Order management (assign, complete, update)
  - Statistics calculation
  - LocalStorage persistence
- **`src/utils/shopifyApi.ts`** ⭐ **Shopify API Integration**:
  - **ShopifyApiService class** for REST Admin API operations
  - **Product synchronization** from Shopify stores
  - **Metafield management** for florist-specific data
  - **Tag management** for difficulty and product type labels
  - **Data mapping** between Shopify and local formats
  - **Error handling** and API response processing

### **Mock Data**
- **`src/data/mockData.ts`** ⭐ **Sample Data** (466 lines):
  - **50+ orders** with realistic dual labels
  - **Multiple stores**: Windflower Florist, Bloom & Co, Garden Dreams
  - **Pre-configured labels**: Difficulty (Easy→Very Hard), Product Types (Bouquet, Vase, etc.)
  - **Florist performance data**

### **Utilities**
- **`src/lib/utils.ts`** - Utility functions (className merging, etc.)

### **Hooks**
- **`src/components/hooks/use-mobile.tsx`** - Mobile responsiveness hook

---

## ⚙️ **Configuration & Build**

### **Development Setup**
- **`package.json`** - Dependencies and scripts
- **`vite.config.ts`** - Vite configuration
- **`tsconfig.json`** - TypeScript configuration
- **`tailwind.config.ts`** - Tailwind CSS configuration
- **`postcss.config.js`** - PostCSS configuration

### **Code Quality**
- **`eslint.config.js`** - ESLint rules
- **`biome.json`** - Biome formatter/linter
- **`components.json`** - shadcn/ui configuration
- **`.gitignore`** - Git ignore patterns

### **Deployment**
- **`worker/index.ts`** - Cloudflare Worker entry point
- **`wrangler.jsonc`** - Cloudflare Workers configuration

---

## 🎯 **Key Enhanced Features**

### **⭐ Advanced Search & Filtering System**
- **Multi-field search**: Order ID, product name, variant, remarks, customizations, labels, timeslot
- **Real-time search results** with count display
- **Search icon and clear button** for better UX
- **Status filtering**: All, Pending, Assigned, Completed
- **Dual-label filtering**: Date + Store + Difficulty + Product Type

### **⭐ Batch Assignment System**
- **Batch mode toggle** for bulk operations
- **Checkbox selection** for individual orders
- **Select all/Clear selection** functionality
- **Bulk assign to current user** button
- **Bulk unassign** button
- **Visual feedback** for selected orders

### **⭐ Hierarchical Sorting System (5-Level Priority)**
Orders are sorted using the following hierarchical rules:

1. **Assigned Florist Priority** (Primary)
   - Current user's assigned orders appear **FIRST**
   - Unassigned orders appear **SECOND**
   - Other florists' assigned orders appear **THIRD**

2. **Timeslot Priority** (Secondary)
   - Earlier timeslots appear first
   - Parses time format (e.g., "9:00 AM - 11:00 AM" → "9:00 AM")
   - Converts to minutes for numerical comparison

3. **Product Name Priority** (Tertiary)
   - Alphabetical sorting of product names
   - Same product names are grouped together

4. **Difficulty Priority** (Quaternary)
   - Based on configured difficulty labels
   - Uses priority values from ProductLabel configuration
   - Unknown difficulties appear at the end

5. **Product Type Priority** (Quinary)
   - Based on configured product type labels
   - Uses priority values from ProductLabel configuration
   - Unknown product types appear at the end

### **⭐ Enhanced UI/UX Features**
- **Personalized order highlighting**: Current user's assigned orders highlighted in yellow
- **Mobile-first responsive design** with horizontal scrolling cards
- **Visual status indicators** with color-coded borders
- **Real-time order statistics** display
- **Smooth animations** and transitions
- **Accessibility features** with proper ARIA labels

### **⭐ Shopify Integration & API Features**
- **Shopify REST Admin API integration** with latest API version (2024-01)
- **Multi-store product synchronization** with individual store controls
- **Shopify product metadata** including variants, images, and metafields
- **Florist-specific metafields** for difficulty, time estimates, and instructions
- **Direct Shopify admin links** for seamless product management
- **Product status tracking** (active, archived, draft)
- **Shopify handle and ID display** for easy product identification
- **Tag-based difficulty and product type extraction**
- **Real-time sync status** with loading indicators
- **Error handling** for API failures and network issues

### **⭐ Shopify-Ready Architecture**
- Multi-store support with domain mapping
- API-ready data structures
- Webhook-compatible order/product models

### **⭐ Florist Workflow Optimization**
- Role-based access (Admin/Florist)
- Order assignment and completion tracking
- Performance analytics and reporting
- Real-time filtering and organization
- **Personalized workflow** with current user priority

---

## 📊 **Module Count Summary**

| Category | Count | Description |
|----------|-------|-------------|
| **Core App Components** | 8 | Main business logic components |
| **UI Components** | 46 | Reusable UI library (shadcn/ui) |
| **Data & Types** | 4 | TypeScript interfaces, data management, mock data |
| **Configuration** | 8 | Build, deployment, and code quality configs |
| **Utilities & Hooks** | 2 | Helper functions and React hooks |
| **Build Artifacts** | 8+ | Generated files (node_modules, .wrangler, etc.) |

**Total Active Modules: 68**

---

## 🚀 **Architecture Highlights**

### **Frontend Stack**
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Radix UI** primitives
- **Lucide React** icons

### **Backend/Deployment**
- **Cloudflare Workers** for serverless deployment
- **LocalStorage** for data persistence (ready for API upgrade)
- **Mock data** for development and testing

### **Development Experience**
- **Hot Module Replacement** (HMR)
- **TypeScript** for type safety
- **ESLint + Biome** for code quality
- **pnpm** for package management

### **Performance Features**
- **Optimized sorting algorithms** with hierarchical priority
- **Efficient search** with multiple field indexing
- **Batch operations** for improved productivity
- **Responsive design** for all device sizes

This is a comprehensive florist management system designed for scalability, productivity, and Shopify integration with advanced workflow optimization features! 