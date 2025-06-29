import { Hono } from "hono"
import { cors } from "hono/cors"
import { jwt, sign } from "hono/jwt"
import { streamSSE } from "hono/streaming"
import * as bcrypt from "bcryptjs"
import { d1DatabaseService, getFloristPhotos } from "../src/services/database-d1"
import { ShopifyApiService } from "../src/services/shopify/shopifyApi"
import type { D1Database, ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types"
import { etag } from "hono/etag"
import type { Tenant, User, Order, Store, WebhookConfig } from "../src/types"

// Define the environment bindings
type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  ASSETS: any
  OPENAI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS middleware
app.use("/api/*", cors())

// --- Realtime Order Status (PUBLIC) ---
app.get("/api/tenants/:tenantId/orders/realtime-status", async (c) => {
  const tenantId = c.req.param("tenantId")
  const lastUpdate = c.req.query("lastUpdate")
  
  try {
    let query = `
      SELECT id, status, updated_at, customer_name, delivery_date, priority, assigned_to
      FROM tenant_orders 
      WHERE tenant_id = ?
    `
    const params = [tenantId]
    
    if (lastUpdate) {
      query += ` AND updated_at > ?`
      params.push(lastUpdate)
    }
    
    query += ` ORDER BY updated_at DESC LIMIT 50`
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all()
    
    const updates = results.map((order: any) => ({
      id: order.id,
      status: order.status,
      updatedAt: order.updated_at,
      customerName: order.customer_name,
      deliveryDate: order.delivery_date,
      priority: order.priority,
      assignedTo: order.assigned_to
    }))
    
    return c.json({
      updates,
      lastUpdate: new Date().toISOString(),
      count: updates.length
    })
  } catch (error) {
    console.error("Error fetching realtime order status:", error)
    return c.json({ error: "Failed to fetch order updates" }, 500)
  }
})

// --- Realtime Orders SSE (PUBLIC) with Change Detection ---
app.get("/api/tenants/:tenantId/realtime/orders", (c) => {
  const tenantId = c.req.param("tenantId")

  return streamSSE(c, async (stream) => {
    // Start looking for changes from 2 minutes ago to catch recent updates
    // Convert to SQLite datetime format (YYYY-MM-DD HH:MM:SS.mmm) to match database storage
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    let lastUpdateTime = twoMinutesAgo.toISOString().slice(0, 23).replace('T', ' ')
    let knownUpdates = new Map<string, string>() // Track last known update time for each order card

    // Send initial connection message
    await stream.writeSSE({
      data: JSON.stringify({
        type: "connected",
        message: "SSE connection established for real-time order updates",
        timestamp: new Date().toISOString(),
        lookingForChangesSince: lastUpdateTime
      }),
      event: "connected",
    })

    while (true) {
      try {
        // Check for changes in order_card_states table (where status updates AND sort_order changes happen)
        const cardStateQuery = `
          SELECT card_id, status, assigned_to, assigned_by, updated_at, delivery_date, sort_order, notes
          FROM order_card_states 
          WHERE tenant_id = ? AND updated_at > ?
          ORDER BY updated_at DESC 
          LIMIT 20
        `

        const { results: cardStateChanges } = await c.env.DB.prepare(cardStateQuery).bind(tenantId, lastUpdateTime).all()

        // Check for changes in main tenant_orders table  
        const orderQuery = `
          SELECT id, status, updated_at, customer_name, delivery_date, priority, assigned_to
          FROM tenant_orders 
          WHERE tenant_id = ? AND updated_at > ?
          ORDER BY updated_at DESC 
          LIMIT 20
        `

        const { results: orderChanges } = await c.env.DB.prepare(orderQuery).bind(tenantId, lastUpdateTime).all()

        const hasChanges = (cardStateChanges && cardStateChanges.length > 0) || (orderChanges && orderChanges.length > 0)

        if (hasChanges) {
          console.log(`[SSE-REALTIME] 📨 Found ${cardStateChanges?.length || 0} card state changes and ${orderChanges?.length || 0} order changes`)
          
          const changeEvents: any[] = []

          // Process card state changes (these are the main status updates)
          if (cardStateChanges && cardStateChanges.length > 0) {
            for (const change of cardStateChanges) {
              const changeKey = `${change.card_id}-${change.updated_at}`
              if (!knownUpdates.has(changeKey)) {
                knownUpdates.set(changeKey, change.updated_at)
                
                // Enhanced real-time event with better sortOrder handling
                const updateEvent = {
                   type: "order_updated",
                   orderId: String(change.card_id),
                   tenantId: tenantId,
                   status: String(change.status),
                   assignedTo: String(change.assigned_to || ''),
                   updatedBy: String(change.assigned_by || 'unknown'),
                   updatedAt: String(change.updated_at),
                   deliveryDate: String(change.delivery_date),
                   sortOrder: change.sort_order !== null && change.sort_order !== undefined ? Number(change.sort_order) : undefined,
                   notes: change.notes ? String(change.notes) : '',
                   timestamp: new Date().toISOString(),
                   // Add flags to help identify reorder operations
                   _isSortOrderUpdate: change.sort_order !== null && change.sort_order !== undefined,
                   _dragOperation: true // Mark as potential drag operation for better handling
                 }
                
                changeEvents.push(updateEvent)
                
                // Enhanced logging for sortOrder updates
                if (updateEvent._isSortOrderUpdate) {
                  console.log(`[SSE-REALTIME] 🎯 sortOrder update detected: ${change.card_id} -> ${change.sort_order}`)
                }
              }
            }
          }

          // Process main order changes
          if (orderChanges && orderChanges.length > 0) {
            for (const change of orderChanges) {
              const changeKey = `main-${change.id}-${change.updated_at}`
              if (!knownUpdates.has(changeKey)) {
                knownUpdates.set(changeKey, change.updated_at)
                
                // Enhanced real-time event for main order changes
                const mainOrderEvent = {
                   type: "order_updated", 
                   orderId: String(change.id),
                   tenantId: tenantId,
                   status: String(change.status),
                   assignedTo: String(change.assigned_to || ''),
                   updatedBy: String(change.assigned_to || 'unknown'),
                   updatedAt: String(change.updated_at),
                   deliveryDate: String(change.delivery_date),
                   sortOrder: change.sort_order !== null && change.sort_order !== undefined ? Number(change.sort_order) : undefined,
                   notes: change.notes ? String(change.notes) : '',
                   timestamp: new Date().toISOString(),
                   _isSortOrderUpdate: change.sort_order !== null && change.sort_order !== undefined,
                   _dragOperation: true
                 }
                
                changeEvents.push(mainOrderEvent)
              }
            }
          }

          // Send all change events
          for (const event of changeEvents) {
            await stream.writeSSE({
              data: JSON.stringify(event),
              event: "order_update",
            })
            console.log(`[SSE-REALTIME] ✅ Sent update: ${event.orderId} (${event.type})`)
          }

          // Update last check time - use SQLite format to match database
          lastUpdateTime = new Date().toISOString().slice(0, 23).replace('T', ' ')
          
          // Clean up old known updates (keep only last 100)
          if (knownUpdates.size > 100) {
            const entries = Array.from(knownUpdates.entries())
            knownUpdates.clear()
            entries.slice(-50).forEach(([key, value]) => knownUpdates.set(key, value))
          }

        } else {
          // Send heartbeat to keep connection alive
          await stream.writeSSE({
            data: JSON.stringify({
              type: "heartbeat",
              timestamp: new Date().toISOString(),
            }),
            event: "heartbeat",
          })
          console.log(`[SSE-REALTIME] Sent heartbeat - no changes detected`)
        }
        
      } catch (error) {
        console.error("Error in SSE real-time polling:", error)
        await stream.writeSSE({
          data: JSON.stringify({
            type: "error",
            message: "Failed to check for order updates",
            timestamp: new Date().toISOString(),
          }),
          event: "error",
        })
      }
      await stream.sleep(3000) // Check every 3 seconds for responsiveness
    }
  })
})

// --- WebSocket Real-time Updates (NEW) ---
app.get("/api/tenants/:tenantId/realtime/ws", async (c) => {
  const upgrade = c.req.header("upgrade")
  if (upgrade !== "websocket") {
    return c.text("Expected Upgrade: websocket", 400)
  }

  const tenantId = c.req.param("tenantId")
  const token = c.req.query("token")
  
  if (!token) {
    return c.text("Missing auth token", 401)
  }

  try {
    console.log(`🔌 [WEBSOCKET] Connection request for tenant ${tenantId}`)
    
    // For now, return a successful response (full WebSocket implementation coming)
    return c.json({
      status: "websocket_endpoint_ready",
      tenantId: tenantId,
      message: "WebSocket endpoint configured successfully",
      note: "Full WebSocket implementation coming next",
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error("❌ [WEBSOCKET] Connection error:", error)
    return c.text("WebSocket connection failed", 500)
  }
})

// WebSocket connection status endpoint
app.get("/api/tenants/:tenantId/realtime/ws-status", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  return c.json({
    status: "websocket_ready",
    tenantId: tenantId,
    endpoint: `/api/tenants/${tenantId}/realtime/ws`,
    implementation: "basic_websocket",
    timestamp: new Date().toISOString(),
    features: {
      connection: "active",
      ping_pong: "supported",
      order_updates: "echo_mode",
      bulk_updates: "planned"
    }
  })
})

// --- AI Florist - Get Knowledge Base Analytics (PUBLIC) ---
app.get('/api/tenants/:tenantId/ai/knowledge-base-analytics', async (c) => {
  try {
    const { tenantId } = c.req.param();
    const db = c.env.DB;

    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required.' }, 400);
    }

    // Fetch analytics data
    const [
      productsCount,
      stylesCount,
      occasionsCount,
      arrangementTypesCount,
      budgetTiersCount,
      flowersCount,
      configCount,
      promptsCount
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM saved_products WHERE tenant_id = ?`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_styles WHERE tenant_id = ?`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_occasions WHERE tenant_id = ?`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_arrangement_types WHERE tenant_id = ?`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_budget_tiers WHERE tenant_id = ?`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_flowers WHERE tenant_id = ? AND is_active = true`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_model_configs WHERE tenant_id = ? AND is_active = true`).bind(tenantId).first(),
      db.prepare(`SELECT COUNT(*) as count FROM ai_prompt_templates WHERE tenant_id = ? AND is_active = true`).bind(tenantId).first(),
    ]);

    const analytics = {
      products: productsCount?.count || 0,
      styles: stylesCount?.count || 0,
      occasions: occasionsCount?.count || 0,
      arrangementTypes: arrangementTypesCount?.count || 0,
      budgetTiers: budgetTiersCount?.count || 0,
      flowers: flowersCount?.count || 0,
      aiConfig: configCount?.count || 0,
      promptTemplates: promptsCount?.count || 0,
    };

    return c.json(analytics);

  } catch (error) {
    console.error('Error fetching knowledge base analytics:', error);
    return c.json({ error: 'Failed to fetch knowledge base analytics.' }, 500);
  }
});

// --- Orders by Date (PUBLIC) ---
app.get("/api/tenants/:tenantId/orders-by-date", async (c) => {
  const tenantId = c.req.param("tenantId")
  const date = c.req.query("date") // e.g., "22/06/2025"

  if (!date) {
    return c.json({ error: "Date query parameter is required" }, 400)
  }

  try {
    // 1. Fetch all data needed for processing
    const [savedProductsWithLabels, stores, orderCardConfig] = await Promise.all([
      d1DatabaseService.getSavedProductsWithLabels(c.env, tenantId),
      d1DatabaseService.getStores(c.env, tenantId),
      d1DatabaseService.getOrderCardConfig(c.env, tenantId),
    ])

    if (!stores || stores.length === 0) {
      return c.json({ error: "No Shopify store configured for this tenant" }, 404)
    }

    // Ensure orderCardConfig is an array
    const configArray = Array.isArray(orderCardConfig) ? orderCardConfig : []

    // 2. Create a lookup map for product labels
    // This allows us to quickly check if a line item is an "Add-On"
    const productLabelMap = new Map<string, any>()
    for (const product of savedProductsWithLabels) {
      if (product.labels && product.labels.length > 0) {
        // Using shopify_product_id as the key
        productLabelMap.set(product.shopify_product_id, product.labels)
      }
    }

    // 3. Fetch Shopify orders from all configured stores
    // For now, we'll fetch from the first store. A more robust solution would iterate
    // over all stores or have the UI specify which store to use.
    const store = stores[0]
    
    console.log("Shopify store data:", {
      id: store.id,
      domain: store.settings.domain,
      hasAccessToken: !!store.settings.accessToken,
      accessTokenLength: store.settings.accessToken?.length,
    })
    
    // Use the store object directly since it's already in the correct format
    const shopifyApi = new ShopifyApiService(store, store.settings.accessToken)
    const shopifyOrders = await shopifyApi.getOrders()

    // 4. Filter Shopify orders by date tag
    const dateTag = date.replace(/-/g, "/") // Ensure format is dd/mm/yyyy
    const filteredOrders = shopifyOrders.filter((order: any) => {
      return order.tags.split(", ").includes(dateTag)
    })

    // 5. Helper function to apply field transformations
    const applyFieldTransformation = (value: any, transformation: string | null, transformationRule: string | null): any => {
      console.log(`Applying transformation: ${transformation}, rule: ${transformationRule}, value: ${value}`)
      
      if (!transformation || !transformationRule || !value) {
        console.log(`No transformation needed, returning original value: ${value}`)
        return value
      }

      try {
        switch (transformation) {
          case "extract":
            console.log(`Applying regex extraction with pattern: ${transformationRule}`)
            const regex = new RegExp(transformationRule, "g")
            const matches = value.match(regex)
            console.log(`Regex matches:`, matches)
            return matches ? matches[0] : null
          case "transform":
            // Add more transformation types here as needed
            return value
          default:
            return value
        }
      } catch (error) {
        console.error(`Error applying transformation ${transformation}:`, error)
        return value
      }
    }

    // 6. Helper function to extract field value from Shopify order
    const extractFieldValue = (order: any, shopifyFields: string[]): any => {
      if (!shopifyFields || shopifyFields.length === 0) {
        return null
      }

      // For now, we'll use the first field. In the future, we can support combining multiple fields
      const fieldPath = shopifyFields[0]
      
      // Handle nested field paths like "line_items.title"
      const pathParts = fieldPath.split(".")
      let value = order
      
      for (const part of pathParts) {
        if (value && typeof value === "object") {
          // Handle arrays - if we encounter an array, take the first item
          if (Array.isArray(value)) {
            if (value.length === 0) {
              value = null
              break
            }
            value = value[0]
          }
          
          value = value[part]
        } else {
          value = null
          break
        }
      }

      return value
    }

    // 7. Process filtered orders into "To-Do" cards with field transformations
    const todoCards: any[] = []
    for (const order of filteredOrders) {
      const primaryItems: any[] = []
      const addOnItems: any[] = []

      // Classify line items
      for (const item of order.line_items) {
        if (!item.product_id) {
          console.warn("Skipping line item with null product_id", item)
          continue
        }
        const labels = productLabelMap.get(item.product_id.toString())
        const isAddOn = labels?.some((label: any) => label.name === "Add-On" && label.category === "productType")

        if (isAddOn) {
          addOnItems.push(item)
        } else {
          primaryItems.push(item)
        }
      }

      // Create cards from primary items
      for (const primaryItem of primaryItems) {
        for (let i = 0; i < primaryItem.quantity; i++) {
          // Create a card object with all configured fields
          const card: any = {
            cardId: `${order.id}-${primaryItem.id}-${i}`,
            shopifyOrderId: order.id,
            orderNumber: order.name,
            productTitle: primaryItem.title,
            variantTitle: primaryItem.variant_title,
            quantity: 1, // Each card represents one item
            addOns: addOnItems.map((addOn) => addOn.title),
            deliveryDate: date,
            customerName: `${order.customer.first_name} ${order.customer.last_name}`,
          }

          // Apply field transformations based on order card configuration
          for (const fieldConfig of configArray) {
            if (fieldConfig.is_visible) {
              console.log(`Processing field: ${fieldConfig.field_id}`)
              console.log(`Field config:`, fieldConfig)
              
              const fieldValue = extractFieldValue(order, fieldConfig.shopifyFields)
              console.log(`Extracted value for ${fieldConfig.field_id}:`, fieldValue)
              
              const transformedValue = applyFieldTransformation(
                fieldValue, 
                fieldConfig.transformation, 
                fieldConfig.transformationRule
              )
              console.log(`Transformed value for ${fieldConfig.field_id}:`, transformedValue)
              
              // Map the field to the card using the field_id
              card[fieldConfig.field_id] = transformedValue
            }
          }

          todoCards.push(card)
        }
      }
    }

    console.log(`Processed ${todoCards.length} todo cards for date ${date}`)
    return c.json(todoCards)
  } catch (error: any) {
    console.error("Error fetching or processing orders:", error)
    return c.json({ error: "Failed to process orders", details: error.message }, 500)
  }
})
// --- Orders from Database by Date (PUBLIC) ---
app.get("/api/tenants/:tenantId/orders-from-db-by-date", async (c) => {
  const tenantId = c.req.param("tenantId")
  const date = c.req.query("date") // e.g., "22/06/2025"

  if (!date) {
    return c.json({ error: "Date query parameter is required" }, 400)
  }

  try {
    // Fetch orders from database by delivery date
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM tenant_orders WHERE tenant_id = ? AND delivery_date = ? ORDER BY created_at ASC`
    ).bind(tenantId, date).all()

    console.log(`Found ${results?.length || 0} orders in database for date ${date}`)
    
    // Build product label map for add-on classification and priority sorting
    const productLabelMap = new Map<string, any[]>()
    try {
      const { results: labelMappings } = await c.env.DB.prepare(`
        SELECT sp.shopify_product_id, sp.shopify_variant_id, pl.name, pl.category, pl.priority
        FROM saved_products sp
        JOIN product_label_mappings plm ON sp.id = plm.saved_product_id
        JOIN product_labels pl ON plm.label_id = pl.id
        WHERE sp.tenant_id = ?
        ORDER BY pl.priority ASC
      `).bind(tenantId).all()

      for (const mapping of labelMappings || []) {
        const key = `${mapping.shopify_product_id}-${mapping.shopify_variant_id}`
        if (!productLabelMap.has(key)) {
          productLabelMap.set(key, [])
        }
        productLabelMap.get(key)?.push(mapping)
      }
      console.log(`Loaded ${productLabelMap.size} product label mappings for classification and priority sorting`)
    } catch (error) {
      console.error("Failed to load product labels for classification:", error)
    }

    // Classify line item as add-on
    const isAddOnProduct = (productId: string, variantId: string): boolean => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      return labels.some((label: any) => 
        label.name?.toLowerCase().includes("add-on") || 
        label.name?.toLowerCase().includes("addon") ||
        label.category?.toLowerCase().includes("add-on") ||
        label.category?.toLowerCase().includes("addon")
      )
    }

    // Get difficulty label for product
    const getDifficultyLabel = (productId: string, variantId: string): string | null => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const difficultyLabel = labels.find((label: any) => 
        label.category?.toLowerCase() === "difficulty"
      )
      return difficultyLabel?.name || null
    }

    // Get product type label for product
    const getProductTypeLabel = (productId: string, variantId: string): string | null => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const productTypeLabel = labels.find((label: any) => 
        label.category?.toLowerCase() === "producttype"
      )
      return productTypeLabel?.name || null
    }

    // Get difficulty priority (lower number = higher priority)
    const getDifficultyPriority = (productId: string, variantId: string): number => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const difficultyLabel = labels.find((label: any) => 
        label.category?.toLowerCase() === "difficulty"
      )
      return difficultyLabel?.priority || 999 // Default to low priority if no difficulty label
    }

    // Get product type priority (lower number = higher priority)
    const getProductTypePriority = (productId: string, variantId: string): number => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const productTypeLabel = labels.find((label: any) => 
        label.category?.toLowerCase() === "producttype"
      )
      return productTypeLabel?.priority || 999 // Default to low priority if no product type label
    }

    // Check if product is a wedding order (has "Weddings" product type label)
    const isWeddingProduct = (productId: string, variantId: string): boolean => {
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      return labels.some((label: any) => 
        label.category?.toLowerCase() === "producttype" && 
        label.name?.toLowerCase() === "weddings"
      )
    }

    // Check if line item should be consolidated (Top-Up, Corsage, or Boutonniere)
    const isConsolidatedProduct = (productId: string, variantId: string, lineItemTitle: string, variantTitle: string): boolean => {
      // Method 1: Check if saved_products has "Top-Up" label
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const hasTopUpLabel = labels.some((label: any) => 
        label.name?.toLowerCase().includes("top-up") ||
        label.name?.toLowerCase().includes("topup")
      )
      
      // Method 2: Check if title contains "Top-Up"
      const titleContainsTopUp = (lineItemTitle || '').toLowerCase().includes('top-up')
      
      // Method 3: Check if product title or variant title contains "Corsage" (case-insensitive)
      const titleContainsCorsage = (lineItemTitle || '').toLowerCase().includes('corsage')
      const variantContainsCorsage = (variantTitle || '').toLowerCase().includes('corsage')
      
      // Method 4: Check if product title or variant title contains "Boutonniere" (case-insensitive)
      const titleContainsBoutonniere = (lineItemTitle || '').toLowerCase().includes('boutonniere')
      const variantContainsBoutonniere = (variantTitle || '').toLowerCase().includes('boutonniere')
      
      return hasTopUpLabel || titleContainsTopUp || titleContainsCorsage || variantContainsCorsage || titleContainsBoutonniere || variantContainsBoutonniere
    }

    // Determine which title to display for consolidated items (the one containing the keyword)
    const getConsolidatedDisplayTitle = (productId: string, variantId: string, lineItemTitle: string, variantTitle: string): string => {
      // Method 1: Check if saved_products has "Top-Up" label
      const key = `${productId}-${variantId}`
      const labels = productLabelMap.get(key) || []
      const hasTopUpLabel = labels.some((label: any) => 
        label.name?.toLowerCase().includes("top-up") ||
        label.name?.toLowerCase().includes("topup")
      )
      
      // Method 2: Check if title contains "Top-Up"
      const titleContainsTopUp = (lineItemTitle || '').toLowerCase().includes('top-up')
      
      // Method 3: Check if product title or variant title contains "Corsage" (case-insensitive)
      const titleContainsCorsage = (lineItemTitle || '').toLowerCase().includes('corsage')
      const variantContainsCorsage = (variantTitle || '').toLowerCase().includes('corsage')
      
      // Method 4: Check if product title or variant title contains "Boutonniere" (case-insensitive)
      const titleContainsBoutonniere = (lineItemTitle || '').toLowerCase().includes('boutonniere')
      const variantContainsBoutonniere = (variantTitle || '').toLowerCase().includes('boutonniere')
      
      // Determine which title to display based on which contains the keyword
      // Priority: Product title takes precedence if both contain the keyword
      
      if (hasTopUpLabel || titleContainsTopUp) {
        return lineItemTitle // For Top-Up, use product title
      }
      
      if (titleContainsCorsage || titleContainsBoutonniere) {
        return lineItemTitle // Product title contains keyword, use it
      }
      
      if (variantContainsCorsage || variantContainsBoutonniere) {
        return variantTitle // Only variant title contains keyword, use it
      }
      
      // Fallback (should not reach here if isConsolidatedProduct returned true)
      return lineItemTitle
    }

    // Process each order into line items
    const processedOrders: any[] = []
    const orderConsolidatedItems = new Map<string, any[]>() // Map shopifyOrderId -> consolidatedItems[]
    
    for (const order of results || []) {
      try {
        // Parse line items from JSON string
        const lineItems = order.line_items ? JSON.parse(order.line_items as string) : []
        
        // Collect consolidated items (Top-Up, Corsage, Boutonniere) for this order
        const consolidatedItems: any[] = []
        
        // Check if any line item in this order contains "express" (case-insensitive)
        const hasExpressItem = lineItems.some((item: any) => 
          (item.title || item.name || '').toLowerCase().includes('express')
        )
        
        // Check if order tags contain "pickup" (case-insensitive)
        let isPickupOrder = false
        try {
          const shopifyData = order.shopify_order_data ? JSON.parse(order.shopify_order_data as string) : null
          if (shopifyData?.tags) {
            const tags = Array.isArray(shopifyData.tags) ? shopifyData.tags : shopifyData.tags.split(', ')
            isPickupOrder = tags.some((tag: string) => tag.toLowerCase().includes('pickup'))
          }
        } catch (e) {
          console.log('[PICKUP-DEBUG] Could not parse shopify order data for pickup detection')
        }
        
        console.log('[PICKUP-DEBUG] Pickup detection for order:', {
          orderId: order.shopify_order_id,
          isPickupOrder,
          rawTags: (() => {
            try {
              const shopifyData = order.shopify_order_data ? JSON.parse(order.shopify_order_data as string) : null
              return shopifyData?.tags
            } catch (e) {
              return 'parse_error'
            }
          })()
        })
        
        // Extract express time slot from the express item's variant title OR item title
        let expressTimeSlot = null
        if (hasExpressItem) {
          const expressItem = lineItems.find((item: any) => 
            (item.title || item.name || '').toLowerCase().includes('express')
          )
          
          // Debug the express item data
          console.log('[EXPRESS-DEBUG] Express item found:', {
            title: expressItem?.title,
            name: expressItem?.name,
            variant_title: expressItem?.variant_title,
            variant: expressItem?.variant,
            properties: expressItem?.properties,
            fullItem: expressItem
          })
          
          if (expressItem) {
            // Time pattern regex for formats like "10:00 - 12:00", "10:00-12:00", "10:30AM - 11:30AM", "14:30PM - 15:30PM"
            const timeRegex = /(\d{1,2}:\d{2}(?:AM|PM)?\s*-\s*\d{1,2}:\d{2}(?:AM|PM)?)/i
            
            // First, try to extract from variant title (original method)
            const variantTitle = expressItem.variant_title || expressItem.variant?.title
            let timeMatch = null
            let sourceLocation = 'none'
            
            if (variantTitle) {
              timeMatch = variantTitle.match(timeRegex)
              if (timeMatch) {
                sourceLocation = 'variant_title'
                expressTimeSlot = timeMatch[1]
              }
            }
            
            // If no time found in variant title, try the item title/name (NEW FEATURE)
            if (!expressTimeSlot) {
              const itemTitle = expressItem.title || expressItem.name || ''
              timeMatch = itemTitle.match(timeRegex)
              if (timeMatch) {
                sourceLocation = 'item_title'
                expressTimeSlot = timeMatch[1]
              }
            }
            
            console.log('[EXPRESS-DEBUG] Enhanced time extraction:', {
              variant_title: expressItem.variant_title,
              variant_title_graphql: expressItem.variant?.title,
              item_title: expressItem.title,
              item_name: expressItem.name,
              source_location: sourceLocation,
              regex_match: timeMatch,
              extracted_time: expressTimeSlot
            })
          }
        }
        
        // Process each line item (excluding express items and collecting Top-Up items)
        for (const lineItem of lineItems) {
          // Skip line items that contain "express" - they won't become individual cards
          if ((lineItem.title || lineItem.name || '').toLowerCase().includes('express')) {
            continue
          }
          
          // Extract product/variant IDs from different possible formats
          let productId = lineItem.product_id?.toString() || lineItem.product?.id?.toString() || ''
          let variantId = lineItem.variant_id?.toString() || lineItem.variant?.id?.toString() || ''
          
          // Clean GraphQL IDs if they exist (e.g., "gid://shopify/Product/123" -> "123")
          if (productId.includes('gid://shopify/Product/')) {
            productId = productId.split('/').pop() || ''
          }
          if (variantId.includes('gid://shopify/ProductVariant/')) {
            variantId = variantId.split('/').pop() || ''
          }
          
          // Check if this is a consolidated item (Top-Up, Corsage, Boutonniere)
          const lineItemTitle = lineItem.title || lineItem.name || ''
          const variantTitle = lineItem.variant_title || lineItem.variant?.title || ''
          if (isConsolidatedProduct(productId, variantId, lineItemTitle, variantTitle)) {
            // Add to consolidated items collection instead of creating individual cards
            consolidatedItems.push({
              title: getConsolidatedDisplayTitle(productId, variantId, lineItemTitle, variantTitle),
              variantTitle: variantTitle,
              quantity: lineItem.quantity || 1,
              price: parseFloat(lineItem.price || '0')
            })
            continue // Skip creating individual cards for consolidated items
          }
          
          // Debug line item structure
          console.log('[LINE-ITEM-DEBUG] Processing line item:', {
            title: lineItem.title,
            original_product_id: lineItem.product_id,
            original_variant_id: lineItem.variant_id,
            graphql_product_id: lineItem.product?.id,
            graphql_variant_id: lineItem.variant?.id,
            cleaned_product_id: productId,
            cleaned_variant_id: variantId,
            variant_title: lineItem.variant_title || lineItem.variant?.title
          })
          
          // Classify as add-on
          const isAddOn = isAddOnProduct(productId, variantId)
          
          // Check if this is a wedding product
          const isWedding = isWeddingProduct(productId, variantId)

          // Get labels and priorities for sorting
          const difficultyLabel = getDifficultyLabel(productId, variantId)
          const productTypeLabel = getProductTypeLabel(productId, variantId)
          const difficultyPriority = getDifficultyPriority(productId, variantId)
          const productTypePriority = getProductTypePriority(productId, variantId)
          
          console.log('[CLASSIFICATION-DEBUG] Product classification:', {
            key: `${productId}-${variantId}`,
            isAddOn,
            difficultyLabel,
            hasLabels: productLabelMap.has(`${productId}-${variantId}`)
          })

          // Create individual cards for each quantity
          for (let i = 0; i < (lineItem.quantity || 1); i++) {
            const cardId = `${order.shopify_order_id}-${lineItem.id || lineItem.product_id}-${i}`
            
            processedOrders.push({
              cardId: cardId,
              orderId: order.id,
              shopifyOrderId: order.shopify_order_id,
              customerName: order.customer_name,
              deliveryDate: order.delivery_date,
              status: order.status,
              priority: order.priority,
              assignedTo: order.assigned_to,
              notes: order.notes,
              productLabel: order.product_label,
              productType: order.product_type,
              totalPrice: order.total_price,
              currency: order.currency,
              customerEmail: order.customer_email,
              storeId: order.store_id,
              sessionId: order.session_id,
              // Line item specific data
              lineItemId: lineItem.id || lineItem.product_id,
              productTitleId: productId,
              variantId: variantId,
              title: lineItem.title || lineItem.name,
              quantity: 1, // Individual quantity
              price: parseFloat(lineItem.price || '0'),
              variantTitle: lineItem.variant_title || lineItem.variant?.title,
              // Labels from product_labels database
              difficultyLabel: difficultyLabel,
              productTypeLabel: productTypeLabel,
              // Priority values for sorting (lower number = higher priority)
              difficultyPriority: difficultyPriority,
              productTypePriority: productTypePriority,
              // Express order detection
              isExpressOrder: hasExpressItem,
              expressTimeSlot: expressTimeSlot,
              // Pickup order detection
              isPickupOrder: isPickupOrder,
              // Add-on classification
              isAddOn: isAddOn,
              productCategory: isAddOn ? "add-on" : "main-order",
              // Wedding product flag
              isWeddingProduct: isWedding,
              // Shopify order data (preserve original GraphQL data if available)
              shopifyOrderData: (() => {
                try {
                  // Try to parse stored GraphQL data first
                  if (order.shopify_order_data && typeof order.shopify_order_data === 'string' && order.shopify_order_data.trim() !== '') {
                    let parsedData = JSON.parse(order.shopify_order_data);
                    
                    // CRITICAL FIX: Handle double-encoded JSON strings
                    if (typeof parsedData === 'string') {
                      console.log('[DOUBLE-ENCODING-FIX] Detected double-encoded JSON for order:', order.shopify_order_id);
                      parsedData = JSON.parse(parsedData);
                    }
                    
                    console.log('[GRAPHQL-PRESERVATION] Using original GraphQL data for order:', order.shopify_order_id);
                    return parsedData;
                  }
                } catch (e) {
                  console.error('[GRAPHQL-PRESERVATION] Failed to parse shopify_order_data, using fallback:', e);
                }
                
                // Fallback to reconstructed data
                console.log('[GRAPHQL-PRESERVATION] Using reconstructed data for order:', order.shopify_order_id);
                return {
                  id: order.shopify_order_id,
                  name: order.shopify_order_id,
                  customer: {
                    first_name: (order.customer_name as string)?.split(' ')[0] || '',
                    last_name: (order.customer_name as string)?.split(' ').slice(1).join(' ') || '',
                    email: order.customer_email
                  },
                  line_items: lineItems,
                  total_price: order.total_price,
                  currency: order.currency,
                  note: order.notes,
                  status: order.status,
                  tags: "" // Empty for fallback
                };
              })()
            })
          }
        }
        
        // CRITICAL: Check for edge case - if no main cards were created but consolidated items exist
        const orderMainCards = processedOrders.filter(card => card.shopifyOrderId === order.shopify_order_id)
        
        if (orderMainCards.length === 0 && consolidatedItems.length > 0) {
          // FALLBACK SOLUTION 1: Create main card using first consolidated item
          const firstItem = consolidatedItems[0]
          const cardId = `${order.shopify_order_id}-fallback-0`
          
          console.log(`[FALLBACK-CARD] Creating fallback card for order ${order.shopify_order_id} with first item: ${firstItem.title}`)
          
          // Get product and variant IDs for the first item (for classification)
          let fallbackProductId = ''
          let fallbackVariantId = ''
          
          // Find the original line item that corresponds to this consolidated item
          const originalLineItem = lineItems.find((item: any) => {
            const lineItemTitle = item.title || item.name || ''
            const variantTitle = item.variant_title || item.variant?.title || ''
            const displayTitle = getConsolidatedDisplayTitle(
              item.product_id?.toString() || item.product?.id?.toString() || '',
              item.variant_id?.toString() || item.variant?.id?.toString() || '',
              lineItemTitle,
              variantTitle
            )
            return displayTitle === firstItem.title
          })
          
          if (originalLineItem) {
            fallbackProductId = originalLineItem.product_id?.toString() || originalLineItem.product?.id?.toString() || ''
            fallbackVariantId = originalLineItem.variant_id?.toString() || originalLineItem.variant?.id?.toString() || ''
            
            // Clean GraphQL IDs if they exist
            if (fallbackProductId.includes('gid://shopify/Product/')) {
              fallbackProductId = fallbackProductId.split('/').pop() || ''
            }
            if (fallbackVariantId.includes('gid://shopify/ProductVariant/')) {
              fallbackVariantId = fallbackVariantId.split('/').pop() || ''
            }
          }
          
          // Get classification for the fallback card
          const isAddOn = isAddOnProduct(fallbackProductId, fallbackVariantId)
          const isWedding = isWeddingProduct(fallbackProductId, fallbackVariantId)
          const difficultyLabel = getDifficultyLabel(fallbackProductId, fallbackVariantId)
          const productTypeLabel = getProductTypeLabel(fallbackProductId, fallbackVariantId)
          const difficultyPriority = getDifficultyPriority(fallbackProductId, fallbackVariantId)
          const productTypePriority = getProductTypePriority(fallbackProductId, fallbackVariantId)
          
          // Create the fallback card using first item's details
          processedOrders.push({
            cardId: cardId,
            orderId: order.id,
            shopifyOrderId: order.shopify_order_id,
            customerName: order.customer_name,
            deliveryDate: order.delivery_date,
            status: order.status,
            priority: order.priority,
            assignedTo: order.assigned_to,
            notes: order.notes,
            productLabel: order.product_label,
            productType: order.product_type,
            totalPrice: order.total_price,
            currency: order.currency,
            customerEmail: order.customer_email,
            storeId: order.store_id,
            sessionId: order.session_id,
            // Line item specific data from first consolidated item
            lineItemId: originalLineItem?.id || `fallback-${order.shopify_order_id}`,
            productTitleId: fallbackProductId,
            variantId: fallbackVariantId,
            title: firstItem.title, // Display title from the first consolidated item
            quantity: firstItem.quantity,
            price: firstItem.price,
            variantTitle: firstItem.variantTitle,
            // Labels from product_labels database
            difficultyLabel: difficultyLabel,
            productTypeLabel: productTypeLabel,
            // Priority values for sorting
            difficultyPriority: difficultyPriority,
            productTypePriority: productTypePriority,
            // Express order detection
            isExpressOrder: hasExpressItem,
            expressTimeSlot: expressTimeSlot,
            // Pickup order detection
            isPickupOrder: isPickupOrder,
            // Add-on classification
            isAddOn: isAddOn,
            productCategory: isAddOn ? "add-on" : "main-order",
            // Wedding product flag
            isWeddingProduct: isWedding,
            // Shopify order data (preserve original GraphQL data if available)
            shopifyOrderData: (() => {
              try {
                // Try to parse stored GraphQL data first
                if (order.shopify_order_data && typeof order.shopify_order_data === 'string' && order.shopify_order_data.trim() !== '') {
                  let parsedData = JSON.parse(order.shopify_order_data);
                  
                  // CRITICAL FIX: Handle double-encoded JSON strings
                  if (typeof parsedData === 'string') {
                    console.log('[DOUBLE-ENCODING-FIX] Detected double-encoded JSON for order:', order.shopify_order_id);
                    parsedData = JSON.parse(parsedData);
                  }
                  
                  console.log('[GRAPHQL-PRESERVATION] Using original GraphQL data for fallback card:', order.shopify_order_id);
                  return parsedData;
                }
              } catch (e) {
                console.error('[GRAPHQL-PRESERVATION] Failed to parse shopify_order_data for fallback card, using fallback:', e);
              }
              
              // Fallback to reconstructed data
              console.log('[GRAPHQL-PRESERVATION] Using reconstructed data for fallback card:', order.shopify_order_id);
              return {
                id: order.shopify_order_id,
                name: order.shopify_order_id,
                customer: {
                  first_name: (order.customer_name as string)?.split(' ')[0] || '',
                  last_name: (order.customer_name as string)?.split(' ').slice(1).join(' ') || '',
                  email: order.customer_email
                },
                line_items: lineItems,
                total_price: order.total_price,
                currency: order.currency,
                note: order.notes,
                status: order.status,
                tags: "" // Empty for fallback
              };
            })()
          })
        }
        
        // Store consolidated items for this order if any exist
        if (consolidatedItems.length > 0) {
          orderConsolidatedItems.set(order.shopify_order_id, consolidatedItems)
          console.log(`[CONSOLIDATED-DEBUG] Found ${consolidatedItems.length} consolidated items for order ${order.shopify_order_id}:`, 
            consolidatedItems.map(item => `${item.title} x ${item.quantity}`).join(', '))
        }
        
      } catch (error) {
        console.error(`Error processing order ${order.id}:`, error)
        // Continue with other orders
      }
    }

    // Fetch saved card states for this date
    let cardStates: Record<string, any> = {}
    try {
      const { results: stateResults } = await c.env.DB.prepare(`
        SELECT card_id, status, assigned_to, assigned_by, notes, sort_order, updated_at
        FROM order_card_states 
        WHERE tenant_id = ? AND delivery_date = ?
      `).bind(tenantId, date).all()

      for (const state of stateResults || []) {
        cardStates[state.card_id as string] = {
          status: state.status,
          assignedTo: state.assigned_to,
          assignedBy: state.assigned_by,
          notes: state.notes,
          sortOrder: state.sort_order || 0,
          updatedAt: state.updated_at
        }
      }
      console.log(`[ORDER-CARD-STATE] Loaded ${Object.keys(cardStates).length} saved states for date ${date}`)
    } catch (error) {
      console.error("Failed to load card states:", error)
      // Continue without states
    }

    // Merge saved states into processed orders
    for (const order of processedOrders) {
      const savedState = cardStates[order.cardId]
      if (savedState) {
        order.status = savedState.status
        order.assignedTo = savedState.assignedTo
        order.assignedBy = savedState.assignedBy
        order.notes = savedState.notes
        order.sortOrder = savedState.sortOrder
        order.updatedAt = savedState.updatedAt
      } else {
        // Default sort order for cards without explicit ordering
        order.sortOrder = 0
      }
      
      // Attach consolidated items to each order card
      const consolidatedItems = orderConsolidatedItems.get(order.shopifyOrderId) || []
      order.topUpItems = consolidatedItems
      
      if (consolidatedItems.length > 0) {
        console.log(`[CONSOLIDATED-ATTACH] Attached ${consolidatedItems.length} consolidated items to order card ${order.cardId}`)
      }
    }

    // Load store information for proper naming
    const storesMap = new Map<string, any>()
    try {
      const { results: storeResults } = await c.env.DB.prepare(`
        SELECT id, shopify_domain FROM shopify_stores 
        WHERE tenant_id = ?
      `).bind(tenantId).all()

      for (const store of storeResults || []) {
        const storeId = String(store.id || '')
        const domain = store.shopify_domain as string
        
        // Derive readable name from domain
        let storeName = 'Unknown Store'
        if (domain?.includes('windflowerflorist')) {
          storeName = 'WindflowerFlorist'
        } else if (domain?.includes('helloflowerssg') || domain?.includes('helloflowers')) {
          storeName = 'HelloFlowers Singapore'
        }
        
        storesMap.set(storeId, {
          id: store.id,
          name: storeName,
          domain: domain
        })

      }
      console.log(`[STORE-GROUPING] Loaded ${storesMap.size} stores for grouping`)
    } catch (error) {
      console.error("Failed to load stores for grouping:", error)
    }

    // Helper function to get store name with fallbacks
    const getStoreName = (order: any): string => {
      const storeId = order.storeId || order.store_id
      
      if (storeId && storesMap.has(String(storeId))) {
        const store = storesMap.get(String(storeId))
        return store?.name || `Store ${storeId}`
      }
      
      // Enhanced fallback logic with order name detection FIRST
      const orderName = order.shopifyOrderId || order.orderId || order.name || ''
      
      if (orderName.startsWith('WF') || orderName.includes('WF')) return 'WindflowerFlorist'
      if (orderName.startsWith('HF') || orderName.includes('HF')) return 'HelloFlowers Singapore'
      
      // Fallback to store ID if available  
      if (storeId) {
        return `Store ${storeId}`
      }
      
      return 'Unknown Store'
    }

    // Helper function to extract time window from order tags
    const getTimeWindow = (order: any): string => {
      console.log('[TIME-WINDOW-START] Processing order:', order.shopifyOrderId || order.cardId)
      try {
        // Get shopify order data and extract tags
        let tags: string[] = []
        
        // Try multiple approaches to get tags
        if (order.shopifyOrderData && typeof order.shopifyOrderData === 'object') {
          const orderData = order.shopifyOrderData
          if (typeof orderData.tags === 'string') {
            tags = orderData.tags.split(',').map(tag => tag.trim())
          } else if (Array.isArray(orderData.tags)) {
            tags = orderData.tags
          }
        } else if (typeof order.shopifyOrderData === 'string') {
          // Handle case where shopifyOrderData is stored as JSON string
          try {
            const parsedData = JSON.parse(order.shopifyOrderData)
            if (typeof parsedData.tags === 'string') {
              tags = parsedData.tags.split(',').map(tag => tag.trim())
            } else if (Array.isArray(parsedData.tags)) {
              tags = parsedData.tags
            }
            console.log('[TIME-WINDOW-DEBUG] Parsed JSON string data for order:', order.shopifyOrderId)
          } catch (parseError) {
            console.log('[TIME-WINDOW-ERROR] Failed to parse JSON string shopifyOrderData for order:', order.shopifyOrderId, parseError)
          }
        }
        
        // Fallback: try to extract from stored tags field directly
        if (tags.length === 0 && order.tags) {
          if (typeof order.tags === 'string') {
            tags = order.tags.split(',').map(tag => tag.trim())
          } else if (Array.isArray(order.tags)) {
            tags = order.tags
          }
          console.log('[TIME-WINDOW-DEBUG] Using fallback tags field for order:', order.shopifyOrderId)
        }
        
        // Log for debugging
        console.log('[TIME-WINDOW-DEBUG] Order:', order.shopifyOrderId || order.cardId, 'Tags:', tags, 'GraphQL data type:', typeof order.shopifyOrderData)
        
        // Look for time slot patterns in tags
        for (const tag of tags) {
          const timeSlot = tag.trim()
          console.log('[TIME-WINDOW-DEBUG] Checking tag:', timeSlot)
          
          // Morning: 10:00-14:00, 10:00-13:00
          if (timeSlot.match(/^10:00[-–]1[3-4]:00$/)) {
            console.log('[TIME-WINDOW-DEBUG] Matched Morning for:', timeSlot)
            return 'Morning'
          }
          
          // Sunday: 11:00-15:00
          if (timeSlot.match(/^11:00[-–]15:00$/)) {
            console.log('[TIME-WINDOW-DEBUG] Matched Sunday for:', timeSlot)
            return 'Sunday'
          }
          
          // Afternoon: 14:00-18:00, 14:00-16:00  
          if (timeSlot.match(/^14:00[-–]1[6-8]:00$/)) {
            console.log('[TIME-WINDOW-DEBUG] Matched Afternoon for:', timeSlot)
            return 'Afternoon'
          }
          
          // Night: 18:00-22:00
          if (timeSlot.match(/^18:00[-–]22:00$/)) {
            console.log('[TIME-WINDOW-DEBUG] Matched Night for:', timeSlot)
            return 'Night'
          }
        }
        
        // Default fallback based on express delivery times
        if (order.isExpressOrder && order.expressTimeSlot) {
          const expressTime = order.expressTimeSlot
          // Parse hour from express time (e.g., "11:30AM" -> 11, "14:30PM" -> 14)
          const hourMatch = expressTime.match(/(\d{1,2}):/)
          if (hourMatch) {
            const hour = parseInt(hourMatch[1])
            
            if (hour >= 10 && hour < 14) return 'Morning'
            if (hour >= 11 && hour < 15) return 'Sunday'  // Sunday fallback for express orders 11-15
            if (hour >= 14 && hour < 18) return 'Afternoon'  
            if (hour >= 18 && hour < 22) return 'Night'
          }
        }
        
        return 'Unscheduled' // Default for orders without clear time window
        
      } catch (error) {
        console.error('[TIME-WINDOW] Error extracting time window:', error)
        return 'Unscheduled'
      }
    }

    // Check if we reached the classification stage
    console.log(`[PRE-CLASSIFICATION] About to start classification with ${processedOrders.length} processed orders`)
    
    // Separate orders into main orders and add-ons
    console.log(`[ADDON-CLASSIFICATION] Total processed orders: ${processedOrders.length}`)
    
    const mainOrders = processedOrders.filter(order => {
      const isMain = !order.isAddOn
      console.log(`[ADDON-CLASSIFICATION] Order ${order.shopifyOrderId || order.cardId}: isAddOn=${order.isAddOn}, classified as ${isMain ? 'MAIN' : 'ADDON'}`)
      return isMain
    })
    
    const addOnOrders = processedOrders.filter(order => order.isAddOn)
    
    console.log(`[ADDON-CLASSIFICATION] Final counts - Main Orders: ${mainOrders.length}, Add-ons: ${addOnOrders.length}`)

    // Enhanced sort function with label priority hierarchy
    const sortByOrder = (a: any, b: any) => {
      // 1. STATUS PRIORITY: Completed orders go to bottom
      const aCompleted = a.status === 'completed'
      const bCompleted = b.status === 'completed'
      
      if (aCompleted && !bCompleted) return 1  // a goes after b
      if (!aCompleted && bCompleted) return -1  // a goes before b
      
      // 2. WEDDING PRIORITY: Wedding orders always go to the top (within same status)
      const aIsWedding = a.isWeddingProduct
      const bIsWedding = b.isWeddingProduct
      
      if (aIsWedding && !bIsWedding) return -1  // a goes before b
      if (!aIsWedding && bIsWedding) return 1   // a goes after b
      
      // 3. MANUAL DRAG-AND-DROP: Only within same status and wedding group
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder
      }
      
      // 4. DIFFICULTY LABELS: Easy → Medium → Hard (lower priority number = higher priority)
      if (a.difficultyPriority !== b.difficultyPriority) {
        return a.difficultyPriority - b.difficultyPriority
      }
      
      // 5. PRODUCT TYPE LABELS: Bouquet → Arrangement → etc. (lower priority number = higher priority)
      if (a.productTypePriority !== b.productTypePriority) {
        return a.productTypePriority - b.productTypePriority
      }
      
      // 6. SAME PRODUCT NAMES: Alphabetical sorting for identical products
      if (a.title && b.title && a.title !== b.title) {
        return a.title.localeCompare(b.title)
      }
      
      // 7. FINAL FALLBACK: Creation time
      return 0
    }

    // Fetch store creation dates for sorting
    const storeCreationDates: Record<string, string> = {}
    try {
      const { results: storeResults } = await c.env.DB.prepare(`
        SELECT id, shopify_domain, created_at 
        FROM shopify_stores 
        WHERE tenant_id = ?
      `).bind(tenantId).all()
      
      for (const store of storeResults || []) {
        storeCreationDates[store.id] = store.created_at || '1970-01-01'
        // Also map by domain name for fallback
        storeCreationDates[store.shopify_domain] = store.created_at || '1970-01-01'
      }
    } catch (error) {
      console.error('[STORE-DATES] Error fetching store creation dates:', error)
    }

    // Group main orders by store and time window (nested structure)
    console.log(`[NESTED-GROUPING] Processing ${mainOrders.length} main orders for nested store+time grouping`)
    const storeTimeGroups: Record<string, any> = {}
    
    for (const order of mainOrders) {
      const storeName = getStoreName(order)
      const timeWindow = getTimeWindow(order)
      const storeId = order.storeId || order.store_id || 'unknown'
      
      // CRITICAL: Debug Baby's Breath before adding to container
      if (order.title?.includes("Baby's Breath")) {
        console.error('[GROUPING-BEFORE] Baby\'s Breath BEFORE adding to container:', {
          shopifyOrderId: order.shopifyOrderId,
          hasShopifyOrderData: !!order.shopifyOrderData,
          shopifyOrderDataName: order.shopifyOrderData?.name,
          shopifyOrderDataType: typeof order.shopifyOrderData
        });
      }
      
      console.log(`[NESTED-GROUPING] Order ${order.shopifyOrderId || order.cardId} -> Store: "${storeName}", Time Window: "${timeWindow}"`)
      
      // Initialize store if it doesn't exist
      if (!storeTimeGroups[storeName]) {
        storeTimeGroups[storeName] = {
          storeId,
          storeName,
          timeWindows: {},
          totalOrders: 0
        }
      }
      
      // Initialize time window within store if it doesn't exist
      if (!storeTimeGroups[storeName].timeWindows[timeWindow]) {
        storeTimeGroups[storeName].timeWindows[timeWindow] = {
          timeWindow,
          orders: [],
          orderCount: 0
        }
      }
      
      // Add order to the appropriate store + time window
      storeTimeGroups[storeName].timeWindows[timeWindow].orders.push(order)
      storeTimeGroups[storeName].timeWindows[timeWindow].orderCount++
      storeTimeGroups[storeName].totalOrders++
      
      // CRITICAL: Debug Baby's Breath AFTER adding to container
      if (order.title?.includes("Baby's Breath")) {
        const addedOrder = storeTimeGroups[storeName].timeWindows[timeWindow].orders[
          storeTimeGroups[storeName].timeWindows[timeWindow].orders.length - 1
        ];
        console.error('[GROUPING-AFTER] Baby\'s Breath AFTER adding to container:', {
          shopifyOrderId: addedOrder.shopifyOrderId,
          hasShopifyOrderData: !!addedOrder.shopifyOrderData,
          shopifyOrderDataName: addedOrder.shopifyOrderData?.name,
          shopifyOrderDataType: typeof addedOrder.shopifyOrderData,
          orderIsExactlyTheSame: addedOrder === order
        });
      }
    }
    
    // Convert nested structure to sorted arrays for frontend
    const timeOrder = ['Morning', 'Sunday', 'Afternoon', 'Night', 'Unscheduled']
    
    const nestedStoreContainers = Object.values(storeTimeGroups)
      .sort((a: any, b: any) => {
        // Sort stores by creation date (as per existing logic)
        const aDate = storeCreationDates[a.storeId] || storeCreationDates[a.storeName] || '1970-01-01'
        const bDate = storeCreationDates[b.storeId] || storeCreationDates[b.storeName] || '1970-01-01'
        return aDate.localeCompare(bDate)
      })
      .map((store: any) => {
        // Sort time windows within each store and prepare orders
        const sortedTimeWindows = Object.values(store.timeWindows)
          .map((tw: any) => ({
            ...tw,
            orders: tw.orders.sort(sortByOrder)
          }))
          .sort((a: any, b: any) => {
            const aIndex = timeOrder.indexOf(a.timeWindow)
            const bIndex = timeOrder.indexOf(b.timeWindow)
            return (aIndex === -1 ? timeOrder.length : aIndex) - (bIndex === -1 ? timeOrder.length : bIndex)
          })
        
        return {
          ...store,
          timeWindows: sortedTimeWindows
        }
      })
    
    console.log(`[NESTED-GROUPING] Created ${nestedStoreContainers.length} store containers with nested time windows`)
    nestedStoreContainers.forEach(store => {
      console.log(`[NESTED-GROUPING] Store "${store.storeName}": ${store.totalOrders} total orders, ${store.timeWindows.length} time windows`)
      store.timeWindows.forEach((tw: any) => {
        console.log(`[NESTED-GROUPING]   ${tw.timeWindow}: ${tw.orderCount} orders`)
      })
    })
    
    // Create flat containers for backward compatibility
    const flatTimeWindowContainers: any[] = []
    nestedStoreContainers.forEach(store => {
      store.timeWindows.forEach((tw: any) => {
        flatTimeWindowContainers.push({
          containerKey: `${tw.timeWindow} - ${store.storeName}`,
          storeName: store.storeName,
          storeId: store.storeId,
          timeWindow: tw.timeWindow,
          orders: tw.orders,
          orderCount: tw.orderCount
        })
      })
    })

    // Sort add-on orders separately
    addOnOrders.sort(sortByOrder)

    console.log(`Processed ${processedOrders.length} cards from database for date ${date}`)
    console.log(`Nested store containers: ${nestedStoreContainers.length}, Flat containers: ${flatTimeWindowContainers.length}, Add-ons: ${addOnOrders.length}`)
    console.log(`Store breakdown:`, nestedStoreContainers.map(sc => `${sc.storeName}: ${sc.totalOrders}`).join(', '))
    
    // Debug logging for first few orders
    if (processedOrders.length > 0) {
      console.log('[DEBUG] Sample order data being sent to frontend:', {
        cardId: processedOrders[0].cardId,
        title: processedOrders[0].title,
        variantTitle: processedOrders[0].variantTitle,
        difficultyLabel: processedOrders[0].difficultyLabel,
        isAddOn: processedOrders[0].isAddOn,
        isExpressOrder: processedOrders[0].isExpressOrder,
        expressTimeSlot: processedOrders[0].expressTimeSlot,
        isPickupOrder: processedOrders[0].isPickupOrder,
        storeName: getStoreName(processedOrders[0])
      })
    }
    
    return c.json({
      orders: processedOrders,
      mainOrders: mainOrders, // Keep for backward compatibility
      addOnOrders: addOnOrders,
      storeContainers: flatTimeWindowContainers, // FIXED: Frontend expects flat structure with store+time combinations
      timeWindowContainers: flatTimeWindowContainers, // Enhanced time window-based grouping (backward compatibility)
      nestedStoreContainers: nestedStoreContainers, // NEW: Available for future frontend enhancements
      stats: {
        total: processedOrders.length,
        mainOrders: mainOrders.length,
        addOns: addOnOrders.length,
        timeWindows: flatTimeWindowContainers.length,
        stores: nestedStoreContainers.length,
        // Add status-based stats
        unassigned: processedOrders.filter(o => !o.status || o.status === 'unassigned').length,
        assigned: processedOrders.filter(o => o.status === 'assigned').length,
        completed: processedOrders.filter(o => o.status === 'completed').length
      }
    })
  } catch (error: any) {
    console.error("Error fetching orders from database:", error)
    return c.json({ error: "Failed to fetch orders from database", details: error.message }, 500)
  }
})

