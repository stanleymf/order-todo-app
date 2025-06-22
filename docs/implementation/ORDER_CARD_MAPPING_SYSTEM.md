# Order Card Mapping System

## Overview

The Order Card Mapping System creates a **dynamic connection** between the Order Card component and the Settings mapping interface. When fields are added, removed, or modified in the Order Card, the mapping section automatically updates to reflect those changes.

## 🏗️ Architecture

### Centralized Field Registry
- **File**: `src/types/orderCardFields.ts`
- **Purpose**: Single source of truth for all Order Card fields
- **Benefits**: 
  - Ensures consistency between components
  - Enables dynamic field management
  - Provides type safety and validation

### Components Using the Registry
1. **OrderCard Component** (`src/components/OrderCard.tsx`)
2. **Settings Mapping Section** (`src/components/Settings.tsx`)

## 📋 Field Structure

Each field in the registry has the following properties:

```typescript
interface OrderCardField {
  id: string;                    // Unique identifier
  label: string;                 // Display name
  type: 'text' | 'number' | 'date' | 'status' | 'currency' | 'email' | 'phone' | 'address' | 'array';
  required: boolean;             // Whether field is required
  description: string;           // Field description
  category: 'basic' | 'customer' | 'delivery' | 'financial' | 'products' | 'metadata';
  sortOrder: number;             // Display order
  isVisible: boolean;            // Whether to show in Order Card
  isEditable: boolean;           // Whether field can be edited
}
```

## 🎯 Current Fields (23 Total)

### Basic Information (4 fields)
- `orderNumber` - Unique order identifier
- `orderDate` - Date when order was placed
- `status` - Current order status
- `priority` - Order priority level

### Customer Information (3 fields)
- `customerName` - Full name of the customer
- `customerEmail` - Customer email address
- `customerPhone` - Customer phone number

### Delivery Information (4 fields)
- `deliveryDate` - Scheduled delivery date
- `deliveryTime` - Preferred delivery time
- `deliveryAddress` - Full delivery address
- `deliveryInstructions` - Special delivery instructions

### Financial Information (5 fields)
- `totalAmount` - Total order amount
- `taxAmount` - Tax amount
- `shippingAmount` - Shipping cost
- `discountAmount` - Discount applied
- `paymentStatus` - Payment status

### Products Information (2 fields)
- `products` - Order items/products
- `productCount` - Number of products in order

### Metadata (5 fields)
- `notes` - Additional notes
- `tags` - Order tags
- `assignedTo` - Staff member assigned to order
- `createdAt` - Order creation timestamp
- `updatedAt` - Last update timestamp

## 🔧 Helper Functions

### Field Management
```typescript
// Get all visible fields (sorted by sortOrder)
getVisibleFields(): OrderCardField[]

// Get fields by category
getFieldsByCategory(category: OrderCardField['category']): OrderCardField[]

// Get specific field by ID
getFieldById(id: string): OrderCardField | undefined

// Add new field
addField(field: Omit<OrderCardField, 'sortOrder'>): void

// Remove field
removeField(id: string): void

// Update field properties
updateField(id: string, updates: Partial<OrderCardField>): void
```

### Settings Mapping Helpers
```typescript
// Get appropriate icon for field
getFieldIcon(field: OrderCardField): React.ReactNode

// Get default Shopify field mapping
getDefaultShopifyField(fieldId: string): string

// Get available Shopify field options
getShopifyFieldOptions(field: OrderCardField): Array<{value: string, label: string}>
```

## 🔄 Dynamic Connection

### How It Works

1. **Single Source of Truth**: All field definitions are stored in `ORDER_CARD_FIELDS` array
2. **Automatic Updates**: Both OrderCard and Settings components read from the same registry
3. **Real-time Sync**: Changes to the registry immediately affect both components

### Adding a New Field

To add a new field to the Order Card:

1. **Add to Registry**:
```typescript
// In src/types/orderCardFields.ts
export const ORDER_CARD_FIELDS: OrderCardField[] = [
  // ... existing fields
  {
    id: 'newField',
    label: 'New Field',
    type: 'text',
    required: false,
    description: 'Description of the new field',
    category: 'basic',
    sortOrder: 24, // Next available number
    isVisible: true,
    isEditable: true
  }
];
```

