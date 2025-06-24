# Changelog

All notable changes to this project will be documented in this file.

## [1.4.3] - 2025-01-13

### 🔄 **Saved Products Sync System**

- **New Sync Script**: Created comprehensive sync system to sync saved products from local SQLite database to D1 database.
- **Upsert Operations**: Implemented safe "upsert" (insert or update) operations that preserve existing data and only add/update products as needed.
- **Missing POST Endpoint**: Added the missing `/api/tenants/:tenantId/saved-products` POST endpoint to the worker that was preventing product saving functionality.
- **Sync Script Features**:
  - Generates SQL scripts for safe database operations
  - Supports tenant-specific syncing with `--tenant-id` parameter
  - Dry-run mode for testing without making changes
  - Batch processing for large datasets
  - Comprehensive logging and progress tracking
- **Script Usage**: Added `npm run sync-saved-products` command for easy execution.
- **Data Preservation**: Sync operations use `INSERT OR REPLACE` to ensure no data loss unless explicitly requested.

### 🔧 **Technical Implementation**

- **Worker Endpoint**: Added POST endpoint for saving products that was missing from the worker implementation.
- **Database Service**: Leverages existing `d1DatabaseService.saveProducts()` method for consistent data handling.
- **Script Architecture**: Created modular sync system with:
  - `SavedProductsSync` class for core sync logic
  - SQL script generation for safe execution
  - Command-line argument parsing
  - Comprehensive error handling and logging

### 🎯 **Impact**

- **Product Management**: Users can now successfully save products from Shopify to their local database.
- **Data Synchronization**: Provides safe way to sync local product data to production D1 database.
- **Development Workflow**: Enables local development with SQLite and production deployment with D1.
- **Data Integrity**: Ensures no existing product data is lost during sync operations.

## [1.4.2] - 2025-01-13

### 🔧 **Critical Webhook Display Fix**

- **Fixed Webhook Count Display Issue**: Resolved critical issue where webhook registration was working but the UI showed "0 webhooks" after registration.
- **Root Cause Identified**: The problem was caused by inconsistent database function usage across API endpoints:
  - Webhook registration used `getStore()` → returned correct data with webhooks ✅
  - Frontend refresh used `/api/tenants/:tenantId/stores` → called `getShopifyStores()` → returned incomplete data ❌
- **Database Function Consistency**: Updated all store-related endpoints to use `getStores()` instead of `getShopifyStores()`:
  - `/api/tenants/:tenantId/stores` - Now returns complete store objects with parsed settings
  - `/api/tenants/:tenantId/test-shopify` - Updated for consistency
  - `/api/tenants/:tenantId/orders-by-date` - Updated for proper store data structure
- **Settings Parsing**: The `getStores()` function properly parses the JSON `settings` column from the database, including the `webhooks` array.
- **Data Structure Consistency**: All endpoints now return consistent store objects with:
  - Properly parsed settings including webhooks
  - Complete store configuration data
  - Consistent field naming and structure

### 🔧 **Technical Details**

- **Function Difference**: 
  - `getShopifyStores()` - Returns raw database fields, no settings parsing, no webhooks
  - `getStores()` - Returns complete Store objects with parsed settings including webhooks
- **Database Schema**: The `shopify_stores` table stores webhook configurations in the JSON `settings` column
- **API Response**: Store objects now include `settings.webhooks` array with registration status and timestamps

### 🎯 **Impact**

- **Webhook Status Display**: UI now correctly shows the number of registered webhooks
- **Store Management**: All store-related functionality now uses consistent data structures
- **API Reliability**: Eliminated data inconsistency between different store endpoints
- **User Experience**: Users can now see accurate webhook registration status after setup

## [1.4.1] - 2025-01-13

### 🔧 **Critical Runtime Error Fixes**

- **Fixed 500 Internal Server Errors**: Resolved critical runtime errors that were causing all application routes to return 500 Internal Server Errors.
- **Removed Problematic Code**: Cleaned up worker code by removing:
  - Development environment checks using `process.env` (not available in Cloudflare Workers)
  - Unimplemented database service methods (`resetDailyUploadGoals`, `syncProductFromWebhook`, etc.)
  - Missing type definitions (`ExportedHandler`, `DurableObjectState`, `WebSocketPair`)
  - Unused webhook handling functions and Durable Object classes
