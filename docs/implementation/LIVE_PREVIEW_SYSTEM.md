# Live Order Card Preview System

## Overview

The Live Order Card Preview System provides florists with a real-time visual representation of how their Order Cards will appear in the main Orders view. This system allows florists to customize field visibility and see immediate feedback on their changes, making it easier to optimize their daily order processing workflow.

## Features

### 🎯 Live Preview
- **Real-time Updates**: Changes to field visibility are reflected immediately in the preview
- **Sample Data**: Uses realistic sample order data to demonstrate field rendering
- **Expandable View**: Toggle between compact and detailed views to see different levels of information
- **Visual Hierarchy**: Fields are organized by category with color-coded sections

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

## Architecture

### Components

#### OrderCardPreview.tsx
The main preview component that renders the live Order Card representation.

**Key Features:**
- Sample order data generation
- Field value rendering based on type
- Category-based layout organization
- Expandable/collapsible detail view
- Field visibility controls

**Props:**
```typescript
interface OrderCardPreviewProps {
  fields: OrderCardField[];
  onToggleFieldVisibility: (fieldId: string, isVisible: boolean) => void;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
}
```

#### Settings.tsx Integration
The Settings component integrates the preview system into the Order Card configuration tab.

**Features:**
- Tab-based navigation
- Preview and mapping sections
- Real-time field visibility updates
- Shopify field mapping interface

### Data Flow

1. **Field Registry**: Centralized field definitions in `orderCardFields.ts`
2. **State Management**: React state manages field visibility and preview settings
3. **Real-time Updates**: Changes immediately update both preview and field registry
4. **Persistence**: Field visibility settings are maintained across sessions

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

### Additional Information
- **Notes**: Additional notes
- **Tags**: Order tags
- **Assigned To**: Staff member assigned to order
- **Created At**: Order creation timestamp
- **Updated At**: Last update timestamp

## Field Types and Rendering

### Text Fields
- Standard text display
- Truncation for long content
- Proper formatting for readability

### Date Fields
- Localized date formatting
- Relative time display (e.g., "2 days ago")
- Calendar icon integration

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

## Sample Data

The preview uses realistic sample order data to demonstrate field rendering:

```typescript
const sampleOrder = {
  id: 'ORD-001',
  orderNumber: '#1001',
  orderDate: new Date().toISOString(),
  status: 'pending',
  priority: 'High',
  customerName: 'John Smith',
  customerEmail: 'john.smith@example.com',
  customerPhone: '+1 (555) 123-4567',
  deliveryDate: new Date(Date.now() + 86400000).toISOString(),
  deliveryTime: '2:00 PM - 4:00 PM',
  deliveryAddress: '123 Main St, Anytown, CA 90210',
  deliveryInstructions: 'Ring doorbell twice, leave with doorman',
  totalAmount: 89.99,
  taxAmount: 7.20,
  shippingAmount: 5.99,
  discountAmount: 10.00,
  paymentStatus: 'paid',
  products: [
    { name: 'Rose Bouquet', quantity: 1, price: 45.99 },
    { name: 'Tulip Arrangement', quantity: 1, price: 34.00 }
  ],
  productCount: 2,
  notes: 'Customer prefers pink roses if available',
  tags: ['urgent', 'vip'],
  assignedTo: 'Sarah Johnson',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};
```

## User Experience

### For Florists
1. **Quick Assessment**: Immediately see how Order Cards will look
2. **Efficient Customization**: Toggle fields on/off with instant feedback
3. **Workflow Optimization**: Hide unnecessary fields to focus on important information
4. **Visual Clarity**: Understand field placement and organization

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

const handleToggleFieldVisibility = (fieldId: string, isVisible: boolean) => {
  setOrderCardFields(prev => 
    prev.map(field => 
      field.id === fieldId 
        ? { ...field, isVisible } 
        : field
    )
  );
  
  // Update the field registry
  updateField(fieldId, { isVisible });
};
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
    // ... other field types
  }
};
```

### Category Organization
```typescript
const visibleFields = fields.filter(field => field.isVisible);
const basicFields = visibleFields.filter(field => field.category === 'basic');
const customerFields = visibleFields.filter(field => field.category === 'customer');
const deliveryFields = visibleFields.filter(field => field.category === 'delivery');
// ... other categories
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
1. **Drag & Drop Reordering**: Allow florists to reorder fields by dragging
2. **Custom Field Creation**: Enable creation of custom fields for specific business needs
3. **Template System**: Save and share field configurations as templates
4. **Role-based Views**: Different field sets for different user roles
5. **Mobile Optimization**: Enhanced mobile preview and controls

### Advanced Customization
1. **Field Styling**: Custom colors, fonts, and styling for individual fields
2. **Conditional Display**: Show/hide fields based on order status or other conditions
3. **Integration Preview**: Preview how Shopify data will map to Order Card fields
4. **Export/Import**: Share field configurations between different stores

## Testing Guidelines

### Visual Testing
- [ ] Preview renders correctly on different screen sizes
- [ ] Field visibility toggles work properly
- [ ] Expand/collapse functionality works as expected
- [ ] Sample data displays correctly for all field types
- [ ] Icons and colors are consistent and appropriate

### Functional Testing
- [ ] Field visibility changes persist across sessions
- [ ] Changes in preview reflect in actual Order Cards
- [ ] All field types render correctly
- [ ] Performance remains good with many fields visible
- [ ] Error handling for missing or invalid data

### User Experience Testing
- [ ] Interface is intuitive for florists
- [ ] Preview provides clear understanding of Order Card layout
- [ ] Field descriptions are helpful and accurate
- [ ] Responsive design works on mobile devices
- [ ] Loading states and transitions are smooth

## Conclusion

The Live Order Card Preview System significantly enhances the florist experience by providing immediate visual feedback on Order Card customization. This system empowers florists to optimize their workflow by showing only the information they need, when they need it, leading to faster order processing and improved customer satisfaction.

The combination of real-time preview, intuitive controls, and comprehensive field management makes this system an essential tool for efficient daily order management in florist operations. 