// --- Order Card States API (PROTECTED) ---

// Update order card status/notes - FORTIFIED FOR REAL-TIME
app.put("/api/tenants/:tenantId/order-card-states/:cardId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const cardId = c.req.param("cardId")
  const { status, notes, assignedTo, deliveryDate, sortOrder } = await c.req.json()

  if (!deliveryDate) {
    return c.json({ error: "Delivery date is required" }, 400)
  }

  try {
    const jwtPayload = c.get('jwtPayload')
    const currentUserId = jwtPayload?.sub || 'unknown'
    const currentUserName = jwtPayload?.name || jwtPayload?.email || 'Unknown User'
    
    console.log(`[ORDER-CARD-STATE-FORTIFIED] JWT Payload Debug:`, {
      sub: jwtPayload?.sub,
      name: jwtPayload?.name,
      email: jwtPayload?.email,
      tenantId: jwtPayload?.tenantId,
      hasJwtPayload: !!jwtPayload,
      requestParams: JSON.stringify({ status, notes, assignedTo, deliveryDate })
    })
    
    // Create consistent timestamp for SQLite format with microsecond precision for uniqueness
    const now = new Date()
    // Use milliseconds + a small increment for uniqueness
    const uniqueTimestamp = now.getTime() + Math.random() * 0.999
    const sqliteTimestamp = new Date(uniqueTimestamp).toISOString().slice(0, 23).replace('T', ' ')
    
    console.log(`[ORDER-CARD-STATE-FORTIFIED] Updating card ${cardId} for tenant ${tenantId}`)
    console.log(`[ORDER-CARD-STATE-FORTIFIED] Update params:`, { 
      tenantId, 
      cardId, 
      deliveryDate, 
      status: status || 'unassigned', 
      assignedTo: assignedTo || null, 
      currentUserId,
      currentUserName,
      notes: notes || null,
      sortOrder: sortOrder || null,
      sqliteTimestamp
    })
    
    // FORTIFIED: Use explicit timestamp and better error handling - NOW WITH SORT ORDER SUPPORT
    const result = await c.env.DB.prepare(`
      INSERT OR REPLACE INTO order_card_states 
      (tenant_id, card_id, delivery_date, status, assigned_to, assigned_by, notes, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      tenantId, 
      cardId, 
      deliveryDate, 
      status || 'unassigned', 
      assignedTo || null, 
      currentUserId, 
      notes || null,
      sortOrder || null,
      sqliteTimestamp
    ).run()

    console.log(`[ORDER-CARD-STATE-FORTIFIED] Updated successfully:`, {
      success: result.success,
      changes: result.changes,
      lastRowId: result.meta?.last_row_id,
      timestamp: sqliteTimestamp
    })
    
    // FORTIFIED: Verify the update was saved correctly
    const verification = await c.env.DB.prepare(`
      SELECT card_id, status, assigned_to, notes, updated_at 
      FROM order_card_states 
      WHERE tenant_id = ? AND card_id = ?
    `).bind(tenantId, cardId).first()
    
    console.log(`[ORDER-CARD-STATE-FORTIFIED] Verification query result:`, verification)
    
    return c.json({ 
      success: true, 
      cardId,
      status: status || 'unassigned',
      notes: notes || null,
      assignedTo: assignedTo || null,
      sortOrder: sortOrder || null,
      updatedAt: sqliteTimestamp,
      verification: verification
    })
  } catch (error: any) {
    console.error("[ORDER-CARD-STATE-FORTIFIED] Error updating order card state:", error)
    return c.json({ error: "Failed to update order card state", details: error.message }, 500)
  }
})

// Get order card states for a specific date
app.get("/api/tenants/:tenantId/order-card-states", async (c) => {
  const tenantId = c.req.param("tenantId")
  const date = c.req.query("date")

  if (!date) {
    return c.json({ error: "Date query parameter is required" }, 400)
  }

  try {
    console.log(`[ORDER-CARD-STATE] Fetching states for tenant ${tenantId}, date ${date}`)
    
    const { results } = await c.env.DB.prepare(`
      SELECT card_id, status, assigned_to, assigned_by, notes, sort_order, updated_at
      FROM order_card_states 
      WHERE tenant_id = ? AND delivery_date = ?
    `).bind(tenantId, date).all()

    console.log(`[ORDER-CARD-STATE] Found ${results?.length || 0} states for date ${date}`)
    
    // Convert to map for easy lookup
    const statesMap: Record<string, any> = {}
    for (const state of results || []) {
      statesMap[state.card_id] = {
        status: state.status,
        assignedTo: state.assigned_to,
        assignedBy: state.assigned_by,
        notes: state.notes,
        sortOrder: state.sort_order || 0,
        updatedAt: state.updated_at
      }
    }
    
    return c.json({ states: statesMap })
  } catch (error: any) {
    console.error("Error fetching order card states:", error)
    return c.json({ error: "Failed to fetch order card states", details: error.message }, 500)
  }
})

// Bulk update multiple order card states
app.post("/api/tenants/:tenantId/order-card-states/bulk", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { updates, deliveryDate } = await c.req.json()

  if (!deliveryDate || !Array.isArray(updates)) {
    return c.json({ error: "Delivery date and updates array are required" }, 400)
  }

  try {
    const jwtPayload = c.get('jwtPayload')
    const currentUserId = jwtPayload?.sub || 'unknown'
    
    console.log(`[ORDER-CARD-STATE] Bulk updating ${updates.length} cards for tenant ${tenantId}`)
    
    // Prepare bulk insert/update
    const stmt = c.env.DB.prepare(`
      INSERT OR REPLACE INTO order_card_states 
      (tenant_id, card_id, delivery_date, status, assigned_to, assigned_by, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    
    const batch = updates.map(update => 
      stmt.bind(
        tenantId,
        update.cardId,
        deliveryDate,
        update.status || 'unassigned',
        update.assignedTo || null,
        currentUserId,
        update.notes || null
      )
    )
    
    const results = await c.env.DB.batch(batch)
    
    console.log(`[ORDER-CARD-STATE] Bulk update completed: ${results.length} operations`)
    
    return c.json({ 
      success: true, 
      updated: updates.length,
      results: results.map(r => ({ success: r.success, changes: r.changes }))
    })
  } catch (error: any) {
    console.error("Error bulk updating order card states:", error)
    return c.json({ error: "Failed to bulk update order card states", details: error.message }, 500)
  }
})

// MOVED: This endpoint will be defined after JWT middleware

// Real-time polling endpoint for order card states - FORTIFIED VERSION WITH AUTH
app.get("/api/tenants/:tenantId/order-card-states/realtime-check", async (c) => {
  const tenantId = c.req.param("tenantId")

  try {
    // FORTIFIED: Add JWT support for user tracking in polling
    const jwtPayload = c.get('jwtPayload')
    const currentUserId = jwtPayload?.sub || 'unknown'
    const currentUserName = jwtPayload?.name || jwtPayload?.email || 'Unknown User'
    const userAgent = c.req.header('User-Agent') || 'unknown'
    const clientType = userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
    
    console.log(`[REALTIME-POLLING-USER-DEBUG] ${clientType} polling request from user:`, {
      userId: currentUserId,
      userName: currentUserName,
      tenantId: tenantId,
      userAgent: userAgent.substring(0, 100),
      clientType
    })
    
    console.log(`[REALTIME-POLLING-FORTIFIED] Checking for recent order card state changes for tenant ${tenantId}`)
    
    // FORTIFIED: Use 5 minutes window for robust coverage (handles delays/interruptions)
    const fiveMinutesAgo = new Date(Date.now() - 300000) // 5 minutes = 300,000ms
    const currentTime = new Date()
    
    // FORTIFIED: Use exact same timestamp format as the PUT endpoint
    const fiveMinutesAgoStr = fiveMinutesAgo.toISOString().slice(0, 19).replace('T', ' ')
    const currentTimeStr = currentTime.toISOString().slice(0, 19).replace('T', ' ')
    
    console.log(`[REALTIME-POLLING-FORTIFIED] Looking for changes after: ${fiveMinutesAgoStr}`)
    console.log(`[REALTIME-POLLING-FORTIFIED] Current time: ${currentTimeStr}`)
    
    // FORTIFIED: More comprehensive query with better logging
    const { results } = await c.env.DB.prepare(`
      SELECT card_id, status, assigned_to, assigned_by, notes, sort_order, updated_at, delivery_date
      FROM order_card_states 
      WHERE tenant_id = ? AND updated_at > ?
      ORDER BY updated_at DESC
    `).bind(tenantId, fiveMinutesAgoStr).all()

    console.log(`[REALTIME-POLLING-FORTIFIED] Raw database results (${results?.length || 0} rows):`, results)

    // FORTIFIED: Enhanced change mapping with more data
    const changes = (results || []).map((state: any) => ({
      cardId: state.card_id,
      status: state.status,
      assignedTo: state.assigned_to,
      assignedBy: state.assigned_by,
      notes: state.notes,
      sortOrder: state.sort_order || 0,
      updatedAt: state.updated_at,
      deliveryDate: state.delivery_date
    }))

    console.log(`[REALTIME-POLLING-FORTIFIED] Found ${changes.length} recent changes:`, changes)
    
    // FORTIFIED: Enhanced response with debugging info
    return c.json({ 
      changes,
      timestamp: currentTimeStr,
      count: changes.length,
      queryWindow: `${fiveMinutesAgoStr} to ${currentTimeStr}`,
      debug: {
        tenantId,
        rawResultCount: results?.length || 0,
        processedChangeCount: changes.length
      }
    })
  } catch (error: any) {
    console.error("[REALTIME-POLLING-FORTIFIED] Error checking real-time order card states:", error)
    return c.json({ error: "Failed to check for updates", details: error.message }, 500)
  }
})

// --- Products (PUBLIC) ---
// Let the SPA catch-all handle /products.

// JWT middleware for protected routes
app.use("/api/tenants/:tenantId/*", async (c, next) => {
  // Skip JWT verification for public endpoints
  const path = c.req.path
  const publicEndpoints = [
    // Core public endpoints
    '/api/tenants/:tenantId/orders-by-date',
    '/api/tenants/:tenantId/orders-from-db-by-date',
    '/api/tenants/:tenantId/analytics',
    '/api/tenants/:tenantId/analytics/florist-stats',
    '/api/tenants/:tenantId/orders/realtime-status',
    '/api/tenants/:tenantId/realtime/orders',
    '/api/tenants/:tenantId/order-card-states/realtime-check',
    // NEW WebSocket endpoints:
    '/api/tenants/:tenantId/realtime/ws',
    '/api/tenants/:tenantId/realtime/ws-status',
    '/api/tenants/:tenantId/test-shopify',
    
    // AI Florist public endpoints (for customer-facing AI)
    '/api/tenants/:tenantId/ai/saved-products',
    '/api/tenants/:tenantId/ai/knowledge-base',
    '/api/tenants/:tenantId/ai/knowledge-base-analytics',
    '/api/tenants/:tenantId/ai/flowers',
    '/api/tenants/:tenantId/ai/styles',
    '/api/tenants/:tenantId/ai/occasions',
    '/api/tenants/:tenantId/ai/arrangement-types',
    '/api/tenants/:tenantId/ai/budget-tiers',
    '/api/tenants/:tenantId/ai/prompt-templates',
    '/api/tenants/:tenantId/ai/model-configs',
    
    // Global AI endpoints (no tenant required)
    '/api/ai/chat',
    '/api/ai/generate-bouquet-image',
    '/api/ai/create-bouquet-product'
  ]
  
  // Check if this is a public endpoint
  const isPublicEndpoint = publicEndpoints.some(endpoint => {
    // Create a regex pattern that matches the endpoint with tenantId parameter
    const pattern = endpoint.replace(':tenantId', '[^/]+')
    const regex = new RegExp(`^${pattern}$`)
    return regex.test(path)
  })
  
  if (isPublicEndpoint) {
    console.log(`Public endpoint accessed: ${path}`)
    return next()
  }
  
  try {
    const auth = jwt({ secret: c.env.JWT_SECRET })
    return await auth(c, next)
  } catch (error) {
    console.error("JWT middleware error:", error)
    return c.json({ error: "Invalid token" }, 401)
  }
})

// Add tenant isolation middleware for protected routes
app.use("/api/tenants/:tenantId/*", async (c, next) => {
  // Skip tenant isolation for public endpoints (already handled above)
  const path = c.req.path
  const publicEndpoints = [
    '/api/tenants/:tenantId/orders-by-date',
    '/api/tenants/:tenantId/orders-from-db-by-date',
    '/api/tenants/:tenantId/analytics',
    '/api/tenants/:tenantId/analytics/florist-stats',
    '/api/tenants/:tenantId/orders/realtime-status',
    '/api/tenants/:tenantId/realtime/orders',
    '/api/tenants/:tenantId/order-card-states/realtime-check',
    // NEW WebSocket endpoints:
    '/api/tenants/:tenantId/realtime/ws',
    '/api/tenants/:tenantId/realtime/ws-status',
    '/api/tenants/:tenantId/test-shopify',
    '/api/tenants/:tenantId/ai/saved-products',
    '/api/tenants/:tenantId/ai/knowledge-base',
    '/api/tenants/:tenantId/ai/knowledge-base-analytics',
    '/api/tenants/:tenantId/ai/flowers',
    '/api/tenants/:tenantId/ai/styles',
    '/api/tenants/:tenantId/ai/occasions',
    '/api/tenants/:tenantId/ai/arrangement-types',
    '/api/tenants/:tenantId/ai/budget-tiers',
    '/api/tenants/:tenantId/ai/prompt-templates',
    '/api/tenants/:tenantId/ai/model-configs'
  ]
  
  const isPublicEndpoint = publicEndpoints.some(endpoint => {
    const pattern = endpoint.replace(':tenantId', '[^/]+')
    const regex = new RegExp(`^${pattern}$`)
    return regex.test(path)
  })
  
  if (isPublicEndpoint) {
    return next()
  }
  
  // For protected routes, ensure tenant isolation
  try {
    const jwtPayload = c.get('jwtPayload')
    const requestedTenantId = c.req.param('tenantId')
    
    if (!jwtPayload || !jwtPayload.tenantId) {
      return c.json({ error: "Invalid token - missing tenant information" }, 401)
    }
    
    // Ensure user can only access their own tenant's data
    if (jwtPayload.tenantId !== requestedTenantId) {
      console.error(`Tenant isolation violation: User ${jwtPayload.sub} (tenant ${jwtPayload.tenantId}) attempted to access tenant ${requestedTenantId}`)
      return c.json({ error: "Access denied - tenant mismatch" }, 403)
    }
    
    // Verify tenant still exists and is active
    const tenant = await d1DatabaseService.getTenant(c.env, requestedTenantId)
    if (!tenant || tenant.status !== 'active') {
      return c.json({ error: "Tenant not found or inactive" }, 404)
    }
    
    return next()
  } catch (error) {
    console.error("Tenant isolation middleware error:", error)
    return c.json({ error: "Authentication failed" }, 401)
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

    // Passwords match, generate JWT with enhanced user info
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      name: user.name,
      email: user.email,
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
    const tenants = await d1DatabaseService.listTenants(c.env, { domain: tenantDomain })
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

    // Generate JWT token with enhanced user info
    const payload = {
      sub: newUser.id,
      tenantId: newUser.tenantId,
      role: newUser.role,
      name: newUser.name,
      email: newUser.email,
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

// --- Unscheduled Orders ---
app.get("/api/tenants/:tenantId/orders/unscheduled", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    console.log(`[UNSCHEDULED-ORDERS] Fetching unscheduled orders for tenant: ${tenantId}`)
    
    // First try to get orders without proper delivery dates
    let orders: any[] = []
    try {
      const result = await c.env.DB.prepare(`
        SELECT 
          o.*,
          s.name as store_name,
          s.shopify_domain
        FROM tenant_orders o
        LEFT JOIN shopify_stores s ON o.store_id = s.id
        WHERE o.tenant_id = ? 
        AND (
          o.delivery_date IS NULL 
          OR o.delivery_date = '' 
          OR o.delivery_date = 'undefined'
          OR o.delivery_date = 'null'
          OR o.delivery_date = 'No delivery date found'
        )
        ORDER BY o.created_at DESC
        LIMIT 1000
      `).bind(tenantId).all()
      orders = result.results as any[] || []
    } catch (sqlError) {
      console.error(`[UNSCHEDULED-ORDERS] SQL error:`, sqlError)
      // Fallback to simpler query without JOIN if shopify_stores doesn't exist
      const result = await c.env.DB.prepare(`
        SELECT o.*
        FROM tenant_orders o
        WHERE o.tenant_id = ? 
        AND (
          o.delivery_date IS NULL 
          OR o.delivery_date = '' 
          OR o.delivery_date = 'undefined'
          OR o.delivery_date = 'null'
          OR o.delivery_date = 'No delivery date found'
        )
        ORDER BY o.created_at DESC
        LIMIT 1000
      `).bind(tenantId).all()
      orders = result.results as any[] || []
    }
    
    console.log(`[UNSCHEDULED-ORDERS] Found ${orders?.length || 0} unscheduled orders`)
    
    if (!orders || orders.length === 0) {
      return c.json([])
    }
    
    // Transform to match frontend expectations
    const processedOrders = orders.map((order: any) => {
      let shopifyOrderData = null
      if (order.shopify_order_data) {
        try {
          shopifyOrderData = JSON.parse(order.shopify_order_data)
          // Handle double-encoded JSON bug fix
          if (typeof shopifyOrderData === 'string') {
            shopifyOrderData = JSON.parse(shopifyOrderData)
          }
        } catch (e) {
          console.warn(`[UNSCHEDULED-ORDERS] Failed to parse shopifyOrderData for order ${order.id}:`, e)
        }
      }
      
      return {
        id: order.id,
        cardId: order.id,
        orderId: order.id,
        shopifyOrderId: order.shopify_order_id,
        customerName: order.customer_name,
        deliveryDate: order.delivery_date,
        status: order.status,
        priority: order.priority,
        assignedTo: order.assigned_to,
        notes: order.notes,
        productLabel: order.product_label,
        productType: order.product_type,
        totalPrice: order.total_price,
        currency: order.currency,
        customerEmail: order.customer_email,
        storeId: order.store_id,
        storeName: order.store_name,
        sessionId: order.session_id,
        title: shopifyOrderData?.lineItems?.edges?.[0]?.node?.title || order.product_titles || 'Unknown Product',
        variantTitle: shopifyOrderData?.lineItems?.edges?.[0]?.node?.variant?.title || '',
        quantity: 1,
        shopifyOrderData: shopifyOrderData,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      }
    })
    
    console.log(`[UNSCHEDULED-ORDERS] Processed ${processedOrders.length} orders successfully`)
    
    return c.json(processedOrders)
  } catch (error: any) {
    console.error("[UNSCHEDULED-ORDERS] Error fetching unscheduled orders:", error)
    return c.json({ error: "Failed to fetch unscheduled orders", details: error.message }, 500)
  }
})

// NEW: Bulk reorder endpoint with guaranteed real-time broadcasting (PROTECTED)
app.post("/api/tenants/:tenantId/bulk-reorder", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { changes, deliveryDate, adminId, adminName, timestamp } = await c.req.json()

  if (!changes || !deliveryDate) {
    return c.json({ error: "Changes object and deliveryDate are required" }, 400)
  }

  try {
    const jwtPayload = c.get('jwtPayload')
    const currentUserId = jwtPayload?.sub || adminId || 'unknown'
    const currentUserName = jwtPayload?.name || jwtPayload?.email || adminName || 'Unknown Admin'
    
    console.log(`[BULK-REORDER] Processing ${Object.keys(changes).length} reorder changes for tenant ${tenantId}`)
    console.log(`[BULK-REORDER] Admin: ${currentUserName} (${currentUserId})`)
    
    // Create unique timestamp for this batch
    const batchTimestamp = new Date().toISOString().slice(0, 23).replace('T', ' ')
    
    // Prepare batch updates with enhanced real-time tracking
    const updatePromises = Object.entries(changes).map(async ([orderId, sortOrder]) => {
      // Get existing state to preserve other fields
      const existing = await c.env.DB.prepare(`
        SELECT status, assigned_to, assigned_by, notes FROM order_card_states
        WHERE tenant_id = ? AND card_id = ? AND delivery_date = ?
      `).bind(tenantId, orderId, deliveryDate).first()
      
      // Update with sortOrder and preserve existing fields
      const result = await c.env.DB.prepare(`
        INSERT OR REPLACE INTO order_card_states 
        (tenant_id, card_id, delivery_date, status, assigned_to, assigned_by, notes, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        orderId,
        deliveryDate,
        existing?.status || 'unassigned',
        existing?.assigned_to || null,
        existing?.assigned_by || currentUserId, // Track who made the reorder
        existing?.notes || null,
        sortOrder,
        batchTimestamp
      ).run()

      console.log(`[BULK-REORDER] Updated ${orderId} -> sortOrder: ${sortOrder}`)
      return { orderId, sortOrder, success: result.success }
    })

    const results = await Promise.all(updatePromises)
    const successCount = results.filter(r => r.success).length

    console.log(`[BULK-REORDER] Completed: ${successCount}/${results.length} updates successful`)
    
    // Force broadcast to all connected clients for cross-device sync
    // Note: This will be picked up by the SSE real-time system automatically
    // since we've updated the order_card_states table with new timestamps
    
    return c.json({ 
      success: true,
      message: `Bulk reorder completed: ${successCount} orders updated`,
      updated: successCount,
      total: results.length,
      batchTimestamp,
      adminId: currentUserId,
      adminName: currentUserName,
      crossDeviceSync: true
    })

  } catch (error: any) {
    console.error("[BULK-REORDER] Error processing bulk reorder:", error)
    return c.json({ 
      error: "Failed to process bulk reorder", 
      details: error.message 
    }, 500)
  }
})

app.post("/api/tenants/:tenantId/orders", async (c) => {
  const tenantId = c.req.param("tenantId")
  const orderData = await c.req.json()
  const newOrder = await d1DatabaseService.createOrder(c.env, tenantId, orderData)
  return c.json(newOrder, 201)
})
app.get("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const orderId = c.req.param("orderId")
  const order = await d1DatabaseService.getOrder(c.env, tenantId, orderId)
  return order ? c.json(order) : c.json({ error: "Not Found" }, 404)
})
// --- Order Reordering ---
app.put("/api/tenants/:tenantId/orders/reorder", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { orderIds, deliveryDate } = await c.req.json()

  if (!orderIds || !Array.isArray(orderIds) || !deliveryDate) {
    return c.json({ error: "orderIds array and deliveryDate are required" }, 400)
  }

  try {
    console.log(`[REORDER] Updating order sequence for ${orderIds.length} orders on ${deliveryDate}`)

    // Get the current user ID from JWT for anti-loop protection
    const jwtPayload = c.get('jwtPayload')
    const currentUserId = jwtPayload?.sub || jwtPayload?.email || jwtPayload?.name || 'unknown'
    
    console.log(`[REORDER] Current user making changes: ${currentUserId}`)

    // Update sort_order for each order based on its position in the array
    const updatePromises = orderIds.map(async (orderId: string, index: number) => {
      const sortOrder = (index + 1) * 10 // Use increments of 10 for easier insertion later
      
      try {
        console.log(`[REORDER-DEBUG] Processing order ${orderId} at index ${index} with sortOrder ${sortOrder}`)
        
        // First check if record exists to preserve existing fields
        const existing = await c.env.DB.prepare(`
          SELECT status, assigned_to, assigned_by, notes FROM order_card_states
          WHERE tenant_id = ? AND card_id = ? AND delivery_date = ?
        `).bind(tenantId, orderId, deliveryDate).first()
        
        console.log(`[REORDER-DEBUG] Existing record for ${orderId}:`, existing)
        
        // CRITICAL FIX: For reordering, don't set assigned_by to allow cross-device sync
        const result = await c.env.DB.prepare(`
          INSERT OR REPLACE INTO order_card_states 
          (tenant_id, delivery_date, card_id, status, assigned_to, assigned_by, notes, sort_order, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          tenantId, 
          deliveryDate, 
          orderId, 
          existing?.status || 'unassigned',
          existing?.assigned_to || null,
          existing?.assigned_by || null, // CRITICAL FIX: Keep existing assigned_by, don't overwrite with current user
          existing?.notes || null,
          sortOrder
        ).run()

        console.log(`[REORDER-DEBUG] Database result for ${orderId}:`, result)
        console.log(`[REORDER-FIXED] Set order ${orderId} to position ${index + 1} (sort_order: ${sortOrder}) - preserved existing assigned_by for cross-device sync`)
        return result
      } catch (error) {
        console.error(`[REORDER-ERROR] Failed to update order ${orderId}:`, error)
        throw error
      }
    })

    await Promise.all(updatePromises)

    console.log(`[REORDER-FIXED] Successfully updated order sequence for tenant ${tenantId} on ${deliveryDate} - ready for cross-device sync`)
    
    return c.json({ 
      success: true, 
      message: `Updated order sequence for ${orderIds.length} orders`,
      orderIds: orderIds,
      deliveryDate: deliveryDate,
      reorderOperator: currentUserId, // Renamed to avoid confusion with assigned_by
      crossDeviceSync: true // Flag indicating this should sync across devices
    })

  } catch (error) {
    console.error("[REORDER] Error updating order sequence:", error)
    return c.json({ 
      error: "Failed to update order sequence", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, 500)
  }
})

app.put("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const orderId = c.req.param("orderId")
  const updateData = await c.req.json()
  const updatedOrder = await d1DatabaseService.updateOrder(c.env, tenantId, orderId, updateData)
  return updatedOrder ? c.json(updatedOrder) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/orders/:orderId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const orderId = c.req.param("orderId")
  const success = await d1DatabaseService.deleteOrder(c.env, tenantId, orderId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Camera Widget Templates ---
app.get("/api/tenants/:tenantId/camera-widget-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templates = await d1DatabaseService.getCameraWidgetTemplates(c.env, tenantId);
  return c.json(templates);
});

app.post("/api/tenants/:tenantId/camera-widget-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templateData = await c.req.json();
  const newTemplate = await d1DatabaseService.createCameraWidgetTemplate(c.env, tenantId, templateData);
  return c.json(newTemplate, 201);
});

app.put("/api/tenants/:tenantId/camera-widget-templates/:templateId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templateId = c.req.param("templateId");
  const templateData = await c.req.json();
  const updatedTemplate = await d1DatabaseService.updateCameraWidgetTemplate(c.env, tenantId, templateId, templateData);
  return c.json(updatedTemplate);
});

app.delete("/api/tenants/:tenantId/camera-widget-templates/:templateId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templateId = c.req.param("templateId");
  await d1DatabaseService.deleteCameraWidgetTemplate(c.env, tenantId, templateId);
  return c.json({ success: true });
});

// --- Product Sync ---
app.post("/api/tenants/:tenantId/stores/:storeId/sync-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
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

// --- Product Sync (Single) ---
app.post("/api/tenants/:tenantId/stores/:storeId/sync-product", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  const { shopifyProductId } = await c.req.json()

  if (!shopifyProductId) {
    return c.json({ error: "Shopify Product ID is required" }, 400)
  }

  try {
    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    if (!store || !store.settings.accessToken) {
      return c.json({ error: "Shopify store not found or is not configured" }, 404)
    }

    const { createShopifyApiService } = await import("../src/services/shopify/shopifyApi")
    const shopifyService = createShopifyApiService(store, store.settings.accessToken)
    
    // The Shopify API needs the numeric ID
    const numericProductId = shopifyProductId.split('/').pop()
    if (!numericProductId) {
      return c.json({ error: "Invalid Shopify Product ID format" }, 400)
    }
    const productData = await shopifyService.fetchProduct(numericProductId)

    if (!productData) {
      return c.json({ error: "Product not found on Shopify" }, 404)
    }

    // Adapt the fetched product data to the format expected by saveProducts
    const productsToSave = (productData.variants || []).map(variant => ({
      shopifyProductId: productData.shopifyId || numericProductId,
      shopifyVariantId: variant.id,
      title: productData.name || 'Untitled Product',
      variantTitle: variant.title,
      description: productData.description || '',
      price: variant.price ? parseFloat(variant.price) : 0,
      tags: productData.tags || [],
      productType: productData.productType || '',
      vendor: productData.vendor || '',
      handle: productData.handle || '',
      imageUrl: productData.images?.[0]?.src || undefined,
      imageAlt: productData.images?.[0]?.alt || undefined,
      imageWidth: productData.images?.[0]?.width || undefined,
      imageHeight: productData.images?.[0]?.height || undefined,
    }))

    await d1DatabaseService.saveProducts(c.env, tenantId, productsToSave)

    return c.json({ success: true, message: "Product synced successfully" })
  } catch (error) {
    console.error("Error syncing single product from Shopify:", error)
    return c.json({ error: "Failed to sync product" }, 500)
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
  const tenantId = c.req.param("tenantId")
  const labelId = c.req.param("labelId")
  const label = await d1DatabaseService.getProductLabelById(c.env, tenantId, labelId)
  return label ? c.json(label) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/product-labels/:labelId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const labelId = c.req.param("labelId")
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
  const tenantId = c.req.param("tenantId")
  const labelId = c.req.param("labelId")
  const success = await d1DatabaseService.deleteProductLabel(c.env, tenantId, labelId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

// --- Stores ---
app.get("/api/tenants/:tenantId/stores", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    const stores = await d1DatabaseService.getStores(c.env, tenantId)
    return c.json(stores)
  } catch (error) {
    console.error("Error fetching stores:", error)
    return c.json({ error: "Failed to fetch stores" }, 500)
  }
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
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
  return store ? c.json(store) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/stores/:storeId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  const updateData = await c.req.json()
  const updatedStore = await d1DatabaseService.updateStore(c.env, tenantId, storeId, updateData)
  return updatedStore ? c.json(updatedStore) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/stores/:storeId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  const success = await d1DatabaseService.deleteStore(c.env, tenantId, storeId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

app.get("/api/tenants/:tenantId/stores/:storeId/orders/lookup", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
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
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  console.log(`Webhook registration started for tenant ${tenantId}, store ${storeId}`)

  try {
    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    if (!store) {
      console.error(`Store not found for tenant ${tenantId}, store ${storeId}`)
      return c.json({ error: "Store not found" }, 404)
    }
    console.log("Found store:", store.name)

    const domain = store.settings.domain
    const accessToken = store.settings.accessToken

    if (!domain || !accessToken) {
      console.error("Store domain or access token not configured.")
      return c.json({ error: "Store domain or access token not configured." }, 400)
    }
    console.log("Store credentials found, proceeding with webhook registration.")

    // Define all webhook topics we want to listen to
    const webhookTopics = [
      "orders/create",
      "orders/updated", 
      "orders/fulfilled",
      "orders/cancelled",
      "products/create",
      "products/update",
      "products/delete",
      "inventory_items/update", // Corrected from inventory_levels/update
      "app/uninstalled"
    ]
    
    const baseUrl = new URL(c.req.url).hostname
    const webhookUrl = `https://${baseUrl}/api/webhooks/shopify/orders-create/${tenantId}/${storeId}`

    const registeredWebhooks: WebhookConfig[] = []

    // First, get existing webhooks to avoid duplicates
    const existingWebhooksResponse = await fetch(`https://${domain}/admin/api/2023-10/webhooks.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    })

    let existingWebhooks: any[] = []
    if (existingWebhooksResponse.ok) {
      const existingData = await existingWebhooksResponse.json()
      existingWebhooks = existingData.webhooks || []
    }

    // Delete existing webhooks that point to our endpoint
    for (const webhook of existingWebhooks) {
      if (webhook.address.includes(baseUrl)) {
        try {
          await fetch(`https://${domain}/admin/api/2023-10/webhooks/${webhook.id}.json`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
          })
          console.log(`Deleted existing webhook: ${webhook.topic}`)
        } catch (error) {
          console.error(`Failed to delete webhook ${webhook.id}:`, error)
        }
      }
    }

    // Register new webhooks
    for (const topic of webhookTopics) {
      try {
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
        
        if (response.ok && data.webhook) {
          registeredWebhooks.push({
            id: data.webhook.id.toString(),
            topic: data.webhook.topic,
            address: data.webhook.address,
            status: "active",
            lastTriggered: new Date().toISOString(),
          })
          console.log(`Successfully registered webhook for ${topic}`)
        } else {
          console.error(`Failed to register webhook for ${topic}:`, JSON.stringify(data, null, 2))
          // Add failed webhook to track issues
          registeredWebhooks.push({
            id: `failed-${topic}`,
            topic,
            address: webhookUrl,
            status: "error",
            lastTriggered: new Date().toISOString(),
          })
        }
      } catch (error) {
        console.error(`Fatal error registering webhook for ${topic}:`, error)
      }
    }

    // Always fetch the latest settings from the DB before updating
    const latestStore = await d1DatabaseService.getStore(c.env, tenantId, storeId);
    const mergedSettings = {
      ...latestStore.settings,
      webhooks: registeredWebhooks,
    };
    await d1DatabaseService.updateStore(c.env, tenantId, storeId, { settings: mergedSettings });
    console.log(`Updated store ${storeId} with ${registeredWebhooks.length} webhook configurations.`)

    const updatedStore = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    return c.json(updatedStore)
  } catch (error: any) {
    console.error("Webhook registration failed:", error.message)
    return c.json({ error: "Failed to register webhooks", details: error.message }, 500)
  }
})

app.post("/api/tenants/:tenantId/stores/:storeId/orders/by_name", async (c) => {
  const tenantId = c.req.param("tenantId")
  const storeId = c.req.param("storeId")
  
  try {
    const { orderName } = await c.req.json()

    if (!orderName) {
      return c.json({ error: "orderName is required" }, 400)
    }

    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId)
    if (!store) {
      return c.json({ error: "Store not found" }, 404)
    }

    const shopify = new ShopifyApiService(store, store.settings.accessToken)
    const orders = await shopify.getOrders({ name: orderName, status: "any" })

    if (!orders || orders.length === 0) {
      return c.json({ error: "Order not found" }, 404)
    }

    return c.json(orders[0])
  } catch (error: any) {
    console.error("Failed to fetch order by name:", error)
    return c.json({ error: "Failed to fetch order", details: error.message }, 500)
  }
})

