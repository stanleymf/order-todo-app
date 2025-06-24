# Changelog

All notable changes to this project will be documented in this file.

## [1.5.5] - 2025-01-25

### 🚀 Major Features Added
- **Status Button Toggle**: Status buttons now toggle off when clicked again - clicking the same status resets to unassigned
- **Collapsible Stats Container**: Replaced 4 overview cards with comprehensive collapsible Stats container featuring 8 detailed stat cards
- **Enhanced Analytics Dashboard**: Complete stats overhaul with detailed breakdowns and visual enhancements

### 🎨 UI/UX Improvements
- **Comprehensive Stats Display**: 8 detailed stat cards including:
  - Total Order Count, Unassigned Count, Assigned Count, Completed Count
  - Breakdown by Store, Difficulty Labels Count, Product Type Label Count, Add-Ons Count
- **Collapsible Interface**: Stats container can be collapsed/expanded with smooth animations
- **Color-Coded Cards**: Each stat card has distinct color scheme for visual hierarchy
- **Detailed Breakdowns**: Store, difficulty, and product type breakdowns show individual counts
- **Responsive Design**: Stats container adapts to mobile with proper spacing and typography

### 🔧 Technical Enhancements
- **Toggle Logic**: Improved status change logic to handle toggle-off functionality
- **Enhanced Stats Calculation**: Comprehensive statistics calculation with detailed breakdowns
- **Performance Optimization**: Smart data processing for multiple breakdown categories
- **Mobile Responsive**: Proper mobile layout for all stat cards

### 🐛 Fixes
- **Status Reset**: Fixed status buttons to properly reset to unassigned when clicked again
- **Stats Calculation**: Enhanced statistics to handle edge cases and empty data states

## [1.5.4] - 2024-12-XX

### 🚀 Major Features Added
- **Field Mapping System Integration**: OrderDetailCard now uses proper FieldMappings configuration instead of hardcoded field extraction
- **Add-on Classification System**: Automatic classification of line items as main orders vs add-ons based on saved_products and product_labels lookup
- **Separate Order Containers**: Orders page now displays main orders and add-ons in separate visual containers
- **Enhanced Variant Title Support**: Product variant titles now properly display using configured field mappings

### 🔧 Backend Enhancements
- **Database Lookup Integration**: Added product label mapping query for add-on classification
- **Enhanced API Response**: `/api/tenants/:tenantId/orders-from-db-by-date` now returns categorized orders with `mainOrders` and `addOnOrders` arrays
- **Improved Field Extraction**: Generic field value extraction with transformation support in OrderDetailCard

### 🎨 UI/UX Improvements
- **Two-Column Layout**: Orders page displays main orders and add-ons side by side
- **Visual Distinction**: Add-on cards have orange color scheme vs blue for main orders
- **Enhanced Overview Cards**: Updated stats to show main orders count and add-ons count separately
- **Improved Field Display**: Better handling of array values and empty fields

### 🐛 Fixes
- **Webhook URL Generation**: Fixed webhook registration to include tenant and store IDs in URL
- **Field Configuration**: OrderDetailCard now respects FieldMappings instead of hardcoded logic
- **Variant Title Display**: Missing variant titles now properly extracted and displayed

### 🔄 API Changes
- **Breaking**: `getOrdersFromDbByDate` response format changed from array to object with `orders`, `mainOrders`, `addOnOrders` properties
- **Backward Compatible**: Frontend handles both old and new response formats

## [1.5.3] - 2024-12-XX

## [1.5.2] - 2025-01-15

### Fixed
- **DashboardCard Eye Icon**: Fixed eye icon to properly open ProductImageModal with product images and descriptions
- **Card Interaction**: Fixed collapse/expand behavior to trigger only on white space clicks, not eye icon or status buttons
- **Notes Interaction**: Fixed notes textbox to prevent card collapse when clicking or editing
- **ProductImageModal Integration**: Properly integrated with saved products API for image lookup by product/variant ID
- **Product Data Extraction**: Enhanced product info extraction for both GraphQL and REST API formats

## [1.5.1] - 2025-01-15

### Enhanced
- **DashboardCard Redesign**: Complete redesign of DashboardCard component with new specifications
  - **Collapsed State**: Horizontal layout with product title/variant, eye icon for expansion, and 3 enlarged circle status buttons (Pending, Assigned, Completed)
  - **Auto-Assignment**: Clicking Blue (Assigned) or Green (Completed) automatically assigns to current user
  - **Difficulty Badge**: Color-coded difficulty label below status buttons using saved products API
  - **Expanded State**: Comprehensive view with product title, variant, timeslot, order date, difficulty label, add-ons, status, and editable notes
  - **Non-Collapsing Notes**: Notes textbox prevents card collapse on click for better UX
  - **Real-time Product Labels**: Integrated with saved products API for difficulty/product type labels with color coding
  - **Smart Data Extraction**: Automatic extraction of timeslots, dates, and add-ons from Shopify order data
  - **Mobile Optimized**: Touch-friendly enlarged circle buttons and responsive design
  - **Proper Field Mapping**: Uses existing field mapping configuration system from Settings

### Technical
- Added product label caching system for improved API performance
- Implemented proper TypeScript interfaces for Order status types
- Cleaned up unused imports and functions
- Updated status values to match Order type schema (pending instead of unassigned)
- Fixed ProductImageModal prop interfaces

