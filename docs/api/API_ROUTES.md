# API Routes Documentation

This document outlines all the available API routes in the multi-tenant florist order management system.

## Base URL
- **Production**: `https://order-to-do.stanleytan92.workers.dev`
- **Development**: `http://localhost:8787`

## Authentication

### Login
- **POST** `/api/auth/login`
- **Description**: Authenticate a user with email, password, and tenant domain
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "tenantDomain": "florist.myshopify.com"
  }
  ```
- **Response**: Returns user data, tenant info, and JWT access token

### Registration
- **POST** `/api/auth/register`
- **Description**: Register a new user and create tenant if needed
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "tenantDomain": "florist.myshopify.com",
    "tenantName": "My Florist Shop"
  }
  ```

### Logout
- **POST** `/api/auth/logout`
- **Description**: Logout the current user
- **Headers**: `Authorization: Bearer <token>`

### Refresh Token
- **POST** `/api/auth/refresh`
- **Description**: Refresh the JWT access token
- **Headers**: `Authorization: Bearer <token>`

## Tenant Management

### List Tenants
- **GET** `/api/tenants`
- **Description**: Get all tenants (public route)

### Create Tenant
- **POST** `/api/tenants`
- **Description**: Create a new tenant
- **Request Body**:
  ```json
  {
    "name": "My Florist Shop",
    "domain": "florist.myshopify.com",
    "subscriptionPlan": "starter"
  }
  ```

### Get Tenant by ID
- **GET** `/api/tenants/:tenantId`
- **Description**: Get a specific tenant by ID

## User Management

### Get Users
- **GET** `/api/tenants/:tenantId/users`
- **Description**: Get all users for a tenant
- **Headers**: `Authorization: Bearer <token>`

### Create User
- **POST** `/api/tenants/:tenantId/users`
- **Description**: Create a new user for a tenant
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "email": "florist@example.com",
    "name": "Jane Florist",
    "password": "password123",
    "role": "florist",
    "permissions": ["read_orders", "update_orders"]
  }
  ```

### Get User by ID
- **GET** `/api/tenants/:tenantId/users/:userId`
- **Description**: Get a specific user by ID
- **Headers**: `Authorization: Bearer <token>`

### Update User
- **PUT** `/api/tenants/:tenantId/users/:userId`
- **Description**: Update a user
- **Headers**: `Authorization: Bearer <token>`

### Delete User
- **DELETE** `/api/tenants/:tenantId/users/:userId`
- **Description**: Delete a user
- **Headers**: `Authorization: Bearer <token>`

## Order Management

### Get Orders
- **GET** `/api/tenants/:tenantId/orders`
- **Description**: Get all orders for a tenant
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `status`: Filter by order status (pending, assigned, completed)
  - `assignedTo`: Filter by assigned user ID
  - `deliveryDate`: Filter by delivery date
  - `storeId`: Filter by store ID

### Create Order
- **POST** `/api/tenants/:tenantId/orders`
- **Description**: Create a new order
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "customerName": "John Smith",
    "deliveryDate": "2025-06-22",
    "status": "pending",
    "priority": 1,
    "assignedTo": "user-id",
    "notes": "Special instructions",
    "shopifyOrderId": "shopify-order-123"
  }
  ```

### Get Order by ID
- **GET** `/api/tenants/:tenantId/orders/:orderId`
- **Description**: Get a specific order by ID
- **Headers**: `Authorization: Bearer <token>`

### Update Order
- **PUT** `/api/tenants/:tenantId/orders/:orderId`
- **Description**: Update an order
- **Headers**: `Authorization: Bearer <token>`

### Delete Order
- **DELETE** `/api/tenants/:tenantId/orders/:orderId`
- **Description**: Delete an order
- **Headers**: `Authorization: Bearer <token>`

## Product Management

### Get Products
- **GET** `/api/tenants/:tenantId/products`
- **Description**: Get all products for a tenant
- **Headers**: `Authorization: Bearer <token>`

