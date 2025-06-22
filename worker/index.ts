import { Hono } from "hono"
import { cors } from "hono/cors"
import { jwt, sign } from "hono/jwt"
import bcrypt from "bcryptjs"
import { d1DatabaseService } from "../src/services/database-d1"
import type { D1Database, ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types"
import { etag } from "hono/etag"
import { WebhookConfig } from "../src/types"
// @ts-ignore
// import manifest from '__STATIC_CONTENT_MANIFEST';

// This is the static content imported from the built client
// @ts-ignore
// import spa from '../dist/client/index.html';

// Define the environment bindings
type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  ASSETS: any
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS middleware
app.use("/api/*", cors())

// JWT middleware for protected routes
app.use("/api/tenants/:tenantId/*", async (c, next) => {
  try {
    const auth = jwt({ secret: c.env.JWT_SECRET })
    const result = await auth(c, next)

    // Get the tenant ID from the URL
    const urlTenantId = c.req.param("tenantId")

    // Get the tenant ID from the JWT payload
    const token = c.req.header("Authorization")?.replace("Bearer ", "")
    if (!token) {
      return c.json({ error: "No token provided" }, 401)
    }

    // Parse the JWT token to get the payload
    const payload = JSON.parse(atob(token.split(".")[1]))
    const tokenTenantId = payload.tenantId

    // Validate that the tenant ID in the URL matches the tenant ID in the token
    if (urlTenantId !== tokenTenantId) {
      return c.json({ error: "Tenant ID mismatch" }, 403)
    }

    return result
  } catch (error) {
    console.error("JWT middleware error:", error)
    return c.json({ error: "Invalid token" }, 401)
  }
})

// Add ETag middleware for caching
app.use("*", etag())

// --- Authentication routes ---
app.post("/api/auth/login", async (c) => {
  const { email, password, tenantDomain } = await c.req.json()

  if (!email || !password || !tenantDomain) {
    return c.json({ error: "Email, password, and tenant domain are required" }, 400)
  }

  try {
    console.log(`Login attempt for email: ${email}, tenant: ${tenantDomain}`)

    const user = await d1DatabaseService.getUserByEmailAndTenant(c.env, email, tenantDomain)

    if (!user) {
      console.log(`User not found for email: ${email}, tenant: ${tenantDomain}`)
      return c.json({ error: "Invalid credentials or tenant" }, 401)
    }

    if (!user.hashedPassword) {
      console.log(`User found but no password hash for email: ${email}`)
      return c.json({ error: "Invalid credentials or tenant" }, 401)
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword)
    if (!isPasswordValid) {
      console.log(`Invalid password for email: ${email}`)
      return c.json({ error: "Invalid credentials or tenant" }, 401)
    }

    console.log(`Login successful for email: ${email}, tenant: ${tenantDomain}`)

    // Get tenant information
    const tenant = await d1DatabaseService.getTenant(c.env, user.tenantId)

    // Passwords match, generate JWT
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    }
    const token = await sign(payload, c.env.JWT_SECRET)

    const { hashedPassword, ...userWithoutPassword } = user

    return c.json({
      success: true,
      user: userWithoutPassword,
      tenant,
      accessToken: token,
    })
  } catch (error) {
    console.error("Login error:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
})

// --- Registration route ---
app.post("/api/auth/register", async (c) => {
  const { email, password, name, tenantDomain, tenantName } = await c.req.json()

  if (!email || !password || !name || !tenantDomain) {
    return c.json({ error: "Email, password, name, and tenant domain are required" }, 400)
  }

  try {
    // Check if tenant exists, create if it doesn't
    let tenants = await d1DatabaseService.listTenants(c.env, { domain: tenantDomain })
    let tenant = tenants[0]

    if (!tenant) {
      // Create new tenant
      tenant = await d1DatabaseService.createTenant(c.env, {
        name: tenantName || `${tenantDomain} Florist`,
        domain: tenantDomain,
        subscriptionPlan: "starter",
      })
    }

    // Check if user already exists
    const existingUser = await d1DatabaseService.getUserByEmailAndTenant(c.env, email, tenantDomain)
    if (existingUser) {
      return c.json({ error: "User already exists with this email" }, 409)
    }

    // Create new user
    const newUser = await d1DatabaseService.createUser(c.env, tenant.id, {
      email,
      name,
      password,
      role: "admin", // First user is admin
    })

    // Generate JWT token
    const payload = {
      sub: newUser.id,
      tenantId: newUser.tenantId,
      role: newUser.role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24 hours
    }
    const token = await sign(payload, c.env.JWT_SECRET)

    return c.json(
      {
        success: true,
        user: newUser,
        tenant,
        accessToken: token,
        message: "Registration successful",
      },
      201
    )
  } catch (error) {
    console.error("Registration error:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
})

// --- Orders ---
app.get("/api/tenants/:tenantId/orders", async (c) => {
  const tenantId = c.req.param("tenantId")
  // TODO: Add filtering from query params
  const orders = await d1DatabaseService.getOrders(c.env, tenantId)
  return c.json(orders)
})
app.post("/api/tenants/:tenantId/orders", async (c) => {
  const tenantId = c.req.param("tenantId")
  const orderData = await c.req.json()
  const newOrder = await d1DatabaseService.createOrder(c.env, tenantId, orderData)
  return c.json(newOrder, 201)
})
app.get("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const { tenantId, orderId } = c.req.param()
  const order = await d1DatabaseService.getOrder(c.env, tenantId, orderId)
  return order ? c.json(order) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const { tenantId, orderId } = c.req.param()
  const updateData = await c.req.json()
  const updatedOrder = await d1DatabaseService.updateOrder(c.env, tenantId, orderId, updateData)
  return updatedOrder ? c.json(updatedOrder) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const { tenantId, orderId } = c.req.param()
  const success = await d1DatabaseService.deleteOrder(c.env, tenantId, orderId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Products ---
app.get("/api/tenants/:tenantId/products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const products = await d1DatabaseService.getProducts(c.env, tenantId)
  return c.json(products)
})
app.post("/api/tenants/:tenantId/products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productData = await c.req.json()
  const newProduct = await d1DatabaseService.createProduct(c.env, tenantId, productData)
  return c.json(newProduct, 201)
})
app.get("/api/tenants/:tenantId/products/:productId", async (c) => {
  const { tenantId, productId } = c.req.param()
  const product = await d1DatabaseService.getProduct(c.env, tenantId, productId)
  return product ? c.json(product) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/products/:productId", async (c) => {
  const { tenantId, productId } = c.req.param()
  const updateData = await c.req.json()
  const updatedProduct = await d1DatabaseService.updateProduct(
    c.env,
    tenantId,
    productId,
    updateData
  )
  return updatedProduct ? c.json(updatedProduct) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/products/:productId", async (c) => {
  const { tenantId, productId } = c.req.param()
  const success = await d1DatabaseService.deleteProduct(c.env, tenantId, productId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Saved Products ---
app.post("/api/tenants/:tenantId/saved-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { products } = await c.req.json()
  const savedProducts = await d1DatabaseService.saveProducts(c.env, tenantId, products)
  return c.json(savedProducts, 201)
})

app.get("/api/tenants/:tenantId/saved-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const search = c.req.query("search")
  const productType = c.req.query("productType")
  const vendor = c.req.query("vendor")
  const hasLabels = c.req.query("hasLabels")

  const filters: any = {}
  if (search) filters.search = search
  if (productType) filters.productType = productType
  if (vendor) filters.vendor = vendor
  if (hasLabels) filters.hasLabels = hasLabels === "true"

  const savedProducts = await d1DatabaseService.getSavedProducts(c.env, tenantId, filters)
  return c.json(savedProducts)
})

app.get("/api/tenants/:tenantId/saved-products/:productId", async (c) => {
  const { tenantId, productId } = c.req.param()
  const savedProduct = await d1DatabaseService.getSavedProduct(c.env, tenantId, productId)
  return savedProduct ? c.json(savedProduct) : c.json({ error: "Not Found" }, 404)
})

app.delete("/api/tenants/:tenantId/saved-products/:productId", async (c) => {
  const { tenantId, productId } = c.req.param()
  const success = await d1DatabaseService.deleteSavedProduct(c.env, tenantId, productId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

app.post("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const { tenantId, productId, labelId } = c.req.param()
  const success = await d1DatabaseService.addProductLabel(c.env, tenantId, productId, labelId)
  return c.json({ success })
})

app.delete("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const { tenantId, productId, labelId } = c.req.param()
  const success = await d1DatabaseService.removeProductLabel(c.env, tenantId, productId, labelId)
  return c.json({ success })
})

app.get("/api/tenants/:tenantId/saved-products/by-shopify-ids", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.query("productId")
  const variantId = c.req.query("variantId")

  if (!productId || !variantId) {
    return c.json({ error: "Product ID and variant ID are required" }, 400)
  }

  const savedProduct = await d1DatabaseService.getProductByShopifyIds(
    c.env,
    tenantId,
    productId,
    variantId
  )
  return savedProduct ? c.json(savedProduct) : c.json({ error: "Not Found" }, 404)
})

// --- Product Sync ---
app.post("/api/tenants/:tenantId/stores/:storeId/sync-products", async (c) => {
  const { tenantId, storeId } = c.req.param()
  const { title, tag, page = 1, limit = 250, sinceId, pageInfo } = await c.req.json()

  try {
    // Get the store details
    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    if (!store) {
      return c.json({ error: "Store not found" }, 404)
    }

    // Check if store has required credentials
    if (!store.settings?.domain || !store.settings?.accessToken) {
      return c.json({ error: "Store domain or access token not configured" }, 400)
    }

    console.log("Store configuration:", {
      domain: store.settings.domain,
      hasAccessToken: !!store.settings.accessToken,
      accessTokenLength: store.settings.accessToken?.length,
    })

    // Create Shopify API service
    const { createShopifyApiService } = await import("../src/services/shopify/shopifyApi")
    const shopifyService = createShopifyApiService(store, store.settings.accessToken)

    // Fetch products from Shopify with cursor-based pagination
    console.log(
      `Fetching products from Shopify store: ${store.settings.domain}, page ${page}, limit ${limit}, sinceId: ${sinceId || "none"}, pageInfo: ${pageInfo || "none"}`
    )
    const result = await shopifyService.fetchProducts(page, limit, sinceId, pageInfo)

    // Apply filters if provided
    let filteredProducts = result.products
    if (title) {
      filteredProducts = filteredProducts.filter((product) =>
        product.title?.toLowerCase().includes(title.toLowerCase())
      )
    }
    if (tag) {
      filteredProducts = filteredProducts.filter((product) =>
        product.tags?.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
      )
    }

    console.log(`Fetched ${filteredProducts.length} products from Shopify (page ${page})`)

    return c.json({
      success: true,
      products: filteredProducts,
      pagination: result.pagination,
      filters: { title, tag },
    })
  } catch (error) {
    console.error("Error syncing products from Shopify:", error)
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      error: error,
    })
    return c.json(
      {
        error: "Failed to fetch products from Shopify",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500
    )
  }
})

// --- Product Labels ---
app.get("/api/tenants/:tenantId/product-labels", async (c) => {
  const tenantId = c.req.param("tenantId")
  const labels = await d1DatabaseService.getProductLabels(c.env, tenantId)
  return c.json(labels)
})
app.post("/api/tenants/:tenantId/product-labels", async (c) => {
  const tenantId = c.req.param("tenantId")
  const labelData = await c.req.json()
  const newLabel = await d1DatabaseService.createProductLabel(c.env, tenantId, labelData)
  return c.json(newLabel, 201)
})
app.get("/api/tenants/:tenantId/product-labels/:labelId", async (c) => {
  const { tenantId, labelId } = c.req.param()
  const label = await d1DatabaseService.getProductLabelById(c.env, tenantId, labelId)
  return label ? c.json(label) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/product-labels/:labelId", async (c) => {
  const { tenantId, labelId } = c.req.param()
  const updateData = await c.req.json()
  const updatedLabel = await d1DatabaseService.updateProductLabel(
    c.env,
    tenantId,
    labelId,
    updateData
  )
  return updatedLabel ? c.json(updatedLabel) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/product-labels/:labelId", async (c) => {
  const { tenantId, labelId } = c.req.param()
  const success = await d1DatabaseService.deleteProductLabel(c.env, tenantId, labelId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Stores ---
app.get("/api/tenants/:tenantId/stores", async (c) => {
  const tenantId = c.req.param("tenantId")
  const stores = await d1DatabaseService.getStores(c.env, tenantId)
  return c.json(stores)
})
app.post("/api/tenants/:tenantId/stores", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeData = await c.req.json()

  // Transform the store data to match the database service expectations
  const transformedData = {
    shopifyDomain: storeData.settings?.domain || storeData.settings?.address,
    accessToken: storeData.settings?.accessToken,
    webhookSecret: storeData.settings?.apiSecretKey,
    syncEnabled: true,
  }

  const newStore = await d1DatabaseService.createStore(c.env, tenantId, transformedData)
  return c.json(newStore, 201)
})
app.get("/api/tenants/:tenantId/stores/:storeId", async (c) => {
  const { tenantId, storeId } = c.req.param()
  const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
  return store ? c.json(store) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/stores/:storeId", async (c) => {
  const { tenantId, storeId } = c.req.param()
  const updateData = await c.req.json()
  const updatedStore = await d1DatabaseService.updateStore(c.env, tenantId, storeId, updateData)
  return updatedStore ? c.json(updatedStore) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/stores/:storeId", async (c) => {
  const { tenantId, storeId } = c.req.param()
  const success = await d1DatabaseService.deleteStore(c.env, tenantId, storeId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

app.get("/api/tenants/:tenantId/stores/:storeId/orders/lookup", async (c) => {
  const { tenantId, storeId } = c.req.param()
  const orderName = c.req.query("name")

  if (!orderName) {
    return c.json({ error: "Order name query parameter is required" }, 400)
  }

  try {
    const shopifyOrder = await d1DatabaseService.fetchShopifyOrder(
      c.env,
      tenantId,
      storeId,
      orderName
    )
    if (shopifyOrder) {
      const lineItem = shopifyOrder.lineItems?.edges?.[0]?.node
      if (lineItem) {
        const productId = lineItem.product?.id
        const variantId = lineItem.variant?.id
        
        if (productId && variantId) {
          // Shopify GraphQL IDs are GIDs, e.g., "gid://shopify/Product/123456789"
          // We extract the numeric IDs to look up in our local database.
          const numericProductId = productId.split("/").pop()
          const numericVariantId = variantId.split("/").pop()
          
          if (numericProductId && numericVariantId) {
            const localProduct = await d1DatabaseService.getProductByShopifyIds(
              c.env,
              tenantId,
              numericProductId,
              numericVariantId
            )
            if (localProduct) {
              // Attach local product data to the response, making it available for mapping
              shopifyOrder.localProduct = localProduct
            }
          }
        }
      }
      return c.json(shopifyOrder)
    } else {
      return c.json({ error: "Order not found" }, 404)
    }
  } catch (error) {
    console.error("Error fetching Shopify order:", error)
    return c.json({ error: "Failed to fetch Shopify order" }, 500)
  }
})

app.post("/api/tenants/:tenantId/stores/:storeId/register-webhooks", async (c) => {
  const { tenantId, storeId } = c.req.param()
  try {
    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    if (!store) {
      return c.json({ error: "Store not found" }, 404)
    }

    const domain = store.settings.domain
    const accessToken = store.settings.accessToken

    if (!domain || !accessToken) {
      return c.json({ error: "Store domain or access token not configured." }, 400)
    }

    const webhookTopics = ["orders/create", "orders/updated", "products/update"]
    const webhookUrl = `https://${new URL(c.req.url).hostname}/api/webhooks/shopify`

    const registeredWebhooks: WebhookConfig[] = []

    for (const topic of webhookTopics) {
      const response = await fetch(`https://${domain}/admin/api/2023-10/webhooks.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: "json",
          },
        }),
      })
      const data = await response.json()
      if (response.ok) {
        registeredWebhooks.push({
          id: data.webhook.id,
          topic: data.webhook.topic,
          address: data.webhook.address,
          status: "active",
        })
      } else {
        console.error(`Failed to register webhook for ${topic}:`, data)
      }
    }

    const updatedSettings = { ...store.settings, webhooks: registeredWebhooks }
    await d1DatabaseService.updateStore(c.env, tenantId, storeId, { settings: updatedSettings })

    const updatedStore = { ...store, settings: updatedSettings }
    return c.json(updatedStore)
  } catch (error) {
    console.error("Failed to register webhooks:", error)
    return c.json({ error: "Failed to register webhooks" }, 500)
  }
})

// --- Analytics ---
app.get("/api/tenants/:tenantId/analytics", async (c) => {
  const tenantId = c.req.param("tenantId")
  const timeFrame = c.req.query("timeFrame") || "weekly"
  const analytics = await d1DatabaseService.getAnalytics(c.env, tenantId, timeFrame)
  return c.json(analytics)
})
app.get("/api/tenants/:tenantId/analytics/florist-stats", async (c) => {
  const tenantId = c.req.param("tenantId")
  const stats = await d1DatabaseService.getFloristStats(c.env, tenantId)
  return c.json(stats)
})
app.delete("/api/tenants/:tenantId/analytics/florist-stats/:statId", async (c) => {
  const { tenantId, statId } = c.req.param()
  // In a real app, you'd have a D1 table for these stats
  console.log(`Deleting stat ${statId} for tenant ${tenantId}`)
  return c.json({ success: true, message: `Stat ${statId} deleted.` })
})

// --- Users ---
app.get("/api/tenants/:tenantId/users", async (c) => {
  const tenantId = c.req.param("tenantId")
  const users = await d1DatabaseService.getUsers(c.env, tenantId)
  return c.json(users)
})
app.post("/api/tenants/:tenantId/users", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userData = await c.req.json()
  const newUser = await d1DatabaseService.createUser(c.env, tenantId, userData)
  return c.json(newUser, 201)
})
app.get("/api/tenants/:tenantId/users/:userId", async (c) => {
  const { tenantId, userId } = c.req.param()
  const user = await d1DatabaseService.getUser(c.env, tenantId, userId)
  return user ? c.json(user) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/users/:userId", async (c) => {
  const { tenantId, userId } = c.req.param()
  const updateData = await c.req.json()
  const updatedUser = await d1DatabaseService.updateUser(c.env, tenantId, userId, updateData)
  return updatedUser ? c.json(updatedUser) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/users/:userId", async (c) => {
  const { tenantId, userId } = c.req.param()
  const success = await d1DatabaseService.deleteUser(c.env, tenantId, userId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Tenants (Public Routes) ---
app.get("/api/tenants", async (c) => {
  const tenants = await d1DatabaseService.listTenants(c.env)
  return c.json(tenants)
})
app.post("/api/tenants", async (c) => {
  const tenantData = await c.req.json()
  const newTenant = await d1DatabaseService.createTenant(c.env, tenantData)
  return c.json(newTenant, 201)
})
app.get("/api/tenants/:tenantId", async (c) => {
  const { tenantId } = c.req.param()
  const tenant = await d1DatabaseService.getTenant(c.env, tenantId)
  return tenant ? c.json(tenant) : c.json({ error: "Not Found" }, 404)
})

// --- Configuration Routes ---
app.get("/api/tenants/:tenantId/config/order-card", async (c) => {
  const tenantId = c.req.param("tenantId")
  const config = await d1DatabaseService.getOrderCardConfig(c.env, tenantId)
  return c.json(config)
})

app.put("/api/tenants/:tenantId/config/order-card", async (c) => {
  const tenantId = c.req.param("tenantId")
  const configData = await c.req.json()

  console.log(`Saving config for tenant ${tenantId}:`, JSON.stringify(configData, null, 2))

  try {
    const newConfig = await d1DatabaseService.saveOrderCardConfig(c.env, tenantId, configData)
    return c.json(newConfig, 201)
  } catch (error) {
    console.error("Error saving order card config in worker:", error)
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }
    return c.json(
      {
        error: "Failed to save configuration",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    )
  }
})

app.get("/api/tenants/:tenantId/settings", async (c) => {
  const { tenantId } = c.req.param()
  try {
    const tenant = await d1DatabaseService.getTenant(c.env, tenantId)
    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404)
    }

    let settings: any = {}
    if (tenant.settings) {
      if (typeof tenant.settings === "string") {
        try {
          settings = JSON.parse(tenant.settings)
        } catch (e) {
          console.error("Failed to parse settings JSON:", e)
          settings = {}
        }
      } else if (typeof tenant.settings === "object") {
        settings = tenant.settings
      }
    }

    return c.json(settings)
  } catch (error) {
    console.error("Error getting tenant settings:", error)
    return c.json({ error: "Failed to get settings" }, 500)
  }
})

app.put("/api/tenants/:tenantId/settings", async (c) => {
  const { tenantId } = c.req.param()
  const settingsData = await c.req.json()

  try {
    const tenant = await d1DatabaseService.getTenant(c.env, tenantId)
    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404)
    }

    // Save settings
    await c.env.DB.prepare(
      "UPDATE tenants SET settings = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(JSON.stringify(settingsData), tenantId)
      .run()

    return c.json({ success: true, settings: settingsData })
  } catch (error) {
    console.error("Error saving tenant settings:", error)
    return c.json({ error: "Failed to save settings" }, 500)
  }
})

// --- Health & Test Routes ---
app.get("/api/health", (c) => c.json({ status: "healthy" }))
app.get("/api/test-d1", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM tenants").all()
  return c.json({ message: "D1 connection successful", tenantCount: results[0].count })
})

// --- Database Initialization Route ---
app.post("/api/init-db", async (c) => {
  try {
    // Create all tables
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT UNIQUE NOT NULL, subscription_plan TEXT DEFAULT "starter", status TEXT DEFAULT "active", settings TEXT DEFAULT "{}", created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)'
    ).run()
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS tenant_users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, hashed_password TEXT NOT NULL, role TEXT NOT NULL DEFAULT "florist", permissions TEXT, created_at TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))'
    ).run()
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS tenant_orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_order_id TEXT, customer_name TEXT NOT NULL, delivery_date TEXT NOT NULL, status TEXT DEFAULT "pending", priority INTEGER DEFAULT 0, assigned_to TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))'
    ).run()
    await c.env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS tenant_products (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_product_id TEXT, name TEXT NOT NULL, description TEXT, price REAL, stock_quantity INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))"
    ).run()
    await c.env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS shopify_stores (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_domain TEXT UNIQUE NOT NULL, access_token TEXT NOT NULL, webhook_secret TEXT, sync_enabled BOOLEAN DEFAULT true, last_sync_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))"
    ).run()

    return c.json({ success: true, message: "Database initialized successfully" })
  } catch (error) {
    console.error("Database initialization error:", error)
    return c.json({ error: "Failed to initialize database" }, 500)
  }
})

// --- Temporary Test User Creation Route ---
app.post("/api/temp/create-user", async (c) => {
  try {
    const tenants = await d1DatabaseService.listTenants(c.env, { domain: "test-florist" })
    const testTenant = tenants[0]

    if (!testTenant) {
      return c.json({ error: "Test tenant 'test-florist' not found." }, 404)
    }

    // Create user with demo credentials from login page
    const newUser = await d1DatabaseService.createUser(c.env, testTenant.id, {
      email: "admin@test-florist.com",
      name: "Admin User",
      password: "password",
      role: "admin",
    })

    // We don't want to return the full user object here in a real scenario
    return c.json({ success: true, userId: newUser.id })
  } catch (error: any) {
    // Check for unique constraint error
    if (error.message && error.message.includes("UNIQUE constraint failed")) {
      return c.json({ message: "Test user already exists." }, 200)
    }
    console.error("Test user creation error:", error)
    return c.json({ error: "Failed to create test user" }, 500)
  }
})

// --- Shopify Webhook ---
app.post("/api/webhooks/shopify/orders/create/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId")
  console.log(`Received Shopify order create webhook for tenant: ${tenantId}`)

  try {
    const shopifyOrder = await c.req.json()

    // It's good practice to verify the webhook signature, but skipping for now.
    // Recommended: implement Shopify webhook verification
    // https://shopify.dev/docs/apps/build/webhooks/subscribe/https#step-2-validate-the-origin-of-your-webhook-to-ensure-it-s-coming-from-shopify

    if (!shopifyOrder || !shopifyOrder.line_items || shopifyOrder.line_items.length === 0) {
      console.error("Malformed Shopify order payload", shopifyOrder)
      return c.json({ error: "Invalid order data" }, 400)
    }

    // --- Extract Product Label ---
    const firstLineItem = shopifyOrder.line_items[0]
    let product_label: string | undefined

    if (firstLineItem.product_id && firstLineItem.variant_id) {
      try {
        const savedProduct = await d1DatabaseService.getProductByShopifyIds(
          c.env,
          tenantId,
          String(firstLineItem.product_id),
          String(firstLineItem.variant_id)
        )

        if (savedProduct && savedProduct.labelNames && savedProduct.labelNames.length > 0) {
          product_label = savedProduct.labelNames[0]
          console.log(`Found label "${product_label}" for product ${firstLineItem.title}`)
        }
      } catch (e) {
        console.error("Error fetching saved product by shopify ids", e)
      }
    }

    // --- Extract Delivery Date ---
    // Assumes delivery date is passed as a note attribute named 'delivery_date'
    // Format is expected to be YYYY-MM-DD
    let deliveryDate: string
    const deliveryDateAttribute = shopifyOrder.note_attributes?.find(
      (attr: any) => attr.name === "delivery_date"
    )

    if (deliveryDateAttribute) {
      deliveryDate = deliveryDateAttribute.value
    } else {
      // Fallback to order creation date if no delivery date is specified
      deliveryDate = shopifyOrder.created_at.split("T")[0]
      console.log(
        `No delivery_date note attribute found. Falling back to order created_at: ${deliveryDate}`
      )
    }

    // --- Create Order in our DB ---
    const customerName =
      `${shopifyOrder.customer?.first_name || ""} ${
        shopifyOrder.customer?.last_name || ""
      }`.trim() || "N/A"

    const orderData: {
      shopifyOrderId: string
      customerName: string
      deliveryDate: string
      notes?: string
      product_label?: string
    } = {
      shopifyOrderId: String(shopifyOrder.id),
      customerName,
      deliveryDate,
      notes: shopifyOrder.note,
    }

    if (product_label) {
      orderData.product_label = product_label
    }

    await d1DatabaseService.createOrder(c.env, tenantId, orderData)
    console.log(`Successfully created order ${orderData.shopifyOrderId} for tenant ${tenantId}`)

    return c.json({ success: true }, 200)
  } catch (error) {
    console.error("Failed to process Shopify order webhook:", error)
    return c.json({ error: "Internal server error" }, 500)
  }
})

// Helper to clone a Response and set headers if needed
function cloneResponseWithHeaders(
  response: Response,
  headers: Record<string, string> = {}
): Response {
  const clonedResponse = new Response(response.body, response)
  for (const [key, value] of Object.entries(headers)) {
    clonedResponse.headers.set(key, value)
  }
  return clonedResponse
}

// Serve static assets and SPA routing (must be last, after all API routes)
app.get("*", async (c) => {
  const url = new URL(c.req.url)
  const path = url.pathname

  // Skip API routes - they should be handled by the API handlers above
  if (path.startsWith("/api/")) {
    return c.text("API route not found", 404)
  }

  // Try to serve static assets first
  try {
    const response = await c.env.ASSETS.fetch(c.req)
    if (response && response.status !== 404) {
      return response
    }
  } catch (error) {
    console.error("Error serving static asset:", error)
  }

  // Fallback to index.html for SPA routing
  try {
    const indexResponse = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)))
    if (indexResponse && indexResponse.status !== 404) {
      return new Response(indexResponse.body, {
        headers: {
          "Content-Type": "text/html",
          "Cache-Control": "no-cache",
        },
      })
    }
  } catch (error) {
    console.error("Error serving index.html:", error)
  }

  return c.text("Not Found", 404)
})

export default {
  fetch: app.fetch,
  // The scheduled handler is optional
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.resolve())
  },
}

// The old code is left below for reference during migration, but is no longer active.
/*
// ... all the old fetch handler, handleApiRequest, etc. code
*/