## [1.5.0] - 2025-01-15

### 🎯 **NEW DASHBOARD ROUTE - Enhanced Analytics & UI/UX**

- **Major New Feature**: Added comprehensive Dashboard route as default landing page with advanced analytics
  - **New `/dashboard` Route**: Now serves as the primary landing page (before `/orders`)
  - **Enhanced Navigation**: Updated routing structure with Dashboard → Orders → Analytics → Products → AI → Settings
  - **Dual Card Systems**: Maintains existing OrderCard for `/orders` while introducing new DashboardCard for enhanced visualization

### 🏠 **DashboardView Component - Advanced Analytics Interface**

- **Row 1 - Core Metrics (Clickable Filters)**:
  - **Total Orders**: Click to show all orders
  - **Unassigned Orders**: Click to filter unassigned orders 
  - **Assigned Orders**: Click to filter assigned orders
  - **Completed Orders**: Click to filter completed orders

- **Row 2 - Breakdown Analytics**:
  - **Store Breakdown**: Clickable store cards with order counts for selected date
  - **Difficulty Breakdown**: Visual summary of difficulty label distribution with color coding
  - **Product Type Breakdown**: Summary count of each product type label

### 🎨 **DashboardCard - Enhanced Order Visualization**

- **Advanced Visual Design**:
  - **Store Indicators**: Color-coded dots for store identification
  - **Express Order Highlighting**: Yellow background for express orders with lightning badge
  - **Time Window Badges**: Blue badges displaying delivery time windows
  - **Label System**: Color-coded difficulty and product type badges with proper icons
  - **Expandable Interface**: Clean collapsed view with eye icon for expansion

- **Enhanced Functionality**:
  - **Smart Status Buttons**: Vertical stack of status circles (unassigned/assigned/completed)
  - **Auto-Assignment**: Automatically assigns current user when marking assigned/completed
  - **Product Image Modal**: Integrated with package icon for quick product visualization
  - **Notes Management**: Real-time notes updating with proper error handling

### 🚀 **Advanced Sorting & Filtering System**

- **Priority-Based Sorting**:
  1. **Time Window Priority**: Earlier delivery windows appear first
  2. **Store Grouping**: Orders grouped by store with alphabetical sorting
  3. **Express Detection**: Express orders prioritized with visual highlighting
  4. **Label Priority**: Uses `product_labels.priority` field for intelligent sorting

- **Smart Filtering**:
  - **Status Filters**: Click stat cards to filter by order status
  - **Store Filters**: Click store breakdown cards to filter by specific store
  - **Search Integration**: Real-time search across customer names, order numbers, and notes
  - **Filter Persistence**: Maintains filter state during date navigation
  - **Clear Filters**: One-click filter reset functionality

### 🔄 **Real-time Updates & Data Management**

- **Live Data Integration**:
  - **Real-time Connection Status**: Live/Offline indicator with WebSocket status
  - **Automatic Updates**: Orders update in real-time when other users make changes
  - **Sync Functionality**: "Update Orders" button for manual Shopify data refresh
  - **Last Sync Tracking**: Displays timestamp of last successful sync

- **Enhanced Data Processing**:
  - **Time Window Extraction**: Automatic extraction from order tags using regex patterns
  - **Express Order Detection**: Scans all line items for "express" keywords
  - **Label Integration**: Fetches difficulty/product type labels from Saved Products API
  - **Caching Optimization**: Smart caching for product label API calls

### 🎯 **Mobile-Responsive Design**

- **Adaptive Layout**:
  - **Mobile Grid**: 2-column stat cards, single-column breakdowns
  - **Compact Cards**: Optimized card sizing for mobile screens
  - **Touch-Friendly**: Larger touch targets and proper spacing
  - **Responsive Text**: Smaller font sizes and condensed layouts for mobile

### 🔧 **Technical Architecture**

- **Component Structure**:
  - **DashboardView.tsx**: Main dashboard component with analytics and filtering
  - **DashboardCard.tsx**: Enhanced order card with improved UI/UX
  - **Shared Logic**: Maintains compatibility with existing API services
  - **Type Safety**: Full TypeScript integration with proper interfaces

- **Performance Optimizations**:
  - **Memoized Calculations**: UseMemo for statistics and breakdowns
  - **Efficient Filtering**: Optimized filtering logic with minimal re-renders
  - **API Deduplication**: Smart caching prevents duplicate product label API calls

### 🎨 **Enhanced User Experience**

- **Visual Hierarchy**:
  - **Color-Coded Elements**: Stores, labels, and status have distinct color schemes
  - **Icon Integration**: Meaningful icons for all UI elements (Clock, Store, User, etc.)
  - **Badge System**: Informative badges for status, time windows, and express orders
  - **Hover Effects**: Subtle hover states for interactive elements

- **Interaction Design**:
  - **Clickable Analytics**: All stat cards and breakdown elements are interactive
  - **Progressive Disclosure**: Cards start collapsed with option to expand for details
  - **Context Awareness**: Current filters highlighted with visual feedback
  - **Error Handling**: Graceful error states with user-friendly messages

### 🚀 **Deployment & Integration**

