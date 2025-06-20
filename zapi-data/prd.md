# Product Requirements Document: Florist Order Dashboard

## 1. Overview

This document outlines the requirements for a web-based Order Dashboard application designed for a flower delivery e-commerce business. The application will serve as a centralized platform for florists and administrators to manage daily flower arrangement orders sourced from multiple Shopify stores. It aims to replace the current spreadsheet-based workflow with a more efficient, interactive, and data-driven system. The dashboard will provide a real-time view of daily orders across all stores, allow florists to assign tasks to themselves, and enable administrators to oversee operations. Additionally, it will feature an analytics component to track and display florist performance, fostering transparency and productivity.

## 2. Objectives/Goals

*   To replace the manual Google Sheets workflow with a dedicated, streamlined web application.
*   To provide a unified view of orders from multiple Shopify stores in a single dashboard.
*   To provide a clear, prioritized, and real-time list of daily orders for florists across all stores.
*   To enable florists to self-manage their workload by assigning available orders to themselves from any store.
*   To grant administrators the ability to oversee, manage, and modify all orders and assignments across all stores.
*   To introduce a system for categorizing products with priority labels to better organize the workflow across stores.
*   To implement an analytics dashboard to track and display key performance indicators (KPIs) for all florists, with the ability to filter by store.
*   To create a transparent work environment where performance data is visible to all team members.

## 3. Features

### 3.1. User Roles and Authentication

**Description:** The application will support two distinct user roles: Admin and Florist. Access to features will be determined by the user's role.

**Application Flows:**

*   **User Login:**
    1.  A user navigates to the application's login page.
    2.  The user enters their credentials (e.g., username and password).
    3.  The system authenticates the user and identifies their role (Admin or Florist).
    4.  Upon successful login, the user is redirected to the main Order Dashboard.

### 3.2. Multi-Store Management

**Description:** The application will support multiple Shopify stores, allowing users to view and manage orders from different stores in a unified interface.

**Application Flows:**

*   **Store Selection and Filtering:**
    1.  Users can view orders from all stores combined or filter by specific stores.
    2.  A store selector allows users to choose "All Stores" or individual stores.
    3.  Orders are clearly labeled with their originating store.
    4.  Analytics and product management can be filtered by store.

### 3.3. Daily Order Dashboard

**Description:** The central feature of the application is the daily order dashboard, which displays a list of all active orders for a selected date across all connected Shopify stores.

**Application Flows:**

*   **Viewing Daily Orders:**
    1.  Upon logging in, the user is presented with the order list for the current day by default, showing orders from all stores.
    2.  The user can select a different date using a date picker to view orders for past or future dates.
    3.  The user can filter orders by specific stores using a store selector.
    4.  The dashboard displays two lists: "To-Do" and "Completed".
    5.  Each order in the "To-Do" list is displayed as a row containing the following information: Store Name, Product Name/Variant, Timeslot, Order ID, and Remarks.
    6.  The "To-Do" list is sorted primarily by the delivery timeslot in ascending order (earliest first).
    7.  Within each timeslot, the orders are secondarily sorted by the custom product priority label.

### 3.4. Order Management

**Description:** This feature covers how users interact with orders, including assignment, modification, and completion across multiple stores.

**Application Flows:**

*   **Florist Self-Assigns an Order:**
    1.  A logged-in Florist views the "To-Do" list across all stores.
    2.  For any unassigned order from any store, an "Assign to Me" button is visible.
    3.  The Florist clicks the "Assign to Me" button.
    4.  The system assigns the order to that Florist. The button is replaced with the Florist's name.
    5.  The system records the timestamp of the assignment to begin tracking completion time.
    6.  No other florist can assign themselves to this order unless it is unassigned by an Admin.

*   **Admin Assigns an Order:**
    1.  A logged-in Admin views the "To-Do" list across all stores.
    2.  For any order (unassigned or already assigned), a dropdown menu of all available florists is displayed.
    3.  The Admin selects a florist from the dropdown menu to assign or re-assign the order.
    4.  The system updates the order's assignment. If it's a new assignment, the completion timer starts. If it's a reassignment, the timer resets.

*   **Admin Modifies an Order:**
    1.  A logged-in Admin views an order on the dashboard.
    2.  The Admin can click on the "Remarks" field of an order to edit its content.
    3.  The Admin saves the changes, and the updated remarks are reflected on the dashboard for all users.

*   **Marking an Order as Completed:**
    1.  A Florist who is assigned to an order sees a "Mark as Completed" button or checkbox for that order.
    2.  Once the arrangement is finished, the Florist clicks the "Mark as Completed" button.
    3.  The system records the completion timestamp.
    4.  The order is removed from the "To-Do" list and moved to the "Completed" list for that day.
    5.  The total time taken (from assignment to completion) is calculated and stored for analytics purposes.

### 3.5. Product Label Management (Admin Only)

**Description:** Admins can create and assign custom priority labels to products to influence the sorting order on the dashboard. This can be managed per store or globally.

**Application Flows:**