- **Simplified Static Asset Serving**: Streamlined static asset serving to use only the Cloudflare Workers `ASSETS` binding.
- **Error Handling**: Improved error handling to prevent unhandled exceptions from crashing the worker.

### 🔧 **Critical Static Asset Serving Fix**

- **Fixed 404 Errors for All Routes**: Resolved critical issue where all application routes were returning 404 errors due to incorrect static asset serving configuration.
- **Cloudflare Workers Asset Binding**: Fixed static asset serving to properly use the `ASSETS` binding instead of incorrect `serveStatic` configuration.
- **SPA Routing Support**: Implemented proper SPA routing that serves `index.html` for client-side routes while allowing API routes to pass through.
- **Asset Fallback Logic**: Added fallback logic to serve `index.html` when static assets are not found, enabling proper client-side routing.

### 🔧 **Shopify Order Fetching Fix**

- **Fixed "Fetch Orders from Shopify" Functionality**: Resolved critical issue in Settings > Order Card where the "Fetch Orders from Shopify" feature was not working due to API parameter mismatch.
- **ShopifyApiService Update**: Updated `getOrders()` method in `ShopifyApiService` to accept optional filtering parameters (`name` and `status`) to support order lookup functionality.
- **API Parameter Support**: The `getOrders()` method now properly handles:
  - Order name filtering for specific order lookup
  - Status filtering (any, open, closed, cancelled)
  - Backward compatibility with existing calls
- **Worker Endpoint Fix**: Fixed the `/api/tenants/:tenantId/stores/:storeId/orders/by_name` endpoint to properly use the updated `getOrders()` method.
- **Import Statement Fix**: Corrected import statement for `d1DatabaseService` to use the proper export name.

### 🚀 **Deployment Information**

- **Build Status**: ✅ Successful build with 2138 modules transformed
- **Bundle Size**: 781.96 kB (222.37 kB gzipped)
- **Deployment URL**: https://order-to-do.stanleytan92.workers.dev
- **Version ID**: f7767ffa-08e3-48b9-a980-dd72c5f6704b
- **All Bindings**: Properly configured (DB, ASSETS, JWT_SECRET, NODE_ENV, OPENAI_API_KEY)

### 🔧 **Technical Details**

- **Worker Startup Time**: 15ms
- **Asset Upload**: 333.78 KiB / gzip: 65.54 KiB
- **Environment**: Production
- **Database**: D1 Database (order-todo-db) properly connected

### 🐛 **Bug Fixes**

- **Import Error Resolution**: Fixed import error in `worker/index.ts` where `D1DatabaseService` was incorrectly imported as a class instead of the exported `d1DatabaseService` object.
- **Linter Error Cleanup**: Resolved TypeScript compilation errors that were preventing successful builds.

### 🎯 **Impact**

- **Application Accessibility**: All application routes are now accessible and functional
- **SPA Functionality**: Client-side routing now works correctly for all pages
- **Order Card Testing**: Users can now successfully test their order card configurations with real Shopify order data
- **Field Mapping Validation**: The live preview now properly displays how configured field mappings and transformations work with actual order data
- **Store Integration**: Complete end-to-end testing of Shopify store integration is now functional

## [0.2.4] - 2025-06-23

### 🗄️ **Critical Database Fix**

- **Missing `shopify_stores` Table**: Fixed a critical issue where the `shopify_stores` table was missing from the database, causing all store management functionality to fail.
- **Database Migration**: Created and applied migration `0009_create_shopify_stores_table.sql` to create the missing table with proper schema:
  - `id` - Primary key
  - `tenant_id` - Foreign key to tenants table
  - `shopify_domain` - Store domain (e.g., my-store.myshopify.com)
  - `access_token` - Shopify API access token
  - `webhook_secret` - Webhook verification secret
  - `sync_enabled` - Boolean flag for sync status
  - `settings` - JSON field for webhook configurations and other settings
  - `created_at`, `updated_at`, `last_sync_at` - Timestamps
- **Performance Indexes**: Added proper indexes for efficient querying:
  - Index on `tenant_id` for tenant-specific queries
  - Index on `shopify_domain` for domain lookups
  - Index on `sync_enabled` for filtering active stores
  - Unique constraint on `(tenant_id, shopify_domain)` to prevent duplicates
