# OrdersView Logic Implementation

## Overview
This document outlines the logic for OrdersView to properly handle Shopify orders, line items, quantities, and add-on classification.

## Current State Analysis

### Existing API Endpoints
1. **`/api/tenants/:tenantId/saved-products/by-shopify-id`** - Perfect for matching
   - Parameters: `shopify_product_id`, `shopify_variant_id`
   - Returns: Full product data including `labelNames` array
   - Used for: Identifying if a line item is an add-on

2. **`/api/tenants/:tenantId/saved-products`** - General saved products
   - Returns: All saved products with labels
   - Used for: General product management

3. **`/api/tenants/:tenantId/orders`** - Current orders endpoint
   - Returns: Basic order data (missing full Shopify order data)
   - Issue: `realOrderData` doesn't contain full Shopify order information

## Implementation Plan

### Step 1: Fetch Full Shopify Order Data
- **Problem**: OrdersView currently only has basic order data
- **Solution**: Update OrdersView to fetch full Shopify order data for each order
- **Method**: Use existing `fetchShopifyOrder` function or create new endpoint

### Step 2: Line Item Processing Logic
```typescript
interface ProcessedLineItem {
  orderId: string;
  lineItemId: string;
  productTitleId: string;
  variantId: string;
  title: string;
  quantity: number;
  price: number;
  isAddOn: boolean;
  shopifyOrderData: any; // Full Shopify order data
}
```

### Step 3: Add-On Classification
1. **Extract IDs**: From each line item, get `product_title_id` and `variant_id`
2. **API Call**: Use `getProductByShopifyIds()` to fetch saved product data
3. **Label Check**: Check if `labelNames` array contains "Add-Ons"
4. **Classification**: Mark line item as add-on or main product

### Step 4: Quantity Flattening
- **Input**: Line item with quantity 3
- **Output**: 3 individual cards with quantity 1 each
- **Logic**: Create separate card objects for each quantity

### Step 5: Container Separation
- **Main Container**: Regular line items (non-add-ons)
- **Add-Ons Container**: Add-on line items
- **Display Logic**: Show add-ons in separate section for further processing

### Step 6: OrderCard Integration
- **Add-Ons Field**: Display related add-ons in main OrderCard
- **Data Source**: Use processed line items to populate add-ons field

## Database Schema Understanding

### Saved Products Table
```sql
saved_products (
  id, tenant_id, shopify_product_id, shopify_variant_id,
  title, variant_title, description, price, tags,
  product_type, vendor, handle, status,
  image_url, image_alt, image_width, image_height
)
```

### Product Labels Table
```sql
product_labels (
  id, tenant_id, name, category, color, priority
)
```

### Product Label Mappings Table
```sql
product_label_mappings (
  id, tenant_id, saved_product_id, label_id
)
```

## API Flow

### 1. OrdersView Data Fetching
```typescript
// Current: Basic order data
const orders = await getOrders(tenantId);

// New: Full Shopify order data
const ordersWithShopifyData = await Promise.all(
  orders.map(async (order) => {
    const shopifyData = await fetchShopifyOrder(tenantId, storeId, order.shopifyOrderId);
    return { ...order, shopifyOrderData: shopifyData };
  })
);
```

### 2. Line Item Processing
```typescript
const processLineItems = (shopifyOrderData) => {
  const lineItems = [];
  
  shopifyOrderData.line_items.forEach((lineItem) => {
    // Create individual cards for each quantity
    for (let i = 0; i < lineItem.quantity; i++) {
      lineItems.push({
        orderId: shopifyOrderData.id,
        lineItemId: lineItem.id,
        productTitleId: lineItem.product_title_id,
        variantId: lineItem.variant_id,
        title: lineItem.title,
        quantity: 1, // Individual quantity
        price: lineItem.price,
        shopifyOrderData: shopifyOrderData
      });
    }
  });
  
  return lineItems;
};
```

### 3. Add-On Classification
```typescript
const classifyLineItems = async (lineItems, tenantId) => {
  const classifiedItems = [];
  
  for (const item of lineItems) {
    // Fetch saved product data
    const savedProduct = await getProductByShopifyIds(
      tenantId,
      item.productTitleId,
      item.variantId
    );
    
    // Check if it's an add-on
    const isAddOn = savedProduct?.labelNames?.includes("Add-Ons") || false;
    
    classifiedItems.push({
      ...item,
      isAddOn,
      savedProductData: savedProduct
    });
  }
  
  return classifiedItems;
};
```

## UI Structure

### OrdersView Layout
```
┌─────────────────────────────────────┐
│ Main Orders Container               │
│ ┌─────────────────────────────────┐ │
│ │ Order Card 1 (Main Product)     │ │
│ │ - Add-Ons: Ribbon, Card         │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Order Card 2 (Main Product)     │ │
│ │ - Add-Ons: None                 │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Add-Ons Processing Container        │
│ ┌─────────────────────────────────┐ │
│ │ Add-On Card 1 (Ribbon)          │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Add-On Card 2 (Card)            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Data Fetching
1. Update OrdersView to fetch full Shopify order data
2. Create helper functions for line item processing
3. Implement quantity flattening logic

### Phase 2: Add-On Classification
1. Implement add-on detection using existing API
2. Create classification helper functions
3. Test with sample data

### Phase 3: UI Updates
1. Update OrdersView to separate main items and add-ons
2. Update OrderCard to display add-ons field
3. Implement container separation

### Phase 4: Testing & Optimization
1. Test with real Shopify orders
2. Optimize API calls (batch processing if needed)
3. Handle edge cases (missing saved products, etc.)

## Error Handling

### Missing Saved Products
- If a line item doesn't exist in saved_products, treat as main product
- Log warning for missing products
- Allow manual classification later

### API Failures
- Graceful degradation if Shopify API fails
- Fallback to basic order data
- Retry logic for transient failures

### Data Inconsistencies
- Validate Shopify order data structure
- Handle missing line items gracefully
- Default values for missing fields

## Performance Considerations

### API Optimization
- Batch API calls where possible
- Cache saved product data
- Implement request deduplication

### UI Performance
- Virtual scrolling for large order lists
- Lazy loading of add-on data
- Debounced search and filtering

## Future Enhancements

### Advanced Add-On Logic
- Multiple add-on categories (ribbons, cards, packaging)
- Add-on dependencies and combinations
- Automated add-on suggestions

### Workflow Integration
- Add-on processing workflows
- Status tracking for add-on items
- Integration with inventory management

### Analytics
- Add-on usage analytics
- Processing time tracking
- Performance metrics 