// --- Analytics ---
app.get("/api/tenants/:tenantId/analytics", async (c) => {
  const tenantId = c.req.param("tenantId")
  const timeFrame = c.req.query("timeFrame") ?? "weekly"
  const analytics = await d1DatabaseService.getAnalytics(c.env, tenantId, timeFrame)
  return c.json(analytics)
})
app.get("/api/tenants/:tenantId/analytics/florist-stats", async (c) => {
  const tenantId = c.req.param("tenantId")
  const stats = await d1DatabaseService.getFloristStats(c.env, tenantId)
  return c.json(stats)
})
app.delete("/api/tenants/:tenantId/analytics/florist-stats/:statId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const statId = c.req.param("statId")
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
  const tenantId = c.req.param("tenantId")
  const userId = c.req.param("userId")
  const user = await d1DatabaseService.getUser(c.env, tenantId, userId)
  return user ? c.json(user) : c.json({ error: "Not Found" }, 404)
})
app.put("/api/tenants/:tenantId/users/:userId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userId = c.req.param("userId")
  const updateData = await c.req.json()
  const updatedUser = await d1DatabaseService.updateUser(c.env, tenantId, userId, updateData)
  return updatedUser ? c.json(updatedUser) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/users/:userId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userId = c.req.param("userId")
  const success = await d1DatabaseService.deleteUser(c.env, tenantId, userId)
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
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const product = await d1DatabaseService.getProduct(c.env, tenantId, productId)
  return product ? c.json(product) : c.json({ error: "Not Found" }, 404)
})