*   **Managing Product Labels:**
    1.  A logged-in Admin navigates to a "Product Management" page.
    2.  The Admin can filter products by store or view all products across stores.
    3.  The system displays a list of all products fetched from the selected Shopify stores.
    4.  For each product, the Admin can assign or change a text-based priority label (e.g., "High Priority", "Standard", "Quick").
    5.  The Admin saves the labels. This labeling system will be used to sort orders on the main dashboard.

### 3.6. Analytics Dashboard

**Description:** A dashboard visible to all users that displays key performance metrics for all florists, with the ability to filter by store.

**Application Flows:**

*   **Viewing Analytics:**
    1.  Any logged-in user (Admin or Florist) navigates to the "Analytics" page.
    2.  The dashboard displays a summary of performance data across all stores by default.
    3.  Users can filter analytics by specific stores using a store selector.
    4.  The data includes a list of all florists and their corresponding metrics: total number of completed orders and the average time taken to complete an order.
    5.  By default, the view shows data for a predefined period (e.g., "This Week").
    6.  The user can use a filter to change the time frame for the analytics (e.g., "Today", "This Week", "This Month"). The displayed data updates accordingly.

## 4. Technical Requirements

### 4.1. System Architecture

*   The application will be a Single Page Application (SPA) built using React.
*   For the initial prototype, application state and data (orders, assignments, etc.) will be persisted in the browser's Local Storage.
*   The application will be designed for deployment on Cloudflare Workers.

### 4.2. Functional Technical Requirements

*   **Multi-Store Shopify Integration:** The application must be able to connect to multiple Shopify store APIs to pull order and product information.
*   **Store Management:** The system must handle multiple store configurations and maintain separate product catalogs per store.
*   **User Roles:** The system must enforce the distinct permissions for Admin and Florist roles across all stores.

### 4.3. Backend API Endpoints

The following backend API endpoints are required to support the application's functionality.

*   **Authentication**
    *   `POST /api/auth/login`: Authenticates a user and returns a token with their role.
*   **Stores**
    *   `GET /api/stores`: Fetches a list of all connected Shopify stores.
*   **Orders**
    *   `GET /api/orders?date={YYYY-MM-DD}&store={storeId}`: Fetches all orders for a specified date from specific or all Shopify stores.
    *   `PATCH /api/orders/{orderId}`: Updates order details, specifically the remarks field. (Admin only).
    *   `PATCH /api/orders/{orderId}/assign`: Assigns a florist to an order. Body includes `{ "floristId": "..." }`.
    *   `PATCH /api/orders/{orderId}/complete`: Marks an order as completed.
*   **Products**
    *   `GET /api/products?store={storeId}`: Fetches all products from specific or all Shopify stores.
    *   `POST /api/products/labels`: Creates or updates the custom priority labels for products.
*   **Users**
    *   `GET /api/users`: Fetches a list of all florists in the system.
*   **Analytics**
    *   `GET /api/analytics?timeframe={daily|weekly|monthly}&store={storeId}`: Fetches aggregated performance data for the specified time frame and store.

## 5. Design Style

### 5.1. Design Philosophy

The design will be clean, modern, and highly functional. The primary goal is to create an intuitive user interface that minimizes cognitive load and allows users to perform their tasks efficiently across multiple stores. The focus is on clarity, readability, and ease of navigation.

### 5.2. Theme

A light theme will be used to ensure high contrast and readability, which is crucial for a data-heavy dashboard environment. The layout will be structured and organized, using cards or table rows to represent individual orders clearly, with clear store identification.

### 5.3. Color Palette

*   **Primary:** A soft, professional green (e.g., `#4A934A`) to evoke the nature of the business without being distracting.
*   **Secondary/Accent:** A complementary color like a warm beige or light gold for interactive elements like buttons and links.
*   **Store Colors:** Each store will have a distinct color identifier for easy visual recognition.
*   **Neutral:** A palette of grays (e.g., `#F5F5F5` for backgrounds, `#666666` for secondary text, `#1A1A1A` for primary text) will be used for the main interface components.
*   **Status Colors:**
    *   **Green (`#28a745`):** For "Completed" status indicators.
    *   **Blue (`#007bff`):** For informational highlights or selected items.

### 5.4. Typography

*   **Font Family:** A clean, legible sans-serif font such as **Inter** or **Lato** will be used throughout the application for its excellent readability on screens.
*   **Hierarchy:** A clear typographic hierarchy will be established using different font sizes and weights (e.g., Bold for headers, Regular for body text) to guide the user's attention and make information easy to scan.

## 6. Assumptions / Constraints

*   It is assumed that secure access to multiple Shopify store APIs (with necessary permissions for reading orders and products) will be provided.
*   The system will have a pre-existing list of users (Admins and Florists). This document does not cover the requirements for user registration or management flows.
*   The initial implementation will be a UI-only prototype. Persistence will be handled by the browser's local storage, and there will be no live backend or database connectivity.
*   The "time taken" for an order is strictly defined as the duration between a florist assigning the order to themselves (or being assigned by an admin) and them marking it as complete.
*   All connected stores will share the same florist team and user base.