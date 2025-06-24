import { Tenant, CreateTenantRequest, User, Order } from "../types"
import bcrypt from "bcryptjs"

// Declare crypto global for Cloudflare Workers
declare const crypto: Crypto

// Helper to ensure no undefined values are passed to the database
function safeValue(val: any) {
  return typeof val === 'undefined' ? null : val;
}

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
    const params: any[] = []
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
    const params: any[] = [tenantId]

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
      shopifyOrderData: result.shopify_order_data ? JSON.parse(result.shopify_order_data) : undefined,
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
      total_price?: number
      currency?: string
      customer_email?: string
      line_items?: string
      product_titles?: string
      quantities?: string
      session_id?: string
      store_id?: string
      product_type?: string
      shopifyOrderData?: any // Add this field for full GraphQL order
    }
  ): Promise<Order> {
    // 1. Check if order already exists
    if (orderData.shopifyOrderId) {
      const existingOrder = await env.DB.prepare(
        "SELECT * FROM tenant_orders WHERE tenant_id = ? AND shopify_order_id = ?"
      )
        .bind(tenantId, orderData.shopifyOrderId)
        .first()

      if (existingOrder) {
        console.log(`Order with Shopify ID ${orderData.shopifyOrderId} already exists. Skipping creation.`)
        // The result from D1 needs to be mapped to the Order type
        return {
          id: existingOrder.id,
          tenantId: existingOrder.tenant_id,
          shopifyOrderId: existingOrder.shopify_order_id,
          customerName: existingOrder.customer_name,
          deliveryDate: existingOrder.delivery_date,
          status: existingOrder.status,
          priority: existingOrder.priority,
          assignedTo: existingOrder.assigned_to,
          notes: existingOrder.notes,
          createdAt: existingOrder.created_at,
          updatedAt: existingOrder.updated_at,
          shopifyOrderData: existingOrder.shopify_order_data ? JSON.parse(existingOrder.shopify_order_data) : undefined,
        }
      }
    }
    
    const id = orderData.shopifyOrderId ? `shopify-${orderData.shopifyOrderId}` : crypto.randomUUID()
    const now = new Date().toISOString()
    
    // Ensure all analytics fields are present for insertion
    const fullOrderData = {
      ...orderData,
      status: orderData.status || "pending",
      priority: orderData.priority || 0,
      assignedTo: orderData.assignedTo || null,
      notes: orderData.notes || null,
      product_label: orderData.product_label || null,
      total_price: orderData.total_price || null,
      currency: orderData.currency || null,
      customer_email: orderData.customer_email || null,
      line_items: orderData.line_items || null,
      product_titles: orderData.product_titles || null,
      quantities: orderData.quantities || null,
      session_id: orderData.session_id || null,
      store_id: orderData.store_id || null,
      product_type: orderData.product_type || null,
      shopifyOrderData: orderData.shopifyOrderData ? JSON.stringify(orderData.shopifyOrderData) : null,
    };

    await env.DB.prepare(
      `INSERT INTO tenant_orders (
        id, tenant_id, shopify_order_id, customer_name, delivery_date, status, priority, assigned_to, notes, product_label, 
        total_price, currency, customer_email, line_items, product_titles, quantities, session_id, store_id, product_type, shopify_order_data,
        created_at, updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      fullOrderData.shopifyOrderId,
      fullOrderData.customerName,
      fullOrderData.deliveryDate,
      fullOrderData.status,
      fullOrderData.priority,
      fullOrderData.assignedTo,
      fullOrderData.notes,
      fullOrderData.product_label,
      fullOrderData.total_price,
      fullOrderData.currency,
      fullOrderData.customer_email,
      fullOrderData.line_items,
      fullOrderData.product_titles,
      fullOrderData.quantities,
      fullOrderData.session_id,
      fullOrderData.store_id,
      fullOrderData.product_type,
      fullOrderData.shopifyOrderData,
      now,
      now
    ).run()

    const newOrder = await this.getOrder(env, tenantId, id)
    if (!newOrder) {
      throw new Error("Failed to create or retrieve order after insertion.")
    }
    return newOrder
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
    
    console.log("[DB-GET] Retrieved order from database:", orderId);
    console.log("[DB-GET] shopify_order_data field exists:", !!result.shopify_order_data);
    if (result.shopify_order_data) {
      try {
        const parsedData = JSON.parse(result.shopify_order_data);
        console.log("[DB-GET] Parsed shopifyOrderData structure:", {
          hasLineItems: !!parsedData?.lineItems,
          hasEdges: !!parsedData?.lineItems?.edges,
          edgesLength: parsedData?.lineItems?.edges?.length,
          firstNodeTitle: parsedData?.lineItems?.edges?.[0]?.node?.title,
          firstNodeVariantTitle: parsedData?.lineItems?.edges?.[0]?.node?.variant?.title,
          orderName: parsedData?.name,
          orderId: parsedData?.id
        });
      } catch (e) {
        console.log("[DB-GET] Failed to parse shopify_order_data:", e);
      }
    }
    
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
      shopifyOrderData: result.shopify_order_data ? JSON.parse(result.shopify_order_data) : undefined,
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
    // PATCH: allow updating shopifyOrderData
    if (updateData.shopifyOrderData !== undefined) {
      console.log("[DB-UPDATE] About to update shopifyOrderData for order:", orderId);
      console.log("[DB-UPDATE] shopifyOrderData structure check:", {
        hasLineItems: !!updateData.shopifyOrderData?.lineItems,
        hasEdges: !!updateData.shopifyOrderData?.lineItems?.edges,
        edgesLength: updateData.shopifyOrderData?.lineItems?.edges?.length,
        firstNodeTitle: updateData.shopifyOrderData?.lineItems?.edges?.[0]?.node?.title,
        firstNodeVariantTitle: updateData.shopifyOrderData?.lineItems?.edges?.[0]?.node?.variant?.title,
        orderName: updateData.shopifyOrderData?.name,
        orderId: updateData.shopifyOrderData?.id,
        dataType: typeof updateData.shopifyOrderData
      });
      fields.push("shopify_order_data = ?")
      const jsonData = updateData.shopifyOrderData ? JSON.stringify(updateData.shopifyOrderData) : null;
      console.log("[DB-UPDATE] JSON data being saved (first 500 chars):", jsonData?.substring(0, 500));
      values.push(jsonData)
    }

    fields.push("updated_at = ?")
    values.push(now)

    if (fields.length === 1) {
      // Only updated_at
      return await d1DatabaseService.getOrder(env, tenantId, orderId)
    }

    values.push(tenantId, orderId)
    const query = `UPDATE tenant_orders SET ${fields.join(", ")} WHERE tenant_id = ? AND id = ?`

    console.log("[DB-UPDATE] Executing query:", query);
    console.log("[DB-UPDATE] Values count:", values.length);

    await env.DB.prepare(query)
      .bind(...values)
      .run()
    
    console.log("[DB-UPDATE] Database update completed for order:", orderId);
    return await d1DatabaseService.getOrder(env, tenantId, orderId)
  },

  // Delete an order
  async deleteOrder(env: any, tenantId: string, orderId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      "DELETE FROM tenant_orders WHERE id = ? AND tenant_id = ?"
    )
      .bind(orderId, tenantId)
      .run()
    return success
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
      ).bind(tenantId).all();

      if (!results) {
        return [];
      }

      return results.map((result: any) => {
        let parsedSettings: any = {};
        try {
          if (result.settings) {
            parsedSettings = JSON.parse(result.settings);
          }
        } catch (e) {
          console.error(`Failed to parse settings for store ${result.id}`, e);
        }

        return {
          id: result.id,
          tenantId: result.tenant_id,
          name: result.shopify_domain,
          type: "shopify",
          status: result.sync_enabled ? "active" : "inactive",
          settings: {
            domain: result.shopify_domain,
            address: result.shopify_domain,
            accessToken: result.access_token,
            apiSecretKey: result.webhook_secret,
            timezone: "UTC",
            currency: "USD",
            businessHours: { start: "09:00", end: "17:00" },
            webhooks: parsedSettings.webhooks || [],
            ...parsedSettings,
          },
          lastSyncAt: result.last_sync_at,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        };
      });
    },

  // Get all stores across all tenants (for webhook processing)
  async getAllStores(env: any): Promise<any[]> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM shopify_stores ORDER BY created_at DESC"
    )
      .all()
    return results.map((result: any) => {
      let settings: any = {}
      try {
        settings = result.settings ? JSON.parse(result.settings) : {}
      } catch (e) {
        console.error(`Failed to parse settings for store ${result.id}`, e)
      }
      return {
        id: result.id,
        tenantId: result.tenant_id,
        name: result.shopify_domain,
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
          webhooks: settings.webhooks || [],
          ...settings,
        },
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      }
    })
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
      settings?: any
    }
  ): Promise<any> {
    const storeId = crypto.randomUUID()
    const now = new Date().toISOString()
    
    // Prepare settings with default values
    const defaultSettings = {
      webhooks: [],
      timezone: "UTC",
      currency: "USD",
      businessHours: { start: "09:00", end: "17:00" },
      ...storeData.settings
    }

    try {
      await env.DB.prepare(
        `INSERT INTO shopify_stores (id, tenant_id, shopify_domain, access_token, webhook_secret, sync_enabled, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          storeId,
          tenantId,
          storeData.shopifyDomain,
          storeData.accessToken,
          storeData.webhookSecret || null,
          storeData.syncEnabled !== false, // Default to true
          JSON.stringify(defaultSettings),
          now,
          now
        )
        .run()
    } catch (error) {
      console.error("Failed to insert store into database:", error)
      throw new Error("Database insertion for store failed.")
    }

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
        ...defaultSettings,
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

    // Parse settings from JSON string, defaulting to empty object
    let settings: any = {}
    try {
      settings = result.settings ? JSON.parse(result.settings) : {}
    } catch (error) {
      console.error('Error parsing store settings:', error)
      settings = {}
    }

    return {
      id: result.id,
      tenantId: result.tenant_id,
      name: result.shopify_domain,
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
        webhooks: settings.webhooks || [],
        ...settings,
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
    if (updateData.settings !== undefined) {
      fields.push("settings = ?")
      values.push(JSON.stringify(updateData.settings))
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
      `SELECT id, tenant_id, shopify_domain as shopifyDomain, access_token as accessToken, webhook_secret as webhookSecret, sync_enabled as syncEnabled, last_sync_at as lastSyncAt, created_at, updated_at FROM shopify_stores WHERE tenant_id = ?`
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
      // First, check if the product already exists
      const existingProduct = await env.DB.prepare(`
        SELECT id FROM saved_products 
        WHERE tenant_id = ? AND shopify_product_id = ? AND shopify_variant_id = ?
      `)
        .bind(tenantId, product.shopifyProductId, product.shopifyVariantId)
        .first()

      const productId = existingProduct?.id || crypto.randomUUID()
      const now = new Date().toISOString()

      // Debug log for product image fields
      console.log('[saveProducts] Saving product:', {
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
        title: product.title,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        imageWidth: product.imageWidth,
        imageHeight: product.imageHeight,
      })

      await env.DB.prepare(`
        INSERT OR REPLACE INTO saved_products (
          id, tenant_id, shopify_product_id, shopify_variant_id, title, variant_title,
          description, price, tags, product_type, vendor, handle, 
          image_url, image_alt, image_width, image_height,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          safeValue(productId),
          safeValue(tenantId),
          safeValue(product.shopifyProductId),
          safeValue(product.shopifyVariantId),
          safeValue(product.title),
          safeValue(product.variantTitle),
          safeValue(product.description),
          safeValue(product.price),
          JSON.stringify(product.tags || []),
          safeValue(product.productType),
          safeValue(product.vendor),
          safeValue(product.handle),
          safeValue(product.imageUrl),
          safeValue(product.imageAlt),
          safeValue(product.imageWidth),
          safeValue(product.imageHeight),
          safeValue(existingProduct ? existingProduct.created_at : now),
          safeValue(now)
        )
        .run()

      console.log('[saveProducts] Successfully saved product to database:', { 
        productId, 
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
        title: product.title,
        imageUrl: product.imageUrl 
      })

      // Verify the product was actually saved by querying the database
      const verificationResult = await env.DB.prepare(`
        SELECT id, title, image_url, image_alt, image_width, image_height 
        FROM saved_products 
        WHERE id = ?
      `)
        .bind(productId)
        .first()

      console.log('[saveProducts] Database verification result:', verificationResult)

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
        createdAt: existingProduct ? existingProduct.created_at : now,
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
    console.log('[getSavedProducts] Fetching products for tenant:', tenantId)
    console.log('[getSavedProducts] Filters:', filters)
    
    let query = `
      SELECT sp.*, 
             GROUP_CONCAT(plm.label_id) as label_ids,
             GROUP_CONCAT(pl.name) as label_names
      FROM saved_products sp
      LEFT JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
      LEFT JOIN product_labels pl ON plm.label_id = pl.id
      WHERE sp.tenant_id = ?
    `
    const params: any[] = [tenantId]

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

    console.log('[getSavedProducts] Executing query:', query)
    console.log('[getSavedProducts] Query parameters:', params)

    const { results } = await env.DB.prepare(query)
      .bind(...params)
      .all()

    console.log('[getSavedProducts] Raw database results count:', results?.length || 0)
    
    if (results && results.length > 0) {
      console.log('[getSavedProducts] Sample raw result:', {
        id: results[0].id,
        title: results[0].title,
        image_url: results[0].image_url,
        image_alt: results[0].image_alt,
        image_width: results[0].image_width,
        image_height: results[0].image_height,
      })
    }

    const mappedResults = results.map((result: any) => ({
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

    console.log('[getSavedProducts] Returning mapped results count:', mappedResults.length)
    if (mappedResults.length > 0) {
      console.log('[getSavedProducts] Sample mapped result:', {
        id: mappedResults[0].id,
        title: mappedResults[0].title,
        imageUrl: mappedResults[0].imageUrl,
        imageAlt: mappedResults[0].imageAlt,
        imageWidth: mappedResults[0].imageWidth,
        imageHeight: mappedResults[0].imageHeight,
      })
    }

    return mappedResults
  },

  async getSavedProductsWithLabels(env: any, tenantId: string): Promise<any[]> {
    const query = `
      SELECT
        p.id, p.shopify_product_id, p.shopify_variant_id,
        (SELECT json_group_array(json_object('id', pl.id, 'name', pl.name, 'category', pl.category))
         FROM product_label_mappings plm
         JOIN product_labels pl ON plm.label_id = pl.id
         WHERE plm.saved_product_id = p.id) as labels
      FROM saved_products p
      WHERE p.tenant_id = ? AND EXISTS (SELECT 1 FROM product_label_mappings plm WHERE plm.saved_product_id = p.id)
    `
    const { results } = await env.DB.prepare(query).bind(tenantId).all()

    return results.map((row: any) => ({
      ...row,
      labels: row.labels ? JSON.parse(row.labels) : [],
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
      "DELETE FROM saved_products WHERE id = ? AND tenant_id = ?"
    )
      .bind(productId, tenantId)
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
             GROUP_CONCAT(pl.category) as label_categories,
             GROUP_CONCAT(pl.color) as label_colors
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
      imageUrl: result.image_url,
      imageAlt: result.image_alt,
      imageWidth: result.image_width,
      imageHeight: result.image_height,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      labelIds: result.label_ids ? result.label_ids.split(",") : [],
      labelNames: result.label_names ? result.label_names.split(",") : [],
      labelCategories: result.label_categories ? result.label_categories.split(",") : [],
      labelColors: result.label_colors ? result.label_colors.split(",") : [],
    }
  },

  // --- AI Flowers Management ---
  async getFlowers(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_flowers WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createFlower(env: any, tenantId: string, flowerData: any): Promise<any> {
    const id = flowerData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_flowers (id, tenant_id, name, variety, color, seasonality, availability, price_range, description, image_url, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      flowerData.name,
      flowerData.variety,
      flowerData.color,
      flowerData.seasonality || null,
      flowerData.availability !== undefined ? flowerData.availability : true,
      flowerData.price_range || null,
      flowerData.description || null,
      flowerData.image_url || null,
      flowerData.is_active !== undefined ? flowerData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getFlower(env, tenantId, id);
  },

  async getFlower(env: any, tenantId: string, flowerId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_flowers WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, flowerId).all();
    return results[0] || null;
  },

  async deleteFlower(env: any, tenantId: string, flowerId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      `DELETE FROM ai_flowers WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, flowerId).run();
    return !!success;
  },

  // --- AI Prompt Templates Management ---
  async getPromptTemplates(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_prompt_templates WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createPromptTemplate(env: any, tenantId: string, promptData: any): Promise<any> {
    const id = promptData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_prompt_templates (id, tenant_id, name, template, variables, category, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      promptData.name,
      promptData.template,
      promptData.variables ? JSON.stringify(promptData.variables) : null,
      promptData.category || 'custom',
      promptData.is_active !== undefined ? promptData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getPromptTemplate(env, tenantId, id);
  },

  async getPromptTemplate(env: any, tenantId: string, promptId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_prompt_templates WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, promptId).all();
    return results[0] || null;
  },

  async deletePromptTemplate(env: any, tenantId: string, promptId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      `DELETE FROM ai_prompt_templates WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, promptId).run();
    return !!success;
  },

  // --- AI Model Configs Management ---
  async getModelConfigs(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_model_configs WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createModelConfig(env: any, tenantId: string, configData: any): Promise<any> {
    const id = configData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_model_configs (id, tenant_id, name, model_type, config_data, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      configData.name,
      configData.model_type || 'dalle3',
      JSON.stringify(configData.config_data || {}),
      configData.is_active !== undefined ? configData.is_active : false,
      now,
      now
    ).run();
    return await this.getModelConfig(env, tenantId, id);
  },

  async getModelConfig(env: any, tenantId: string, configId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_model_configs WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, configId).all();
    return results[0] || null;
  },

  async deleteModelConfig(env: any, tenantId: string, configId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      `DELETE FROM ai_model_configs WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, configId).run();
    return !!success;
  },

  // --- AI Training Data Management ---
  async getAITrainingData(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_training_data WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(tenantId).all();
    return results;
  },

  async createAITrainingData(env: any, tenantId: string, data: any): Promise<any> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_training_data (id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      data.data_type,
      data.content,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.source_type || 'manual',
      data.source_id || null,
      data.quality_score || 0.5,
      data.is_active !== undefined ? data.is_active : true,
      now,
      now
    ).run();
    return await this.getAITrainingDataItem(env, tenantId, id);
  },

  async getAITrainingDataItem(env: any, tenantId: string, dataId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_training_data WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, dataId).all();
    return results[0] || null;
  },

  async extractTrainingDataFromProducts(env: any, tenantId: string): Promise<any[]> {
    try {
      // Get saved products and extract training data (limit to first 50 to avoid API limits)
      const { results: products } = await env.DB.prepare(
        `SELECT * FROM saved_products WHERE tenant_id = ? AND status = 'active' LIMIT 50`
      ).bind(tenantId).all();

      if (products.length === 0) {
        return [];
      }

      // Check for existing training data to avoid duplicates
      const existingSourceIds = await env.DB.prepare(
        `SELECT source_id FROM ai_training_data WHERE tenant_id = ? AND source_type = 'shopify'`
      ).bind(tenantId).all();
      
      const existingIds = new Set(existingSourceIds.results.map((row: any) => row.source_id));
      
      // Filter out products that already have training data
      const newProducts = products.filter((product: any) => !existingIds.has(product.id));
      
      if (newProducts.length === 0) {
        return [];
      }

      // Prepare batch insert data
      const now = new Date().toISOString();
      const trainingDataToInsert = newProducts.map((product: any) => {
        const id = crypto.randomUUID();
        
        // Parse tags from JSON string, with fallback to empty array
        let tags = [];
        try {
          tags = product.tags ? JSON.parse(product.tags) : [];
        } catch (error) {
          console.warn('Failed to parse tags for product:', product.id, error);
          tags = [];
        }

        return {
          id,
          tenant_id: tenantId,
          data_type: 'prompt',
          content: `Create a beautiful ${product.product_type || 'bouquet'} with ${product.title}`,
          metadata: JSON.stringify({
            product_id: product.id,
            product_type: product.product_type,
            vendor: product.vendor,
            tags: tags
          }),
          source_type: 'shopify',
          source_id: product.id,
          quality_score: 0.8,
          is_active: 1,
          created_at: now,
          updated_at: now
        };
      });

      // Use smaller batches (10 at a time) to avoid parameter limits
      const batchSize = 10;
      const insertedData = [];
      
      for (let i = 0; i < trainingDataToInsert.length; i += batchSize) {
        const batch = trainingDataToInsert.slice(i, i + batchSize);
        
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap((data: any) => [
          data.id,
          data.tenant_id,
          data.data_type,
          data.content,
          data.metadata,
          data.source_type,
          data.source_id,
          data.quality_score,
          data.is_active,
          data.created_at,
          data.updated_at
        ]);

        try {
          await env.DB.prepare(
            `INSERT INTO ai_training_data (id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score, is_active, created_at, updated_at)
             VALUES ${placeholders}`
          ).bind(...values).run();
          
          insertedData.push(...batch);
        } catch (batchError) {
          console.error(`Error inserting batch ${i / batchSize + 1}:`, batchError);
          // Continue with next batch instead of failing completely
        }
      }

      // Return the created training data
      return insertedData.map((data: any) => ({
        id: data.id,
        tenant_id: data.tenant_id,
        data_type: data.data_type,
        content: data.content,
        metadata: JSON.parse(data.metadata),
        source_type: data.source_type,
        source_id: data.source_id,
        quality_score: data.quality_score,
        is_active: data.is_active,
        created_at: data.created_at,
        updated_at: data.updated_at
      }));
    } catch (error) {
      console.error('Error extracting training data from products:', error);
      throw new Error(`Failed to extract training data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getAITrainingDataStats(env: any, tenantId: string): Promise<any> {
    // Get counts from various tables
    const [
      { results: products },
      { results: prompts },
      { results: images },
      { results: feedback }
    ] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as count FROM saved_products WHERE tenant_id = ?`).bind(tenantId).all(),
      env.DB.prepare(`SELECT COUNT(*) as count FROM ai_training_data WHERE tenant_id = ? AND data_type = 'prompt'`).bind(tenantId).all(),
      env.DB.prepare(`SELECT COUNT(*) as count FROM ai_training_data WHERE tenant_id = ? AND data_type = 'image'`).bind(tenantId).all(),
      env.DB.prepare(`SELECT COUNT(*) as count FROM ai_training_data WHERE tenant_id = ? AND data_type = 'feedback'`).bind(tenantId).all()
    ]);

    return {
      total_products: products[0]?.count || 0,
      total_prompts: prompts[0]?.count || 0,
      total_images: images[0]?.count || 0,
      total_feedback: feedback[0]?.count || 0,
      quality_distribution: { high: 0, medium: 0, low: 0 },
      source_distribution: { manual: 0, shopify: 0, generated: 0 }
    };
  },

  // --- AI Training Sessions Management ---
  async getAITrainingSessions(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_training_sessions WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(tenantId).all();
    return results;
  },

  async createAITrainingSession(env: any, tenantId: string, sessionData: any): Promise<any> {
    const id = sessionData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_training_sessions (id, tenant_id, model_config_id, session_name, status, training_data_count, training_progress, training_metrics, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      sessionData.model_config_id,
      sessionData.session_name,
      sessionData.status || 'pending',
      sessionData.training_data_count || 0,
      sessionData.training_progress || 0,
      sessionData.training_metrics ? JSON.stringify(sessionData.training_metrics) : null,
      now,
      now
    ).run();
    return await this.getAITrainingSession(env, tenantId, id);
  },

  async getAITrainingSession(env: any, tenantId: string, sessionId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_training_sessions WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, sessionId).all();
    return results[0] || null;
  },

  // --- AI Generated Designs Management ---
  async getAIGeneratedDesigns(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_generated_designs WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(tenantId).all();
    return results;
  },

  async saveAIGeneratedDesign(env: any, tenantId: string, designData: any): Promise<any> {
    const id = designData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_generated_designs (id, tenant_id, session_id, prompt, generated_image_url, generated_image_data, style_parameters, generation_metadata, quality_rating, feedback, is_favorite, is_approved, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      designData.session_id || null,
      designData.prompt,
      designData.generated_image_url || null,
      designData.generated_image_data || null,
      designData.style_parameters ? JSON.stringify(designData.style_parameters) : null,
      designData.generation_metadata ? JSON.stringify(designData.generation_metadata) : null,
      designData.quality_rating || null,
      designData.feedback || null,
      designData.is_favorite !== undefined ? designData.is_favorite : false,
      designData.is_approved !== undefined ? designData.is_approved : false,
      now,
      now
    ).run();
    return await this.getAIGeneratedDesign(env, tenantId, id);
  },

  async getAIGeneratedDesign(env: any, tenantId: string, designId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_generated_designs WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, designId).all();
    return results[0] || null;
  },

  // --- AI Style Templates Management ---
  async getAIStyleTemplates(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_style_templates WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(tenantId).all();
    return results;
  },

  async createAIStyleTemplate(env: any, tenantId: string, templateData: any): Promise<any> {
    const id = templateData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_style_templates (id, tenant_id, name, description, style_parameters, example_images, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      templateData.name,
      templateData.description || null,
      JSON.stringify(templateData.style_parameters || {}),
      templateData.example_images ? JSON.stringify(templateData.example_images) : null,
      templateData.is_active !== undefined ? templateData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getAIStyleTemplate(env, tenantId, id);
  },

  async getAIStyleTemplate(env: any, tenantId: string, templateId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_style_templates WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, templateId).all();
    return results[0] || null;
  },

  // --- AI Usage Analytics Management ---
  async getAIUsageAnalytics(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_usage_analytics WHERE tenant_id = ? ORDER BY date DESC`
    ).bind(tenantId).all();
    return results;
  },

  async recordAIGeneration(env: any, tenantId: string, metadata: any): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];
    
    await env.DB.prepare(
      `INSERT INTO ai_usage_analytics (id, tenant_id, date, model_type, generation_count, total_tokens, total_cost, average_rating, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      today,
      metadata.model_type || 'unknown',
      1,
      metadata.tokens_used || 0,
      metadata.cost || 0,
      metadata.rating || 0,
      now
    ).run();
  },

  // --- AI Styles Management ---
  async getAIStyles(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_styles WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createAIStyle(env: any, tenantId: string, styleData: any): Promise<any> {
    const id = styleData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_styles (id, tenant_id, name, description, color_palette, mood, arrangement_style, flair_elements, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      styleData.name,
      styleData.description || null,
      styleData.color_palette ? JSON.stringify(styleData.color_palette) : null,
      styleData.mood || null,
      styleData.arrangement_style || null,
      styleData.flair_elements ? JSON.stringify(styleData.flair_elements) : null,
      styleData.is_active !== undefined ? styleData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getAIStyle(env, tenantId, id);
  },

  async getAIStyle(env: any, tenantId: string, styleId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_styles WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, styleId).all();
    return results[0] || null;
  },

  async deleteAIStyle(env: any, tenantId: string, styleId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      `DELETE FROM ai_styles WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, styleId).run();
    return !!success;
  },

  // --- AI Arrangement Types Management ---
  async getAIArrangementTypes(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_arrangement_types WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createAIArrangementType(env: any, tenantId: string, typeData: any): Promise<any> {
    const id = typeData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_arrangement_types (id, tenant_id, name, description, category, typical_size, typical_flowers, price_range, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      typeData.name,
      typeData.description || null,
      typeData.category,
      typeData.typical_size || null,
      typeData.typical_flowers || null,
      typeData.price_range || null,
      typeData.is_active !== undefined ? typeData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getAIArrangementType(env, tenantId, id);
  },

  async getAIArrangementType(env: any, tenantId: string, typeId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_arrangement_types WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, typeId).all();
    return results[0] || null;
  },

  async deleteAIArrangementType(env: any, tenantId: string, typeId: string): Promise<boolean> {
    const { success } = await env.DB.prepare(
      `DELETE FROM ai_arrangement_types WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, typeId).run();
    return !!success;
  },

  // --- AI Occasions Management ---
  async getAIOccasions(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_occasions WHERE tenant_id = ? ORDER BY name`
    ).bind(tenantId).all();
    return results;
  },

  async createAIOccasion(env: any, tenantId: string, occasionData: any): Promise<any> {
    const id = occasionData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_occasions (id, tenant_id, name, description, typical_flowers, typical_colors, seasonal_preferences, price_sensitivity, is_active, usage_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      occasionData.name,
      occasionData.description || null,
      occasionData.typical_flowers || null,
      occasionData.typical_colors || null,
      occasionData.seasonal_preferences || null,
      occasionData.price_sensitivity || null,
      occasionData.is_active !== undefined ? occasionData.is_active : true,
      0,
      now,
      now
    ).run();
    return await this.getAIOccasion(env, tenantId, id);
  },

  async getAIOccasion(env: any, tenantId: string, occasionId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_occasions WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, occasionId).all();
    return results[0] || null;
  },

  async deleteAIOccasion(env: any, tenantId: string, occasionId: string): Promise<boolean> {
    const result = await env.DB.prepare(
      `DELETE FROM ai_occasions WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, occasionId).run();
    return result.changes > 0;
  },

  // --- AI Budget Tiers Management ---
  async getAIBudgetTiers(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_budget_tiers WHERE tenant_id = ? ORDER BY min_price ASC`
    ).bind(tenantId).all();
    return results;
  },

  async createAIBudgetTier(env: any, tenantId: string, budgetTierData: any): Promise<any> {
    const id = budgetTierData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_budget_tiers (id, tenant_id, name, min_price, max_price, description, typical_flowers, typical_arrangements, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      budgetTierData.name,
      budgetTierData.min_price || null,
      budgetTierData.max_price || null,
      budgetTierData.description || null,
      budgetTierData.typical_flowers ? JSON.stringify(budgetTierData.typical_flowers) : null,
      budgetTierData.typical_arrangements ? JSON.stringify(budgetTierData.typical_arrangements) : null,
      budgetTierData.is_active !== false ? 1 : 0,
      now,
      now
    ).run();
    return await this.getAIBudgetTier(env, tenantId, id);
  },

  async getAIBudgetTier(env: any, tenantId: string, budgetTierId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_budget_tiers WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, budgetTierId).all();
    return results[0] || null;
  },

  async deleteAIBudgetTier(env: any, tenantId: string, budgetTierId: string): Promise<boolean> {
    const result = await env.DB.prepare(
      `DELETE FROM ai_budget_tiers WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, budgetTierId).run();
    return result.changes > 0;
  },

  // --- AI Customer Data Management ---
  async getAICustomerData(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_customer_data WHERE tenant_id = ? ORDER BY created_at DESC`
    ).bind(tenantId).all();
    return results;
  },

  async createAICustomerData(env: any, tenantId: string, customerDataData: any): Promise<any> {
    const id = customerDataData.id || crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO ai_customer_data (id, tenant_id, customer_id, recipient_name, birthday, anniversary, special_dates, preferences, allergies, favorite_flowers, favorite_colors, budget_preference, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      tenantId,
      customerDataData.customer_id,
      customerDataData.recipient_name || null,
      customerDataData.birthday || null,
      customerDataData.anniversary || null,
      customerDataData.special_dates ? JSON.stringify(customerDataData.special_dates) : null,
      customerDataData.preferences ? JSON.stringify(customerDataData.preferences) : null,
      customerDataData.allergies ? JSON.stringify(customerDataData.allergies) : null,
      customerDataData.favorite_flowers ? JSON.stringify(customerDataData.favorite_flowers) : null,
      customerDataData.favorite_colors ? JSON.stringify(customerDataData.favorite_colors) : null,
      customerDataData.budget_preference || null,
      customerDataData.is_active !== false ? 1 : 0,
      now,
      now
    ).run();
    return await this.getAICustomerDataItem(env, tenantId, id);
  },

  async getAICustomerDataItem(env: any, tenantId: string, customerDataId: string): Promise<any | null> {
    const { results } = await env.DB.prepare(
      `SELECT * FROM ai_customer_data WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, customerDataId).all();
    return results[0] || null;
  },

  async deleteAICustomerData(env: any, tenantId: string, customerDataId: string): Promise<boolean> {
    const result = await env.DB.prepare(
      `DELETE FROM ai_customer_data WHERE tenant_id = ? AND id = ?`
    ).bind(tenantId, customerDataId).run();
    return result.changes > 0;
  },

  // --- Shopify Analytics Methods ---
  async getShopifyAnalytics(env: any, tenantId: string, filters: { dateRange: string, compareWith: string, productType?: string, storeId?: string }): Promise<any> {
    try {
        // Calculate date ranges
        const { startDate, endDate, compareStartDate, compareEndDate } = this.calculateDateRanges(filters.dateRange, filters.compareWith);
        
        let mainWhere = `tenant_id = ? AND created_at >= ? AND created_at <= ?`;
        const mainParams: (string|number)[] = [tenantId, startDate, endDate];
        
        if (filters.productType) {
            mainWhere += ` AND product_type = ?`;
            mainParams.push(filters.productType);
        }
        
        if (filters.storeId) {
            mainWhere += ` AND store_id = ?`;
            mainParams.push(filters.storeId);
        }

        const mainQuery = `
            SELECT
                COUNT(id) AS total_orders,
                SUM(total_price) AS total_revenue,
                AVG(total_price) AS average_order_value,
                COUNT(DISTINCT customer_email) AS unique_customers
            FROM tenant_orders
            WHERE ${mainWhere}
        `;
        
        const mainData: any = await env.DB.prepare(mainQuery).bind(...mainParams).first();

        // Get top products by sales
        const topProductsQuery = `
            SELECT 
                product_titles as product_title,
                SUM(total_price) as total_sales,
                COUNT(*) as order_count
            FROM tenant_orders
            WHERE ${mainWhere}
            GROUP BY product_titles
            ORDER BY total_sales DESC
            LIMIT 10
        `;
        
        const { results: topProducts } = await env.DB.prepare(topProductsQuery).bind(...mainParams).all();

        // Get top occasions (extracted from product_titles or notes)
        const topOccasionsQuery = `
            SELECT 
                CASE 
                    WHEN notes LIKE '%wedding%' OR product_titles LIKE '%wedding%' THEN 'Wedding'
                    WHEN notes LIKE '%birthday%' OR product_titles LIKE '%birthday%' THEN 'Birthday'
                    WHEN notes LIKE '%anniversary%' OR product_titles LIKE '%anniversary%' THEN 'Anniversary'
                    WHEN notes LIKE '%sympathy%' OR product_titles LIKE '%sympathy%' THEN 'Sympathy'
                    WHEN notes LIKE '%congratulations%' OR product_titles LIKE '%congratulations%' THEN 'Congratulations'
                    WHEN notes LIKE '%thank%' OR product_titles LIKE '%thank%' THEN 'Thank You'
                    ELSE 'Other'
                END as occasion,
                COUNT(*) as order_count,
                SUM(total_price) as total_sales
            FROM tenant_orders
            WHERE ${mainWhere}
            GROUP BY occasion
            ORDER BY total_sales DESC
            LIMIT 10
        `;
        
        const { results: topOccasions } = await env.DB.prepare(topOccasionsQuery).bind(...mainParams).all();

        // Get customer segments based on spending
        const customerSegmentsQuery = `
            SELECT 
                CASE 
                    WHEN total_price >= 200 THEN 'High Value'
                    WHEN total_price >= 100 THEN 'Medium Value'
                    ELSE 'Budget'
                END as segment,
                COUNT(DISTINCT customer_email) as customer_count,
                AVG(total_price) as avg_spent
            FROM tenant_orders
            WHERE ${mainWhere}
            GROUP BY segment
            ORDER BY avg_spent DESC
        `;
        
        const { results: customerSegments } = await env.DB.prepare(customerSegmentsQuery).bind(...mainParams).all();

        // Calculate additional metrics
        const returningCustomerRate = mainData.unique_customers > 0 ? 
            ((mainData.total_orders - mainData.unique_customers) / mainData.total_orders * 100) : 0;
        
        const conversionRate = mainData.total_orders > 0 ? 
            (mainData.total_orders / (mainData.total_orders * 1.5) * 100) : 0; // Simplified calculation

        // Comparison data (if requested)
        let comparisonData = null;
        if (filters.compareWith !== 'none' && compareStartDate && compareEndDate) {
            let compareWhere = `tenant_id = ? AND created_at >= ? AND created_at <= ?`;
            const compareParams: (string|number)[] = [tenantId, compareStartDate, compareEndDate];

            if (filters.productType) {
                compareWhere += ` AND product_type = ?`;
                compareParams.push(filters.productType);
            }
            if (filters.storeId) {
                compareWhere += ` AND store_id = ?`;
                compareParams.push(filters.storeId);
            }

            const compareQuery = `
                SELECT
                    COUNT(id) AS total_orders,
                    SUM(total_price) AS total_revenue,
                    AVG(total_price) AS average_order_value
                FROM tenant_orders
                WHERE ${compareWhere}
            `;
            
            comparisonData = await env.DB.prepare(compareQuery).bind(...compareParams).first();
        }

        return {
            dateRange: { start: startDate, end: endDate },
            compareDateRange: { start: compareStartDate, end: compareEndDate },
            metrics: {
                total_orders: mainData.total_orders || 0,
                total_revenue: mainData.total_revenue || 0,
                average_order_value: mainData.average_order_value || 0,
                unique_customers: mainData.unique_customers || 0,
                returning_customer_rate: returningCustomerRate,
                conversion_rate: conversionRate
            },
            top_products_by_sales: topProducts || [],
            top_occasions: topOccasions || [],
            customer_segments: customerSegments || [],
            comparison: comparisonData,
        };
    } catch (e: any) {
        console.error("Error in getShopifyAnalytics:", e.message);
        throw new Error(`D1 Analytics Error: ${e.message}`);
    }
  },

  calculateDateRanges(dateRange: string, compareWith: string): {
    startDate: string;
    endDate: string;
    compareStartDate: string;
    compareEndDate: string;
  } {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    
    let startDate: string;
    let compareStartDate: string;
    let compareEndDate: string;
    
    switch (dateRange) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    const periodDays = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
    
    switch (compareWith) {
      case 'previous':
        compareEndDate = startDate;
        compareStartDate = new Date(new Date(startDate).getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'same_period_last_year':
        compareEndDate = new Date(new Date(endDate).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        compareStartDate = new Date(new Date(startDate).getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        compareStartDate = startDate;
        compareEndDate = endDate;
    }
    
    return { startDate, endDate, compareStartDate, compareEndDate };
  },

  async createTrainingSessionFromAnalytics(env: any, tenantId: string, sessionData: {
    selectedProducts: string[];
    selectedOccasions: string[];
    selectedStyles: string[];
    sessionName: string;
    priority: 'high' | 'medium' | 'low';
    model_config_id?: string;
  }): Promise<any> {
    try {
      const sessionId = crypto.randomUUID();
      const now = new Date().toISOString();
      
      // Create training session
      await env.DB.prepare(
        `INSERT INTO ai_training_sessions (id, tenant_id, model_config_id, session_name, status, training_data_count, training_progress, training_metrics, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        sessionId,
        tenantId,
        sessionData.model_config_id || 'default-dalle3',
        sessionData.sessionName,
        'pending',
        0,
        0,
        JSON.stringify({
          source: 'shopify_analytics',
          selectedProducts: sessionData.selectedProducts,
          selectedOccasions: sessionData.selectedOccasions,
          selectedStyles: sessionData.selectedStyles,
          priority: sessionData.priority
        }),
        now,
        now
      ).run();
      
      // Extract training data from selected products
      if (sessionData.selectedProducts.length > 0) {
        const placeholders = sessionData.selectedProducts.map(() => '?').join(',');
        const { results: products } = await env.DB.prepare(
          `SELECT * FROM saved_products WHERE tenant_id = ? AND id IN (${placeholders})`
        ).bind(tenantId, ...sessionData.selectedProducts).all();
        
        // Create training data entries
        for (const product of products) {
          const trainingDataId = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO ai_training_data (id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            trainingDataId,
            tenantId,
            'prompt',
            `Create a beautiful ${product.product_type || 'bouquet'} with ${product.title}`,
            JSON.stringify({
              product_id: product.id,
              product_type: product.product_type,
              vendor: product.vendor,
              session_id: sessionId,
              priority: sessionData.priority
            }),
            'shopify_analytics',
            product.id,
            0.9, // High quality score for analytics-selected data
            1,
            now,
            now
          ).run();
        }
        
        // Update session with training data count
        await env.DB.prepare(
          `UPDATE ai_training_sessions SET training_data_count = ? WHERE id = ?`
        ).bind(products.length, sessionId).run();
      }
      
      return await this.getAITrainingSession(env, tenantId, sessionId);
    } catch (error) {
      console.error('Error creating training session from analytics:', error);
      throw new Error(`Failed to create training session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // --- Camera Widget Templates ---
  async getCameraWidgetTemplates(env: any, tenantId: string): Promise<any[]> {
    const { results } = await env.DB.prepare(
      "SELECT * FROM camera_widget_templates WHERE tenant_id = ?"
    ).bind(tenantId).all();
    return results.map((r: any) => ({ ...r, fields: JSON.parse(r.fields || '{}')}));
  },

  async createCameraWidgetTemplate(env: any, tenantId: string, template: any): Promise<any> {
    const id = crypto.randomUUID();
    const { name, description, fields } = template;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO camera_widget_templates (id, tenant_id, name, description, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, tenantId, name, description, JSON.stringify(fields), now, now).run();
    return { id, tenant_id: tenantId, ...template };
  },

  async updateCameraWidgetTemplate(env: any, tenantId: string, templateId: string, template: any): Promise<any> {
    const { name, description, fields } = template;
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE camera_widget_templates SET name = ?, description = ?, fields = ?, updated_at = ? WHERE id = ? AND tenant_id = ?"
    ).bind(name, description, JSON.stringify(fields), now, templateId, tenantId).run();
    return { id: templateId, ...template };
  },

  async deleteCameraWidgetTemplate(env: any, tenantId: string, templateId: string): Promise<{ success: boolean }> {
    const { success } = await env.DB.prepare(
      "DELETE FROM camera_widget_templates WHERE id = ? AND tenant_id = ?"
    ).bind(templateId, tenantId).run();
    return { success };
  },
};

// ===== PHOTO UPLOAD DATABASE METHODS =====

export async function getFloristPhotos(
  env: any,
  tenantId: string,
  filters?: {
    photo_id?: string;
    status?: string;
    date_range?: { start: string; end: string };
    user_id?: string;
  }
): Promise<any[]> {
  let query = `
    SELECT fpu.*, pd.title, pd.description, pd.style, pd.occasion, pd.arrangement_type
    FROM florist_photo_uploads fpu
    LEFT JOIN photo_descriptions pd ON fpu.id = pd.photo_id
    WHERE fpu.tenant_id = ?
  `
  const params = [tenantId]
  
  if (filters?.photo_id) {
    query += " AND fpu.id = ?"
    params.push(filters.photo_id)
  }
  
  if (filters?.status) {
    query += " AND fpu.upload_status = ?"
    params.push(filters.status)
  }
  
  if (filters?.user_id) {
    query += " AND fpu.user_id = ?"
    params.push(filters.user_id)
  }
  
  if (filters?.date_range) {
    query += " AND fpu.created_at BETWEEN ? AND ?"
    params.push(filters.date_range.start, filters.date_range.end)
  }
  
  query += " ORDER BY fpu.created_at DESC"
  
  const { results } = await env.DB.prepare(query).bind(...params).all()
  return results
}

export async function getFloristPhoto(
  env: any,
  tenantId: string,
  photoId: string
): Promise<any | null> {
  const { results } = await env.DB.prepare(`
    SELECT fpu.*, pd.*, pqa.*
    FROM florist_photo_uploads fpu
    LEFT JOIN photo_descriptions pd ON fpu.id = pd.photo_id
    LEFT JOIN photo_quality_assessment pqa ON fpu.id = pqa.photo_id
    WHERE fpu.id = ? AND fpu.tenant_id = ?
  `).bind(photoId, tenantId).all()
  
  return results[0] || null
}

export async function createFloristPhoto(
  env: any,
  tenantId: string,
  userId: string,
  photoData: {
    original_filename: string;
    original_file_size: number;
    compressed_file_size: number;
    image_url: string;
    thumbnail_url?: string;
    image_metadata?: Record<string, any>;
  }
): Promise<any> {
  const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const { results } = await env.DB.prepare(`
    INSERT INTO florist_photo_uploads (
      id, tenant_id, user_id, original_filename, original_file_size,
      compressed_file_size, image_url, thumbnail_url, image_metadata, upload_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    photoId,
    tenantId,
    userId,
    photoData.original_filename,
    photoData.original_file_size,
    photoData.compressed_file_size,
    photoData.image_url,
    photoData.thumbnail_url || null,
    JSON.stringify(photoData.image_metadata || {}),
    'uploaded'
  ).all()
  
  return results[0]
}

export async function updatePhotoDescription(
  env: any,
  tenantId: string,
  photoId: string,
  userId: string,
  descriptionData: {
    title: string;
    description: string;
    flowers_used?: string[];
    colors?: string[];
    style?: string;
    occasion?: string;
    arrangement_type?: string;
    difficulty_level?: string;
    special_techniques?: string[];
    materials_used?: string[];
    customer_preferences?: string;
    price_range?: string;
    season?: string;
    tags?: string[];
    is_public?: boolean;
  }
): Promise<any> {
  // Check if description already exists
  const existing = await env.DB.prepare(`
    SELECT id FROM photo_descriptions WHERE photo_id = ?
  `).bind(photoId).first()
  
  if (existing) {
    // Update existing description
    const { results } = await env.DB.prepare(`
      UPDATE photo_descriptions SET
        title = ?, description = ?, flowers_used = ?, colors = ?, style = ?,
        occasion = ?, arrangement_type = ?, difficulty_level = ?, special_techniques = ?,
        materials_used = ?, customer_preferences = ?, price_range = ?, season = ?,
        tags = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
      WHERE photo_id = ?
      RETURNING *
    `).bind(
      descriptionData.title,
      descriptionData.description,
      JSON.stringify(descriptionData.flowers_used || []),
      JSON.stringify(descriptionData.colors || []),
      descriptionData.style,
      descriptionData.occasion,
      descriptionData.arrangement_type,
      descriptionData.difficulty_level,
      JSON.stringify(descriptionData.special_techniques || []),
      JSON.stringify(descriptionData.materials_used || []),
      descriptionData.customer_preferences,
      descriptionData.price_range,
      descriptionData.season,
      JSON.stringify(descriptionData.tags || []),
      descriptionData.is_public ? 1 : 0,
      photoId
    ).all()
    
    return results[0]
  } else {
    // Create new description
    const descId = `desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const { results } = await env.DB.prepare(`
      INSERT INTO photo_descriptions (
        id, photo_id, tenant_id, user_id, title, description, flowers_used,
        colors, style, occasion, arrangement_type, difficulty_level,
        special_techniques, materials_used, customer_preferences, price_range,
        season, tags, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      descId,
      photoId,
      tenantId,
      userId,
      descriptionData.title,
      descriptionData.description,
      JSON.stringify(descriptionData.flowers_used || []),
      JSON.stringify(descriptionData.colors || []),
      descriptionData.style,
      descriptionData.occasion,
      descriptionData.arrangement_type,
      descriptionData.difficulty_level,
      JSON.stringify(descriptionData.special_techniques || []),
      JSON.stringify(descriptionData.materials_used || []),
      descriptionData.customer_preferences,
      descriptionData.price_range,
      descriptionData.season,
      JSON.stringify(descriptionData.tags || []),
      descriptionData.is_public ? 1 : 0
    ).all()
    
    return results[0]
  }
}

export async function assessPhotoQuality(
  env: any,
  tenantId: string,
  photoId: string,
  userId: string,
  assessmentData: {
    technical_quality: number;
    composition_quality: number;
    design_quality: number;
    training_value: number;
    quality_notes?: string;
    improvement_suggestions?: string;
    is_approved_for_training: boolean;
  }
): Promise<any> {
  const overallScore = (
    assessmentData.technical_quality +
    assessmentData.composition_quality +
    assessmentData.design_quality +
    assessmentData.training_value
  ) / 4
  
  const qaId = `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const { results } = await env.DB.prepare(`
    INSERT OR REPLACE INTO photo_quality_assessment (
      id, photo_id, tenant_id, assessed_by, technical_quality, composition_quality,
      design_quality, training_value, overall_score, quality_notes,
      improvement_suggestions, is_approved_for_training, assessment_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    RETURNING *
  `).bind(
    qaId,
    photoId,
    tenantId,
    userId,
    assessmentData.technical_quality,
    assessmentData.composition_quality,
    assessmentData.design_quality,
    assessmentData.training_value,
    overallScore,
    assessmentData.quality_notes,
    assessmentData.improvement_suggestions,
    assessmentData.is_approved_for_training ? 1 : 0
  ).all()
  
  // Update photo status based on approval
  const newStatus = assessmentData.is_approved_for_training ? 'approved' : 'rejected'
  await env.DB.prepare(`
    UPDATE florist_photo_uploads SET upload_status = ? WHERE id = ?
  `).bind(newStatus, photoId).run()
  
  return results[0]
}

export async function createTrainingDataFromPhoto(
  env: any,
  tenantId: string,
  photoId: string,
  extractionData: {
    prompt: string;
    style_parameters: Record<string, any>;
    quality_score?: number;
    confidence_score?: number;
  }
): Promise<any> {
  // Get photo data
  const photo = await getFloristPhoto(env, tenantId, photoId)
  if (!photo) {
    throw new Error("Photo not found")
  }
  
  if (!photo.is_approved_for_training) {
    throw new Error("Photo must be approved for training before creating training data")
  }
  
  // Create training data record
  const trainingDataId = `td_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  const { results: trainingResults } = await env.DB.prepare(`
    INSERT INTO ai_training_data (
      id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    trainingDataId,
    tenantId,
    'image',
    JSON.stringify({
      prompt: extractionData.prompt,
      style_parameters: extractionData.style_parameters,
      image_url: photo.image_url
    }),
    JSON.stringify({
      photo_id: photoId,
      original_filename: photo.original_filename,
      upload_date: photo.created_at
    }),
    'photo_upload',
    photoId,
    extractionData.quality_score || 1.0
  ).all()
  
  // Create mapping between photo and training data
  const mappingId = `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  await env.DB.prepare(`
    INSERT INTO photo_training_mapping (
      id, photo_id, training_data_id, mapping_type, confidence_score
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(
    mappingId,
    photoId,
    trainingDataId,
    'example',
    extractionData.confidence_score || 1.0
  ).run()
  
  return trainingResults[0]
}

export async function getDailyUploadGoal(
  env: any,
  tenantId: string,
  userId: string,
  date: string
): Promise<any | null> {
  const goal = await env.DB.prepare(`
    SELECT * FROM daily_upload_goals 
    WHERE tenant_id = ? AND user_id = ? AND date = ?
  `).bind(tenantId, userId, date).first()
  
  if (!goal) {
    // Create default goal if none exists
    const defaultGoal = {
      id: `goal_${tenantId}_${userId}_${date}`,
      tenant_id: tenantId,
      user_id: userId,
      date: date,
      target_count: 1,
      actual_count: 0,
      goal_status: 'pending',
      streak_count: 0
    }
    
    await env.DB.prepare(`
      INSERT INTO daily_upload_goals (
        id, tenant_id, user_id, date, target_count, actual_count, goal_status, streak_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      defaultGoal.id,
      defaultGoal.tenant_id,
      defaultGoal.user_id,
      defaultGoal.date,
      defaultGoal.target_count,
      defaultGoal.actual_count,
      defaultGoal.goal_status,
      defaultGoal.streak_count
    ).run()
    
    return defaultGoal
  }
  
  return goal
}

export async function updateDailyUploadGoal(
  env: any,
  tenantId: string,
  userId: string,
  date: string,
  actualCount: number
): Promise<any> {
  const { results } = await env.DB.prepare(`
    INSERT OR REPLACE INTO daily_upload_goals (
      id, tenant_id, user_id, date, actual_count, goal_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, 
      CASE 
        WHEN ? >= COALESCE((SELECT target_count FROM daily_upload_goals WHERE tenant_id = ? AND user_id = ? AND date = ?), 1)
        THEN 'completed'
        ELSE 'in_progress'
      END,
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `).bind(
    `goal_${tenantId}_${userId}_${date}`,
    tenantId,
    userId,
    date,
    actualCount,
    actualCount,
    tenantId, userId, date
  ).all()
  
  return results[0]
}

export async function getUploadStatistics(
  env: any,
  tenantId: string,
  userId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = `
    SELECT * FROM upload_statistics 
    WHERE tenant_id = ? AND user_id = ?
  `
  const params = [tenantId, userId]
  
  if (dateRange) {
    query += " AND date BETWEEN ? AND ?"
    params.push(dateRange.start, dateRange.end)
  }
  
  query += " ORDER BY date DESC"
  
  const { results } = await env.DB.prepare(query).bind(...params).all()
  return results
}