- **Foreign Key Constraints**: Added proper foreign key relationship to `tenants` table with CASCADE delete

### 🔧 **Impact**

- **Store Management**: Users can now successfully add, edit, and manage Shopify stores
- **Webhook Registration**: Store webhook registration now works properly
- **API Testing**: "Test Connection" functionality is now operational
- **Multi-tenant Support**: Proper tenant isolation for store configurations

### 🐛 **Root Cause**

- The `shopify_stores` table was referenced in multiple migrations (0012, etc.) but never actually created
- Backend code expected the table to exist, causing 401 errors and failed store operations
- This was a critical infrastructure issue that prevented core functionality

## [0.2.3] - 2025-06-23

### 🔧 **Webhook System Overhaul**

- **Comprehensive Webhook Handler**: Completely rewrote the webhook system with a unified endpoint at `/api/webhooks/shopify` that handles all Shopify webhook topics:
  - `orders/create` - Creates new orders automatically
  - `orders/updated` - Updates existing orders
  - `orders/fulfilled` - Marks orders as completed
  - `orders/cancelled` - Marks orders as cancelled
  - `products/create` & `products/update` - Handles product changes
  - `products/delete` - Removes products from saved list
  - `inventory_levels/update` - Tracks inventory changes
  - `app/uninstalled` - Handles app uninstallation

- **Enhanced Webhook Registration**: Improved webhook registration process with:
  - Automatic cleanup of existing webhooks before registration
  - Comprehensive error handling and status tracking
  - Support for 9 different webhook topics
  - Webhook status monitoring with last trigger timestamps

- **Webhook Status Monitoring**: Added webhook status section to Settings > General page showing:
  - Real-time webhook status (active/error/inactive)
  - Last trigger timestamps for each webhook
  - Visual status indicators (green/red/gray dots)
  - One-click webhook registration and connection testing

### 🔐 **Authentication Fixes**

- **JWT Middleware Improvements**: Fixed persistent JWT authentication errors by:
  - Adding realtime status endpoint to public endpoints list
  - Improved error handling in JWT middleware
  - Better logging for authentication issues

### 🏪 **Store Management Enhancements**

- **Store Connection Testing**: Added "Test Connection" button to verify Shopify API credentials
- **Enhanced Store Settings**: Improved store configuration with better validation and error handling
- **Webhook Status Tracking**: Store settings now include webhook registration timestamps and status

### 🗄️ **Database Improvements**

- **New Database Method**: Added `getAllStores()` method to support webhook processing across all tenants
- **Enhanced Store Data**: Store objects now include comprehensive webhook information and status tracking

### 📊 **API Improvements**

- **Unified Webhook Endpoint**: Single endpoint handles all webhook types with proper routing
- **Better Error Handling**: Comprehensive error handling and logging for all webhook operations
- **Status Tracking**: Webhook status is automatically updated when webhooks are triggered

## [0.2.2] - 2025-06-23

### ✨ Features & Fixes

- **Restored Settings > General Page**: Completely restored the General settings page with full Shopify store management functionality that was previously missing.
- **Shopify Store Management**: Added comprehensive store CRUD operations including:
  - Add new Shopify stores with API credentials
  - Edit existing store configurations
  - Delete stores with confirmation
  - View store status and last sync information
  - Register webhooks for automatic order/product sync
- **API Configuration Help**: Added detailed step-by-step guide for setting up Shopify API credentials.
- **Store Status Monitoring**: Display store status, last sync time, and webhook registration status.
- **Mobile Responsive**: All store management features are fully responsive and mobile-optimized.

### 🐛 Bug Fixes

- **TypeScript Errors**: Fixed missing properties in Store and StoreSettings types (`lastSyncAt`, `accessToken`, `apiSecretKey`).
- **Settings Page Restoration**: Recovered the complete General settings functionality that was accidentally removed.

### ♻️ Improvements

- **Enhanced UI**: Improved store management interface with better visual hierarchy and status indicators.
- **Error Handling**: Added proper error handling and user feedback for store operations.
- **Security**: API credentials are properly masked in password fields.

## [0.2.1] - 2025-06-22

### ✨ Features & Fixes

