# Changelog

All notable changes to this project will be documented in this file.

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

---

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