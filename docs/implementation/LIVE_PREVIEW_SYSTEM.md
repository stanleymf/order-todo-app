# Live Order Card Preview System

## Overview

The Live Order Card Preview System provides florists with a real-time visual representation of how their Order Cards will appear in the main Orders view. This system allows florists to customize field visibility and see immediate feedback on their changes, making it easier to optimize their daily order processing workflow.

## ✅ **Current Implementation Status**

### **Completed Features**
- **Real-time Preview**: Live updates when field visibility is toggled
- **Sample Data Integration**: Uses realistic sample order data with proper field mapping
- **Expandable View**: Toggle between compact and detailed views
- **Field Visibility Controls**: Individual toggles for each field with visual feedback
- **Shopify Integration**: Real order data fetching from Shopify stores
- **Product Label Support**: Difficulty and product type labels with color coding
- **Status Management**: Preview different order statuses (unassigned, assigned, completed)
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Customisations Field**: Editable text area for order customizations
- **Store Selection**: Multi-store support for order fetching

### **Technical Achievements**
- **Database Integration**: Connected to Cloudflare D1 with proper table structure
- **API Endpoints**: Fixed database table name mismatches (`stores` → `shopify_stores`, `saved_product_labels` → `product_label_mappings`)
- **Shopify API Service**: Proper constructor initialization with access tokens
- **Product Classification**: Enhanced saved products query to return all products (not just labeled ones)
- **Order Processing Workflow**: Implemented complete order processing pipeline

## Features

### 🎯 Live Preview
- **Real-time Updates**: Changes to field visibility are reflected immediately in the preview
- **Sample Data**: Uses realistic sample order data to demonstrate field rendering
- **Expandable View**: Toggle between compact and detailed views to see different levels of information
- **Visual Hierarchy**: Fields are organized by category with color-coded sections
- **Real Order Data**: Fetch and display actual Shopify orders for testing

### 🎛️ Field Visibility Controls
- **Individual Toggles**: Each field can be shown/hidden independently
- **Visual Feedback**: Icons and descriptions help identify field purposes
- **Category Organization**: Fields are grouped by functionality (Basic, Customer, Delivery, etc.)
- **Persistent Settings**: Changes are saved and applied across the application

### 🎨 Visual Design
- **Card-based Layout**: Mimics the actual Order Card appearance
- **Icon Integration**: Each field type has appropriate icons for quick recognition
- **Color Coding**: Different categories use distinct colors for easy identification
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Status Indicators**: Visual status circles for order state management

## Architecture

### Components

#### OrderCardPreview.tsx
The main preview component that renders the live Order Card representation.

**Key Features:**
- Sample order data generation with Shopify field mapping
- Field value rendering based on type with proper transformations
- Category-based layout organization
- Expandable/collapsible detail view
- Field visibility controls with real-time updates
- Real order data fetching from Shopify stores
- Product label integration (difficulty and product type)
- Status management (unassigned, assigned, completed)
- Customisations field for order notes

**Props:**
```typescript
interface OrderCardPreviewProps {
  fields: OrderCardField[];
  onToggleFieldVisibility: (fieldId: string) => void;
  onSave?: () => void;
  isSaving?: boolean;
  users?: Array<{ id: string; name: string }>;
  difficultyLabels?: Array<{ id: string; name: string; color: string }>;
  productTypeLabels?: Array<{ id: string; name: string; color: string }>;
  currentUserId?: string;
  realOrderData?: any;
  stores: any[];
  onFetchOrder: () => void;
  isFetching: boolean;
  orderNameToFetch: string;
  setOrderNameToFetch: (value: string) => void;
  selectedStoreId: string;
  setSelectedStoreId: (value: string) => void;
}
```

#### Settings.tsx Integration
The Settings component integrates the preview system into the Order Card configuration tab.

**Features:**
- Tab-based navigation
- Preview and mapping sections
- Real-time field visibility updates
- Shopify field mapping interface
- Store selection for order fetching

### Data Flow

1. **Field Registry**: Centralized field definitions in `orderCardFields.ts`
2. **State Management**: React state manages field visibility and preview settings
3. **Real-time Updates**: Changes immediately update both preview and field registry
4. **Persistence**: Field visibility settings are maintained across sessions
5. **Shopify Integration**: Real order data fetched from configured stores
6. **Product Labels**: Difficulty and product type labels from saved products

## Field Categories

### Basic Information
- **Order Number**: Unique order identifier
- **Order Date**: Date when order was placed
- **Status**: Current order status
- **Priority**: Order priority level

### Customer Information
- **Customer Name**: Full name of the customer
- **Customer Email**: Customer email address
- **Customer Phone**: Customer phone number

### Delivery Information
- **Delivery Date**: Scheduled delivery date
- **Delivery Time**: Preferred delivery time
- **Delivery Address**: Full delivery address
- **Delivery Instructions**: Special delivery instructions

### Financial Information
- **Total Amount**: Total order amount
- **Tax Amount**: Tax amount
- **Shipping Amount**: Shipping cost
- **Discount Amount**: Discount applied
- **Payment Status**: Payment status

### Products Information
- **Products**: Order items/products
- **Product Count**: Number of products in order
- **Product Title**: Individual product titles
- **Variant Title**: Product variant information

### Additional Information
- **Notes**: Additional notes
- **Tags**: Order tags
- **Assigned To**: Staff member assigned to order
- **Created At**: Order creation timestamp
- **Updated At**: Last update timestamp
- **Customisations**: Editable order customizations

## Field Types and Rendering

### Text Fields
- Standard text display
- Truncation for long content
- Proper formatting for readability

### Date Fields
- Localized date formatting
- Relative time display (e.g., "2 days ago")
- Calendar icon integration
- Date extraction from tags with regex support

