# OrdersView Logic Implementation

## Overview
This document outlines the logic for OrdersView to properly handle Shopify orders, line items, quantities, add-on classification, and the new webhook-based ingestion and management flow.

---

## Updated Architecture (as of 2025-06-24)

### 1. Shopify Webhook Integration (Primary Source of Truth)
- Orders are received in real time via the Shopify `orders/create` webhook.
- Each order is saved to the database, associated with a specific date using a tag in the format `dd/mm/yyyy` (extracted from the order's tags).
- No manual processing is needed for new orders—they appear automatically for the correct date in the UI.

### 2. Process Orders Button (Manual Sync/Update & Fetch)
- The "Process Orders" button is retained in the UI.
- When clicked, it will:
  - **Fetch new orders from Shopify** for the selected date (using the `dd/mm/yyyy` tag).
  - **Add any new orders** that are not already in the database (prevents duplicates).
  - **Update existing saved orders** for the selected date (refresh status, line items, etc.).
  - **Never create duplicates**—only new or updated orders are saved.

### 3. Bulk Delete Orders
- A bulk delete button is available in OrdersView.
- Allows the user to delete all orders for the selected date (or all currently displayed orders) in one action.
- Useful for clearing out test data or resetting a day's orders.

---

## Technical Flow

### Webhook Ingestion
1. Shopify sends an `orders/create` webhook when a new order is placed.
2. The backend webhook handler:
   - Parses the order payload.
   - Extracts the `dd/mm/yyyy` date tag from the order's tags.
   - Saves the order to the database, associating it with the extracted date.
   - Ensures no duplicate orders are created (idempotent insert/update logic).

### Order Retrieval
- The frontend fetches orders for the selected date by matching the `dd/mm/yyyy` tag.
- Orders are displayed immediately for the correct date, with no manual processing required.

### Process Orders Button
- When clicked, triggers a backend/API call to:
  - Fetch new orders from Shopify for the selected date.
  - Add any new orders not already in the database.
  - Update (refresh) all existing orders for the selected date.
- No duplicate orders are created; only new or updated ones are saved.

### Bulk Delete
- The frontend provides a bulk delete button.
- When clicked, sends a request to the backend to delete all orders for the selected date (or all currently displayed orders).
- Confirmation dialog is recommended to prevent accidental deletion.

---

## UI/UX Summary
- **Orders appear automatically** for the correct date as soon as they are received from Shopify.
- **Process Orders** is now a "sync" action: fetches new orders and updates existing ones, never duplicates.
- **Bulk Delete** allows for easy clearing of orders for a date.
- **No duplicates**: All logic ensures that orders are not duplicated, whether via webhook or manual update.

---

## Implementation Steps

1. **Backend**
   - [ ] Webhook handler for `orders/create` (idempotent save by order ID, date tag extraction)
   - [ ] Endpoint for updating (refreshing) and fetching new orders for a date (sync logic)
   - [ ] Endpoint for bulk deleting orders by date
2. **Frontend**
   - [ ] Fetch orders for selected date by `dd/mm/yyyy` tag
   - [ ] Process Orders button triggers sync: fetches new orders and updates existing ones
   - [ ] Bulk delete button with confirmation dialog
   - [ ] UI reflects real-time updates and deletion

---

## Notes
- This architecture ensures real-time, reliable, and duplicate-free order management.
- Manual processing is only for sync (fetch new + update), not creation only.
- Bulk delete is a safety/maintenance feature for admins.

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