# Order Processing Workflow & Implementation Plan

This document outlines the plan to implement the advanced order processing logic for the Florist Dashboard. The goal is to fetch Shopify orders for a specific date, intelligently parse their line items into actionable "To-Do" cards and associated "Add-On" items, and display them on the dashboard.

## 1. User Flow Summary

1.  **Date Selection**: A user selects a target delivery date on the dashboard.
2.  **API Request**: The frontend calls a new backend endpoint on our Cloudflare Worker, passing the selected date.
3.  **Data Fetching**: The worker fetches:
    - All recent, open orders from the Shopify API.
    - The complete list of "Product Labels" (identifying add-ons) from the D1 database.
4.  **Core Logic (Worker)**: The worker processes the data:
    - It filters Shopify orders by matching the selected date against a `dd/mm/yyyy` tag on the order.
    - For each matching order, it iterates through the line items.
    - Using the Product Labels from D1, it classifies each line item as either a primary product or an "add-on".
    - It constructs a new data structure representing the "To-Do" cards. Each primary item (respecting its quantity) becomes a main card. Add-on items are nested within the card of their corresponding primary item.
5.  **API Response**: The worker sends the structured list of "To-Do" cards back to the frontend.
6.  **Render Dashboard**: The `OrdersView` component renders the received data, displaying an `OrderCard` for each primary to-do item, complete with its associated add-on information.

## 2. Implementation Plan

### Phase 1: Backend (Cloudflare Worker & API)

**Location**: `worker/src/index.ts` (or a new route handler file)

1.  **Create New API Endpoint**:
    - Define a new Hono route, e.g., `app.get('/api/orders-by-date', ...)`.
    - This endpoint will accept a `date` query parameter (e.g., `?date=22-06-2025`).

2.  **Fetch Product Labels from D1**:
    - Create a new database service function in `src/services/database-d1.ts` to query the `product_labels` table.
    - The function should fetch all saved products and their associated labels (especially "Add-On").
    - The worker will call this function first to have the labels ready for processing.

3.  **Fetch Orders from Shopify**:
    - Utilize the existing Shopify API service in `src/services/shopify/shopifyApi.ts`.
    - Fetch open orders. We may need to fetch a broad range of recent orders and filter them in our worker, as filtering by tag directly in the Shopify API query can be restrictive.

4.  **Implement Core Processing Logic**:
    - **Date Filtering**: In the worker, iterate through the fetched Shopify orders. For each order, check its `tags` array for a string matching the `dd/mm/yyyy` format of the request.
    - **Line Item Classification**:
        - For each line item in a date-matched order, use its `product_id` and `variant_id` to look up its label in the data fetched from D1.
        - Create two temporary arrays for the order: `primaryItems` and `addOnItems`.
    - **Card Generation**:
        - Iterate through the `primaryItems` array. For each item, create a new "To-Do Card" object.
        - If an item's quantity is greater than 1, create that many identical card objects.
        - Populate each card object with the `addOnItems` titles.
        - The final output of the worker should be a flat array of these "To-Do Card" objects.

### Phase 2: Frontend (React Components)

**Location**: `src/components/OrdersView.tsx`

1.  **Update State Management**:
    - Introduce state to hold the selected date from the date picker. The default should be the current date.

2.  **Trigger API Call**:
    - Use a `useEffect` hook that triggers whenever the selected date changes.
    - Inside the effect, call the new `/api/orders-by-date` endpoint using the `api` service client.
    - Update the component's state with the fetched array of "To-Do Card" objects.

3.  **Render Order Cards**:
    - Modify the render logic to map over the new state array.
    - Pass the data for each "To-Do Card" object as a prop to the `OrderCard` component.
    - Ensure a loading state is shown while the data is being fetched.
    - Ensure an empty state is shown if no orders are found for the selected criteria.

**Location**: `src/components/OrderCard.tsx`

1.  **Display Add-On Information**:
    - The `OrderCard` component already accepts a configuration. We will need to ensure it can display a field for "Add-Ons".
    - If the "Add-Ons" field is part of the card's data, render the list of add-on titles. This may involve adding a new "add-ons" field type to the `OrderCardField` configuration in `src/types/orderCardFields.ts` and updating the `OrderCard` to render it appropriately.

## 3. Feasibility Assessment

-   **Overall Feasibility**: **High**. The proposed plan is logical and leverages the existing architecture (React frontend, Cloudflare Worker backend, D1 database). There are no major technical blockers.

-   **Potential Challenges & Mitigations**:
    1.  **Shopify API Rate Limits**:
        - **Challenge**: Fetching a large number of orders at once could hit Shopify's API rate limits.
        - **Mitigation**: Fetch only the necessary order fields (`id`, `line_items`, `tags`). Implement caching on the worker for Shopify responses where appropriate (e.g., cache for 1-2 minutes) to reduce redundant calls.
    2.  **Data Consistency**:
        - **Challenge**: The product labels in our D1 database could become out-of-sync with the products in Shopify.
        - **Mitigation**: The current "Saved Products" component is the source of truth. The risk is low as long as this component is maintained. For the future, a webhook or periodic sync from Shopify could be considered to keep the local product list fresh.
    3.  **Performance**:
        - **Challenge**: The processing logic in the worker (iterating orders, then line items) could be slow if the number of daily orders is very high (e.g., 1000+).
        - **Mitigation**: The logic is O(N*M) where N is orders and M is line items. For a typical florist, this should be very fast. We will benchmark the worker's response time during development. If performance becomes an issue, we can explore optimizing the data lookups.
    4.  **Date/Timezone Issues**:
        - **Challenge**: Incorrectly handling timezones between the user's browser, the worker, and Shopify can lead to orders being missed or shown on the wrong day.
        - **Mitigation**: Standardize on UTC for all date comparisons in the backend. Ensure the frontend correctly converts the user's selected local date to a standardized format for the API call.

This plan provides a clear path forward. The work can be done incrementally, starting with the backend endpoint and logic, followed by the frontend integration. 