- **Routing Updates**: Updated App.tsx with new dashboard route structure
- **Navigation Changes**: Modified Dashboard.tsx with 6-tab layout
- **Backward Compatibility**: Existing `/orders` route unchanged
- **Clean Architecture**: Separate components prevent code interference

### 📊 **Impact & Benefits**

- **Enhanced Overview**: Users get immediate visual insights into daily operations
- **Improved Workflow**: Clickable analytics enable rapid filtering and navigation
- **Better Visualization**: Enhanced card design improves information scanning
- **Mobile Optimization**: Better mobile experience for on-the-go usage
- **Data-Driven Decisions**: Rich analytics support operational insights

### 🚀 **Deployment**

- **Build**: 2140 modules transformed successfully
- **Bundle**: 823.30 kB (232.80 kB gzipped)
- **Version ID**: e857bc7e-8b15-41b3-9a52-0ff198fb42d1
- **Deployment URL**: https://order-to-do.stanleytan92.workers.dev
- **Status**: 🟢 **Dashboard Live** - Enhanced analytics interface ready

## [1.4.14] - 2025-01-24

### 🎯 **Unified OrderCard Architecture - Single Component for Preview & Production**

- **Major Architecture Simplification**: Unified OrderCard component to serve both preview and production needs
  - **Deleted Legacy OrderCard.tsx**: Removed complex fallback logic and duplicate codebase
  - **Enhanced OrderCardPreview**: Adapted as unified OrderCard with production-ready features
  - **Single Source of Truth**: Settings → Preview → Production now use identical component logic
  - **Perfect Mirror Experience**: What users see in configuration preview exactly matches production display

- **Technical Implementation**:
  - **Unified Props Interface**: Standardized OrderCardProps for consistent data flow
  - **Status Management**: Maintained status circles (unassigned → assigned → completed) with proper event handling
  - **Field Mapping**: Preserved robust field configuration system with getValueFromShopifyData()
  - **Product Image Modal**: Integrated ProductImageModal functionality for both contexts
  - **Expandable Cards**: Maintained collapsed/expanded view functionality

- **OrdersView Integration**: Updated to use unified OrderCard component
  - **Proper Event Handling**: Enhanced handleOrderUpdate function with correct tenantId/userId parameters
  - **TypeScript Compliance**: Fixed all type errors and removed unused variables
  - **Consistent Behavior**: Same interaction patterns across preview and production
  - **Performance Optimization**: Reduced bundle size by eliminating duplicate component logic

### 🚀 **Benefits & Impact**

- **Maintenance Simplified**: Single component to maintain instead of two diverging codebases
- **Configuration Consistency**: Field mappings work identically in preview and production
- **Developer Experience**: No more debugging differences between preview and live behavior
- **User Experience**: Perfect WYSIWYG - what you configure is exactly what displays
- **Future-Proof**: Single codebase easier to enhance and extend

### 🔧 **Data Flow Optimization**

- **Date-Driven Navigation**: Orders organized by delivery date extracted from tags (dd/mm/yyyy format)
- **Dual Population Methods**: Automatic via webhooks (order/create) and manual via "Fetch Orders" button
- **Real-time Collaboration**: Persistent assignment/completion state across multiple florists
- **Unified Data Processing**: Single getValueFromShopifyData() function handles both REST and GraphQL formats

### 🚀 **Deployment**

- **Build**: 2138 modules transformed successfully
- **Bundle**: 799.59 kB (226.41 kB gzipped) - optimized through code deduplication
- **Version ID**: eff87dff-fb98-43e9-a3db-395af1537cad
- **Deployment URL**: https://order-to-do.stanleytan92.workers.dev
- **Status**: 🟢 **Architecture Unified** - Single component serves all needs

## [1.4.13] - 2025-01-24

### 🎯 **Critical Field Mapping & Data Format Resolution**

- **Field Mapping Data Format Fix**: Resolved critical mismatch between REST and GraphQL data formats in OrderCard field mapping
  - **Enhanced getValueFromShopifyData Function**: Updated to handle both REST format (`line_items[0].title`) and GraphQL format (`lineItems.edges.0.node.title`)
  - **Automatic Format Translation**: Added intelligent path conversion from GraphQL config paths to REST data structure
  - **Product Label Integration**: Fixed `product:difficultyLabel` and `product:productTypeLabel` extraction from savedProductData
  - **Note Attributes Support**: Added proper handling for `note_attributes` arrays (add-ons, customizations)

- **Advanced Transformation Logic**: Enhanced regex transformation system for robust data extraction
  - **Array Tag Processing**: Improved handling of tags arrays for timeslot and date extraction using regex patterns
  - **Error-Resilient Regex**: Added try-catch blocks for regex operations to prevent field mapping failures
  - **Multi-Format Support**: Tags now work as both arrays and comma-separated strings

- **Complete Field Configuration Compliance**: OrderCard now fully supports the configured field mapping structure
  - **GraphQL Path Support**: `lineItems.edges.0.node.title` → `line_items[0].title` automatic conversion
  - **Shopify Field Mapping**: All `shopifyFields` configurations now extract data correctly
  - **Transformation Rules**: Regex patterns for timeslot (`HH:MM-HH:MM`) and date (`dd/mm/yyyy`) extraction working
  - **Fallback Logic**: Multiple shopifyFields paths attempted until successful data extraction