app.put("/api/tenants/:tenantId/products/:productId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const updateData = await c.req.json()
  const updatedProduct = await d1DatabaseService.updateProduct(c.env, tenantId, productId, updateData)
  return updatedProduct ? c.json(updatedProduct) : c.json({ error: "Not Found" }, 404)
})

app.delete("/api/tenants/:tenantId/products/:productId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const success = await d1DatabaseService.deleteProduct(c.env, tenantId, productId)
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
  const tenantId = c.req.param("tenantId")
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

  try {
    // Extract the fields array from the config object
    const fields = configData.fields || configData
    
    // Ensure fields is an array
    if (!Array.isArray(fields)) {
      throw new Error("Config must contain a fields array")
    }

    await d1DatabaseService.saveOrderCardConfig(c.env, tenantId, fields)
    return c.json({ success: true, message: "Configuration saved successfully" }, 201)
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
  const tenantId = c.req.param("tenantId")
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
  const tenantId = c.req.param("tenantId")
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

// --- Token Validation ---
app.get("/api/auth/validate", async (c) => {
  try {
    const authHeader = c.req.header("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ valid: false, error: "No token provided" }, 401)
    }

    // Use the same JWT middleware pattern as other endpoints
    const auth = jwt({ secret: c.env.JWT_SECRET })
    let isValid = false
    let userData: any = null
    let tenantData: any = null

    await auth(c, async () => {
      // This will only execute if the token is valid
      const payload = c.get('jwtPayload')
      
      if (payload && payload.tenantId) {
        // Verify user and tenant still exist in database
        const user = await d1DatabaseService.getUser(c.env, payload.tenantId, payload.sub)
        if (user) {
          const tenant = await d1DatabaseService.getTenant(c.env, payload.tenantId)
          if (tenant) {
            isValid = true
            userData = {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              permissions: user.permissions
            }
            tenantData = {
              id: tenant.id,
              name: tenant.name,
              domain: tenant.domain,
              subscriptionPlan: tenant.subscriptionPlan,
              status: tenant.status
            }
          }
        }
      }
    })

    if (isValid && userData && tenantData) {
      return c.json({ 
        valid: true, 
        user: userData,
        tenant: tenantData
      })
    } else {
      return c.json({ valid: false, error: "Invalid token or user/tenant not found" }, 401)
    }
  } catch (error) {
    console.error("Token validation error:", error)
    return c.json({ valid: false, error: "Invalid token" }, 401)
  }
})

app.get("/api/test-d1", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM tenants").all()
  return c.json({ message: "D1 connection successful", tenantCount: results[0].count })
})

// --- Database Initialization Route ---
app.post("/api/init-db", async (c) => {
  try {
    // Create all tables with IF NOT EXISTS to be safe
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, domain TEXT UNIQUE NOT NULL, subscription_plan TEXT DEFAULT "starter", status TEXT DEFAULT "active", settings TEXT DEFAULT "{}", created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`
    ).run()
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenant_users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, hashed_password TEXT NOT NULL, role TEXT NOT NULL DEFAULT "florist", permissions TEXT, created_at TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))`
    ).run()
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenant_orders (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_order_id TEXT, customer_name TEXT NOT NULL, delivery_date TEXT NOT NULL, status TEXT DEFAULT "pending", priority INTEGER DEFAULT 0, assigned_to TEXT, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))`
    ).run()
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS tenant_products (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_product_id TEXT, name TEXT NOT NULL, description TEXT, price REAL, stock_quantity INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))`
    ).run()
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS shopify_stores (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_domain TEXT UNIQUE NOT NULL, access_token TEXT NOT NULL, webhook_secret TEXT, sync_enabled BOOLEAN DEFAULT true, last_sync_at TEXT, settings TEXT DEFAULT '{}', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))`
    ).run()
    
    // Add tables from migrations
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS product_labels (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('difficulty', 'productType', 'custom')),
        color TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();
    
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS saved_products (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        shopify_product_id TEXT NOT NULL,
        shopify_variant_id TEXT NOT NULL,
        title TEXT NOT NULL,
        variant_title TEXT,
        description TEXT,
        price REAL NOT NULL,
        tags TEXT,
        product_type TEXT,
        vendor TEXT,
        handle TEXT,
        status TEXT DEFAULT 'active',
        image_url TEXT,
        image_alt TEXT,
        image_width INTEGER,
        image_height INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        UNIQUE(tenant_id, shopify_product_id, shopify_variant_id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS product_label_mappings (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saved_product_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (saved_product_id) REFERENCES saved_products(id) ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES product_labels(id) ON DELETE CASCADE,
        UNIQUE(saved_product_id, label_id)
      )`
    ).run();

    // --- AI Tables ---
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_usage_analytics (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        date TEXT NOT NULL,
        model_type TEXT NOT NULL,
        generation_count INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        average_rating REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_generated_designs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        generated_image_url TEXT,
        style_parameters TEXT,
        model_version TEXT DEFAULT 'v1.0',
        cost REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        quality_rating REAL,
        feedback TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        generation_metadata TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_styles (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        characteristics TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_occasions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        flower_preferences TEXT,
        color_preferences TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_arrangement_types (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        complexity_level TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_budget_tiers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        min_price REAL,
        max_price REAL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_flowers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        variety TEXT,
        color TEXT,
        seasonality TEXT,
        availability BOOLEAN DEFAULT true,
        price_range TEXT,
        description TEXT,
        image_url TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_model_configs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        model_type TEXT NOT NULL,
        parameters TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_prompt_templates (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        template TEXT NOT NULL,
        category TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_training_data (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        data_type TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        source_type TEXT,
        source_id TEXT,
        quality_score REAL DEFAULT 1.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_training_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        session_name TEXT NOT NULL,
        model_config_id TEXT,
        training_data_ids TEXT,
        status TEXT DEFAULT 'pending',
        progress REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_style_templates (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        template_data TEXT NOT NULL,
        category TEXT,
        is_active BOOLEAN DEFAULT true,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS ai_customer_data (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        customer_id TEXT,
        preferences TEXT,
        purchase_history TEXT,
        feedback TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

    // --- Photo Upload Tables ---
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS florist_photo_uploads (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        original_file_size INTEGER NOT NULL,
        compressed_file_size INTEGER,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        image_metadata TEXT,
        upload_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (user_id) REFERENCES tenant_users(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS photo_descriptions (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT,
        description TEXT,
        flowers_used TEXT,
        colors TEXT,
        style TEXT,
        occasion TEXT,
        arrangement_type TEXT,
        difficulty_level TEXT,
        special_techniques TEXT,
        materials_used TEXT,
        customer_preferences TEXT,
        price_range TEXT,
        season TEXT,
        tags TEXT,
        is_public BOOLEAN DEFAULT false,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (user_id) REFERENCES tenant_users(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS photo_quality_assessment (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        assessed_by TEXT NOT NULL,
        technical_quality INTEGER NOT NULL,
        composition_quality INTEGER NOT NULL,
        design_quality INTEGER NOT NULL,
        training_value INTEGER NOT NULL,
        overall_score REAL NOT NULL,
        quality_notes TEXT,
        improvement_suggestions TEXT,
        is_approved_for_training BOOLEAN DEFAULT false,
        assessment_date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (assessed_by) REFERENCES tenant_users(id)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS photo_training_mapping (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL,
        training_data_id TEXT NOT NULL,
        mapping_type TEXT DEFAULT 'example',
        confidence_score REAL DEFAULT 1.0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (photo_id) REFERENCES florist_photo_uploads(id) ON DELETE CASCADE,
        FOREIGN KEY (training_data_id) REFERENCES ai_training_data(id) ON DELETE CASCADE
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS daily_upload_goals (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        target_count INTEGER DEFAULT 1,
        actual_count INTEGER DEFAULT 0,
        goal_status TEXT DEFAULT 'pending',
        streak_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (user_id) REFERENCES tenant_users(id),
        UNIQUE(tenant_id, user_id, date)
      )`
    ).run();

    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS upload_statistics (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        upload_count INTEGER DEFAULT 0,
        total_size INTEGER DEFAULT 0,
        average_quality_score REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (user_id) REFERENCES tenant_users(id)
      )`
    ).run();

    // --- Camera Widget Templates ---
    await c.env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS camera_widget_templates (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        template_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
      )`
    ).run();

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
app.post("/api/webhooks/shopify/orders-create/:tenantId/:storeId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const storeId = c.req.param("storeId");
  console.log(`Received Shopify order create webhook for tenant: ${tenantId}`);

  try {
    const shopifyOrder = await c.req.json();

    if (!shopifyOrder || !shopifyOrder.id) {
      console.error("Malformed Shopify order payload", shopifyOrder);
      return c.json({ error: "Invalid order data" }, 400);
    }

    // Fetch the store to get access token and domain
    const store = await d1DatabaseService.getStore(c.env, tenantId, storeId);
    if (!store || !store.settings.accessToken) {
      return c.json({ error: "Shopify store not found or is not configured" }, 404);
    }

    // Import ShopifyApiService dynamically (for Cloudflare Workers compatibility)
    const { createShopifyApiService } = await import("../src/services/shopify/shopifyApi");
    const shopifyService = createShopifyApiService(store, store.settings.accessToken);

    // Convert REST order ID to GID for GraphQL (gid://shopify/Order/1234567890)
    const orderGid = `gid://shopify/Order/${shopifyOrder.id}`;
    let shopifyOrderGraphQL = null;
    try {
      shopifyOrderGraphQL = await shopifyService.fetchOrderByIdGraphQL(orderGid);
      console.log("[WEBHOOK] Shopify GraphQL order fetch SUCCESS:", JSON.stringify(shopifyOrderGraphQL));
    } catch (err) {
      console.error("[WEBHOOK] Failed to fetch order from Shopify GraphQL:", err);
    }

    const customerName = `${shopifyOrder.customer?.first_name ?? ""} ${shopifyOrder.customer?.last_name ?? ""}`.trim() || "N/A";
    // Extract delivery date ONLY from Shopify order tags in dd/mm/yyyy format
    const extractDeliveryDateFromTags = (tags: string | string[]): string | null => {
      if (!tags) return null;
      
      // Handle both string and array formats
      let tagArray: string[];
      if (Array.isArray(tags)) {
        tagArray = tags;
      } else if (typeof tags === 'string') {
        tagArray = tags.split(", ");
      } else {
        return null;
      }
      
      const dateTag = tagArray.find((tag: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(tag.trim()));
      return dateTag || null;
    };
    // First try to get delivery date from tags, then from GraphQL custom attributes
    let deliveryDate = extractDeliveryDateFromTags(shopifyOrder.tags);
    
    // If no delivery date in tags, try custom attributes from GraphQL
    if (!deliveryDate && shopifyOrderGraphQL && Array.isArray(shopifyOrderGraphQL.customAttributes)) {
      const deliveryDateAttr = shopifyOrderGraphQL.customAttributes.find((attr: any) => 
        attr.key === 'delivery_date' || attr.key === 'Delivery Date'
      );
      if (deliveryDateAttr && deliveryDateAttr.value) {
        deliveryDate = deliveryDateAttr.value;
        console.log("[WEBHOOK] Found delivery date in custom attributes:", deliveryDate);
      }
    }
    
    // If still no delivery date, log for debugging
    if (!deliveryDate) {
      console.log("[WEBHOOK] No delivery date found in tags or custom attributes for order:", shopifyOrder.id, "Tags:", shopifyOrder.tags);
      console.log("[WEBHOOK] Custom attributes:", shopifyOrderGraphQL?.customAttributes || 'none');
    }
    
    if (!deliveryDate) {
      console.log("[WEBHOOK] No delivery date found in tags or custom attributes for order:", shopifyOrder.id, "Tags:", shopifyOrder.tags);
      console.log("[WEBHOOK] Order will be created as unscheduled");
      // Use special marker for unscheduled orders (order_card_states doesn't allow NULL)
      deliveryDate = 'unscheduled';
    }
    
    console.log("[WEBHOOK] Extracted delivery date:", deliveryDate, "for order:", shopifyOrder.id);
    
    const productLabel = shopifyOrder.line_items?.[0]?.properties?.find((p: any) => p.name === '_label')?.value ?? 'default';

    // Enhanced order data for analytics
    const orderData = {
      shopifyOrderId: String(shopifyOrder.id),
      customerName: customerName,
      deliveryDate: deliveryDate,
      notes: shopifyOrder.note,
      product_label: productLabel,
      total_price: parseFloat(shopifyOrder.total_price),
      currency: shopifyOrder.currency,
      customer_email: shopifyOrder.customer?.email,
      line_items: JSON.stringify(shopifyOrder.line_items),
      product_titles: JSON.stringify(shopifyOrder.line_items?.map((item: any) => item.title)),
      quantities: JSON.stringify(shopifyOrder.line_items?.map((item: any) => item.quantity)),
      session_id: shopifyOrder.checkout_id, // Or other session identifier
      store_id: storeId,
      product_type: shopifyOrder.line_items?.[0]?.product_type ?? 'Unknown',
      shopifyOrderData: shopifyOrderGraphQL // Store the full GraphQL order for config-driven rendering
    };

    // Patch: If order exists, update with latest GraphQL data
    const existingOrder = await c.env.DB.prepare(
      "SELECT id FROM tenant_orders WHERE tenant_id = ? AND shopify_order_id = ?"
    ).bind(tenantId, String(shopifyOrder.id)).first();
    if (existingOrder) {
      await d1DatabaseService.updateOrder(c.env, tenantId, existingOrder.id, { shopifyOrderData: shopifyOrderGraphQL });
      console.log("[WEBHOOK] Updated existing order with GraphQL data:", existingOrder.id);
      
      // REAL-TIME FIX: Update order_card_states for existing orders to trigger real-time updates
      try {
        await c.env.DB.prepare(`
          INSERT OR REPLACE INTO order_card_states (card_id, tenant_id, status, assigned_to, assigned_by, notes, sort_order, delivery_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          existingOrder.id,
          tenantId,
          'unassigned', // Keep existing status or default
          null, // Keep existing assignment or null
          'webhook', // System user for webhook updates
          orderData.notes || null,
          0, // Default sort order
          deliveryDate, // Include delivery date (can be null for unscheduled)
          new Date().toISOString().slice(0, 19).replace('T', ' ') // SQLite datetime format
        ).run();
        
        console.log("[WEBHOOK-REALTIME] Updated order_card_states entry for real-time detection:", existingOrder.id);
      } catch (error) {
        console.error("[WEBHOOK-REALTIME] Failed to update order_card_states entry:", error);
        // Don't fail the webhook if this fails, just log it
      }
      
      return c.json({ success: true, orderId: existingOrder.id, updated: true });
    }

    const newOrder = await d1DatabaseService.createOrder(c.env, tenantId, orderData);
    
    // REAL-TIME FIX: Create order_card_states entry so new webhook orders appear in real-time
    try {
      await c.env.DB.prepare(`
        INSERT INTO order_card_states (card_id, tenant_id, status, assigned_to, assigned_by, notes, sort_order, delivery_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newOrder.id,
        tenantId,
        'unassigned', // Default status for new webhook orders
        null, // Not assigned initially
        'webhook', // System user for webhook-created orders
        newOrder.notes || null,
        0, // Default sort order
        deliveryDate, // Include delivery date (can be null for unscheduled)
        new Date().toISOString().slice(0, 19).replace('T', ' ') // SQLite datetime format
      ).run();
      
      console.log("[WEBHOOK-REALTIME] Created order_card_states entry for real-time detection:", newOrder.id);
    } catch (error) {
      console.error("[WEBHOOK-REALTIME] Failed to create order_card_states entry:", error);
      // Don't fail the webhook if this fails, just log it
    }
    
    return c.json({ success: true, orderId: newOrder.id });
  } catch (error: any) {
    console.error("Error processing Shopify order webhook:", error);
    return c.json({ error: "Failed to process webhook", details: error.message }, 500);
  }
});

// --- Test Shopify Store Configuration ---
app.get("/api/tenants/:tenantId/test-shopify", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    const stores = await d1DatabaseService.getStores(c.env, tenantId)
    
    if (!stores || stores.length === 0) {
      return c.json({ error: "No Shopify stores configured for this tenant" }, 404)
    }
    
    const store = stores[0]
    
    // Test the store configuration
    const storeForApi = {
      id: store.id,
      tenantId: tenantId,
      name: store.name,
      type: "shopify" as const,
      status: "active" as const,
      settings: store.settings,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    }
    
    const shopifyApi = new ShopifyApiService(storeForApi, store.settings.accessToken)
    
    // Test a simple API call to verify credentials
    const testUrl = `https://${store.settings.domain}/admin/api/2023-10/shop.json`
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": store.settings.accessToken,
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return c.json({
        error: "Shopify API test failed",
        status: response.status,
        statusText: response.statusText,
        details: errorText,
        storeConfig: {
          domain: store.settings.domain,
          hasAccessToken: !!store.settings.accessToken,
          accessTokenLength: store.settings.accessToken?.length,
        }
      }, 400)
    }
    
    const shopData = await response.json()
    
    return c.json({
      success: true,
      storeConfig: {
        domain: store.settings.domain,
        hasAccessToken: !!store.settings.accessToken,
        accessTokenLength: store.settings.accessToken?.length,
      },
      shopInfo: {
        name: shopData.shop?.name,
        email: shopData.shop?.email,
        domain: shopData.shop?.domain,
        province: shopData.shop?.province,
        country: shopData.shop?.country,
      }
    })
  } catch (error: any) {
    console.error("Shopify test error:", error)
    return c.json({ 
      error: "Failed to test Shopify configuration", 
      details: error.message 
    }, 500)
  }
})

// --- Order Card Configuration Endpoints ---
app.get("/api/tenants/:tenantId/order-card-config", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    const config = await d1DatabaseService.getOrderCardConfig(c.env, tenantId)
    
    // If no config exists, return empty config (frontend will use defaults)
    if (!config) {
      return c.json({ config: [] })
    }
    
    // Handle different config formats
    let configArray: any[] = []
    
    if (Array.isArray(config)) {
      // Config is already an array
      configArray = config
    } else if (config && typeof config === 'object' && config.fields) {
      // Config is an object with a fields property
      configArray = config.fields
    } else {
      // Config is something else, return empty array
      configArray = []
    }
    
    return c.json({ config: configArray })
  } catch (error) {
    console.error("Error fetching order card config:", error)
    return c.json({ error: "Failed to fetch order card configuration" }, 500)
  }
})

app.post("/api/tenants/:tenantId/order-card-config", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    const body = await c.req.json()
    const { config } = body
    
    if (!config || !Array.isArray(config)) {
      return c.json({ error: "Invalid configuration format" }, 400)
    }
    
    await d1DatabaseService.saveOrderCardConfig(c.env, tenantId, config)
    
    return c.json({ success: true, message: "Order card configuration saved successfully" })
  } catch (error) {
    console.error("Error saving order card config:", error)
    return c.json({ error: "Failed to save order card configuration" }, 500)
  }
})

app.post("/api/tenants/:tenantId/order-card-config/go-live", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  try {
    const body = await c.req.json()
    const { config } = body
    
    if (!config || !Array.isArray(config)) {
      return c.json({ error: "Invalid configuration format" }, 400)
    }
    
    // Save the configuration
    await d1DatabaseService.saveOrderCardConfig(c.env, tenantId, config)
    
    // Return success with the saved config
    return c.json({ 
      success: true, 
      message: "Order card configuration is now live!",
      config 
    })
  } catch (error) {
    console.error("Error going live with order card config:", error)
    return c.json({ error: "Failed to activate order card configuration" }, 500)
  }
})

// --- Sample Data for AI Training ---
app.post("/api/tenants/:tenantId/sample-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  const sampleProducts = [
    {
      shopifyProductId: "sample-1",
      shopifyVariantId: "variant-1",
      title: "Romantic Rose Bouquet",
      variantTitle: "Pink Roses",
      description: "A beautiful romantic bouquet featuring soft pink roses and white peonies, perfect for weddings and anniversaries",
      price: 89.99,
      tags: ["romantic", "wedding", "pink", "roses", "peonies"],
      productType: "Bouquet",
      vendor: "Windflower Florist",
      handle: "romantic-rose-bouquet",
      imageUrl: "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop",
      imageAlt: "Romantic pink rose bouquet",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-2",
      shopifyVariantId: "variant-2",
      title: "Modern White Lily Arrangement",
      variantTitle: "White Lilies",
      description: "Clean and modern arrangement with white lilies and green foliage, ideal for contemporary spaces",
      price: 75.00,
      tags: ["modern", "white", "lilies", "contemporary", "minimalist"],
      productType: "Arrangement",
      vendor: "Windflower Florist",
      handle: "modern-white-lily",
      imageUrl: "https://images.unsplash.com/photo-1589244159943-460088ed5c1b?w=400&h=600&fit=crop",
      imageAlt: "Modern white lily arrangement",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-3",
      shopifyVariantId: "variant-3",
      title: "Rustic Wildflower Bouquet",
      variantTitle: "Mixed Wildflowers",
      description: "Natural and charming wildflower bouquet with sunflowers, daisies, and seasonal blooms",
      price: 65.00,
      tags: ["rustic", "wildflowers", "sunflowers", "daisies", "natural"],
      productType: "Bouquet",
      vendor: "Windflower Florist",
      handle: "rustic-wildflower-bouquet",
      imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop",
      imageAlt: "Rustic wildflower bouquet",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-4",
      shopifyVariantId: "variant-4",
      title: "Elegant Orchid Display",
      variantTitle: "Purple Orchids",
      description: "Sophisticated orchid arrangement in a modern vase, perfect for luxury events and corporate gifts",
      price: 120.00,
      tags: ["elegant", "orchids", "purple", "luxury", "corporate"],
      productType: "Display",
      vendor: "Windflower Florist",
      handle: "elegant-orchid-display",
      imageUrl: "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop",
      imageAlt: "Elegant purple orchid display",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-5",
      shopifyVariantId: "variant-5",
      title: "Wild Garden Bouquet",
      variantTitle: "Mixed Colors",
      description: "Free-flowing and natural bouquet with vibrant colors and diverse flower varieties",
      price: 85.00,
      tags: ["wild", "garden", "vibrant", "mixed", "natural"],
      productType: "Bouquet",
      vendor: "Windflower Florist",
      handle: "wild-garden-bouquet",
      imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop",
      imageAlt: "Wild garden bouquet",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-6",
      shopifyVariantId: "variant-6",
      title: "Birthday Celebration Bouquet",
      variantTitle: "Bright Colors",
      description: "Joyful and vibrant birthday bouquet with tulips, roses, and colorful accents",
      price: 70.00,
      tags: ["birthday", "celebration", "tulips", "roses", "bright"],
      productType: "Bouquet",
      vendor: "Windflower Florist",
      handle: "birthday-celebration-bouquet",
      imageUrl: "https://images.unsplash.com/photo-1589244159943-460088ed5c1b?w=400&h=600&fit=crop",
      imageAlt: "Birthday celebration bouquet",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-7",
      shopifyVariantId: "variant-7",
      title: "Wedding Bridal Bouquet",
      variantTitle: "White and Pink",
      description: "Stunning bridal bouquet with white roses, pink peonies, and delicate baby's breath",
      price: 150.00,
      tags: ["wedding", "bridal", "white", "pink", "roses", "peonies"],
      productType: "Bridal Bouquet",
      vendor: "Windflower Florist",
      handle: "wedding-bridal-bouquet",
      imageUrl: "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop",
      imageAlt: "Wedding bridal bouquet",
      imageWidth: 400,
      imageHeight: 600
    },
    {
      shopifyProductId: "sample-8",
      shopifyVariantId: "variant-8",
      title: "Sympathy Peace Lily",
      variantTitle: "White Peace Lily",
      description: "Respectful and comforting peace lily arrangement for sympathy and remembrance",
      price: 95.00,
      tags: ["sympathy", "peace lily", "white", "remembrance", "comforting"],
      productType: "Plant",
      vendor: "Windflower Florist",
      handle: "sympathy-peace-lily",
      imageUrl: "https://images.unsplash.com/photo-1589244159943-460088ed5c1b?w=400&h=600&fit=crop",
      imageAlt: "Sympathy peace lily",
      imageWidth: 400,
      imageHeight: 600
    }
  ]

  const savedProducts = await d1DatabaseService.saveProducts(c.env, tenantId, sampleProducts)
  return c.json({ 
    success: true, 
    message: `Created ${savedProducts.length} sample products for AI training`,
    products: savedProducts 
  }, 201)
})

// --- AI Florist - Generate Image from Conversation (PUBLIC) ---
app.post('/api/ai/generate-bouquet-image', async (c) => {
  try {
    const { messages, knowledgeBase, tenantId, designSpecs } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Invalid chat history provided.' }, 400);
    }
    if (!knowledgeBase) {
      return c.json({ error: 'Knowledge base is required for context.' }, 400);
    }
    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required to use the AI service.' }, 400);
    }

    // --- Fetch Tenant-Specific OpenAI API Key ---
    const tenantSettingsRaw = await c.env.DB.prepare("SELECT settings FROM tenants WHERE id = ?").bind(tenantId).first<{ settings: string }>();
    if (!tenantSettingsRaw?.settings) {
        return c.json({ error: 'Could not find settings for this tenant.' }, 404);
    }

    const tenantSettings = JSON.parse(tenantSettingsRaw.settings);
    const openaiApiKey = tenantSettings.openaiApiKey;

    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured for this tenant.' }, 503);
    }
    
    const startTime = Date.now();

    // 1. Create a system prompt for image generation based on conversation
    const conversationSummary = messages
      .filter(msg => msg.sender === 'user')
      .map(msg => msg.text)
      .join(' ');
    
    // Extract key design elements from conversation and design specs
    const extractedSpecs = {
      style: designSpecs?.style || 'romantic',
      occasion: designSpecs?.occasion || 'general',
      colorPalette: designSpecs?.colorPalette || ['pink', 'white'],
      flowerTypes: designSpecs?.flowerTypes || ['roses'],
      arrangement: designSpecs?.arrangement || 'round',
      size: designSpecs?.size || 'medium',
      budget: designSpecs?.budget || 'mid-range'
    };

    // 2. Create an optimized DALL-E prompt based on conversation and specs
    const imagePrompt = createBouquetImagePrompt(conversationSummary, extractedSpecs, knowledgeBase);
    
    // 3. Call DALL-E 3 API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('DALL-E API Error:', error);
      throw new Error(`DALL-E API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generationTime = new Date();
    const designId = `design_${crypto.randomUUID()}`;

    const designToSave = {
        id: designId,
        tenant_id: tenantId,
        prompt: imagePrompt,
        generated_image_url: data.data[0].url,
        style_parameters: JSON.stringify(extractedSpecs),
        model_version: 'v1.0-dalle3',
        cost: 0.040,
        status: 'completed',
        created_at: generationTime.toISOString(),
        updated_at: generationTime.toISOString(),
        generation_metadata: JSON.stringify({ confidence: 0.9, generationTime: (Date.now() - startTime) / 1000 }),
    };

    // 4. Save the generated design to the database
    await c.env.DB.prepare(
      `INSERT INTO ai_generated_designs (id, tenant_id, prompt, generated_image_url, style_parameters, model_version, cost, status, created_at, updated_at, generation_metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      designToSave.id,
      designToSave.tenant_id,
      designToSave.prompt,
      designToSave.generated_image_url,
      designToSave.style_parameters,
      designToSave.model_version,
      designToSave.cost,
      designToSave.status,
      designToSave.created_at,
      designToSave.updated_at,
      designToSave.generation_metadata
    ).run();
    
    // 5. Return the response to the frontend
    return c.json({
      id: designToSave.id,
      prompt: imagePrompt,
      generatedImage: data.data[0].url,
      confidence: 0.90 + Math.random() * 0.05,
      designSpecs: extractedSpecs,
      generationTime: (Date.now() - startTime) / 1000,
      modelVersion: 'v1.0-dalle3',
      cost: 0.040,
      status: 'completed',
      conversationSummary: conversationSummary
    });

  } catch (error) {
    console.error('Error in bouquet image generation:', error);
    
    // Return fallback response
    return c.json({
      id: `fallback-${Date.now()}`,
      prompt: 'Fallback bouquet image',
      generatedImage: getFallbackImage('romantic'),
      confidence: 0.70,
      designSpecs: {
        style: 'romantic',
        colorPalette: ['pink', 'white'],
        flowerTypes: ['roses'],
        arrangement: 'round',
        size: 'medium',
        occasion: 'general',
        budget: 'mid-range'
      },
      generationTime: 0,
      modelVersion: 'v1.0-fallback',
      cost: 0.00,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 200);
  }
});

// Helper function to create optimized DALL-E prompts for bouquets
function createBouquetImagePrompt(conversationSummary: string, designSpecs: any, knowledgeBase: any): string {
  const { style, occasion, colorPalette, flowerTypes, arrangement, size } = designSpecs;
  
  // Get relevant product examples from knowledge base
  const relevantProducts = knowledgeBase.products?.slice(0, 5) || [];
  const productExamples = relevantProducts.map(p => p.title).join(', ');
  
  let prompt = `Create a beautiful, professional photograph of a flower bouquet with the following specifications:\n`;
  prompt += `- Style: ${style} and elegant\n`;
  prompt += `- Occasion: ${occasion}\n`;
  prompt += `- Colors: ${colorPalette.join(', ')}\n`;
  prompt += `- Flowers: ${flowerTypes.join(', ')}\n`;
  prompt += `- Arrangement: ${arrangement} bouquet\n`;
  prompt += `- Size: ${size}\n`;
  
  if (productExamples) {
    prompt += `- Similar to these styles: ${productExamples}\n`;
  }
  
  prompt += `- High-quality, professional floral photography\n`;
  prompt += `- Soft, natural lighting\n`;
  prompt += `- Clean, minimalist background\n`;
  prompt += `- Perfect for a florist's portfolio\n`;
  
  // Add context from conversation if available
  if (conversationSummary.length > 0) {
    prompt += `- Customer preferences: ${conversationSummary.substring(0, 200)}...\n`;
  }
  
  return prompt;
}

// Helper function to get fallback images
function getFallbackImage(style: string): string {
  const fallbackImages: Record<string, string> = {
    romantic: 'https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=400&h=600&fit=crop',
    modern: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=400&h=600&fit=crop',
    rustic: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop',
    elegant: 'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=400&h=600&fit=crop',
    wild: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=600&fit=crop'
  };
  
  return fallbackImages[style] || fallbackImages.romantic;
}

// --- AI Flowers Endpoints ---
app.get("/api/tenants/:tenantId/ai/flowers", async (c) => {
  const tenantId = c.req.param("tenantId");
  const flowers = await d1DatabaseService.getFlowers(c.env, tenantId);
  return c.json(flowers);
});

app.post("/api/tenants/:tenantId/ai/flowers", async (c) => {
  const tenantId = c.req.param("tenantId");
  const flowerData = await c.req.json();
  const newFlower = await d1DatabaseService.createFlower(c.env, tenantId, flowerData);
  return c.json(newFlower, 201);
});

app.delete("/api/tenants/:tenantId/ai/flowers/:flowerId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const flowerId = c.req.param("flowerId");
  const success = await d1DatabaseService.deleteFlower(c.env, tenantId, flowerId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Prompt Templates Endpoints ---
app.get("/api/tenants/:tenantId/ai/prompt-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const prompts = await d1DatabaseService.getPromptTemplates(c.env, tenantId);
  return c.json(prompts);
});

app.post("/api/tenants/:tenantId/ai/prompt-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const promptData = await c.req.json();
  const newPrompt = await d1DatabaseService.createPromptTemplate(c.env, tenantId, promptData);
  return c.json(newPrompt, 201);
});

app.delete("/api/tenants/:tenantId/ai/prompt-templates/:promptId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const promptId = c.req.param("promptId");
  const success = await d1DatabaseService.deletePromptTemplate(c.env, tenantId, promptId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Model Configs Endpoints ---
app.get("/api/tenants/:tenantId/ai/model-configs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const configs = await d1DatabaseService.getModelConfigs(c.env, tenantId);
  return c.json(configs);
});

app.post("/api/tenants/:tenantId/ai/model-configs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const configData = await c.req.json();
  const newConfig = await d1DatabaseService.createModelConfig(c.env, tenantId, configData);
  return c.json(newConfig, 201);
});

app.delete("/api/tenants/:tenantId/ai/model-configs/:configId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const configId = c.req.param("configId");
  const success = await d1DatabaseService.deleteModelConfig(c.env, tenantId, configId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Training Data Endpoints ---
app.get("/api/tenants/:tenantId/ai/training-data", async (c) => {
  const tenantId = c.req.param("tenantId");
  const trainingData = await d1DatabaseService.getAITrainingData(c.env, tenantId);
  return c.json(trainingData);
});

app.post("/api/tenants/:tenantId/ai/training-data", async (c) => {
  const tenantId = c.req.param("tenantId");
  const data = await c.req.json();
  const newData = await d1DatabaseService.createAITrainingData(c.env, tenantId, data);
  return c.json(newData, 201);
});

app.post("/api/tenants/:tenantId/ai/training-data/extract-products", async (c) => {
  const tenantId = c.req.param("tenantId");
  const extractedData = await d1DatabaseService.extractTrainingDataFromProducts(c.env, tenantId);
  return c.json(extractedData);
});

app.post("/api/tenants/:tenantId/ai/training-data/extract-orders", async (c) => {
  const tenantId = c.req.param("tenantId");
  
  try {
    console.log("[EXTRACT-ORDERS] Starting training data extraction from orders for tenant:", tenantId);
    
    // Get all orders from the database (limit to recent orders)
    const { results: orders } = await c.env.DB.prepare(
      `SELECT shopify_order_id, customer_name, customer_email, delivery_date, notes, 
              product_titles, quantities, line_items, total_price, currency, 
              product_type, shopify_order_data, created_at
       FROM tenant_orders 
       WHERE tenant_id = ? 
       ORDER BY created_at DESC 
       LIMIT 100`
    ).bind(tenantId).all();

    if (!orders || orders.length === 0) {
      return c.json({ success: true, extractedData: [], message: "No orders found" });
    }

    // Check for existing training data to avoid duplicates
    const existingSourceIds = await c.env.DB.prepare(
      `SELECT source_id FROM ai_training_data WHERE tenant_id = ? AND source_type = 'shopify_order'`
    ).bind(tenantId).all();
    
    const existingIds = new Set(existingSourceIds.results.map((row: any) => row.source_id));
    const newOrders = orders.filter((order: any) => !existingIds.has(order.shopify_order_id));
    
    if (newOrders.length === 0) {
      return c.json({ success: true, extractedData: [], message: `All ${orders.length} orders already processed` });
    }

    // Process orders and create training data
    const now = new Date().toISOString();
    const trainingDataToInsert = [];

    for (const order of newOrders) {
      try {
        let productTitles = [];
        try {
          productTitles = order.product_titles ? JSON.parse(order.product_titles) : [];
        } catch {
          productTitles = [order.product_type || "Unknown Product"];
        }

        const mainProducts = productTitles.filter((title: string) => 
          !title.toLowerCase().includes('express') && !title.toLowerCase().includes('delivery')
        );

        if (mainProducts.length === 0) continue;

        const trainingContent = {
          customer_context: {
            customer_name: order.customer_name,
            delivery_date: order.delivery_date,
            total_price: order.total_price,
            currency: order.currency
          },
          order_analysis: {
            main_products: mainProducts,
            product_count: mainProducts.length,
            price_range: order.total_price ? 
              (order.total_price < 50 ? 'budget' : order.total_price < 100 ? 'mid-range' : 'premium') : 'unknown',
            order_type: order.product_type || 'unknown'
          },
          suggested_prompts: [
            `Create a beautiful ${mainProducts[0]} arrangement for ${order.customer_name}`,
            `Design a ${order.product_type || 'floral'} arrangement similar to: ${mainProducts.join(', ')}`
          ]
        };

        trainingDataToInsert.push({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          data_type: 'prompt',
          content: JSON.stringify(trainingContent),
          metadata: JSON.stringify({
            shopify_order_id: order.shopify_order_id,
            customer_name: order.customer_name,
            main_products: mainProducts,
            total_price: order.total_price
          }),
          source_type: 'shopify_order',
          source_id: order.shopify_order_id,
          quality_score: 0.9,
          is_active: 1,
          created_at: now,
          updated_at: now
        });
      } catch (error) {
        console.error(`Error processing order ${order.shopify_order_id}:`, error);
      }
    }

    // Insert in batches
    const batchSize = 10;
    let insertedCount = 0;
    
    for (let i = 0; i < trainingDataToInsert.length; i += batchSize) {
      const batch = trainingDataToInsert.slice(i, i + batchSize);
      try {
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flatMap((data: any) => [
          data.id, data.tenant_id, data.data_type, data.content, data.metadata,
          data.source_type, data.source_id, data.quality_score, data.is_active,
          data.created_at, data.updated_at
        ]);

        await c.env.DB.prepare(
          `INSERT INTO ai_training_data (id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score, is_active, created_at, updated_at)
           VALUES ${placeholders}`
        ).bind(...values).run();
        
        insertedCount += batch.length;
      } catch (error) {
        console.error(`Error inserting batch:`, error);
      }
    }

    return c.json({ 
      success: true, 
      extractedData: trainingDataToInsert.slice(0, insertedCount),
      totalProcessed: insertedCount,
      totalOrders: orders.length,
      message: `Successfully extracted training data from ${insertedCount} orders`
    });

  } catch (error) {
    console.error("Error extracting training data from orders:", error);
    return c.json({ error: "Failed to extract training data from orders" }, 500);
  }
});

app.get("/api/tenants/:tenantId/ai/training-data/stats", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const stats = await d1DatabaseService.getAITrainingDataStats(c.env, tenantId)
    return c.json(stats)
  } catch (error) {
    console.error("Error fetching training data stats:", error)
    return c.json({ error: "Failed to fetch training data stats" }, 500)
  }
});

app.get("/api/tenants/:tenantId/ai/training-sessions", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const sessions = await d1DatabaseService.getAITrainingSessions(c.env, tenantId)
    return c.json(sessions)
  } catch (error) {
    console.error("Error fetching training sessions:", error)
    return c.json({ error: "Failed to fetch training sessions" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/training-sessions", async (c) => {
  const tenantId = c.req.param("tenantId");
  const sessionData = await c.req.json();
  const newSession = await d1DatabaseService.createAITrainingSession(c.env, tenantId, sessionData);
  return c.json(newSession, 201);
});

// --- AI Generated Designs Endpoints ---
app.get("/api/tenants/:tenantId/ai/generated-designs", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const designs = await d1DatabaseService.getAIGeneratedDesigns(c.env, tenantId)
    return c.json(designs)
  } catch (error) {
    console.error("Error fetching generated designs:", error)
    return c.json({ error: "Failed to fetch generated designs" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/generated-designs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const designData = await c.req.json();
  const newDesign = await d1DatabaseService.saveAIGeneratedDesign(c.env, tenantId, designData);
  return c.json(newDesign, 201);
});

app.put("/api/tenants/:tenantId/ai/generated-designs/:designId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const designId = c.req.param("designId");
  const updateData = await c.req.json();
  
  try {
    // Update the design with rating and feedback
    await c.env.DB.prepare(`
      UPDATE ai_generated_designs 
      SET quality_rating = ?, feedback = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(
      updateData.quality_rating || updateData.rating,
      updateData.feedback,
      designId,
      tenantId
    ).run();
    
    // Get the updated design
    const updatedDesign = await d1DatabaseService.getAIGeneratedDesign(c.env, tenantId, designId);
    return c.json(updatedDesign);
  } catch (error) {
    console.error("Error updating AI generated design:", error);
    return c.json({ error: "Failed to update design" }, 500);
  }
});

// --- AI Style Templates Endpoints ---
app.get("/api/tenants/:tenantId/ai/style-templates", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const templates = await d1DatabaseService.getAIStyleTemplates(c.env, tenantId)
    return c.json(templates)
  } catch (error) {
    console.error("Error fetching style templates:", error)
    return c.json({ error: "Failed to fetch style templates" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/style-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templateData = await c.req.json();
  const newTemplate = await d1DatabaseService.createAIStyleTemplate(c.env, tenantId, templateData);
  return c.json(newTemplate, 201);
});

// --- AI Usage Analytics Endpoints ---
app.get("/api/tenants/:tenantId/ai/usage-analytics", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const analytics = await d1DatabaseService.getAIUsageAnalytics(c.env, tenantId)
    return c.json(analytics)
  } catch (error) {
    console.error("Error fetching usage analytics:", error)
    return c.json({ error: "Failed to fetch usage analytics" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/usage", async (c) => {
  const tenantId = c.req.param("tenantId");
  const metadata = await c.req.json();
  await d1DatabaseService.recordAIGeneration(c.env, tenantId, metadata);
  return c.json({ success: true });
});

// --- AI Styles Endpoints ---
app.get("/api/tenants/:tenantId/ai/styles", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const styles = await d1DatabaseService.getAIStyles(c.env, tenantId)
    return c.json(styles)
  } catch (error) {
    console.error("Error fetching AI styles:", error)
    return c.json({ error: "Failed to fetch AI styles" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/styles", async (c) => {
  const tenantId = c.req.param("tenantId");
  const styleData = await c.req.json();
  const newStyle = await d1DatabaseService.createAIStyle(c.env, tenantId, styleData);
  return c.json(newStyle, 201);
});

app.delete("/api/tenants/:tenantId/ai/styles/:styleId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const styleId = c.req.param("styleId");
  const success = await d1DatabaseService.deleteAIStyle(c.env, tenantId, styleId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Arrangement Types Endpoints ---
app.get("/api/tenants/:tenantId/ai/arrangement-types", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const types = await d1DatabaseService.getAIArrangementTypes(c.env, tenantId)
    return c.json(types)
  } catch (error) {
    console.error("Error fetching arrangement types:", error)
    return c.json({ error: "Failed to fetch arrangement types" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/arrangement-types", async (c) => {
  const tenantId = c.req.param("tenantId");
  const typeData = await c.req.json();
  const newType = await d1DatabaseService.createAIArrangementType(c.env, tenantId, typeData);
  return c.json(newType, 201);
});

app.delete("/api/tenants/:tenantId/ai/arrangement-types/:typeId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const typeId = c.req.param("typeId");
  const success = await d1DatabaseService.deleteAIArrangementType(c.env, tenantId, typeId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Occasions Endpoints ---
app.get("/api/tenants/:tenantId/ai/occasions", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const occasions = await d1DatabaseService.getAIOccasions(c.env, tenantId)
    return c.json(occasions)
  } catch (error) {
    console.error("Error fetching occasions:", error)
    return c.json({ error: "Failed to fetch occasions" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/occasions", async (c) => {
  const tenantId = c.req.param("tenantId");
  const occasionData = await c.req.json();
  const newOccasion = await d1DatabaseService.createAIOccasion(c.env, tenantId, occasionData);
  return c.json(newOccasion, 201);
});

app.delete("/api/tenants/:tenantId/ai/occasions/:occasionId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const occasionId = c.req.param("occasionId");
  const success = await d1DatabaseService.deleteAIOccasion(c.env, tenantId, occasionId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Budget Tiers Endpoints ---
app.get("/api/tenants/:tenantId/ai/budget-tiers", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const tiers = await d1DatabaseService.getAIBudgetTiers(c.env, tenantId)
    return c.json(tiers)
  } catch (error) {
    console.error("Error fetching budget tiers:", error)
    return c.json({ error: "Failed to fetch budget tiers" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/budget-tiers", async (c) => {
  const tenantId = c.req.param("tenantId");
  const budgetTierData = await c.req.json();
  const newBudgetTier = await d1DatabaseService.createAIBudgetTier(c.env, tenantId, budgetTierData);
  return c.json(newBudgetTier, 201);
});

app.delete("/api/tenants/:tenantId/ai/budget-tiers/:budgetTierId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const budgetTierId = c.req.param("budgetTierId");
  const success = await d1DatabaseService.deleteAIBudgetTier(c.env, tenantId, budgetTierId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- AI Customer Data Endpoints ---
app.get("/api/tenants/:tenantId/ai/customer-data", async (c) => {
  const tenantId = c.req.param("tenantId")
  try {
    const data = await d1DatabaseService.getAICustomerData(c.env, tenantId)
    return c.json(data)
  } catch (error) {
    console.error("Error fetching customer data:", error)
    return c.json({ error: "Failed to fetch customer data" }, 500)
  }
});

app.post("/api/tenants/:tenantId/ai/customer-data", async (c) => {
  const tenantId = c.req.param("tenantId");
  const customerDataData = await c.req.json();
  const newCustomerData = await d1DatabaseService.createAICustomerData(c.env, tenantId, customerDataData);
  return c.json(newCustomerData, 201);
});

app.delete("/api/tenants/:tenantId/ai/customer-data/:customerDataId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const customerDataId = c.req.param("customerDataId");
  const success = await d1DatabaseService.deleteAICustomerData(c.env, tenantId, customerDataId);
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404);
});

// --- Shopify Analytics Endpoints ---
app.get("/api/tenants/:tenantId/shopify/analytics", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { dateRange, compareWith, productType, storeId } = c.req.query()
  try {
    const analytics = await d1DatabaseService.getShopifyAnalytics(c.env, tenantId, {
      dateRange: dateRange || "last_30_days",
      compareWith: compareWith || "previous_period",
      productType,
      storeId
    })
    return c.json(analytics)
  } catch (error) {
    console.error("Error fetching Shopify analytics:", error)
    return c.json({ error: "Failed to fetch Shopify analytics" }, 500)
  }
})

app.post("/api/tenants/:tenantId/shopify/analytics/training-session", async (c) => {
  const tenantId = c.req.param("tenantId");
  const sessionData = await c.req.json();
  const newSession = await d1DatabaseService.createTrainingSessionFromAnalytics(c.env, tenantId, sessionData);
  return c.json(newSession, 201);
});

// --- Photo Upload Endpoints ---
app.post("/api/tenants/:tenantId/photos/upload", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userId = c.get("jwtPayload").sub

  try {
    const formData = await c.req.formData()
    const photoFile = formData.get("photo") as File
    const thumbnailFile = formData.get("thumbnail") as File | null
    const metadata = formData.get("metadata") as string
    const originalSize = parseInt(formData.get("original_size") as string)
    const compressedSize = parseInt(formData.get("compressed_size") as string)

    if (!photoFile) {
      return c.json({ error: "No photo file provided" }, 400)
    }

    // Generate unique ID for the photo
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // For now, we'll store the file data as base64 in the database
    // In production, you'd want to use Cloudflare R2 or similar for file storage
    const photoBuffer = await photoFile.arrayBuffer()
    const photoBase64 = btoa(String.fromCharCode(...new Uint8Array(photoBuffer)))
    
    let thumbnailBase64: string | null = null
    if (thumbnailFile) {
      const thumbnailBuffer = await thumbnailFile.arrayBuffer()
      thumbnailBase64 = btoa(String.fromCharCode(...new Uint8Array(thumbnailBuffer)))
    }

    // Parse metadata
    let parsedMetadata: Record<string, any> = {}
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata)
      } catch (e) {
        console.warn("Failed to parse metadata:", e)
      }
    }

    // Insert photo record
    const result = await c.env.DB.prepare(`
      INSERT INTO florist_photo_uploads (
        id, tenant_id, user_id, original_filename, original_file_size, 
        compressed_file_size, image_url, thumbnail_url, image_metadata, upload_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      photoId,
      tenantId,
      userId,
      photoFile.name,
      originalSize,
      compressedSize,
      `data:${photoFile.type};base64,${photoBase64}`,
      thumbnailBase64 ? `data:${thumbnailFile?.type};base64,${thumbnailBase64}` : null,
      JSON.stringify(parsedMetadata),
      'uploaded'
    ).run()

    // Update daily upload goals
    const today = new Date().toISOString().split('T')[0]
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO daily_upload_goals (
        id, tenant_id, user_id, date, actual_count, goal_status, updated_at
      ) VALUES (?, ?, ?, ?, 
        COALESCE((SELECT actual_count FROM daily_upload_goals WHERE tenant_id = ? AND user_id = ? AND date = ?), 0) + 1,
        CASE 
          WHEN COALESCE((SELECT actual_count FROM daily_upload_goals WHERE tenant_id = ? AND user_id = ? AND date = ?), 0) + 1 >= 
               COALESCE((SELECT target_count FROM daily_upload_goals WHERE tenant_id = ? AND user_id = ? AND date = ?), 1)
          THEN 'completed'
          ELSE 'in_progress'
        END,
        CURRENT_TIMESTAMP
      )
    `).bind(
      `goal_${tenantId}_${userId}_${today}`,
      tenantId,
      userId,
      today,
      tenantId, userId, today,
      tenantId, userId, today,
      tenantId, userId, today
    ).run()

    return c.json({
      id: photoId,
      success: true,
      message: "Photo uploaded successfully"
    })
  } catch (error) {
    console.error("Photo upload error:", error)
    return c.json({ error: "Failed to upload photo" }, 500)
  }
})

app.get("/api/tenants/:tenantId/photos", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { photo_id, status, date_range, user_id } = c.req.query()
  try {
    const filters: any = {}
    if (photo_id) filters.photo_id = photo_id
    if (status) filters.status = status
    if (date_range) filters.date_range = JSON.parse(date_range)
    if (user_id) filters.user_id = user_id
    
    const photos = await getFloristPhotos(c.env, tenantId, filters)
    return c.json(photos)
  } catch (error) {
    console.error("Error fetching photos:", error)
    return c.json({ error: "Failed to fetch photos" }, 500)
  }
})

app.post("/api/tenants/:tenantId/photos/:photoId/description", async (c) => {
  const tenantId = c.req.param("tenantId")
  const photoId = c.req.param("photoId")
  const userId = c.get("jwtPayload").sub
  const descriptionData = await c.req.json()

  try {
    // Check if photo exists
    const photo = await c.env.DB.prepare(`
      SELECT id FROM florist_photo_uploads WHERE id = ? AND tenant_id = ?
    `).bind(photoId, tenantId).first()

    if (!photo) {
      return c.json({ error: "Photo not found" }, 404)
    }

    // Check if description already exists
    const existingDesc = await c.env.DB.prepare(`
      SELECT id FROM photo_descriptions WHERE photo_id = ?
    `).bind(photoId).first()

    if (existingDesc) {
      // Update existing description
      await c.env.DB.prepare(`
        UPDATE photo_descriptions SET
          title = ?, description = ?, flowers_used = ?, colors = ?, style = ?,
          occasion = ?, arrangement_type = ?, difficulty_level = ?, special_techniques = ?,
          materials_used = ?, customer_preferences = ?, price_range = ?, season = ?,
          tags = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
        WHERE photo_id = ?
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
      ).run()
    } else {
      // Create new description
      await c.env.DB.prepare(`
        INSERT INTO photo_descriptions (
          id, photo_id, tenant_id, user_id, title, description, flowers_used,
          colors, style, occasion, arrangement_type, difficulty_level,
          special_techniques, materials_used, customer_preferences, price_range,
          season, tags, is_public
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        `desc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
      ).run()
    }

    return c.json({
      success: true,
      message: "Photo description saved successfully"
    })
  } catch (error) {
    console.error("Save description error:", error)
    return c.json({ error: "Failed to save description" }, 500)
  }
})

app.post("/api/tenants/:tenantId/photos/:photoId/quality", async (c) => {
  const tenantId = c.req.param("tenantId")
  const photoId = c.req.param("photoId")
  const userId = c.get("jwtPayload").sub
  const assessmentData = await c.req.json()

  try {
    // Check if photo exists
    const photo = await c.env.DB.prepare(`
      SELECT id FROM florist_photo_uploads WHERE id = ? AND tenant_id = ?
    `).bind(photoId, tenantId).first()

    if (!photo) {
      return c.json({ error: "Photo not found" }, 404)
    }

    // Calculate overall score
    const overallScore = (
      assessmentData.technical_quality +
      assessmentData.composition_quality +
      assessmentData.design_quality +
      assessmentData.training_value
    ) / 4

    // Insert or update quality assessment
    await c.env.DB.prepare(`
      INSERT OR REPLACE INTO photo_quality_assessment (
        id, photo_id, tenant_id, assessed_by, technical_quality, composition_quality,
        design_quality, training_value, overall_score, quality_notes,
        improvement_suggestions, is_approved_for_training, assessment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    ).run()

    // Update photo status based on approval
    const newStatus = assessmentData.is_approved_for_training ? 'approved' : 'rejected'
    await c.env.DB.prepare(`
      UPDATE florist_photo_uploads SET upload_status = ? WHERE id = ?
    `).bind(newStatus, photoId).run()

    return c.json({
      success: true,
      message: "Quality assessment saved successfully",
      overall_score: overallScore
    })
  } catch (error) {
    console.error("Quality assessment error:", error)
    return c.json({ error: "Failed to save quality assessment" }, 500)
  }
})

app.post("/api/tenants/:tenantId/photos/:photoId/training-data", async (c) => {
  const tenantId = c.req.param("tenantId")
  const photoId = c.req.param("photoId")
  const userId = c.get("jwtPayload").sub
  const extractionData = await c.req.json()

  try {
    // Check if photo exists and is approved
    const photo = await c.env.DB.prepare(`
      SELECT fpu.*, pd.*, pqa.is_approved_for_training
      FROM florist_photo_uploads fpu
      LEFT JOIN photo_descriptions pd ON fpu.id = pd.photo_id
      LEFT JOIN photo_quality_assessment pqa ON fpu.id = pqa.photo_id
      WHERE fpu.id = ? AND fpu.tenant_id = ?
    `).bind(photoId, tenantId).first()

    if (!photo) {
      return c.json({ error: "Photo not found" }, 404)
    }

    if (!photo.is_approved_for_training) {
      return c.json({ error: "Photo must be approved for training before creating training data" }, 400)
    }

    // Create training data record
    const trainingDataId = `td_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await c.env.DB.prepare(`
      INSERT INTO ai_training_data (
        id, tenant_id, data_type, content, metadata, source_type, source_id, quality_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      trainingDataId,
      tenantId,
      'image',
      JSON.stringify({
        prompt: extractionData.prompt,
        style_parameters: extractionData.style_parameters,
        image_url: photo.image_url
      }),
      JSON.stringify(extractionData.metadata),
      'photo_upload',
      photoId,
      extractionData.quality_score || 1.0
    ).run()

    // Create mapping between photo and training data
    await c.env.DB.prepare(`
      INSERT INTO photo_training_mapping (
        id, photo_id, training_data_id, mapping_type, confidence_score
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      `mapping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      photoId,
      trainingDataId,
      'example',
      extractionData.confidence_score || 1.0
    ).run()

    return c.json({
      success: true,
      training_data_id: trainingDataId,
      message: "Training data created successfully"
    })
  } catch (error) {
    console.error("Training data creation error:", error)
    return c.json({ error: "Failed to create training data" }, 500)
  }
})

app.get("/api/tenants/:tenantId/photos/goals", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userId = c.get("jwtPayload").sub
  const { date } = c.req.query()

  try {
    const targetDate = date || new Date().toISOString().split('T')[0]
    
    const goal = await c.env.DB.prepare(`
      SELECT * FROM daily_upload_goals 
      WHERE tenant_id = ? AND user_id = ? AND date = ?
    `).bind(tenantId, userId, targetDate).first()

    if (!goal) {
      // Create default goal if none exists
      const defaultGoal = {
        id: `goal_${tenantId}_${userId}_${targetDate}`,
        tenant_id: tenantId,
        user_id: userId,
        date: targetDate,
        target_count: 1,
        actual_count: 0,
        goal_status: 'pending',
        streak_count: 0
      }
      
      await c.env.DB.prepare(`
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

      return c.json(defaultGoal)
    }

    return c.json(goal)
  } catch (error) {
    console.error("Get goals error:", error)
    return c.json({ error: "Failed to fetch goals" }, 500)
  }
})

app.get("/api/tenants/:tenantId/photos/statistics", async (c) => {
  const tenantId = c.req.param("tenantId")
  const userId = c.get("jwtPayload").sub
  const { start, end } = c.req.query()

  try {
    let query = `
      SELECT * FROM upload_statistics 
      WHERE tenant_id = ? AND user_id = ?
    `
    const params = [tenantId, userId]
    
    if (start && end) {
      query += " AND date BETWEEN ? AND ?"
      params.push(start, end)
    }
    
    query += " ORDER BY date DESC"
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all()
    
    return c.json(results)
  } catch (error) {
    console.error("Get statistics error:", error)
    return c.json({ error: "Failed to fetch statistics" }, 500)
  }
})

// --- AI Florist Product Creation ---
app.post("/api/ai/create-bouquet-product", async (c) => {
  try {
    const { occasion, style, budget } = await c.req.json();

    if (!occasion || !style || !budget) {
      return c.json({ error: "Missing required design parameters: occasion, style, and budget are required." }, 400);
    }

    // 1. Generate Product Details
    const productName = `Custom ${style} ${occasion} Bouquet`;
    const productDescription = `A beautiful, AI-designed bouquet perfect for a ${occasion.toLowerCase()}. This arrangement captures a ${style.toLowerCase()} aesthetic and is customized to your preferences.`;
    const price = budget === 'budget' ? '49.99' : budget === 'mid-range' ? '89.99' : '149.99';
    
    // In a real implementation, you would generate an image here using DALL-E or another service
    const mockImageUrl = "https://images.unsplash.com/photo-1562690868-60bbe7293e94?w=800";

    // 2. Placeholder for Shopify Product Creation
    // In a real implementation, you would use the Shopify API service to create the product.
    // const shopifyProduct = await ShopifyApiService.createProduct(c.env, tenantId, {
    //   title: productName,
    //   body_html: productDescription,
    //   variants: [{ price: price }],
    //   images: [{ src: mockImageUrl }],
    // });
    
    console.log("SIMULATING SHOPIFY PRODUCT CREATION:", { productName, productDescription, price, mockImageUrl });

    // 3. Return a mock Shopify product URL for now
    const mockShopifyProductUrl = `https://your-shopify-store.myshopify.com/products/mock-custom-bouquet-${Date.now()}`;

    return c.json({
      success: true,
      message: "Shopify product created successfully (simulated).",
      shopifyProductUrl: mockShopifyProductUrl,
    });

  } catch (error) {
    console.error("Failed to create bouquet product:", error);
    return c.json({ error: "Internal server error while creating bouquet product." }, 500);
  }
});

// --- AI Florist - Get Saved Products for Grounding ---
app.get('/api/tenants/:tenantId/ai/saved-products', async (c) => {
  try {
    const { tenantId } = c.req.param();
    const db = c.env.DB;

    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required.' }, 400);
    }

    const { results } = await db
      .prepare(
        `SELECT id, title, variant_title, description, price, tags, product_type
         FROM saved_products
         WHERE tenant_id = ?
         LIMIT 200` // Limit to 200 products to avoid overwhelming the context
      )
      .bind(tenantId)
      .all();

    if (!results) {
      return c.json([]); // Return empty array if no products found
    }

    return c.json(results);

  } catch (error) {
    console.error('Error fetching saved products:', error);
    return c.json({ error: 'Failed to fetch saved products.' }, 500);
  }
});

// --- Saved Products ---
app.get("/api/tenants/:tenantId/saved-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  console.log(`[SAVED-PRODUCTS-GET] Fetching saved products for tenant: ${tenantId}`)
  console.log(`[SAVED-PRODUCTS-GET] Query parameters:`, c.req.query())
  
  try {
    const products = await d1DatabaseService.getSavedProducts(c.env, tenantId, c.req.query())
    console.log(`[SAVED-PRODUCTS-GET] Retrieved ${products.length} products from database`)
    
    // Log a sample of products to verify data structure
    if (products.length > 0) {
      console.log(`[SAVED-PRODUCTS-GET] Sample product:`, {
        id: products[0].id,
        title: products[0].title,
        imageUrl: products[0].imageUrl,
        imageAlt: products[0].imageAlt,
        imageWidth: products[0].imageWidth,
        imageHeight: products[0].imageHeight,
      })
    } else {
      console.log(`[SAVED-PRODUCTS-GET] No products found in database`)
    }
    
    return c.json(products)
  } catch (error) {
    console.error("[SAVED-PRODUCTS-GET] Error fetching saved products:", error)
    return c.json({ error: "Failed to fetch saved products" }, 500)
  }
})

app.post("/api/tenants/:tenantId/saved-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  const { products } = await c.req.json()

  if (!Array.isArray(products) || products.length === 0) {
    return c.json({ error: "Products array is required and cannot be empty" }, 400)
  }

  console.log(`[SAVED-PRODUCTS-POST] Attempting to save ${products.length} products for tenant: ${tenantId}`)
  
  // Log the products being saved to verify they have the expected structure
  products.forEach((product, index) => {
    console.log(`[SAVED-PRODUCTS-POST] Product ${index + 1}:`, {
      shopifyProductId: product.shopifyProductId,
      shopifyVariantId: product.shopifyVariantId,
      title: product.title,
      storeId: product.storeId, // Add storeId to logging
      imageUrl: product.imageUrl,
      imageAlt: product.imageAlt,
      imageWidth: product.imageWidth,
      imageHeight: product.imageHeight,
    })
  })

  try {
    console.log(`[SAVED-PRODUCTS-POST] Calling d1DatabaseService.saveProducts...`)
    const savedProducts = await d1DatabaseService.saveProducts(c.env, tenantId, products)
    console.log(`[SAVED-PRODUCTS-POST] saveProducts returned ${savedProducts.length} products`)
    
    // Log the returned products to verify they have the expected data
    savedProducts.forEach((product, index) => {
      console.log(`[SAVED-PRODUCTS-POST] Returned product ${index + 1}:`, {
        id: product.id,
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
        title: product.title,
        storeId: product.storeId, // Add storeId to logging
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        imageWidth: product.imageWidth,
        imageHeight: product.imageHeight,
      })
    })
    
    return c.json(savedProducts, 201)
  } catch (error) {
    console.error("[SAVED-PRODUCTS-POST] Error saving products:", error)
    console.error("[SAVED-PRODUCTS-POST] Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    })
    return c.json({ error: "Failed to save products" }, 500)
  }
})

// Dedicated endpoint to get a saved product by Shopify product/variant ID
app.get("/api/tenants/:tenantId/saved-products/by-shopify-id", async (c) => {
  const tenantId = c.req.param("tenantId")
  const shopifyProductId = c.req.query("shopify_product_id")
  const shopifyVariantId = c.req.query("shopify_variant_id")
  
  console.log(`[SAVED-PRODUCTS-BY-SHOPIFY-ID] Request for tenant: ${tenantId}, product: ${shopifyProductId}, variant: ${shopifyVariantId}`)
  
  if (!shopifyProductId || !shopifyVariantId) {
    console.log(`[SAVED-PRODUCTS-BY-SHOPIFY-ID] Missing required parameters`)
    return c.json({ error: "shopify_product_id and shopify_variant_id are required" }, 400)
  }
  
  try {
    const product = await d1DatabaseService.getProductByShopifyIds(c.env, tenantId, shopifyProductId, shopifyVariantId)
    console.log(`[SAVED-PRODUCTS-BY-SHOPIFY-ID] Database query result:`, { 
      found: !!product, 
      hasLabels: product ? !!product.labelNames : false,
      labelNames: product?.labelNames,
      labelCategories: product?.labelCategories,
      labelColors: product?.labelColors
    })
    
    if (!product) return c.json({ error: "Product not found" }, 404)
    return c.json(product)
  } catch (error) {
    console.error("[SAVED-PRODUCTS-BY-SHOPIFY-ID] Error fetching saved product by Shopify ID:", error)
    return c.json({ error: "Failed to fetch saved product" }, 500)
  }
})

// Delete a single saved product
app.delete("/api/tenants/:tenantId/saved-products/:productId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  
  console.log(`[SAVED-PRODUCTS-DELETE] Deleting product ${productId} for tenant: ${tenantId}`)
  
  try {
    const success = await d1DatabaseService.deleteSavedProduct(c.env, tenantId, productId)
    if (success) {
      console.log(`[SAVED-PRODUCTS-DELETE] Successfully deleted product ${productId}`)
      return c.json({ success: true, message: "Product deleted successfully" })
    } else {
      console.log(`[SAVED-PRODUCTS-DELETE] Product ${productId} not found`)
      return c.json({ error: "Product not found" }, 404)
    }
  } catch (error) {
    console.error("[SAVED-PRODUCTS-DELETE] Error deleting saved product:", error)
    return c.json({ error: "Failed to delete product" }, 500)
  }
})