2. **Automatic Updates**:
   - ✅ OrderCard component will automatically display the new field
   - ✅ Settings mapping section will automatically include the new field
   - ✅ No additional code changes needed in components

### Removing a Field

To remove a field:

1. **Remove from Registry**:
```typescript
// Use the helper function
removeField('fieldId');
```

2. **Automatic Updates**:
   - ✅ OrderCard component will automatically hide the field
   - ✅ Settings mapping section will automatically remove the field
   - ✅ No additional code changes needed

### Modifying a Field

To modify field properties:

```typescript
// Update field properties
updateField('fieldId', {
  isVisible: false,
  label: 'New Label',
  description: 'Updated description'
});
```

## 🛠️ Shopify Field Mapping

### System Mappings
Direct field-to-field mappings with intelligent defaults:

| Order Card Field | Default Shopify Field | Category |
|------------------|----------------------|----------|
| `orderNumber` | `order_number` | Basic |
| `customerName` | `customer.first_name` | Customer |
| `deliveryDate` | `shipping_address` | Delivery |
| `totalAmount` | `total_price` | Financial |
| `status` | `fulfillment_status` | Basic |

### Extract Processing Mappings
Advanced mappings requiring data processing:

1. **Product Name Extraction**: `line_items[0].title`
2. **Priority from Tags**: Extract from `tags` array
3. **Delivery Instructions**: Extract from `note` field

### Field Categories and Options

#### Customer Fields
- `customer.first_name`, `customer.last_name`, `customer.name`
- `customer.email`, `customer.phone`

#### Delivery Fields
- `shipping_address.name`, `shipping_address.address1`
- `shipping_address.city`, `shipping_address.province`

#### Financial Fields
- `total_price`, `total_tax`, `total_discounts`
- `financial_status`, `fulfillment_status`

#### Product Fields
- `line_items`, `line_items[0].title`
- `line_items[0].variant_title`

## 🎨 UI Features

### Order Card Display
- **Responsive Design**: Mobile and desktop layouts
- **Field Grouping**: Organized by category
- **Visual Indicators**: Icons, badges, and status indicators
- **Edit Mode**: Inline editing for editable fields

### Settings Mapping Interface
- **Dynamic Generation**: Automatically creates mapping rows
- **Smart Defaults**: Pre-selects appropriate Shopify fields
- **Category-based Options**: Shows relevant field options
- **Visual Feedback**: Required field indicators, descriptions

## 🔮 Future Enhancements

### Planned Features
1. **Field Visibility Toggle**: Allow users to show/hide fields
2. **Custom Field Creation**: Add new fields through UI
3. **Field Reordering**: Drag-and-drop field ordering
4. **Mapping Templates**: Pre-configured mapping sets
5. **Validation Rules**: Field validation and constraints

### Advanced Processing
1. **Conditional Mapping**: Map based on field values
2. **Data Transformation**: Format, combine, or split fields
3. **Custom Functions**: User-defined mapping logic
4. **Batch Processing**: Apply mappings to multiple orders

## 🧪 Testing

### Manual Testing
1. **Add Field**: Add new field to registry, verify it appears in both components
2. **Remove Field**: Remove field from registry, verify it disappears from both components
3. **Modify Field**: Change field properties, verify updates reflect in both components
4. **Mapping Options**: Test different Shopify field mappings

### Automated Testing
```typescript
// Test field registry functions
describe('Order Card Fields', () => {
  test('getVisibleFields returns only visible fields', () => {
    const visibleFields = getVisibleFields();
    expect(visibleFields.every(field => field.isVisible)).toBe(true);
  });

  test('addField adds new field with correct sortOrder', () => {
    const newField = { /* field definition */ };
    addField(newField);
    const field = getFieldById(newField.id);
    expect(field).toBeDefined();
  });
});
```

## 📚 Related Documentation

- [API Routes Documentation](../api/API_ROUTES.md)
- [System Architecture](../architecture/SYSTEM_ARCHITECTURE.md)
- [Multi-tenant Implementation](../implementation/MULTI_TENANT_IMPLEMENTATION.md) 