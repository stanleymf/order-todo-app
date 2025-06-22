# 🏪 Inventory Management System

## 📋 **Overview**

The **Inventory Management System** is a comprehensive component designed to manage florist ingredients, track stock levels, and provide the foundation for recipe management. This system will integrate with the recipe feature to supply ingredient data and enable efficient stock forecasting.

---

## 🎯 **Core Objectives**

### **Primary Goals**
- **Ingredient Database**: Centralized management of all florist materials
- **Stock Tracking**: Real-time monitoring of ingredient quantities
- **Recipe Integration**: Supply ingredient data for product recipes
- **Supplier Management**: Track suppliers and ordering information
- **Category Organization**: Logical grouping of ingredients by type

### **Secondary Goals**
- **Cost Tracking**: Monitor ingredient costs and pricing
- **Expiry Management**: Track ingredient freshness and shelf life
- **Location Management**: Organize ingredients by storage location
- **Reorder Alerts**: Automated notifications for low stock levels

---

## 📊 **Data Architecture**

### **Core Data Models**

#### **Inventory Item**
```typescript
interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  category: IngredientCategory;
  subcategory?: string;
  description?: string;
  unit: InventoryUnit;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  costPerUnit: number;
  supplierId?: string;
  location?: string;
  expiryDate?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

type IngredientCategory = 
  | 'flowers'
  | 'greenery'
  | 'accessories'
  | 'vases'
  | 'packaging'
  | 'tools'
  | 'chemicals'
  | 'other';

type InventoryUnit = 
  | 'stems'
  | 'bunches'
  | 'pieces'
  | 'grams'
  | 'kilograms'
  | 'liters'
  | 'meters'
  | 'boxes'
  | 'packs';
```

#### **Supplier Management**
```typescript
interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: Address;
  paymentTerms?: string;
  leadTime: number; // days
  minimumOrder?: number;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}
```

#### **Stock Transactions**
```typescript
interface StockTransaction {
  id: string;
  tenantId: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment' | 'expiry' | 'damage';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string; // PO number, order ID, etc.
  performedBy: string; // user ID
  performedAt: Date;
  notes?: string;
}

interface StockAdjustment {
  id: string;
  itemId: string;
  adjustmentType: 'add' | 'subtract' | 'set';
  quantity: number;
  reason: string;
  performedBy: string;
  performedAt: Date;
}
```

---

## 🏗️ **System Architecture**

### **Database Schema**

#### **Tables Structure**
```sql
-- Inventory Items
CREATE TABLE inventory_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  unit TEXT NOT NULL,
  current_stock REAL NOT NULL DEFAULT 0,
  minimum_stock REAL NOT NULL DEFAULT 0,
  maximum_stock REAL,
  cost_per_unit REAL NOT NULL DEFAULT 0,
  supplier_id TEXT,
  location TEXT,
  expiry_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Suppliers
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT,
  payment_terms TEXT,
  lead_time INTEGER NOT NULL DEFAULT 1,
  minimum_order REAL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Stock Transactions
CREATE TABLE stock_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  previous_stock REAL NOT NULL,
  new_stock REAL NOT NULL,
  reason TEXT,
  reference TEXT,
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  FOREIGN KEY (performed_by) REFERENCES users(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

### **API Endpoints**

#### **Inventory Items**
```typescript
// GET /api/inventory/items
// GET /api/inventory/items/:id
// POST /api/inventory/items
// PUT /api/inventory/items/:id
// DELETE /api/inventory/items/:id
// GET /api/inventory/items/category/:category
// GET /api/inventory/items/low-stock
// POST /api/inventory/items/:id/adjust-stock

interface InventoryItemResponse {
  success: boolean;
  data?: InventoryItem | InventoryItem[];
  error?: string;
}

interface StockAdjustmentRequest {
  adjustmentType: 'add' | 'subtract' | 'set';
  quantity: number;
  reason: string;
}
```

#### **Suppliers**
```typescript
// GET /api/inventory/suppliers
// GET /api/inventory/suppliers/:id
// POST /api/inventory/suppliers
// PUT /api/inventory/suppliers/:id
// DELETE /api/inventory/suppliers/:id