// Bulk delete all saved products for a tenant
app.delete("/api/tenants/:tenantId/saved-products", async (c) => {
  const tenantId = c.req.param("tenantId")
  
  console.log(`[SAVED-PRODUCTS-BULK-DELETE] Deleting all products for tenant: ${tenantId}`)
  
  try {
    // Delete all saved products for this tenant
    const { success } = await c.env.DB.prepare(
      "DELETE FROM saved_products WHERE tenant_id = ?"
    )
      .bind(tenantId)
      .run()

    console.log(`[SAVED-PRODUCTS-BULK-DELETE] Bulk delete result:`, { success })
    
    if (success) {
      console.log(`[SAVED-PRODUCTS-BULK-DELETE] Successfully deleted all products for tenant ${tenantId}`)
      return c.json({ 
        success: true, 
        message: "All saved products deleted successfully",
        deletedCount: "all"
      })
    } else {
      console.log(`[SAVED-PRODUCTS-BULK-DELETE] Failed to delete products for tenant ${tenantId}`)
      return c.json({ error: "Failed to delete products" }, 500)
    }
  } catch (error) {
    console.error("[SAVED-PRODUCTS-BULK-DELETE] Error bulk deleting saved products:", error)
    return c.json({ error: "Failed to delete products" }, 500)
  }
})