-   **Comprehensive Mobile Responsiveness**: A full-site audit and update were performed to ensure all pages and components are mobile-friendly.
-   **Orders Page (`OrdersView.tsx`)**: The main orders grid, buttons, and text have been optimized for smaller screens.
-   **Analytics Page (`Analytics.tsx`)**: Card layouts, tables, and spacing have been refined for a better mobile experience.
-   **Settings Page (`Settings.tsx`)**: All tabs (General, Order Card, Users, Billing), dialogs, and form controls are now fully responsive.
-   **Live Preview**: The "Fetch a test Shopify order" controls are now stacked and full-width on mobile.

### ♻️ Improvements

-   **UI Consistency**: Improved UI consistency across different screen sizes.
-   **Touch Targets**: Increased the size of buttons and other interactive elements on mobile for better usability.
-   **Removed "Save All Settings" Button**: The global "Save All Settings" button in the header was removed to reduce user confusion, as settings are saved per section.

## [0.5.0] - 2025-01-13

### ✨ Features & Documentation

- **Recipe Feature Planning**: Added comprehensive documentation for recipe management system in Phase 2 of the architecture
- **Inventory Management System**: Created detailed documentation for the complete inventory management component
- **Recipe Icon Positioning**: Moved the product image eye icon below the variant title in OrderCard preview for better UX
- **System Architecture Updates**: Enhanced Phase 2 objectives to include recipe integration and modal display features
- **Database Schema Planning**: Documented complete database schema for inventory items, suppliers, and stock transactions
- **API Endpoint Specification**: Defined comprehensive API endpoints for inventory management operations
- **Implementation Roadmap**: Created 7-week development plan with clear milestones for inventory system implementation

### 📚 Documentation

- **INVENTORY_MANAGEMENT.md**: Comprehensive 500+ line documentation covering:
  - Complete data architecture and models
  - Database schema with SQL table structures
  - API endpoint specifications
  - UI/UX design mockups and component interfaces
  - Technical implementation details
  - Integration points with recipe and order management
  - Implementation roadmap and success metrics
- **SYSTEM_ARCHITECTURE.md**: Updated Phase 2 section with:
  - Recipe management system interfaces
  - Recipe UI component specifications
  - Integration with product image modals
  - Enhanced objectives and technical implementation details

### 🎯 Future Features Planned

- **Recipe Builder**: Two-column modal interface for ingredients and quantities
- **Ingredient Database**: Centralized management of florist materials
- **Supplier Management**: Track suppliers and ordering information
- **Stock Forecasting**: Predict required materials based on order volume
- **Recipe Display**: Replace order notes with recipe lists in product image modals

## [0.4.0] - 2025-06-13

### ✨ Features & Fixes

-   **Enhanced Order Card Preview**: The Order Card Preview in the settings has been significantly improved for better usability and accuracy.
-   **Mobile-Friendly Status Buttons**: The status buttons (Unassigned, Assigned, Completed) are now larger and have a wider click radius on mobile devices.
-   **Difficulty Label in Collapsed View**: The collapsed view of the order card now displays the `Difficulty Label` as a colored badge in the bottom-right corner for quick reference.

### 🐛 Bug Fixes

-   **Textarea Focus Bug**: Fixed a persistent issue where the "Customisations" textarea would lose focus after every character typed. This was resolved by refactoring the view components to prevent unnecessary re-renders.
-   **Data Sync for Difficulty Label**: Corrected a bug where the collapsed view would show stale or incorrect data for the `Difficulty Label`. Both collapsed and expanded views are now correctly synchronized.
-   **Mobile/Desktop View Toggle**: The toggle in the main dashboard now correctly defaults to the appropriate view based on screen size and can be manually overridden for testing.
-   **Product Title Wrapping**: Removed unwanted text truncation on the product title in the collapsed view, allowing it to wrap and display the full text.

### ♻️ Improvements

-   **Component Refactoring**: The `OrderCardPreview`'s sub-components were refactore out to improve stability and prevent re-render-related bugs.
-   **Responsive Design**: Fixed several issues where the settings page layout would break on mobile screens, ensuring a smooth experience across all devices.

## [0.3.0] - 2025-01-13

A major refactoring release focused on improving code maintainability and developer experience through component reorganization.

### ✨ Features