interface SupplierResponse {
  success: boolean;
  data?: Supplier | Supplier[];
  error?: string;
}
```

---

## 🎨 **User Interface Design**

### **Main Inventory Dashboard**

#### **Layout Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Inventory Management                                        │
├─────────────────────────────────────────────────────────────┤
│ [Search] [Filter by Category] [Add New Item] [+ New Order]  │
├─────────────────────────────────────────────────────────────┤
│ Category Tabs: [All] [Flowers] [Greenery] [Accessories]     │
├─────────────────────────────────────────────────────────────┤
│ Item List (Table View)                                      │
│ ┌─────────┬─────────────┬─────────┬─────────┬─────────────┐ │
│ │ Name    │ Category    │ Stock   │ Cost    │ Actions     │ │
│ ├─────────┼─────────────┼─────────┼─────────┼─────────────┤ │
│ │ Roses   │ Flowers     │ 150     │ $2.50   │ [Edit] [⋮]  │ │
│ │ Vases   │ Accessories │ 25      │ $15.00  │ [Edit] [⋮]  │ │
│ └─────────┴─────────────┴─────────┴─────────┴─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### **Key Features**
- **Search & Filter**: Quick find by name, category, or supplier
- **Category Tabs**: Easy navigation between ingredient types
- **Stock Alerts**: Color-coded indicators for low stock
- **Bulk Actions**: Select multiple items for batch operations
- **Quick Add**: Fast entry for common ingredients

### **Add/Edit Item Modal**

#### **Form Structure**
```
┌─────────────────────────────────────────────────────────────┐
│ Add New Inventory Item                                      │
├─────────────────────────────────────────────────────────────┤
│ Name:           [________________]                          │
│ Category:       [Dropdown: Flowers ▼]                       │
│ Subcategory:    [________________] (Optional)               │
│ Description:    [________________] (Optional)               │
│ Unit:           [Dropdown: Stems ▼]                         │
│ Current Stock:  [____]                                      │
│ Min Stock:      [____]                                      │
│ Max Stock:      [____] (Optional)                           │
│ Cost per Unit:  [$____.__]                                  │
│ Supplier:       [Dropdown: Select Supplier ▼]               │
│ Location:       [________________] (Optional)               │
│ Expiry Date:    [Date Picker] (Optional)                    │
├─────────────────────────────────────────────────────────────┤
│ [Cancel] [Save Item]                                        │
└─────────────────────────────────────────────────────────────┘
```

### **Stock Adjustment Modal**

#### **Quick Stock Update**
```
┌─────────────────────────────────────────────────────────────┐
│ Adjust Stock: Roses                                         │
├─────────────────────────────────────────────────────────────┤
│ Current Stock: 150 stems                                    │
│                                                             │
│ Adjustment Type: [Add ▼] [Subtract] [Set to]               │
│ Quantity:       [____]                                      │
│ Reason:         [Dropdown: Received Order ▼]                │
│ Notes:          [________________] (Optional)               │
├─────────────────────────────────────────────────────────────┤
│ [Cancel] [Update Stock]                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 **Technical Implementation**

### **Frontend Components**

#### **Inventory Dashboard**
```typescript
interface InventoryDashboardProps {
  tenantId: string;
  view: 'list' | 'grid' | 'low-stock';
  category?: IngredientCategory;
  searchQuery?: string;
}

const InventoryDashboard: React.FC<InventoryDashboardProps> = ({
  tenantId,
  view,
  category,
  searchQuery
}) => {
  // Implementation
};
```

#### **Inventory Item Form**
```typescript
interface InventoryItemFormProps {
  item?: InventoryItem;
  suppliers: Supplier[];
  onSave: (item: InventoryItem) => void;
  onCancel: () => void;
}

const InventoryItemForm: React.FC<InventoryItemFormProps> = ({
  item,
  suppliers,
  onSave,
  onCancel
}) => {
  // Implementation
};
```

#### **Stock Adjustment Modal**
```typescript
interface StockAdjustmentModalProps {
  item: InventoryItem;
  isOpen: boolean;
  onClose: () => void;
  onAdjust: (adjustment: StockAdjustment) => void;
}

const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  item,
  isOpen,
  onClose,
  onAdjust
}) => {
  // Implementation
};
```

### **Backend Services**

#### **Inventory Service**
```typescript
class InventoryService {
  async getItems(tenantId: string, filters?: InventoryFilters): Promise<InventoryItem[]>;
  async getItem(id: string): Promise<InventoryItem>;
  async createItem(item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<InventoryItem>;
  async updateItem(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem>;
  async deleteItem(id: string): Promise<void>;
  async adjustStock(itemId: string, adjustment: StockAdjustment): Promise<StockTransaction>;
  async getLowStockItems(tenantId: string, threshold?: number): Promise<InventoryItem[]>;
  async getItemsByCategory(tenantId: string, category: IngredientCategory): Promise<InventoryItem[]>;
}
```

