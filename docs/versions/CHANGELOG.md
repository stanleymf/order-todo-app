# Changelog

All notable changes to this project will be documented in this file.

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