### Currency Fields
- Proper currency formatting with $ symbol
- Decimal precision handling
- Color coding for positive/negative values

### Status Fields
- Badge-based display
- Color-coded status indicators
- Icon integration

### Email Fields
- Clickable mailto links
- Email validation display
- Mail icon integration

### Phone Fields
- Clickable tel links
- Phone number formatting
- Phone icon integration

### Address Fields
- Multi-line display
- Map pin icon integration
- Proper spacing and formatting

### Array Fields
- Item count display
- Summary information
- Expandable detail view

### Label Fields
- Color-coded badges
- Category-based filtering (difficulty, productType)
- Dynamic label assignment

## Sample Data

The preview uses realistic sample order data to demonstrate field rendering:

```typescript
const sampleOrder = {
  id: 'ORD-001',
  productTitle: 'Rose Bouquet',
  productVariantTitle: 'Large - Pink Roses',
  timeslot: '2:00 PM - 4:00 PM',
  orderId: '#1001',
  orderDate: new Date().toISOString(),
  orderTags: 'urgent, vip, 22/06/2025',
  assignedTo: 'Sarah Johnson',
  priorityLabel: 'High',
  addOns: 'Greeting Card, Gift Wrap',
  customisations: 'Customer prefers pink roses if available',
  isCompleted: false
};
```

## User Experience

### For Florists
1. **Quick Assessment**: Immediately see how Order Cards will look
2. **Efficient Customization**: Toggle fields on/off with instant feedback
3. **Workflow Optimization**: Hide unnecessary fields to focus on important information
4. **Visual Clarity**: Understand field placement and organization
5. **Real Data Testing**: Test with actual Shopify orders

### For Administrators
1. **Standardization**: Ensure consistent Order Card appearance across the organization
2. **Training**: Use preview to train new staff on order processing
3. **Process Improvement**: Identify which fields are most important for daily operations
4. **Quality Control**: Verify that all necessary information is visible

## Technical Implementation

### State Management
```typescript
const [orderCardFields, setOrderCardFields] = useState<OrderCardField[]>([]);
const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('unassigned');
const [customisations, setCustomisations] = useState('');
```

### Field Rendering Logic
```typescript
const renderFieldValue = (field: OrderCardField) => {
  const value = getFieldValue(field.id);
  
  switch (field.type) {
    case 'date':
      return new Date(value).toLocaleDateString();
    case 'currency':
      return `$${parseFloat(value || 0).toFixed(2)}`;
    case 'status':
      return <Badge variant={getStatusVariant(value)}>{value}</Badge>;
    case 'label':
      return <Badge style={{ backgroundColor: getLabelColor(value) }}>{value}</Badge>;
    // ... other field types
  }
};
```

### Shopify Integration
```typescript
const getValueFromShopifyData = (sourcePath: string, data: any): any => {
  if (sourcePath.startsWith("product:")) {
    const productField = sourcePath.split(":")[1];
    return data.localProduct?.[productField];
  }
  return data[sourcePath];
};
```

## Benefits

### Efficiency
- **Reduced Training Time**: Visual preview helps new staff understand the system quickly
- **Faster Decision Making**: Florists can see all relevant information at a glance
- **Streamlined Workflow**: Hide unnecessary fields to focus on essential information

### Quality
- **Consistent Display**: Standardized Order Card appearance across all users
- **Error Reduction**: Clear field labels and icons reduce confusion
- **Better Organization**: Logical grouping of related information

### Flexibility
- **Customizable Views**: Each florist can optimize their view for their specific needs
- **Adaptable Layout**: Easy to add or remove fields as business requirements change
- **Scalable Design**: System can accommodate new field types and categories

## Future Enhancements

### Planned Features
1. **Product Image Preview**: Eye icon to view product images from saved products
2. **Drag & Drop Reordering**: Allow florists to reorder fields by dragging
3. **Custom Field Creation**: Enable creation of custom fields for specific business needs
4. **Template System**: Save and share field configurations as templates
5. **Role-based Views**: Different field sets for different user roles
6. **Mobile Optimization**: Enhanced mobile preview and controls

### Advanced Customization
1. **Field Styling**: Custom colors, fonts, and styling for individual fields
2. **Conditional Display**: Show/hide fields based on order status or other conditions
3. **Integration Preview**: Preview how Shopify data will map to Order Card fields
4. **Export/Import**: Share field configurations between different stores

## Testing Guidelines

### Visual Testing
- [x] Preview renders correctly on different screen sizes
- [x] Field visibility toggles work properly
- [x] Expand/collapse functionality works as expected
- [x] Sample data displays correctly for all field types
- [x] Icons and colors are consistent and appropriate
- [x] Real order data fetching works correctly
- [x] Product labels display with proper colors

### Functional Testing
- [x] Field visibility changes persist across sessions
- [x] Changes in preview reflect in actual Order Cards
- [x] All field types render correctly
- [x] Performance remains good with many fields visible
- [x] Error handling for missing or invalid data
- [x] Shopify API integration works properly
- [x] Database queries execute without errors

### User Experience Testing
- [x] Interface is intuitive for florists
- [x] Preview provides clear understanding of Order Card layout
- [x] Field descriptions are helpful and accurate
- [x] Responsive design works on mobile devices
- [x] Loading states and transitions are smooth

## Conclusion

The Live Order Card Preview System has been successfully implemented with comprehensive features including real-time preview, Shopify integration, product label support, and mobile responsiveness. The system now provides florists with a powerful tool to customize their order processing workflow while maintaining data integrity and performance.

The recent fixes to database table names and Shopify API integration have resolved critical issues, making the system production-ready for multi-tenant florist operations. 