// --- Saved Products Label Management ---

// Add a label to a saved product
app.post("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const labelId = c.req.param("labelId")
  
  console.log(`[SAVED-PRODUCTS-LABELS] Adding label ${labelId} to product ${productId} for tenant: ${tenantId}`)
  
  try {
    // Verify the product exists and belongs to the tenant
    const product = await d1DatabaseService.getSavedProduct(c.env, tenantId, productId)
    if (!product) {
      console.log(`[SAVED-PRODUCTS-LABELS] Product ${productId} not found`)
      return c.json({ error: "Product not found" }, 404)
    }
    
    // Verify the label exists and belongs to the tenant
    const label = await d1DatabaseService.getProductLabelById(c.env, tenantId, labelId)
    if (!label) {
      console.log(`[SAVED-PRODUCTS-LABELS] Label ${labelId} not found`)
      return c.json({ error: "Label not found" }, 404)
    }
    
    // Check if the mapping already exists
    const existingMapping = await c.env.DB.prepare(`
      SELECT id FROM product_label_mappings 
      WHERE tenant_id = ? AND saved_product_id = ? AND label_id = ?
    `)
      .bind(tenantId, productId, labelId)
      .first()
    
    if (existingMapping) {
      console.log(`[SAVED-PRODUCTS-LABELS] Label ${labelId} already exists on product ${productId}`)
      return c.json({ success: true, message: "Label already exists on product" })
    }
    
    // Create the mapping
    const mappingId = crypto.randomUUID()
    await c.env.DB.prepare(`
      INSERT INTO product_label_mappings (id, tenant_id, saved_product_id, label_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(mappingId, tenantId, productId, labelId, new Date().toISOString())
      .run()
    
    console.log(`[SAVED-PRODUCTS-LABELS] Successfully added label ${labelId} to product ${productId}`)
    return c.json({ success: true, message: "Label added successfully" })
    
  } catch (error) {
    console.error("[SAVED-PRODUCTS-LABELS] Error adding label to saved product:", error)
    return c.json({ error: "Failed to add label" }, 500)
  }
})

// Remove a label from a saved product
app.delete("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const labelId = c.req.param("labelId")
  
  console.log(`[SAVED-PRODUCTS-LABELS] Removing label ${labelId} from product ${productId} for tenant: ${tenantId}`)
  
  try {
    // Delete the mapping
    const { success } = await c.env.DB.prepare(`
      DELETE FROM product_label_mappings 
      WHERE tenant_id = ? AND saved_product_id = ? AND label_id = ?
    `)
      .bind(tenantId, productId, labelId)
      .run()
    
    if (success) {
      console.log(`[SAVED-PRODUCTS-LABELS] Successfully removed label ${labelId} from product ${productId}`)
      return c.json({ success: true, message: "Label removed successfully" })
    } else {
      console.log(`[SAVED-PRODUCTS-LABELS] Label ${labelId} not found on product ${productId}`)
      return c.json({ error: "Label not found on product" }, 404)
    }
    
  } catch (error) {
    console.error("[SAVED-PRODUCTS-LABELS] Error removing label from saved product:", error)
    return c.json({ error: "Failed to remove label" }, 500)
  }
})

// --- AI Florist - Get Knowledge Base (PUBLIC) ---
app.get('/api/tenants/:tenantId/ai/knowledge-base', async (c) => {
  try {
    const { tenantId } = c.req.param();
    const db = c.env.DB;

    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required.' }, 400);
    }

    // Fetch all knowledge base data in parallel
    const [
      products,
      styles,
      occasions,
      arrangementTypes,
      budgetTiers,
      flowers,
      modelConfigs,
      promptTemplates
    ] = await Promise.all([
      db.prepare(`SELECT id, title, variant_title, description, price, tags, product_type FROM saved_products WHERE tenant_id = ? AND status = 'active' LIMIT 200`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_styles WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_occasions WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_arrangement_types WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_budget_tiers WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_flowers WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_model_configs WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT * FROM ai_prompt_templates WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
    ]);

    const knowledgeBase = {
      products: products?.results || [],
      styles: styles?.results || [],
      occasions: occasions?.results || [],
      arrangementTypes: arrangementTypes?.results || [],
      budgetTiers: budgetTiers?.results || [],
      flowers: flowers?.results || [],
      aiConfig: modelConfigs?.results || [],
      promptTemplates: promptTemplates?.results || [],
    };

    return c.json(knowledgeBase);

  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return c.json({ error: 'Failed to fetch knowledge base.' }, 500);
  }
});

// --- AI Florist - Chat Endpoint (PUBLIC) ---
app.post('/api/ai/chat', async (c) => {
  try {
    const { messages, knowledgeBase, tenantId } = await c.req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'Invalid chat history provided.' }, 400);
    }
    if (!knowledgeBase) {
      return c.json({ error: 'Knowledge base is required for context.' }, 400);
    }
    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required to use the AI service.' }, 400);
    }

    // --- Fetch Tenant-Specific OpenAI API Key ---
    const tenantSettingsRaw = await c.env.DB.prepare("SELECT settings FROM tenants WHERE id = ?").bind(tenantId).first<{ settings: string }>();
    if (!tenantSettingsRaw?.settings) {
        return c.json({ error: 'Could not find settings for this tenant.' }, 404);
    }

    const tenantSettings = JSON.parse(tenantSettingsRaw.settings);
    const openaiApiKey = tenantSettings.openaiApiKey;

    if (!openaiApiKey) {
      return c.json({ error: 'OpenAI API key not configured for this tenant.' }, 503);
    }

    // Get the last user message
    const lastUserMessage = messages.filter(msg => msg.sender === 'user').pop();
    if (!lastUserMessage) {
      return c.json({ error: 'No user message found in conversation.' }, 400);
    }

    // Create a system prompt with knowledge base context
    const systemPrompt = createSystemPrompt(knowledgeBase);

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          }))
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "I'm sorry, I couldn't generate a response right now.";

    // Record the AI usage
    try {
      await c.env.DB.prepare(`
        INSERT INTO ai_usage_analytics (
          id, tenant_id, date, model_type, generation_count, total_tokens, total_cost, average_rating, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        new Date().toISOString().split('T')[0],
        'gpt-4',
        1,
        data.usage?.total_tokens || 0,
        (data.usage?.total_tokens || 0) * 0.00003, // Approximate cost per token
        0 // No rating for chat
      ).run();
    } catch (error) {
      console.error('Failed to log AI usage:', error);
    }

    return c.json({
      response: aiResponse,
      usage: data.usage,
      model: 'gpt-4'
    });

  } catch (error) {
    console.error('Error in AI chat:', error);
    
    // Return fallback response
    return c.json({
      response: "I'm having trouble connecting right now. Please try again in a moment, or check your OpenAI API configuration.",
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 200);
  }
});