### 🔧 **Technical Implementation**

- **Data Source Priority**: Enhanced field value extraction with intelligent fallback
  ```typescript
  // Priority order: shopifyOrderData → order → savedProductData
  1. Try shopifyOrderData with all configured shopifyFields paths
  2. Fallback to direct order properties
  3. Handle special product: prefix for saved product data
  ```
- **REST-GraphQL Bridge**: Seamless translation between data formats
  - `lineItems.edges.0.node.title` → `line_items[0].title`
  - `lineItems.edges.0.node.variant.title` → `line_items[0].variant_title`
  - Maintains backward compatibility with existing configurations

### 🚀 **Issue Resolution**

- **Primary Issue**: ✅ **Fixed** - OrderCard field mapping now works with REST format data from webhooks
- **Date Extraction**: ✅ **Working** - `dd/mm/yyyy` extraction from order tags via regex transformation
- **Field Parity**: ✅ **Achieved** - OrderCard now mirrors OrderCardPreview field mapping completely
- **Data Normalization**: ✅ **Enhanced** - `normalizeOrderForConfig` creates proper GraphQL structure from REST data

### 🎯 **Impact & Results**

- **Configuration-Driven Rendering**: All OrderCard fields now respect the configured `shopifyFields` mappings
- **Webhook Data Compatibility**: Orders from Shopify webhooks (REST format) display correctly with GraphQL-style configuration
- **Label System Integration**: Difficulty and product type labels extracted from saved products data
- **Regex Transformations**: Timeslots, order dates, and other pattern-based extractions working correctly

### 🚀 **Deployment**

- **Build**: 2138 modules transformed successfully  
- **Bundle**: 801.97 kB (226.75 kB gzipped)
- **Version ID**: 4d5a1ca6-ca0c-4cbf-b485-6a17d31b30b3
- **Deployment URL**: https://order-to-do.stanleytan92.workers.dev
- **Status**: 🟢 **Critical Issues Resolved** - Field mapping working correctly

## [1.4.12] - 2025-01-24

### 🎯 **OrderCard Component Complete Rewrite & UI Structure Fix**

- **Complete OrderCard Component Rewrite**: Rebuilt OrderCard component from scratch to match OrderCardPreview structure exactly
  - **Proper Card Container Structure**: Now uses Card, CardHeader, CardContent components like OrderCardPreview
  - **Exact Field Mapping Logic**: Implements same field extraction, transformation, and rendering logic as OrderCardPreview
  - **Consistent UI/UX**: Same visual appearance, interactions, and behavior as preview
  - **Image Modal Integration**: Eye icon functionality works correctly with proper event handling

- **OrdersView Integration**: OrdersView now uses the new OrderCard component for both main orders and add-ons
  - **Main Orders**: Properly rendered with Card containers and all field functionality
  - **Add-Ons**: Same Card structure and functionality as main orders
  - **Field Display**: All configured fields (Product Title, Variant Title, Order ID, Timeslot, Difficulty, etc.) display correctly
  - **Editable Fields**: Textboxes, selects, and textareas work as configured
  - **Status Buttons**: Status circles function properly with click handlers

- **Technical Improvements**:
  - **Component Architecture**: Clean separation of concerns with StatusCircles, FieldRenderer, ExpandedView, and CollapsedView
  - **Field Value Extraction**: Proper Shopify data mapping and transformation logic
  - **Product Label Integration**: Fetches and displays difficulty/product type labels from Saved Products
  - **Event Handling**: Proper click propagation and form interaction handling
  - **Responsive Design**: Maintains mobile-friendly layout and interactions

### 🚀 **Impact**

- **Complete UI Parity**: OrdersView now matches OrderCardPreview exactly
- **Proper Card Structure**: All order cards now render within proper Card containers
- **Full Functionality**: All fields, buttons, and interactions work as expected
- **Image Modal Access**: Eye icon appears and opens product image modal correctly
- **Consistent Experience**: Same behavior across preview and live order views

### 🚀 **Deployment**

- **Build**: 2138 modules transformed successfully
- **Bundle**: 798.72 kB (225.98 kB gzipped)
- **No Breaking Changes**: All existing functionality preserved
- **Ready for Production**: Complete parity between preview and live views achieved

## [1.4.11] - 2025-01-24

### 🎯 **OrdersView OrderCard Rendering Fix & Image Modal Integration**

- **Complete OrderCard Rendering Parity**: Fixed critical issue where OrdersView was not using the same field mapping, transformation, and config logic as OrderCardPreview
  - OrdersView now uses shared `OrderCardRenderer` component for consistent rendering
  - All fields (Product Title, Variant Title, Order ID, Timeslot, Difficulty, etc.) now display correctly
  - Editable textboxes and status buttons now function as configured
  - Field extraction uses proper `shopifyFields` mapping and transformation logic

- **Product Image Modal Integration**: Added missing eye icon and image modal functionality to OrdersView
  - Added `ProductImageModal` component to OrdersView
  - Implemented `handleShowProductImage` handler for eye icon clicks
  - Eye icon now appears on order cards when product/variant IDs are available
  - Modal displays product images, details, and allows syncing from Shopify
  - Consistent behavior with OrderCardPreview image modal

### 🔧 **Technical Implementation**