- **ProductManagement Component Reorganization**: Completely restructured the monolithic 1399-line ProductManagement component into smaller, focused sub-components:
  - **LabelsManagementSection**: Handles product label creation, editing, and display
  - **ProductSyncSection**: Manages Shopify product synchronization and filtering
  - **SavedProductsSection**: Manages saved products and bulk labeling operations
  - **useProductManagement Hook**: Custom hook for state management and business logic
- **"None" Option for Label Selection**: Added "None" options to both Difficulty Label and Product Type Label dropdowns, allowing users to deselect labels without refreshing the page
- **Enhanced TypeScript Support**: Improved type safety throughout the component hierarchy with proper interface definitions

### ♻️ Improvements

- **Separation of Concerns**: UI logic, business logic, and state management are now properly separated
- **Code Maintainability**: Each component has a single responsibility, making it easier to locate and fix bugs
- **Performance Optimization**: Implemented memoized computed properties and optimized re-renders with useCallback
- **Developer Experience**: Better IDE support, easier debugging, and clearer error messages
- **Testability**: Components and custom hook can now be tested independently
- **Reusability**: Sub-components and custom hook can be reused in other parts of the application

### 📁 File Structure Changes

```
src/
├── components/
│   ├── ProductManagement.tsx          # New organized version (~150 lines)
│   ├── ProductManagementNew.tsx       # Alternative organized version
│   └── product-management/
│       ├── LabelsManagementSection.tsx
│       ├── ProductSyncSection.tsx
│       └── SavedProductsSection.tsx
├── hooks/
│   └── useProductManagement.ts        # Custom hook for state management
└── docs/
    └── implementation/
        └── PRODUCT_MANAGEMENT_REORGANIZATION.md
```

### 🔧 Technical Details

- **Component Size Reduction**: Main component reduced from 1399 lines to ~150 lines
- **State Management**: Centralized in custom hook with proper TypeScript interfaces
- **API Integration**: Isolated in custom hook for better error handling
- **Mobile Responsiveness**: Maintained across all sub-components
- **Product Labeling Workflow**: Preserved all existing functionality while improving code structure

## [0.1.0] - 2024-06-21

This is the initial release after a major feature development and bug-fixing cycle.

### ✨ Features

-   **Order Card Live Preview System**: Implemented a "Live Preview" in the settings to show how the order card will look on the main dashboard.
-   **Dynamic Field Mapping**: The Order Card now dynamically renders based on the configuration set in the settings.
-   **Advanced Field Transformations**: Added the ability to use Regex extractors to pull specific data from Shopify fields (e.g., extracting a timeslot from a note).
-   **Fetch Real Order for Preview**: Added a "Fetch Order" button in the settings to test the preview with live data from Shopify.
-   **Custom Field Creation**: Users can now add new custom fields to the order card.
-   **Product Labels Management**: Implemented a full CRUD (Create, Read, Update, Delete) system for managing "Difficulty" and "Product Type" labels, including a new database table and migrations.
-   **URL-Based Tabs**: The tabs in the Settings page now have their own URLs for better navigation.

### 🐛 Bug Fixes

-   **Fixed Application Deployment**: Resolved a series of issues that were preventing the application from building and deploying successfully, including Vite path alias errors, Wrangler configuration errors, and Cloudflare Worker runtime errors.
-   **Fixed "Go Live" Functionality**: The `OrderCard` component was refactored to correctly use the saved configuration, making the "Go Live" feature fully functional.
-   **Fixed Date Parsing**: Corrected a bug where dates in `dd/mm/yyyy` format were showing as "Invalid Date" in the preview.
-   **Fixed Duplicate Fields**: Removed a duplicate "Priority Label" from the order card preview.
-   **Fixed Hardcoded Mappings**: Removed hardcoded values in the Order Card Preview, so it now fully respects the field mapping settings.
-   **Fixed Text Wrapping**: The "Customisations" text area now correctly wraps long text, especially on mobile views.
-   **Fixed Label Creation**: Fixed a bug where new product labels were not being saved to the database.

### ♻️ Improvements

-   **Code Refactoring**: Major refactoring of `OrderCard.tsx` and `OrderCardPreview.tsx` for better maintainability and to support dynamic rendering.
-   **UI/UX**: Renamed "Priority Label" to "Difficulty Label" for clarity. Added accessibility improvements to dialogs.
-   **Database**: Added a new `product_labels` table and implemented proper database migrations.