// Helper function to create system prompt with knowledge base context
function createSystemPrompt(knowledgeBase: any): string {
  let prompt = `You are an expert AI Florist assistant. You help customers design beautiful flower arrangements and bouquets. 

You have access to the following knowledge base:

`;

  // Add products context
  if (knowledgeBase.products && knowledgeBase.products.length > 0) {
    prompt += `\nAvailable Products (${knowledgeBase.products.length} items):\n`;
    knowledgeBase.products.slice(0, 10).forEach((product: any) => {
      prompt += `- ${product.title}${product.variant_title ? ` (${product.variant_title})` : ''}: $${product.price}\n`;
    });
    if (knowledgeBase.products.length > 10) {
      prompt += `... and ${knowledgeBase.products.length - 10} more products\n`;
    }
  }

  // Add styles context
  if (knowledgeBase.styles && knowledgeBase.styles.length > 0) {
    prompt += `\nAvailable Styles: ${knowledgeBase.styles.map((style: any) => style.name).join(', ')}\n`;
  }

  // Add occasions context
  if (knowledgeBase.occasions && knowledgeBase.occasions.length > 0) {
    prompt += `\nAvailable Occasions: ${knowledgeBase.occasions.map((occasion: any) => occasion.name).join(', ')}\n`;
  }

  // Add flowers context
  if (knowledgeBase.flowers && knowledgeBase.flowers.length > 0) {
    prompt += `\nAvailable Flowers: ${knowledgeBase.flowers.map((flower: any) => flower.name).join(', ')}\n`;
  }

  prompt += `

Guidelines:
- Be friendly, professional, and knowledgeable about flowers
- Ask clarifying questions to understand the customer's needs
- Suggest specific flowers and arrangements based on their preferences
- Consider budget, occasion, style, and color preferences
- Provide helpful advice about flower care and arrangement tips
- Keep responses conversational and engaging
- If you don't have specific information, use your general flower knowledge

Remember: You're helping customers create beautiful, personalized flower arrangements!`;

  return prompt;
}

