import { Tenant, CreateTenantRequest, User, Order } from "../types"
import bcrypt from "bcryptjs"

// Declare crypto global for Cloudflare Workers
declare const crypto: Crypto

export const d1DatabaseService = {
  // Create a new tenant
  async createTenant(env: any, tenantData: CreateTenantRequest): Promise<Tenant> {
    const tenantId = crypto.randomUUID()
    const settings = {
      timezone: "UTC",
      currency: "USD",
      businessHours: { start: "09:00", end: "17:00" },
      features: { analytics: false, multiStore: false, advancedReporting: false },
      ...tenantData.settings,
    }
    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO tenants (id, name, domain, subscription_plan, status, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    )
      .bind(
        tenantId,
        tenantData.name,
        tenantData.domain,
        tenantData.subscriptionPlan || "starter",
        JSON.stringify(settings),
        now,
        now
      )
      .run()
    return (await d1DatabaseService.getTenant(env, tenantId)) as Tenant
  },

  // Get Order Card Configuration
  async getOrderCardConfig(env: any, tenantId: string): Promise<any> {
    const tenant = await d1DatabaseService.getTenant(env, tenantId)
    if (!tenant) return null
    return tenant.settings?.orderCard || null
  },

  // Save Order Card Configuration
  async saveOrderCardConfig(env: any, tenantId: string, config: any): Promise<any> {
    const tenant = await d1DatabaseService.getTenant(env, tenantId)
    if (!tenant) {
      throw new Error("Tenant not found")
    }
    const settings = tenant.settings || {}
    settings.orderCard = config

    await env.DB.prepare("UPDATE tenants SET settings = ? WHERE id = ?")
      .bind(JSON.stringify(settings), tenantId)
      .run()

    return config
  },

  // Get a tenant by ID
  async getTenant(env: any, tenantId: string): Promise<Tenant | null> {
    const { results } = await env.DB.prepare("SELECT * FROM tenants WHERE id = ?")
      .bind(tenantId)
      .all()
    const result = results[0]
    if (!result) return null
    return {
      id: result.id,
      name: result.name,
      domain: result.domain,
      subscriptionPlan: result.subscription_plan,
      status: result.status,
      settings: JSON.parse(result.settings),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // List tenants (optionally filter by domain)
  async listTenants(env: any, filters?: { domain?: string }): Promise<Tenant[]> {
    let query = "SELECT * FROM tenants"
    let params: any[] = []
    if (filters?.domain) {
      query += " WHERE domain = ?"
      params.push(filters.domain)
    }
    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all()
    return results.map((result: any) => ({
      id: result.id,
      name: result.name,
      domain: result.domain,
      subscriptionPlan: result.subscription_plan,
      status: result.status,
      settings: JSON.parse(result.settings),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }))
  },

  // Create a new user for a tenant
  async createUser(
    env: any,
    tenantId: string,
    userData: {
      email: string
      name: string
      password?: string
      role?: string
      permissions?: string[]
    }
  ): Promise<User> {
    const userId = crypto.randomUUID()
    const now = new Date().toISOString()

    if (typeof userData.password !== "string" || userData.password.length === 0) {
      throw new Error("Password must be a non-empty string.")
    }
    const hashedPassword = await bcrypt.hash(userData.password, 10)

    await env.DB.prepare(
      `INSERT INTO tenant_users (id, tenant_id, email, name, hashed_password, role, permissions, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        userId,
        tenantId,
        userData.email,
        userData.name,
        hashedPassword,
        userData.role || "florist",
        JSON.stringify(userData.permissions || []),
        now,
        now
      )
      .run()
    return (await d1DatabaseService.getUser(env, tenantId, userId)) as User
  },

  // Get a user by email and tenant domain
  async getUserByEmailAndTenant(
    env: any,
    email: string,
    tenantDomain: string
  ): Promise<(User & { hashedPassword?: string }) | null> {
    const { results } = await env.DB.prepare(
      `SELECT u.*, u.hashed_password as hashedPassword FROM tenant_users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = ? AND t.domain = ?`
    )
      .bind(email, tenantDomain)
      .all()

    const result: any = results[0]
    if (!result) return null

    return {
      id: result.id,
      tenantId: result.tenant_id,
      email: result.email,
      name: result.name,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      hashedPassword: result.hashedPassword,
    }
  },

  // Get a user by ID
  async getUser(env: any, tenantId: string, userId: string): Promise<User | null> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenant_users WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, userId)
      .all()
    const result = results[0]
    if (!result) return null
    return {
      id: result.id,
      tenantId: result.tenant_id,
      email: result.email,
      name: result.name,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // List users for a tenant
  async getUsers(env: any, tenantId: string): Promise<User[]> {
    const { results } = await env.DB.prepare("SELECT * FROM tenant_users WHERE tenant_id = ?")
      .bind(tenantId)
      .all()
    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      email: result.email,
      name: result.name,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }))
  },

  // List orders for a tenant (with optional filters)
  async getOrders(
    env: any,
    tenantId: string,
    filters?: { status?: string; assignedTo?: string; deliveryDate?: string; storeId?: string }
  ): Promise<Order[]> {
    let query = "SELECT * FROM tenant_orders WHERE tenant_id = ?"
    let params: any[] = [tenantId]

    if (filters?.status) {
      query += " AND status = ?"
      params.push(filters.status)
    }
    if (filters?.assignedTo) {
      query += " AND assigned_to = ?"
      params.push(filters.assignedTo)
    }
    if (filters?.deliveryDate) {
      query += " AND delivery_date = ?"
      params.push(filters.deliveryDate)
    }
    // Note: storeId filter would need to be added to the orders table schema if needed

    query += " ORDER BY delivery_date ASC, priority DESC, created_at ASC"

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all()
    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      shopifyOrderId: result.shopify_order_id,
      customerName: result.customer_name,
      deliveryDate: result.delivery_date,
      status: result.status,
      priority: result.priority,
      assignedTo: result.assigned_to,
      notes: result.notes,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }))
  },

  // Create a new order for a tenant
  async createOrder(
    env: any,
    tenantId: string,
    orderData: {
      customerName: string
      deliveryDate: string
      status?: string
      priority?: number
      assignedTo?: string
      notes?: string
      shopifyOrderId?: string
      product_label?: string
    }
  ): Promise<Order> {
    const orderId = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO tenant_orders (id, tenant_id, shopify_order_id, customer_name, delivery_date, status, priority, assigned_to, notes, product_label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        orderId,
        tenantId,
        orderData.shopifyOrderId || null,
        orderData.customerName,
        orderData.deliveryDate,
        orderData.status || "pending",
        orderData.priority || 0,
        orderData.assignedTo || null,
        orderData.notes || null,
        orderData.product_label || null,
        now,
        now
      )
      .run()
    return (await d1DatabaseService.getOrder(env, tenantId, orderId)) as Order
  },

  // Get a single order by ID
  async getOrder(env: any, tenantId: string, orderId: string): Promise<Order | null> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenant_orders WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, orderId)
      .all()
    const result = results[0]
    if (!result) return null
    return {
      id: result.id,
      tenantId: result.tenant_id,
      shopifyOrderId: result.shopify_order_id,
      customerName: result.customer_name,
      deliveryDate: result.delivery_date,
      status: result.status,
      priority: result.priority,
      assignedTo: result.assigned_to,
      notes: result.notes,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // Update an order
  async updateOrder(
    env: any,
    tenantId: string,
    orderId: string,
    updateData: Partial<Order>
  ): Promise<Order | null> {
    const now = new Date().toISOString()
    const fields = []
    const values = []

    if (updateData.customerName !== undefined) {
      fields.push("customer_name = ?")
      values.push(updateData.customerName)
    }
    if (updateData.deliveryDate !== undefined) {
      fields.push("delivery_date = ?")
      values.push(updateData.deliveryDate)
    }
    if (updateData.status !== undefined) {
      fields.push("status = ?")
      values.push(updateData.status)
    }
    if (updateData.priority !== undefined) {
      fields.push("priority = ?")
      values.push(updateData.priority)
    }
    if (updateData.assignedTo !== undefined) {
      fields.push("assigned_to = ?")
      values.push(updateData.assignedTo)
    }
    if (updateData.notes !== undefined) {
      fields.push("notes = ?")
      values.push(updateData.notes)
    }
    if (updateData.shopifyOrderId !== undefined) {
      fields.push("shopify_order_id = ?")
      values.push(updateData.shopifyOrderId)
    }

    fields.push("updated_at = ?")
    values.push(now)

    if (fields.length === 1) {
      // Only updated_at
      return await d1DatabaseService.getOrder(env, tenantId, orderId)
    }

    values.push(tenantId, orderId)
    const query = `UPDATE tenant_orders SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`

    await env.DB.prepare(query)
      .bind(...values)
      .run()
    return await d1DatabaseService.getOrder(env, tenantId, orderId)
  },

  // Delete an order
  async deleteOrder(env: any, tenantId: string, orderId: string): Promise<boolean> {
    const { meta } = await env.DB.prepare(
      "DELETE FROM tenant_orders WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, orderId)
      .run()
    return meta.changes > 0
  },

  // Update a user
  async updateUser(
    env: any,
    tenantId: string,
    userId: string,
    updateData: Partial<User>
  ): Promise<User | null> {
    const now = new Date().toISOString()
    const fields = []
    const values = []

    if (updateData.email !== undefined) {
      fields.push("email = ?")
      values.push(updateData.email)
    }
    if (updateData.name !== undefined) {
      fields.push("name = ?")
      values.push(updateData.name)
    }
    if (updateData.role !== undefined) {
      fields.push("role = ?")
      values.push(updateData.role)
    }
    if (updateData.permissions !== undefined) {
      fields.push("permissions = ?")
      values.push(JSON.stringify(updateData.permissions))
    }

    fields.push("updated_at = ?")
    values.push(now)

    if (fields.length === 1) {
      // Only updated_at
      return await d1DatabaseService.getUser(env, tenantId, userId)
    }

    values.push(tenantId, userId)
    const query = `UPDATE tenant_users SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`

    await env.DB.prepare(query)
      .bind(...values)
      .run()
    return await d1DatabaseService.getUser(env, tenantId, userId)
  },

  // Delete a user
  async deleteUser(env: any, tenantId: string, userId: string): Promise<boolean> {
    const { meta } = await env.DB.prepare("DELETE FROM tenant_users WHERE tenant_id = ? AND id = ?")
      .bind(tenantId, userId)
      .run()
    return meta.changes > 0
  },

  // Get products for a tenant
  async getProducts(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenant_products WHERE tenant_id = ? ORDER BY created_at DESC"
    )
      .bind(tenantId)
      .all()
    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      name: result.name,
      description: result.description,
      price: result.price,
      stockQuantity: result.stock_quantity,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }))
  },

  // Create a new product
  async createProduct(
    env: any,
    tenantId: string,
    productData: {
      name: string
      description?: string
      price?: number
      stockQuantity?: number
      shopifyProductId?: string
    }
  ): Promise<any> {
    const productId = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO tenant_products (id, tenant_id, shopify_product_id, name, description, price, stock_quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        productId,
        tenantId,
        productData.shopifyProductId || null,
        productData.name,
        productData.description || null,
        productData.price || 0,
        productData.stockQuantity || 0,
        now,
        now
      )
      .run()
    return await d1DatabaseService.getProduct(env, tenantId, productId)
  },

  // Get a single product by ID
  async getProduct(env: any, tenantId: string, productId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenant_products WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, productId)
      .all()
    const result = results[0]
    if (!result) return null
    return {
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      name: result.name,
      description: result.description,
      price: result.price,
      stockQuantity: result.stock_quantity,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // Update a product
  async updateProduct(
    env: any,
    tenantId: string,
    productId: string,
    updateData: Partial<any>
  ): Promise<any | null> {
    const now = new Date().toISOString()
    const fields = []
    const values = []

    if (updateData.name !== undefined) {
      fields.push("name = ?")
      values.push(updateData.name)
    }
    if (updateData.description !== undefined) {
      fields.push("description = ?")
      values.push(updateData.description)
    }
    if (updateData.price !== undefined) {
      fields.push("price = ?")
      values.push(updateData.price)
    }
    if (updateData.stockQuantity !== undefined) {
      fields.push("stock_quantity = ?")
      values.push(updateData.stockQuantity)
    }
    if (updateData.shopifyProductId !== undefined) {
      fields.push("shopify_product_id = ?")
      values.push(updateData.shopifyProductId)
    }

    fields.push("updated_at = ?")
    values.push(now)

    if (fields.length === 1) {
      // Only updated_at
      return await d1DatabaseService.getProduct(env, tenantId, productId)
    }

    values.push(tenantId, productId)
    const query = `UPDATE tenant_products SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`

    await env.DB.prepare(query)
      .bind(...values)
      .run()
    return await d1DatabaseService.getProduct(env, tenantId, productId)
  },

  // Delete a product
  async deleteProduct(env: any, tenantId: string, productId: string): Promise<boolean> {
    const result = await env.DB.prepare("DELETE FROM products WHERE id = ? AND tenant_id = ?")
      .bind(productId, tenantId)
      .run()
    return result.success
  },

  // Get stores for a tenant
  async getStores(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM shopify_stores WHERE tenant_id = ? ORDER BY created_at DESC"
    )
      .bind(tenantId)
      .all()
    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      name: result.shopify_domain, // Use domain as name for now
      type: "shopify",
      status: "active",
      settings: {
        domain: result.shopify_domain,
        address: result.shopify_domain,
        accessToken: result.access_token,
        apiSecretKey: result.webhook_secret,
        timezone: "UTC",
        currency: "USD",
        businessHours: { start: "09:00", end: "17:00" },
        webhooks: [], // Will be populated when webhooks are registered
      },
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }))
  },

  // Create a new store
  async createStore(
    env: any,
    tenantId: string,
    storeData: {
      shopifyDomain: string
      accessToken: string
      webhookSecret?: string
      syncEnabled?: boolean
    }
  ): Promise<any> {
    const storeId = crypto.randomUUID()
    const now = new Date().toISOString()
    await env.DB.prepare(
      `INSERT INTO shopify_stores (id, tenant_id, shopify_domain, access_token, webhook_secret, sync_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        storeId,
        tenantId,
        storeData.shopifyDomain,
        storeData.accessToken,
        storeData.webhookSecret || null,
        storeData.syncEnabled !== false, // Default to true
        now,
        now
      )
      .run()

    // Return the store in the expected format
    return {
      id: storeId,
      tenantId,
      name: storeData.shopifyDomain,
      type: "shopify",
      status: "active",
      settings: {
        domain: storeData.shopifyDomain,
        address: storeData.shopifyDomain,
        accessToken: storeData.accessToken,
        apiSecretKey: storeData.webhookSecret,
        timezone: "UTC",
        currency: "USD",
        businessHours: { start: "09:00", end: "17:00" },
        webhooks: [],
      },
      createdAt: now,
      updatedAt: now,
    }
  },

  // Get a single store by ID
  async getStore(env: any, tenantId: string, storeId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM shopify_stores WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, storeId)
      .all()
    const result = results[0]
    if (!result) return null
    return {
      id: result.id,
      tenantId: result.tenant_id,
      name: result.shopify_domain, // Use domain as name for now
      type: "shopify",
      status: "active",
      settings: {
        domain: result.shopify_domain,
        address: result.shopify_domain,
        accessToken: result.access_token,
        apiSecretKey: result.webhook_secret,
        timezone: "UTC",
        currency: "USD",
        businessHours: { start: "09:00", end: "17:00" },
        webhooks: [], // Will be populated when webhooks are registered
      },
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // Update a store
  async updateStore(
    env: any,
    tenantId: string,
    storeId: string,
    updateData: Partial<any>
  ): Promise<any | null> {
    const now = new Date().toISOString()
    const fields = []
    const values = []

    if (updateData.shopifyDomain !== undefined) {
      fields.push("shopify_domain = ?")
      values.push(updateData.shopifyDomain)
    }
    if (updateData.accessToken !== undefined) {
      fields.push("access_token = ?")
      values.push(updateData.accessToken)
    }
    if (updateData.webhookSecret !== undefined) {
      fields.push("webhook_secret = ?")
      values.push(updateData.webhookSecret)
    }
    if (updateData.syncEnabled !== undefined) {
      fields.push("sync_enabled = ?")
      values.push(updateData.syncEnabled)
    }
    if (updateData.lastSyncAt !== undefined) {
      fields.push("last_sync_at = ?")
      values.push(updateData.lastSyncAt)
    }

    fields.push("updated_at = ?")
    values.push(now)

    if (fields.length === 1) {
      // Only updated_at
      return await d1DatabaseService.getStore(env, tenantId, storeId)
    }

    values.push(tenantId, storeId)
    const query = `UPDATE shopify_stores SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`

    await env.DB.prepare(query)
      .bind(...values)
      .run()
    return await d1DatabaseService.getStore(env, tenantId, storeId)
  },

  // Delete a store
  async deleteStore(env: any, tenantId: string, storeId: string): Promise<boolean> {
    const { meta } = await env.DB.prepare(
      "DELETE FROM shopify_stores WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, storeId)
      .run()
    return meta.changes > 0
  },

  // Get all product labels for a tenant
  async getProductLabels(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT id, name, category, color, priority FROM product_labels WHERE tenant_id = ? ORDER BY priority ASC`
    )
      .bind(tenantId)
      .all()
    return results || []
  },

  // Get a single product label by ID
  async getProductLabelById(env: any, tenantId: string, labelId: string): Promise<any | null> {
    const result = await env.DB.prepare(
      `SELECT * FROM product_labels WHERE id = ? AND tenant_id = ?`
    )
      .bind(labelId, tenantId)
      .first()
    return result || null
  },

  // Create a new product label
  async createProductLabel(
    env: any,
    tenantId: string,
    labelData: { name: string; category: string; color: string; priority: number }
  ): Promise<any> {
    const id = crypto.randomUUID()
    const { name, category, color, priority } = labelData

    await env.DB.prepare(
      `INSERT INTO product_labels (id, tenant_id, name, category, color, priority) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, tenantId, name, category, color, priority)
      .run()

    const newLabel = await this.getProductLabelById(env, tenantId, id)
    return newLabel
  },

  // Update a product label
  async updateProductLabel(
    env: any,
    tenantId: string,
    labelId: string,
    updateData: Partial<{ name: string; color: string; priority: number }>
  ): Promise<any | null> {
    const existingLabel = await this.getProductLabelById(env, tenantId, labelId)
    if (!existingLabel) {
      return null
    }

    const fieldsToUpdate = Object.entries(updateData)
      .filter(([key, value]) => value !== undefined && ["name", "color", "priority"].includes(key))
      .map(([key]) => `${key} = ?`)

    if (fieldsToUpdate.length === 0) {
      return existingLabel // No valid fields to update
    }

    const values = Object.entries(updateData)
      .filter(([key, value]) => value !== undefined && ["name", "color", "priority"].includes(key))
      .map(([, value]) => value)

    const query = `UPDATE product_labels SET ${fieldsToUpdate.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`
    await env.DB.prepare(query)
      .bind(...values, labelId, tenantId)
      .run()

    return this.getProductLabelById(env, tenantId, labelId)
  },

  // Delete a product label
  async deleteProductLabel(env: any, tenantId: string, labelId: string): Promise<boolean> {
    const result = await env.DB.prepare(`DELETE FROM product_labels WHERE id = ? AND tenant_id = ?`)
      .bind(labelId, tenantId)
      .run()

    return result.success
  },

  // Get analytics for a tenant
  async getAnalytics(env: any, tenantId: string, timeFrame: string = "weekly"): Promise<any> {
    // Get basic analytics data
    const orders = await d1DatabaseService.getOrders(env, tenantId)
    const products = await d1DatabaseService.getProducts(env, tenantId)
    const users = await d1DatabaseService.getUsers(env, tenantId)

    // Calculate basic stats
    const totalOrders = orders.length
    const pendingOrders = orders.filter((order) => order.status === "pending").length
    const completedOrders = orders.filter((order) => order.status === "completed").length
    const totalProducts = products.length
    const totalUsers = users.length

    // Calculate revenue (mock data for now)
    const revenue = orders.reduce((sum, order) => sum + Math.random() * 100, 0)

    return {
      timeFrame,
      totalOrders,
      pendingOrders,
      completedOrders,
      totalProducts,
      totalUsers,
      revenue: Math.round(revenue * 100) / 100,
      ordersByStatus: {
        pending: pendingOrders,
        completed: completedOrders,
        cancelled: orders.filter((order) => order.status === "cancelled").length,
      },
      recentOrders: orders.slice(0, 5),
    }
  },

  // Get florist stats
  async getFloristStats(env: any, tenantId: string): Promise<any[]> {
    const users = await d1DatabaseService.getUsers(env, tenantId)
    const orders = await d1DatabaseService.getOrders(env, tenantId)

    return users.map((user) => {
      const userOrders = orders.filter((order) => order.assignedTo === user.id)
      const completedOrders = userOrders.filter((order) => order.status === "completed").length

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        totalOrders: userOrders.length,
        completedOrders,
        completionRate: userOrders.length > 0 ? (completedOrders / userOrders.length) * 100 : 0,
        averageOrdersPerDay: userOrders.length > 0 ? userOrders.length / 7 : 0, // Mock calculation
      }
    })
  },

  async fetchShopifyOrder(
    env: any,
    tenantId: string,
    storeId: string,
    orderName: string
  ): Promise<any> {
    const store = await this.getStore(env, tenantId, storeId)
    if (!store || !store.settings.accessToken) {
      throw new Error("Shopify store not found or access token is missing.")
    }

    const shopifyDomain = store.settings.domain
    const accessToken = store.settings.accessToken

    const query = `{
        orders(first: 1, query: "name:${orderName}") {
            edges {
                node {
                    id
                    name
                    createdAt
                    displayFulfillmentStatus
                    tags
                    note
                    customer {
                        firstName
                        lastName
                    }
                    lineItems(first: 10) {
                        edges {
                            node {
                                title
                                variant {
                                    id
                                    title
                                }
                                product {
                                    id
                                }
                            }
                        }
                    }
                }
            }
        }
    }`

    const response = await fetch(`https://${shopifyDomain}/admin/api/2023-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query }),
    })

    const jsonResponse: any = await response.json()

    if (jsonResponse.errors) {
      throw new Error(`Shopify API error: ${JSON.stringify(jsonResponse.errors)}`)
    }

    const orders = jsonResponse.data?.orders?.edges
    if (orders && orders.length > 0) {
      return orders[0].node
    }

    return null
  },

  // Get all Shopify stores for a tenant
  async getShopifyStores(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT id, name, type, shopify_domain as shopifyDomain, sync_enabled as syncEnabled FROM stores WHERE tenant_id = ?`
    )
      .bind(tenantId)
      .all()
    return results || []
  },

  async getProductByShopifyId(env: any, tenantId: string, shopifyId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM tenant_products WHERE tenant_id = ? AND shopify_product_id = ?"
    )
      .bind(tenantId, shopifyId)
      .all()

    const result = results[0]
    if (!result) return null

    return {
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      name: result.name,
      description: result.description,
      price: result.price,
      stockQuantity: result.stock_quantity,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }
  },

  // Saved Products functions
  async saveProducts(
    env: any,
    tenantId: string,
    products: Array<{
      shopifyProductId: string
      shopifyVariantId: string
      title: string
      variantTitle?: string
      description?: string
      price: number
      tags?: string[]
      productType?: string
      vendor?: string
      handle?: string
      imageUrl?: string
      imageAlt?: string
      imageWidth?: number
      imageHeight?: number
    }>
  ): Promise<any[]> {
    const savedProducts = []

    for (const product of products) {
      const productId = crypto.randomUUID()
      const now = new Date().toISOString()

      await env.DB.prepare(`
        INSERT OR REPLACE INTO saved_products (
          id, tenant_id, shopify_product_id, shopify_variant_id, title, variant_title,
          description, price, tags, product_type, vendor, handle, 
          image_url, image_alt, image_width, image_height,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          productId,
          tenantId,
          product.shopifyProductId,
          product.shopifyVariantId,
          product.title,
          product.variantTitle || null,
          product.description || null,
          product.price,
          JSON.stringify(product.tags || []),
          product.productType || null,
          product.vendor || null,
          product.handle || null,
          product.imageUrl || null,
          product.imageAlt || null,
          product.imageWidth || null,
          product.imageHeight || null,
          now,
          now
        )
        .run()

      savedProducts.push({
        id: productId,
        tenantId,
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
        title: product.title,
        variantTitle: product.variantTitle,
        description: product.description,
        price: product.price,
        tags: product.tags || [],
        productType: product.productType,
        vendor: product.vendor,
        handle: product.handle,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        imageWidth: product.imageWidth,
        imageHeight: product.imageHeight,
        createdAt: now,
        updatedAt: now,
      })
    }

    return savedProducts
  },

  async getSavedProducts(
    env: any,
    tenantId: string,
    filters?: {
      search?: string
      productType?: string
      vendor?: string
      hasLabels?: boolean
    }
  ): Promise<any[]> {
    let query = `
      SELECT sp.*, 
             GROUP_CONCAT(plm.label_id) as label_ids,
             GROUP_CONCAT(pl.name) as label_names
      FROM saved_products sp
      LEFT JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
      LEFT JOIN product_labels pl ON plm.label_id = pl.id
      WHERE sp.tenant_id = ?
    `
    let params: any[] = [tenantId]

    if (filters?.search) {
      query += ` AND (sp.title LIKE ? OR sp.variant_title LIKE ? OR sp.description LIKE ?)`
      const searchTerm = `%${filters.search}%`
      params.push(searchTerm, searchTerm, searchTerm)
    }

    if (filters?.productType) {
      query += ` AND sp.product_type = ?`
      params.push(filters.productType)
    }

    if (filters?.vendor) {
      query += ` AND sp.vendor = ?`
      params.push(filters.vendor)
    }

    if (filters?.hasLabels === true) {
      query += ` AND plm.label_id IS NOT NULL`
    } else if (filters?.hasLabels === false) {
      query += ` AND plm.label_id IS NULL`
    }

    query += ` GROUP BY sp.id ORDER BY sp.created_at DESC`

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all()

    return results.map((result: any) => ({
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      shopifyVariantId: result.shopify_variant_id,
      title: result.title,
      variantTitle: result.variant_title,
      description: result.description,
      price: result.price,
      tags: JSON.parse(result.tags || "[]"),
      productType: result.product_type,
      vendor: result.vendor,
      handle: result.handle,
      status: result.status,
      imageUrl: result.image_url,
      imageAlt: result.image_alt,
      imageWidth: result.image_width,
      imageHeight: result.image_height,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      labelIds: result.label_ids ? result.label_ids.split(",") : [],
      labelNames: result.label_names ? result.label_names.split(",") : [],
    }))
  },

  async getSavedProduct(env: any, tenantId: string, productId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(`
      SELECT sp.*, 
             GROUP_CONCAT(plm.label_id) as label_ids,
             GROUP_CONCAT(pl.name) as label_names
      FROM saved_products sp
      LEFT JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
      LEFT JOIN product_labels pl ON plm.label_id = pl.id
      WHERE sp.tenant_id = ? AND sp.id = ?
      GROUP BY sp.id
    `)
      .bind(tenantId, productId)
      .all()

    const result = results[0]
    if (!result) return null

    return {
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      shopifyVariantId: result.shopify_variant_id,
      title: result.title,
      variantTitle: result.variant_title,
      description: result.description,
      price: result.price,
      tags: JSON.parse(result.tags || "[]"),
      productType: result.product_type,
      vendor: result.vendor,
      handle: result.handle,
      status: result.status,
      imageUrl: result.image_url,
      imageAlt: result.image_alt,
      imageWidth: result.image_width,
      imageHeight: result.image_height,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      labelIds: result.label_ids ? result.label_ids.split(",") : [],
      labelNames: result.label_names ? result.label_names.split(",") : [],
    }
  },

  async deleteSavedProduct(env: any, tenantId: string, productId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      "DELETE FROM saved_products WHERE tenant_id = ? AND id = ?"
    )
      .bind(tenantId, productId)
      .run()

    return success
  },

  async addProductLabel(
    env: any,
    tenantId: string,
    productId: string,
    labelId: string
  ): Promise<boolean> {
    try {
      await env.DB.prepare(`
        INSERT INTO product_label_mappings (id, tenant_id, saved_product_id, label_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
        .bind(crypto.randomUUID(), tenantId, productId, labelId, new Date().toISOString())
        .run()

      return true
    } catch (error) {
      // If it's a duplicate, that's fine
      return false
    }
  },

  async removeProductLabel(
    env: any,
    tenantId: string,
    productId: string,
    labelId: string
  ): Promise<boolean> {
    const { success } = await env.DB.prepare(`
      DELETE FROM product_label_mappings 
      WHERE tenant_id = ? AND saved_product_id = ? AND label_id = ?
    `)
      .bind(tenantId, productId, labelId)
      .run()

    return success
  },

  async getProductByShopifyIds(
    env: any,
    tenantId: string,
    shopifyProductId: string,
    shopifyVariantId: string
  ): Promise<any | null> {
    const { results } = await env.DB.prepare(`
      SELECT sp.*, 
             GROUP_CONCAT(plm.label_id) as label_ids,
             GROUP_CONCAT(pl.name) as label_names,
             GROUP_CONCAT(pl.category) as label_categories
      FROM saved_products sp
      LEFT JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
      LEFT JOIN product_labels pl ON plm.label_id = pl.id
      WHERE sp.tenant_id = ? AND sp.shopify_product_id = ? AND sp.shopify_variant_id = ?
      GROUP BY sp.id
    `)
      .bind(tenantId, shopifyProductId, shopifyVariantId)
      .all()

    const result = results[0]
    if (!result) return null

    return {
      id: result.id,
      tenantId: result.tenant_id,
      shopifyProductId: result.shopify_product_id,
      shopifyVariantId: result.shopify_variant_id,
      title: result.title,
      variantTitle: result.variant_title,
      description: result.description,
      price: result.price,
      tags: JSON.parse(result.tags || "[]"),
      productType: result.product_type,
      vendor: result.vendor,
      handle: result.handle,
      status: result.status,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      labelIds: result.label_ids ? result.label_ids.split(",") : [],
      labelNames: result.label_names ? result.label_names.split(",") : [],
      labelCategories: result.label_categories ? result.label_categories.split(",") : [],
    }
  },
}