## [0.2.0] - 2025-06-21

A major feature and UI enhancement release focused on improving product management workflows and system stability.

### ✨ Features

-   **Saved Product Filtering**: In the "All Products" card, a new filter was added to display `All Products`, `Saved Only`, or `Not Saved` products, making it easier to identify which items need to be saved locally.
-   **Label Status Filtering**: In the "Saved Products" card, a new filter was added to display `All Saved`, `Labelled`, or `Not Labelled` products, helping users quickly find items that require labelling.
-   **Advanced Filter Management**: Both product cards now feature a "Clear Filters" button to reset all active filters at once and a dynamic "Filter Summary" area that displays active filters as removable badges.
-   **Async Loading Indicator**: The "Save Selected" button now displays a loading spinner and is disabled during the save operation, providing clear visual feedback to the user.

### 🐛 Bug Fixes

-   **Application Build Failures**: Resolved multiple build-breaking issues in the `ProductManagement.tsx` component, including an incorrect import path for the AuthContext and a missing closing brace that caused syntax errors.
-   **Deployment Warning**: Investigated and fixed a Wrangler warning related to multiple environments by updating the `wrangler.jsonc` configuration and the deployment script for more explicit environment handling.
-   **UI Overflow**: Fixed a significant UI bug where filter and action buttons would overflow their container on smaller screens. The layout is now fully responsive and wraps correctly.

### ♻️ Improvements

-   **Code Quality**: Performed a full-project format using Biome to ensure consistent code style.
-   **Deployment Process**: The deployment process is now faster and no longer produces environment-related warnings.
-   **User Experience**: The new filters, loading indicators, and UI fixes provide a much smoother and more intuitive workflow for product management.

## [1.0.0] - 2025-06-20
### Added
- Migrated backend from SQLite to Cloudflare D1 for true cloud-native, multi-tenant, multi-user support.
- Implemented D1 schema for tenants, users, orders, products, and Shopify stores.
- Refactored Worker entrypoint to use D1 and new async database service.
- Added API routes for tenant and user management, all powered by D1.
- Verified D1 connection and CRUD operations via local Worker dev server.
- Fixed API route order for correct user listing.
- Updated wrangler config for D1 and removed legacy assets config.
- Set up JWT secrets in Cloudflare environment.
- Committed all foundational work to GitHub.

### Changed
- Backend architecture from local SQLite to cloud-native D1.
- API structure to support multi-tenant isolation.
- Deployment strategy to use Cloudflare Workers and D1.

### Technical
- Database: SQLite → Cloudflare D1
- Backend: Node.js → Cloudflare Workers
- Storage: Local file → Cloud D1
- Authentication: Local → JWT with Cloudflare secrets

## Refactored AI Integration into its own main navigation tab for better modularity.
- Cleaned up the Settings page, removing duplicated AI and Mobile Camera Widget functionality.
- Resolved `ReferenceError` issues on the Settings page caused by the refactor.
- Updated the AI navigation and page icons to `Sparkles` for a more intuitive UI.

## [0.2.3] - 2025-06-23

### 🐛 Bug Fixes

-   **SPA Routing Fix for /products**: Removed the explicit `/products` route from the worker. This allows the SPA catch-all to handle `/products` and resolves the persistent 404 error on that route. Now all non-API routes are handled consistently by the SPA router. 

## [1.4.1] - 2025-06-23

### Fixed
- **React Error #130**: Fixed persistent React error #130 in Order Card Settings by removing problematic `icon` and `processor` properties from OrderCardField interface that were causing serialization issues
- **Order Card Preview**: Restored working Order Card Preview functionality by reverting to stable component structure from commit acd761b
- **Field Mapping**: Simplified field mapping structure to use `transformation` and `transformationRule` instead of complex `processor` objects
- **Type Safety**: Improved type safety by removing non-serializable React component references from field definitions

### Technical
- Replaced complex `processor` objects with simple `transformation` and `transformationRule` properties
- Removed `icon` property from OrderCardField interface to prevent React serialization errors
- Updated OrderCardPreview component to use stable, working structure
- Maintained all existing functionality while fixing the React error

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