### Create Product
- **POST** `/api/tenants/:tenantId/products`
- **Description**: Create a new product
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Rose Bouquet",
    "description": "Beautiful red roses",
    "price": 29.99,
    "stockQuantity": 50,
    "shopifyProductId": "shopify-product-123"
  }
  ```

### Get Product by ID
- **GET** `/api/tenants/:tenantId/products/:productId`
- **Description**: Get a specific product by ID
- **Headers**: `Authorization: Bearer <token>`

### Update Product
- **PUT** `/api/tenants/:tenantId/products/:productId`
- **Description**: Update a product
- **Headers**: `Authorization: Bearer <token>`

### Delete Product
- **DELETE** `/api/tenants/:tenantId/products/:productId`
- **Description**: Delete a product
- **Headers**: `Authorization: Bearer <token>`

## Product Labels Management

### Get Product Labels
- **GET** `/api/tenants/:tenantId/product-labels`
- **Description**: Get all product labels for a tenant
- **Headers**: `Authorization: Bearer <token>`

### Create Product Label
- **POST** `/api/tenants/:tenantId/product-labels`
- **Description**: Create a new product label
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "name": "Very Hard",
    "color": "#ff0000",
    "category": "difficulty",
    "priority": 1
  }
  ```

### Get Product Label by ID
- **GET** `/api/tenants/:tenantId/product-labels/:labelId`
- **Description**: Get a specific product label by ID
- **Headers**: `Authorization: Bearer <token>`

### Update Product Label
- **PUT** `/api/tenants/:tenantId/product-labels/:labelId`
- **Description**: Update a product label
- **Headers**: `Authorization: Bearer <token>`

### Delete Product Label
- **DELETE** `/api/tenants/:tenantId/product-labels/:labelId`
- **Description**: Delete a product label
- **Headers**: `Authorization: Bearer <token>`

## Store Management

### Get Stores
- **GET** `/api/tenants/:tenantId/stores`
- **Description**: Get all stores for a tenant
- **Headers**: `Authorization: Bearer <token>`

### Create Store
- **POST** `/api/tenants/:tenantId/stores`
- **Description**: Create a new store
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "shopifyDomain": "florist.myshopify.com",
    "accessToken": "shpat_...",
    "webhookSecret": "webhook-secret",
    "syncEnabled": true
  }
  ```

### Get Store by ID
- **GET** `/api/tenants/:tenantId/stores/:storeId`
- **Description**: Get a specific store by ID
- **Headers**: `Authorization: Bearer <token>`

### Update Store
- **PUT** `/api/tenants/:tenantId/stores/:storeId`
- **Description**: Update a store
- **Headers**: `Authorization: Bearer <token>`

### Delete Store
- **DELETE** `/api/tenants/:tenantId/stores/:storeId`
- **Description**: Delete a store
- **Headers**: `Authorization: Bearer <token>`

## Analytics

### Get Analytics
- **GET** `/api/tenants/:tenantId/analytics`
- **Description**: Get analytics data for a tenant
- **Headers**: `Authorization: Bearer <token>`
- **Query Parameters**:
  - `timeFrame`: Time frame for analytics (daily, weekly, monthly)

### Get Florist Stats
- **GET** `/api/tenants/:tenantId/analytics/florist-stats`
- **Description**: Get florist performance statistics
- **Headers**: `Authorization: Bearer <token>`

## System Routes

### Health Check
- **GET** `/api/health`
- **Description**: Check if the API is healthy
- **Response**: `{ "status": "healthy" }`

### Database Test
- **GET** `/api/test-d1`
- **Description**: Test D1 database connection
- **Response**: `{ "message": "D1 connection successful", "tenantCount": 5 }`

### Database Initialization
- **POST** `/api/init-db`
- **Description**: Initialize database tables (development only)

### Temporary Test User Creation
- **POST** `/api/temp/create-user`
- **Description**: Create a test user (development only)

## Shopify Integration

### Shopify Webhook
- **POST** `/api/webhooks/shopify`
- **Description**: Handle Shopify webhook events
- **Headers**: `X-Shopify-Topic`, `X-Shopify-Hmac-Sha256`

## Frontend Routes (SPA)

The following routes serve the React SPA:

- **GET** `/` - Dashboard
- **GET** `/login` - Login page
- **GET** `/orders` - Orders management
- **GET** `/products` - Product management
- **GET** `/analytics` - Analytics dashboard
- **GET** `/settings` - Settings page

## Authentication

All protected routes require a valid JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

The JWT token contains:
- `sub`: User ID
- `tenantId`: Tenant ID
- `role`: User role
- `exp`: Expiration timestamp

## Error Responses

All API endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

CORS is enabled for all `/api/*` routes to allow cross-origin requests from the frontend application. 