#### **Supplier Service**
```typescript
class SupplierService {
  async getSuppliers(tenantId: string): Promise<Supplier[]>;
  async getSupplier(id: string): Promise<Supplier>;
  async createSupplier(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier>;
  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier>;
  async deleteSupplier(id: string): Promise<void>;
}
```

---

## 🔗 **Integration Points**

### **Recipe Management Integration**
```typescript
// Recipe system will consume inventory data
interface RecipeIngredientSelector {
  availableIngredients: InventoryItem[];
  onSelect: (ingredient: InventoryItem) => void;
  onSearch: (query: string) => void;
}

// Inventory system will track recipe usage
interface RecipeUsageTracker {
  trackRecipeUsage(recipeId: string, quantity: number): Promise<void>;
  calculateRequiredStock(recipeId: string, orderQuantity: number): Promise<StockRequirement[]>;
}
```

### **Order Management Integration**
```typescript
// When orders are processed, inventory is automatically adjusted
interface OrderInventoryProcessor {
  processOrder(order: Order): Promise<StockTransaction[]>;
  reserveStock(order: Order): Promise<void>;
  releaseStock(order: Order): Promise<void>;
}
```

### **Analytics Integration**
```typescript
// Inventory data feeds into analytics
interface InventoryAnalytics {
  getStockTurnover(itemId: string, dateRange: DateRange): Promise<TurnoverData>;
  getLowStockAlerts(tenantId: string): Promise<StockAlert[]>;
  getCostAnalysis(tenantId: string, dateRange: DateRange): Promise<CostAnalysis>;
}
```

---

## 📈 **Future Enhancements**

### **Phase 2.1: Advanced Features**
- **Barcode Scanning**: QR code/barcode support for quick stock updates
- **Mobile App**: Dedicated mobile interface for stock management
- **Automated Reordering**: AI-powered purchase order generation
- **Supplier Integration**: Direct API connections to supplier systems

### **Phase 2.2: AI Integration**
- **Demand Forecasting**: Predict ingredient needs based on order history
- **Optimal Stock Levels**: AI recommendations for minimum/maximum stock
- **Cost Optimization**: Suggest alternative suppliers or bulk purchasing
- **Waste Reduction**: Track and minimize ingredient spoilage

### **Phase 2.3: Advanced Analytics**
- **Profit Margins**: Track ingredient costs vs. product pricing
- **Seasonal Analysis**: Identify seasonal ingredient patterns
- **Supplier Performance**: Rate and track supplier reliability
- **Inventory Valuation**: Real-time inventory worth calculations

---

## 🚀 **Implementation Roadmap**

### **Phase 1: Core Inventory (Week 1-2)**
- [ ] Database schema creation
- [ ] Basic CRUD operations for inventory items
- [ ] Simple inventory dashboard
- [ ] Stock adjustment functionality

### **Phase 2: Supplier Management (Week 3)**
- [ ] Supplier CRUD operations
- [ ] Supplier-inventory item relationships
- [ ] Supplier selection in item forms

### **Phase 3: Recipe Integration (Week 4)**
- [ ] Inventory item selection in recipe builder
- [ ] Recipe display in product image modals
- [ ] Stock calculation for recipes

### **Phase 4: Advanced Features (Week 5-6)**
- [ ] Low stock alerts
- [ ] Stock transaction history
- [ ] Bulk operations
- [ ] Search and filtering

### **Phase 5: Testing & Polish (Week 7)**
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] UI/UX refinements
- [ ] Documentation completion

---

## 📋 **Success Metrics**

### **Operational Metrics**
- **Stock Accuracy**: 95%+ accuracy in stock levels
- **Low Stock Response**: <24 hours to address low stock alerts
- **Data Entry Speed**: <30 seconds to add new inventory item
- **System Uptime**: 99.9% availability

### **Business Metrics**
- **Reduced Waste**: 20% reduction in ingredient spoilage
- **Cost Savings**: 15% reduction in ingredient costs through better management
- **Time Savings**: 50% reduction in inventory management time
- **Order Fulfillment**: 99%+ order fulfillment rate

---

*This document will be updated as the Inventory Management system evolves and new requirements are identified.* 