- **Shared Component Usage**: OrdersView now leverages `OrderCardRenderer` for all order cards:
  - Passes correct config, users, labels, and order data
  - Uses same field extraction and transformation logic as preview
  - Maintains consistent UI/UX across preview and live view
- **Modal State Management**: Added proper state management for image modal:
  - `isProductImageModalOpen` state for modal visibility
  - `selectedProductId` and `selectedVariantId` for modal data
  - Proper ID extraction (strips `gid://` prefixes)
- **Event Handler Integration**: Connected eye icon clicks to modal functionality:
  - Prevents event bubbling for proper modal behavior
  - Handles both expanded and collapsed card views
  - Supports both main orders and add-on cards

### 🎨 **UI/UX Improvements**

- **Field Display Consistency**: All configured fields now display correctly:
  - Product titles and variants from Shopify data
  - Order IDs, timeslots, and difficulty labels
  - Custom fields with proper transformations
  - Status indicators and assignment information
- **Interactive Elements**: Editable fields and status buttons now functional:
  - Text inputs for editable fields as per config
  - Status circles for order status management
  - Proper event handling and state updates
- **Visual Consistency**: Order cards now match preview exactly:
  - Same layout, styling, and component structure
  - Consistent icon usage and field positioning
  - Proper spacing and typography

### 📊 **Data Flow Enhancement**

- **Field Mapping**: OrdersView now uses proper field extraction:
  - `shopifyFields` configuration for data source mapping
  - Transformation rules (regex, etc.) applied correctly
  - Fallback to direct order properties when needed
- **Label Integration**: Difficulty and product type labels display correctly:
  - Uses saved product data for label information
  - Proper color coding and badge display
  - Consistent with preview behavior

### 🚀 **Impact**

- **Complete Feature Parity**: OrdersView now matches OrderCardPreview functionality
- **Enhanced User Experience**: All fields and interactions work as expected
- **Image Modal Access**: Users can now view product images directly from order cards
- **Consistent Behavior**: Same rendering logic across preview and live views
- **Future-Ready**: Foundation for advanced order management features

### 🚀 **Deployment**

- **Build**: 2138 modules transformed successfully
- **Bundle**: 795.71 kB (225.38 kB gzipped)
- **Version ID**: 8b54a724-2db9-4f22-9150-c8be1cdb4b7e
- **Deployment URL**: https://order-to-do.stanleytan92.workers.dev
- **All endpoints functional**: No breaking changes to existing APIs

## [1.4.10] - 2025-01-24

### Fixed
- **Order Fetching Logic**: Fixed critical issue where orders weren't populating after sync
  - Added `getOrdersFromDbByDate` API function to fetch orders from database instead of Shopify API
  - Updated `processOrdersReload` to use database endpoint after syncing orders
  - Fixed dependency order in OrdersView component to prevent linter errors
  - Added `orders-from-db-by-date` to public endpoints list
  - Ensured proper classification of main orders vs add-ons after sync
  - Support fetching orders for all stores or specific store selection

### Technical
- **API Endpoints**: Added new database orders endpoint for proper data flow
- **Frontend Logic**: Fixed order processing pipeline to use correct data source
- **Error Handling**: Improved error handling and logging for order sync operations

## [1.4.9] - 2025-06-24

### 🎯 **OrdersView Logic Implementation - Add-On Classification & Line Item Processing**

- **Complete OrdersView Overhaul**: Implemented comprehensive logic for processing Shopify orders, line items, quantities, and add-on classification.
- **Full Shopify Order Data Integration**: OrdersView now fetches complete Shopify order data for each order to enable proper field mapping and add-on detection.
- **Line Item Processing**: Each line item within a Shopify order is now processed individually, with quantity flattening (e.g., quantity 3 = 3 separate cards).
- **Add-On Classification System**: Implemented automatic detection of add-ons using existing saved products API:
  - Extracts Product Title ID and Variant ID from each line item
  - Matches against saved_products table using `/api/tenants/:tenantId/saved-products/by-shopify-id`
  - Classifies line items as add-ons if they have "Add-Ons" label in product_labels
- **Container Separation**: Orders are now displayed in two separate containers:
  - **Main Orders Container**: Regular line items (non-add-ons)
  - **Add-Ons Processing Container**: Add-on line items for further processing
- **OrderCard Enhancement**: Updated OrderCard to handle new data structure:
  - Displays add-ons information in main order cards
  - Special handling for add-on cards with distinct styling
  - Add-ons field shows related add-ons with title, quantity, and price
  - Visual indicators (Gift icon) for add-on items

### 🔧 **Technical Implementation**