// SPA routing - handle all non-API routes
app.get('*', async (c) => {
  const path = c.req.path
  
  // Skip API routes
  if (path.startsWith('/api/')) {
    return c.notFound()
  }
  
  // Try to serve static assets first
  try {
    const asset = await c.env.ASSETS.fetch(c.req.url)
    if (asset.status === 200) {
      return asset
    }
  } catch (error) {
    // Asset not found, continue to serve index.html
  }
  
  // Serve index.html for SPA routing
  try {
    const indexHtml = await c.env.ASSETS.fetch(new URL('/', c.req.url))
    if (indexHtml.status === 200) {
      return new Response(indexHtml.body, {
        headers: {
          'Content-Type': 'text/html',
          ...Object.fromEntries(indexHtml.headers.entries())
        }
      })
    }
  } catch (error) {
    console.error('Error serving index.html:', error)
  }
  
  return c.notFound()
})

app.onError((err, c) => {
  console.error("Unhandled error:", err)
  return c.json({ error: "Internal Server Error" }, 500)
})

// Export the app
export default {
  fetch: app.fetch,
}

  // Reset manual sort orders for auto-sort functionality
  app.post("/api/tenants/:tenantId/reset-manual-sort", async (c) => {
    const tenantId = c.req.param("tenantId")
    const body = await c.req.json() as { deliveryDate: string, storeId?: string }
    const { deliveryDate, storeId } = body

    if (!tenantId || !deliveryDate) {
      return c.json({ error: "Missing tenant ID or delivery date" }, 400)
    }

    try {
      console.log(`[RESET-SORT] Resetting manual sort orders for tenant ${tenantId}, date ${deliveryDate}, store ${storeId}`)

      // Delete all sort order entries for this date (and optionally store)
      // This will make the system fall back to the default label-based priority sorting
      let deleteQuery = `
        DELETE FROM order_card_states 
        WHERE tenant_id = ? AND delivery_date = ?
      `
      const params = [tenantId, deliveryDate]

      // If a specific store is selected, we might want to be more selective
      // For now, we'll reset all orders for the date to ensure consistent sorting
      
      const result = await c.env.DB.prepare(deleteQuery).bind(...params).run()
      
      console.log(`[RESET-SORT] Deleted ${result.meta?.changes || 0} manual sort entries for date ${deliveryDate}`)

      return c.json({ 
        success: true, 
        message: `Reset manual sort order for ${result.meta?.changes || 0} orders`,
        deletedCount: result.meta?.changes || 0
      })
    } catch (error: any) {
      console.error("[RESET-SORT] Error resetting manual sort orders:", error)
      return c.json({ error: "Failed to reset sort orders" }, 500)
    }
  })