- **New Data Structures**: Added `ProcessedLineItem` interface for structured line item processing:
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
    shopifyOrderData: any;
    savedProductData?: any;
    cardId: string;
  }
  ```
- **Helper Functions**: Implemented comprehensive processing pipeline:
  - `processLineItems()`: Flattens line items by quantity
  - `classifyLineItems()`: Determines add-on status using saved products API
  - `separateMainAndAddOns()`: Sorts items into appropriate containers
  - `getAddOnsForOrder()`: Retrieves add-ons for specific orders
- **API Integration**: Leveraged existing endpoints:
  - `fetchShopifyOrder()`: Gets full Shopify order data
  - `getProductByShopifyIds()`: Matches line items to saved products
  - `getOrdersByDate()`: Retrieves basic order data
- **Error Handling**: Robust error handling for:
  - Missing Shopify order data
  - Failed add-on classification
  - API failures with graceful degradation

### 🎨 **UI/UX Improvements**

- **Statistics Dashboard**: Updated header stats to show:
  - Total Orders (main order cards)
  - Add-Ons count
  - Completed/Pending counts based on new data structure
- **Visual Indicators**: Added distinct styling for add-on cards:
  - Gift icon for add-on items
  - "Add-On" badges
  - Separate container with clear labeling
- **Add-Ons Display**: Enhanced add-ons field in OrderCard:
  - Lists all related add-ons with details
  - Shows quantity and price for each add-on
  - Clean, organized layout with background highlighting

### 📊 **Data Flow**

1. **Order Fetching**: `getOrdersByDate()` retrieves basic order data
2. **Shopify Data Enrichment**: `fetchShopifyOrder()` gets full Shopify order data for each order
3. **Line Item Processing**: `processLineItems()` flattens line items by quantity
4. **Add-On Classification**: `classifyLineItems()` matches against saved products to identify add-ons
5. **Container Separation**: `separateMainAndAddOns()` sorts items into main vs. add-on containers
6. **UI Rendering**: OrderCard displays appropriate information based on item type

### 🚀 **Deployment**

- **Build**: 2138 modules transformed successfully
- **Bundle**: 792.85 kB (225.28 kB gzipped)
- **Version ID**: 3d52d4da-0205-468b-8caa-570c8e893c27
- **All endpoints functional**: No breaking changes to existing APIs

### 🎯 **Impact**

- **Complete Order Processing**: Full Shopify order data now available for field mapping
- **Add-On Management**: Automatic detection and separation of add-on items
- **Quantity Handling**: Individual cards for each line item quantity
- **Enhanced UX**: Clear visual distinction between main orders and add-ons
- **Future-Ready**: Foundation for advanced add-on processing workflows

## [1.4.8] - 2025-01-24

### Fixed
- **Order Fetching Logic**: Fixed critical issue where orders weren't populating after sync
  - Added `getOrdersFromDbByDate` API function to fetch orders from database instead of Shopify API
  - Updated `processOrdersReload` to use database endpoint after syncing orders
  - Fixed dependency order in OrdersView component to prevent linter errors
  - Added `orders-from-db-by-date` to public endpoints list
  - Ensured proper classification of main orders vs add-ons after sync
  - Support fetching orders for all stores or specific store selection

### Technical
- **API Endpoints**: Added new database orders endpoint for proper data flow
- **Frontend Logic**: Fixed order processing pipeline to use correct data source
- **Error Handling**: Improved error handling and logging for order sync operations

## [1.4.7] - 2025-01-13

### 🎯 **Complete Saved Products Sync & Label Management System**

- **Full Product Sync Implementation**: Successfully implemented end-to-end product synchronization from Shopify to saved products database with all product details including images.
- **Database Schema Enhancement**: Added image fields to saved_products table via migration `0015_add_image_fields_to_saved_products.sql`:
  - `image_url` - Product image URL from Shopify
  - `image_alt` - Image alt text for accessibility
  - `image_width` - Image width in pixels
  - `image_height` - Image height in pixels
- **Backend API Completion**: Implemented all missing endpoints for saved products management:
  - `POST /api/tenants/:tenantId/saved-products` - Save products with full details
  - `DELETE /api/tenants/:tenantId/saved-products/:productId` - Delete single product
  - `DELETE /api/tenants/:tenantId/saved-products` - Bulk delete all products
  - `POST /api/tenants/:tenantId/saved-products/:productId/labels/:labelId` - Add label to product
  - `DELETE /api/tenants/:tenantId/saved-products/:productId/labels/:labelId` - Remove label from product
- **Frontend Integration**: Updated ProductManagement component with:
  - Separate "Save Selected" and "Update Selected" buttons for better UX
  - Proper product data mapping including all image fields
  - Real-time state updates after save operations
  - Label management functionality for saved products
- **Database Verification**: Confirmed 950 saved products in database with proper image URLs and all required fields.

### 🔧 **Technical Implementation**

- **Robust Backend Logging**: Added comprehensive logging throughout the save process:
  - Product data validation and mapping
  - Database write operations with verification
  - Label management operations
  - Error handling and debugging information
- **Database Service Enhancement**: Updated `saveProducts` function to:
  - Handle both new products and updates to existing products
  - Preserve product IDs for existing products
  - Include all image fields in database operations
  - Perform verification queries after saves
- **API Service Updates**: Enhanced frontend API service with:
  - Proper error handling for label operations
  - Authentication for all saved products endpoints
  - Support for bulk operations and filtering

### 🎯 **Product Data Sync Flow**

- **Frontend → Backend**: Complete product details sent including:
  - `shopifyProductId`, `shopifyVariantId`, `title`, `variantTitle`
  - `description`, `price`, `tags`, `productType`, `vendor`, `handle`
  - `imageUrl`, `imageAlt`, `imageWidth`, `imageHeight`
- **Backend → Database**: All fields properly mapped and stored with:
  - Upsert operations (INSERT OR REPLACE) for data integrity
  - Proper JSON serialization for tags array
  - Timestamp management for created_at and updated_at
  - Foreign key relationships maintained
- **Database Verification**: Confirmed successful storage with:
  - 950 products in database
  - Image URLs properly populated
  - All required fields present and accessible

### 🏷️ **Label Management System**

- **Product Label Mappings**: Implemented complete label management for saved products:
  - Many-to-many relationship between products and labels
  - Proper foreign key constraints and cascading deletes
  - Duplicate prevention with unique constraints
- **Label Operations**: Full CRUD operations for product labels:
  - Add labels to products with validation
  - Remove labels from products
  - Query products with their associated labels
  - Label filtering and search capabilities

### 🚀 **Deployment & Testing**

- **Successful Deployment**: Deployed to production with:
  - Build: 2138 modules transformed
  - Bundle: 786.58 kB (223.65 kB gzipped)
  - Version ID: b8571f8f-a9b2-4050-b918-91a0ec8b6414
  - All endpoints functional and tested
- **Database Verification**: Confirmed system integrity:
  - 950 saved products with complete data
  - Image URLs properly stored and accessible
  - Label management operations working
  - All API endpoints responding correctly

### 🎯 **Impact**

- **Complete Product Management**: Users can now fully manage their product catalog from Shopify
- **Image Support**: All product images are properly synced and displayed
- **Label Organization**: Products can be organized with custom labels for better management
- **Data Integrity**: Robust sync system ensures no data loss during operations
- **User Experience**: Intuitive interface for saving, updating, and organizing products

## [1.4.6] - 2025-01-13

### 🔧 **OrderCardPreview Date Parsing Fix**

- **Fixed Date Display**: Updated date field rendering to properly handle `dd/mm/yyyy` format by converting it to ISO format (`yyyy-mm-dd`) before creating JavaScript Date objects.
- **Enhanced Date Parsing**: Added specific handling for European date format in the `renderValue` function to prevent "Invalid Date" errors.

### 🐛 **Bug Fixes**
- Fixed issue where extracted dates in `dd/mm/yyyy` format were showing as "Invalid Date" in the order card preview
- Added proper date format conversion from `15/06/2025` to `2025-06-15` for JavaScript Date constructor compatibility

### 📊 **Technical Improvements**
- Enhanced date field rendering with format detection and conversion
- Improved error handling for date parsing operations

## [1.4.5] - 2025-01-13

### 🔧 **OrderCardPreview Array Access & Date Extraction Fixes**

- **Fixed Array Index Access**: Updated `getValueFromShopifyData` function to properly handle numeric array indices in field paths (e.g., `lineItems.edges.0.node.title`).
- **Improved Date Extraction**: Fixed regex pattern for date extraction from tags to use proper word boundaries and format validation.
- **Updated Default Field Mappings**: Corrected default field mappings in `getAllFields()` to use proper Shopify GraphQL response paths.
- **Enhanced Debugging**: Improved array processing logic with better error handling and logging for array index access.

### 🐛 **Bug Fixes**
- Fixed issue where product titles and variant titles weren't being extracted due to incorrect array index handling
- Fixed date extraction regex pattern from `\\d{2}/\\d{2}/\\d{4}` to proper format with word boundaries
- Updated default field mappings for difficulty and product type labels to use correct paths

### 📊 **Technical Improvements**
- Enhanced array processing in `getValueFromShopifyData` to distinguish between numeric indices and property names
- Improved error handling for array bounds checking
- Better debugging output for array access operations

## [1.4.4] - 2025-01-13

### 🔧 **OrderCardPreview Fixes**

- **Fixed Field Mappings**: Updated Shopify field mappings to use correct GraphQL response structure (camelCase instead of snake_case).
- **Product Information Mapping**: Fixed `lineItems.edges.0.node.title` mapping for product titles and variants.
- **Order Data Display**: Resolved issue where order details weren't showing when fetching real orders from Shopify.
- **Field Mapping Updates**: Updated all Shopify field options to match actual GraphQL API response structure:
  - `line_items.title` → `lineItems.edges.0.node.title`
  - `line_items.variant_title` → `lineItems.edges.0.node.variant.title`
  - `order_number` → `orderNumber`
  - `created_at` → `createdAt`
  - `fulfillment_status` → `displayFulfillmentStatus`
  - `financial_status` → `displayFinancialStatus`
- **Debugging Support**: Added comprehensive debugging logs to track data extraction and field mapping issues.
- **Linter Error Fixes**: Resolved TypeScript linter errors in OrderCardSettingsNew component.

### 🐛 **Bug Fixes**
- Fixed property name mismatches (`is_visible` → `isVisible`, `is_system` → `isSystem`)
- Removed invalid field type references and problematic grouped field logic
- Fixed field editor component property access issues

## [1.4.3] - 2025-06-24
### Fixed
- Collapsed view of OrderCardPreview now uses the fetched difficulty label from Saved Products, ensuring the badge is always correct and matches the expanded view.

## [1.4.2] - 2025-06-24
### Fixed
- Removed redundant product label badge at the bottom of OrderCardPreview expanded view. Only the main Difficulty Label badge remains for clarity.

## [1.4.1] - 2025-06-24
### Added
- OrderCardPreview now attaches both difficulty and product type labels as properties (`orderCardLabels`) on the order card, making them available for future features and debugging. No UI change yet.

## [1.4.0] - 2025-06-23

### 🎉 Major Features
- **AI Florist Chat Integration**: Integrated real OpenAI GPT-3.5-turbo for dynamic chat responses
- **DALL-E Image Generation**: Full integration with OpenAI DALL-E 3 for bouquet image generation
- **AI Training Data Manager**: Complete rating and feedback system for generated designs
- **Database Schema Enhancement**: Added missing columns for AI-generated designs tracking

### ✨ New Features
- **Real-time AI Chat**: AI Florist now uses OpenAI GPT for intelligent, contextual responses
- **Image Rating System**: Users can rate generated designs (1-5 stars) with feedback
- **Design History**: All generated designs are saved and trackable in the database
- **Training Data Analytics**: Comprehensive stats and analytics for AI training data
- **Model Version Tracking**: Track which AI model version generated each design
- **Cost Tracking**: Monitor AI generation costs per design

### 🔧 Technical Improvements
- **Database Schema Updates**:
  - Added `model_version` column to `ai_generated_designs` table
  - Added `cost` column to track generation expenses
  - Added `status` column for design processing states
- **API Endpoints**:
  - `/api/ai/chat` - Real OpenAI integration for chat responses
  - `/api/ai/generate-bouquet-image` - Enhanced with database saving
  - `/api/tenants/:tenantId/ai/generated-designs` - List all generated designs
  - `/api/tenants/:tenantId/ai/generated-designs/:designId` - Update design ratings
- **Frontend Enhancements**:
  - Console logging for debugging image generation responses
  - Improved error handling for rating submissions
  - Real-time feedback for user actions

### 🐛 Bug Fixes
- **Database Migration Conflicts**: Fixed conflicting index creation in migration files
- **Missing Database Columns**: Resolved SQLite errors for missing schema columns
- **Rating System**: Fixed 404 errors when rating fallback images
- **API Integration**: Corrected OpenAI API key usage and error handling

### 📊 Analytics & Monitoring
- **Generation Tracking**: Monitor success/failure rates of AI image generation
- **Cost Analytics**: Track spending on AI generation per tenant
- **Quality Metrics**: User ratings and feedback collection for AI improvement
- **Performance Monitoring**: Generation time tracking and optimization

### 🔒 Security & Stability
- **Tenant Isolation**: All AI operations properly scoped to tenant context
- **Error Handling**: Graceful fallbacks for API failures and database errors
- **Data Integrity**: Proper foreign key relationships and data validation

### 📚 Documentation
- **API Documentation**: Updated with new AI endpoints and parameters
- **Database Schema**: Documented new columns and their purposes
- **Implementation Guide**: Added AI Florist integration documentation

### 🚀 Deployment
- **Production Ready**: All changes deployed to production environment
- **Database Migration**: Safe migration of existing data with new schema
- **Backward Compatibility**: Maintained compatibility with existing features

---

## [1.3.0] - 2025-06-22

### ✨ New Features
- **AI Training Data Manager**: Comprehensive interface for managing AI training data
- **Product Labeling System**: Enhanced product categorization and labeling
- **Order Card Configuration**: Customizable order card layouts and fields
- **Mobile Camera Widget**: Photo capture and upload functionality

### 🔧 Technical Improvements
- **Multi-tenant Architecture**: Improved tenant isolation and data management
- **Database Optimization**: Enhanced query performance and indexing
- **API Enhancements**: New endpoints for AI training and product management

### 🐛 Bug Fixes
- **Authentication Issues**: Fixed JWT token validation problems
- **Data Synchronization**: Resolved Shopify webhook synchronization issues
- **UI Responsiveness**: Improved mobile and tablet interface compatibility

---

## [1.2.0] - 2025-06-21

### ✨ New Features
- **Shopify Integration**: Complete order synchronization and product management
- **Analytics Dashboard**: Comprehensive business metrics and reporting
- **Order Management**: Enhanced order processing and status tracking
- **Customer Management**: Customer data and order history tracking

### 🔧 Technical Improvements
- **Real-time Updates**: WebSocket integration for live data updates
- **Performance Optimization**: Reduced loading times and improved responsiveness
- **Error Handling**: Enhanced error recovery and user feedback

### 🐛 Bug Fixes
- **Data Consistency**: Fixed order status synchronization issues
- **UI Glitches**: Resolved interface rendering problems
- **API Reliability**: Improved API endpoint stability

---

## [1.1.0] - 2025-06-20

### ✨ New Features
- **User Authentication**: Secure login and user management system
- **Multi-tenant Support**: Isolated data and settings per tenant
- **Basic Order Management**: Order creation, editing, and status tracking
- **Product Catalog**: Product management and inventory tracking

### 🔧 Technical Improvements
- **Database Design**: Optimized schema for multi-tenant architecture
- **API Foundation**: RESTful API endpoints for core functionality
- **Frontend Framework**: React-based user interface with modern UI components

### 🐛 Bug Fixes
- **Initial Setup**: Resolved database initialization issues
- **User Permissions**: Fixed access control and authorization problems

---

## [1.0.0] - 2025-06-19

### 🎉 Initial Release
- **Core Order Management**: Basic order creation and management
- **User Interface**: Modern, responsive web application
- **Database Foundation**: SQLite-based data storage
- **Cloudflare Workers**: Serverless backend deployment 