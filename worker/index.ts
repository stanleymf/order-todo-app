import { Hono } from "hono"
import { cors } from "hono/cors"
import { jwt, sign } from "hono/jwt"
import bcrypt from "bcryptjs"
import { d1DatabaseService } from "../src/services/database-d1"
import { ShopifyApiService } from "../src/services/shopify/shopifyApi"
import type { D1Database, ScheduledEvent, ExecutionContext } from "@cloudflare/workers-types"
import { etag } from "hono/etag"
import { WebhookConfig } from "../src/types"

// @ts-ignore
// import manifest from '__STATIC_CONTENT_MANIFEST';

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

// Debug endpoint to check database state (no auth required)
app.get("/api/debug/database", async (c) => {
  try {
    // Check what tables exist
    const { results: tables } = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { results: { name: string }[] };
    
    // Check what tenants exist
    const { results: tenants } = await c.env.DB.prepare("SELECT id, name FROM tenants").all() as { results: { id: string; name: string }[] };
    
    // Check if ai_flowers table exists
    let flowersCount = 0;
    try {
      const { results: flowers } = await c.env.DB.prepare("SELECT COUNT(*) as count FROM ai_flowers").all() as { results: { count: number }[] };
      flowersCount = flowers[0]?.count || 0;
    } catch (e) {
      // Table doesn't exist
    }
    
    return c.json({
      tables: tables.map((t: any) => t.name),
      tenants: tenants,
      flowersCount: flowersCount,
      message: "Database debug info"
    });
  } catch (error) {
    return c.json({
      error: error.message,
      message: "Database debug failed"
    }, 500);
  }
});

// --- AI Florist - Get Saved Products for Grounding (PUBLIC) ---
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

// --- AI Florist - Get Knowledge Base for Grounding (PUBLIC) ---
app.get('/api/tenants/:tenantId/ai/knowledge-base', async (c) => {
  try {
    const { tenantId } = c.req.param();
    const db = c.env.DB;

    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required.' }, 400);
    }

    // Fetch all data in parallel
    const [
      productsPromise,
      stylesPromise,
      occasionsPromise,
      arrangementTypesPromise,
      budgetTiersPromise,
      flowersPromise,
      configPromise,
      promptsPromise
    ] = [
      // Get more products with dynamic category-based rotation
      db.prepare(`
        WITH CategoryProducts AS (
          SELECT 
            id, title, description, price, tags, product_type, created_at,
            CASE 
              WHEN tags IS NOT NULL AND tags != '[]' THEN 1 
              WHEN description IS NOT NULL AND description != '' THEN 2 
              ELSE 3 
            END as priority_score,
            ROW_NUMBER() OVER (
              PARTITION BY 
                CASE 
                  WHEN product_type IS NOT NULL THEN product_type 
                  ELSE 'unknown' 
                END
              ORDER BY 
                CASE 
                  WHEN tags IS NOT NULL AND tags != '[]' THEN 1 
                  WHEN description IS NOT NULL AND description != '' THEN 2 
                  ELSE 3 
                END,
                created_at DESC
            ) as category_rank
          FROM saved_products 
          WHERE tenant_id = ?
        )
        SELECT 
          id, title, description, price, tags, product_type, created_at, priority_score
        FROM CategoryProducts 
        WHERE category_rank <= 50  -- Take top 50 from each category
        ORDER BY priority_score, created_at DESC
        LIMIT 500
      `).bind(tenantId).all(),
      db.prepare(`SELECT name, description, color_palette, mood, arrangement_style FROM ai_styles WHERE tenant_id = ?`).bind(tenantId).all(),
      db.prepare(`SELECT name, description, typical_flowers, typical_colors FROM ai_occasions WHERE tenant_id = ?`).bind(tenantId).all(),
      db.prepare(`SELECT name, description, typical_flowers, category FROM ai_arrangement_types WHERE tenant_id = ?`).bind(tenantId).all(),
      db.prepare(`SELECT name, min_price, max_price, description FROM ai_budget_tiers WHERE tenant_id = ?`).bind(tenantId).all(),
      db.prepare(`SELECT name, variety, color, seasonality, availability, price_range FROM ai_flowers WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
      db.prepare(`SELECT name, model_type, config_data FROM ai_model_configs WHERE tenant_id = ? AND is_active = true LIMIT 1`).bind(tenantId).first(),
      db.prepare(`SELECT name, template, variables, category FROM ai_prompt_templates WHERE tenant_id = ? AND is_active = true`).bind(tenantId).all(),
    ];

    const [
      productsResult,
      stylesResult,
      occasionsResult,
      arrangementTypesResult,
      budgetTiersResult,
      flowersResult,
      configResult,
      promptsResult
    ] = await Promise.all([
      productsPromise,
      stylesPromise,
      occasionsPromise,
      arrangementTypesPromise,
      budgetTiersPromise,
      flowersPromise,
      configPromise,
      promptsPromise
    ]);

    const knowledgeBase = {
      products: productsResult.results || [],
      styles: stylesResult.results || [],
      occasions: occasionsResult.results || [],
      arrangementTypes: arrangementTypesResult.results || [],
      budgetTiers: budgetTiersResult.results || [],
      flowers: flowersResult.results || [],
      aiConfig: configResult || null, // The config itself, or null if none is active
      promptTemplates: promptsResult.results || [],
    };
    
    // 2. Optimize knowledge base to fit within token limits
    // Use intelligent product selection and compression
    const intelligentProductSelection = (products: any[], maxTokens: number = 8000): any[] => {
      if (!products || products.length === 0) return [];
      
      // Priority scoring: products with tags and descriptions get higher priority
      const scoredProducts = products.map((product: any) => {
        let score = 0;
        if (product.tags && product.tags !== '[]') score += 3;
        if (product.description && product.description.trim()) score += 2;
        if (product.price) score += 1;
        return { ...product, score };
      }).sort((a: any, b: any) => b.score - a.score);
      
      // Start with high-priority products and add more until we approach token limit
      const selectedProducts: any[] = [];
      let estimatedTokens = 0;
      const tokenPerProduct = 50; // Rough estimate
      
      for (const product of scoredProducts) {
        const productTokens = tokenPerProduct + (product.description?.length || 0) / 4;
        
        if (estimatedTokens + productTokens > maxTokens) {
          break;
        }
        
        selectedProducts.push(product);
        estimatedTokens += productTokens;
      }
      
      return selectedProducts;
    };
    
    // Intelligent compression of knowledge base
    const intelligentCompression = (knowledgeBase: any) => {
      const maxProductTokens = 6000; // Reserve space for system message and conversation
      const selectedProducts = intelligentProductSelection(knowledgeBase.products || [], maxProductTokens);
      
      // Compress product data to essential fields only
      const compressedProducts = selectedProducts.map((p: any) => ({
        title: p.title,
        price: p.price,
        tags: p.tags,
        product_type: p.product_type,
        // Only include description if it's short and meaningful
        description: p.description && p.description.length < 100 ? p.description : null
      }));
      
      // Compress other data
      const compressedStyles = (knowledgeBase.styles || []).slice(0, 15).map((s: any) => ({
        name: s.name,
        description: s.description?.substring(0, 100) || null
      }));
      
      const compressedOccasions = (knowledgeBase.occasions || []).slice(0, 10).map((o: any) => ({
        name: o.name,
        description: o.description?.substring(0, 100) || null
      }));
      
      return {
        products: compressedProducts,
        styles: compressedStyles,
        occasions: compressedOccasions,
        totalProducts: knowledgeBase.products?.length || 0,
        selectedProducts: compressedProducts.length
      };
    };

    const compactKnowledgeBase = intelligentCompression(knowledgeBase);
    
    return c.json(knowledgeBase);

  } catch (error) {
    console.error('Error fetching AI knowledge base:', error);
    return c.json({ error: 'Failed to fetch AI knowledge base.' }, 500);
  }
});

// --- AI Florist - Conversational Chat Endpoint (PUBLIC) ---
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
    
    // 1. Construct the System Prompt
    // Find the main chat prompt from the templates, or use a robust fallback.
    const chatPromptTemplate = 
      knowledgeBase.promptTemplates?.find(p => p.category === 'bouquet' && p.name === 'Basic Bouquet')?.template ||
      "You are an expert florist AI assistant for {florist_name}. Your goal is to have a friendly, natural conversation to help a customer design their perfect flower bouquet. You have been provided with the shop's inventory and style guide as context. Ask clarifying questions one at a time. Guide the conversation towards understanding the occasion, desired style, and budget to help create a final product.";

    const systemMessageContent = chatPromptTemplate.replace('{florist_name}', 'Windflower Florist'); // Replace with dynamic name later

    // 2. Optimize knowledge base to fit within token limits
    // Limit products to first 20 to stay within context limits
    const limitedProducts = knowledgeBase.products?.slice(0, 20) || [];
    const limitedStyles = knowledgeBase.styles?.slice(0, 10) || [];
    const limitedOccasions = knowledgeBase.occasions?.slice(0, 10) || [];
    
    // Create a more compact knowledge base representation
    const compactKnowledgeBase = {
      products: limitedProducts.map(p => ({
        title: p.title,
        price: p.price,
        tags: p.tags,
        product_type: p.product_type
      })),
      styles: limitedStyles.map(s => ({
        name: s.name,
        description: s.description
      })),
      occasions: limitedOccasions.map(o => ({
        name: o.name,
        description: o.description
      }))
    };

    const systemMessage = {
      role: 'system',
      content: `${systemMessageContent}\n\nHere is a curated selection of the shop's inventory and style guide:\nPRODUCTS: ${JSON.stringify(compactKnowledgeBase.products)}\nSTYLES: ${JSON.stringify(compactKnowledgeBase.styles)}\nOCCASIONS: ${JSON.stringify(compactKnowledgeBase.occasions)}`
    };

    // 2. Prepare the messages for the API
    const messagesForAPI = messages.map(({ sender, text }) => ({
      role: sender === 'ai' ? 'assistant' : 'user',
      content: text,
    }));


    // 3. Call the OpenAI API
    const apiRequestBody = {
      model: "gpt-3.5-turbo", // Use the model from aiConfig in the future
      messages: [systemMessage, ...messagesForAPI],
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', errorText);
      return c.json({ error: 'Failed to get a response from the AI.' }, 502);
    }

    const responseData = await response.json();
    const aiResponseContent = responseData.choices[0]?.message?.content;

    if (!aiResponseContent) {
      return c.json({ error: 'Received an empty response from the AI.' }, 500);
    }
    
    return c.json({
      role: 'assistant',
      content: aiResponseContent,
    });

  } catch (error) {
    console.error('Error in AI chat endpoint:', error);
    return c.json({ error: 'Failed to process chat message.' }, 500);
  }
});

// JWT middleware for protected routes
app.use("/api/tenants/:tenantId/*", async (c, next) => {
  try {
    const auth = jwt({ secret: c.env.JWT_SECRET })
    return await auth(c, next)
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
  const tenantId = c.req.param("tenantId")
  const orderId = c.req.param("orderId")
  const order = await d1DatabaseService.getOrder(c.env, tenantId, orderId)
  return order ? c.json(order) : c.json({ error: "Not Found" }, 404)
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

// New endpoint to get orders by date and process them
app.get("/api/tenants/:tenantId/orders-by-date", async (c) => {
  const tenantId = c.req.param("tenantId")
  const date = c.req.query("date") // e.g., "22/06/2025"

  if (!date) {
    return c.json({ error: "Date query parameter is required" }, 400)
  }

  try {
    // 1. Fetch all data needed for processing
    const [savedProductsWithLabels, shopifyStores, orderCardConfig] = await Promise.all([
      d1DatabaseService.getSavedProductsWithLabels(c.env, tenantId),
      d1DatabaseService.getShopifyStores(c.env, tenantId),
      d1DatabaseService.getOrderCardConfig(c.env, tenantId),
    ])

    if (!shopifyStores || shopifyStores.length === 0) {
      return c.json({ error: "No Shopify store configured for this tenant" }, 404)
    }

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
    const store = shopifyStores[0]
    
    console.log("Shopify store data:", {
      id: store.id,
      domain: store.shopifyDomain,
      hasAccessToken: !!store.accessToken,
      accessTokenLength: store.accessToken?.length,
    })
    
    // Construct the store object in the format expected by ShopifyApiService
    const storeForApi = {
      id: store.id,
      tenantId: tenantId,
      name: store.shopifyDomain,
      type: "shopify" as const,
      status: "active" as const,
      settings: {
        domain: store.shopifyDomain,
        accessToken: store.accessToken,
        timezone: "UTC",
        currency: "USD",
        businessHours: { start: "09:00", end: "17:00" },
        webhooks: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    console.log("Constructed store for API:", {
      domain: storeForApi.settings.domain,
      hasAccessToken: !!storeForApi.settings.accessToken,
    })
    
    const shopifyApi = new ShopifyApiService(storeForApi, store.accessToken)
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
          for (const fieldConfig of orderCardConfig) {
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
  const updatedProduct = await d1DatabaseService.updateProduct(
    c.env,
    tenantId,
    productId,
    updateData
  )
  return updatedProduct ? c.json(updatedProduct) : c.json({ error: "Not Found" }, 404)
})
app.delete("/api/tenants/:tenantId/products/:productId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
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
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const savedProduct = await d1DatabaseService.getSavedProduct(c.env, tenantId, productId)
  return savedProduct ? c.json(savedProduct) : c.json({ error: "Not Found" }, 404)
})

app.delete("/api/tenants/:tenantId/saved-products/:productId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const success = await d1DatabaseService.deleteSavedProduct(c.env, tenantId, productId)
  return success ? c.json({ success: true }) : c.json({ error: "Not Found" }, 404)
})

app.post("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const labelId = c.req.param("labelId")
  const success = await d1DatabaseService.addProductLabel(c.env, tenantId, productId, labelId)
  return c.json({ success })
})

app.delete("/api/tenants/:tenantId/saved-products/:productId/labels/:labelId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const productId = c.req.param("productId")
  const labelId = c.req.param("labelId")
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

// --- Product Image Lookup Endpoint ---
app.get("/api/tenants/:tenantId/saved-products/image/:shopifyProductId/:shopifyVariantId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const shopifyProductId = c.req.param("shopifyProductId")
  const shopifyVariantId = c.req.param("shopifyVariantId")
  
  // Extract numeric IDs from GIDs, handling both formats
  const numericProductId = shopifyProductId.split('/').pop()
  const numericVariantId = shopifyVariantId.split('/').pop()

  try {
    // Direct database query to get product with image data
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM saved_products 
      WHERE tenant_id = ? AND shopify_product_id = ? AND shopify_variant_id = ?
    `)
      .bind(tenantId, numericProductId, numericVariantId)
      .all()
    
    const product = results[0]
    if (!product) {
      return c.json({ error: "Product not found" }, 404)
    }
    
    // Return only the image-related data
    const imageData = {
      imageUrl: product.image_url,
      imageAlt: product.image_alt,
      title: product.title,
      variantTitle: product.variant_title,
      description: product.description,
      price: product.price,
      tags: JSON.parse(String(product.tags || "[]")),
      productType: product.product_type,
      vendor: product.vendor,
    }
    
    return c.json(imageData)
  } catch (error) {
    console.error("Error fetching product image:", error)
    return c.json({ error: "Failed to fetch product image" }, 500)
  }
})

// Alternative endpoint for when we only have product ID
app.get("/api/tenants/:tenantId/saved-products/image/:shopifyProductId", async (c) => {
  const tenantId = c.req.param("tenantId")
  const shopifyProductId = c.req.param("shopifyProductId")

  // Extract numeric ID from GID, handling both formats
  const numericProductId = shopifyProductId.split('/').pop()
  
  try {
    // Get the first variant of the product
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM saved_products 
      WHERE tenant_id = ? AND shopify_product_id = ?
      ORDER BY created_at ASC 
      LIMIT 1
    `)
      .bind(tenantId, numericProductId)
      .all()
    
    const product = results[0]
    if (!product) {
      return c.json({ error: "Product not found" }, 404)
    }
    
    const imageData = {
      imageUrl: product.image_url,
      imageAlt: product.image_alt,
      title: product.title,
      variantTitle: product.variant_title,
      description: product.description,
      price: product.price,
      tags: JSON.parse(String(product.tags || "[]")),
      productType: product.product_type,
      vendor: product.vendor,
    }
    
    return c.json(imageData)
  } catch (error) {
    console.error("Error fetching product image:", error)
    return c.json({ error: "Failed to fetch product image" }, 500)
  }
})

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
    const stores = await d1DatabaseService.getShopifyStores(c.env, tenantId)
    
    // Adapt the data from shopify_stores to the generic Store type
    const adaptedStores = stores.map((store: any) => ({
      id: store.id,
      tenantId: store.tenant_id,
      name: store.shopifyDomain, // Use domain as name for now
      type: 'shopify',
      status: 'active', // Assuming active if it exists
      settings: {
        domain: store.shopifyDomain,
        accessToken: store.accessToken,
      },
      createdAt: store.created_at,
      updatedAt: store.updated_at,
    }));

    return c.json(adaptedStores)
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
      `CREATE TABLE IF NOT EXISTS shopify_stores (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shopify_domain TEXT UNIQUE NOT NULL, access_token TEXT NOT NULL, webhook_secret TEXT, sync_enabled BOOLEAN DEFAULT true, last_sync_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id))`
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
      `CREATE TABLE IF NOT EXISTS saved_product_labels (
        product_id TEXT NOT NULL,
        label_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        PRIMARY KEY (product_id, label_id),
        FOREIGN KEY (product_id) REFERENCES saved_products(id) ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES product_labels(id) ON DELETE CASCADE,
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

    if (!shopifyOrder || !shopifyOrder.line_items) {
      console.error("Malformed Shopify order payload", shopifyOrder);
      return c.json({ error: "Invalid order data" }, 400);
    }

    const customerName = `${shopifyOrder.customer?.first_name ?? ""} ${shopifyOrder.customer?.last_name ?? ""}`.trim() || "N/A";
    
    const deliveryDateAttribute = shopifyOrder.note_attributes?.find((attr: any) => attr.name === "delivery_date");
    const deliveryDate = deliveryDateAttribute ? deliveryDateAttribute.value : shopifyOrder.created_at.split("T")[0];

    const productLabel = shopifyOrder.line_items[0]?.properties?.find((p: any) => p.name === '_label')?.value ?? 'default';
    
    // Enhanced order data for analytics
    const orderData = {
      shopifyOrderId: String(shopifyOrder.id),
      customerName: customerName,
      deliveryDate: deliveryDate,
      notes: shopifyOrder.note,
      product_label: productLabel,
      
      // Analytics fields
      total_price: parseFloat(shopifyOrder.total_price),
      currency: shopifyOrder.currency,
      customer_email: shopifyOrder.customer?.email,
      line_items: JSON.stringify(shopifyOrder.line_items),
      product_titles: JSON.stringify(shopifyOrder.line_items.map((item: any) => item.title)),
      quantities: JSON.stringify(shopifyOrder.line_items.map((item: any) => item.quantity)),
      session_id: shopifyOrder.checkout_id, // Or other session identifier
      store_id: storeId,
      product_type: shopifyOrder.line_items[0]?.product_type ?? 'Unknown'
    };

    const newOrder = await d1DatabaseService.createOrder(c.env, tenantId, orderData);

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
    const shopifyStores = await d1DatabaseService.getShopifyStores(c.env, tenantId)
    
    if (!shopifyStores || shopifyStores.length === 0) {
      return c.json({ error: "No Shopify stores configured for this tenant" }, 404)
    }
    
    const store = shopifyStores[0]
    
    // Test the store configuration
    const storeForApi = {
      id: store.id,
      tenantId: tenantId,
      name: store.shopifyDomain,
      type: "shopify" as const,
      status: "active" as const,
      settings: {
        domain: store.shopifyDomain,
        accessToken: store.accessToken,
        timezone: "UTC",
        currency: "USD",
        businessHours: { start: "09:00", end: "17:00" },
        webhooks: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    const shopifyApi = new ShopifyApiService(storeForApi, store.accessToken)
    
    // Test a simple API call to verify credentials
    const testUrl = `https://${store.shopifyDomain}/admin/api/2023-10/shop.json`
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": store.accessToken,
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
          domain: store.shopifyDomain,
          hasAccessToken: !!store.accessToken,
          accessTokenLength: store.accessToken?.length,
        }
      }, 400)
    }
    
    const shopData = await response.json()
    
    return c.json({
      success: true,
      storeConfig: {
        domain: store.shopifyDomain,
        hasAccessToken: !!store.accessToken,
        accessTokenLength: store.accessToken?.length,
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
    const generationTime = Date.now();
    
    return c.json({
      id: `bouquet-${Date.now()}`,
      prompt: imagePrompt,
      generatedImage: data.data[0].url,
      confidence: 0.90 + Math.random() * 0.05,
      designSpecs: extractedSpecs,
      generationTime: generationTime,
      modelVersion: 'v1.0-dalle3',
      cost: 0.040, // DALL-E 3 pricing
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

app.get("/api/tenants/:tenantId/ai/training-data/stats", async (c) => {
  const tenantId = c.req.param("tenantId");
  const stats = await d1DatabaseService.getAITrainingDataStats(c.env, tenantId);
  return c.json(stats);
});

// --- AI Training Sessions Endpoints ---
app.get("/api/tenants/:tenantId/ai/training-sessions", async (c) => {
  const tenantId = c.req.param("tenantId");
  const sessions = await d1DatabaseService.getAITrainingSessions(c.env, tenantId);
  return c.json(sessions);
});

app.post("/api/tenants/:tenantId/ai/training-sessions", async (c) => {
  const tenantId = c.req.param("tenantId");
  const sessionData = await c.req.json();
  const newSession = await d1DatabaseService.createAITrainingSession(c.env, tenantId, sessionData);
  return c.json(newSession, 201);
});

// --- AI Generated Designs Endpoints ---
app.get("/api/tenants/:tenantId/ai/generated-designs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const designs = await d1DatabaseService.getAIGeneratedDesigns(c.env, tenantId);
  return c.json(designs);
});

app.post("/api/tenants/:tenantId/ai/generated-designs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const designData = await c.req.json();
  const newDesign = await d1DatabaseService.saveAIGeneratedDesign(c.env, tenantId, designData);
  return c.json(newDesign, 201);
});

// --- AI Style Templates Endpoints ---
app.get("/api/tenants/:tenantId/ai/style-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templates = await d1DatabaseService.getAIStyleTemplates(c.env, tenantId);
  return c.json(templates);
});

app.post("/api/tenants/:tenantId/ai/style-templates", async (c) => {
  const tenantId = c.req.param("tenantId");
  const templateData = await c.req.json();
  const newTemplate = await d1DatabaseService.createAIStyleTemplate(c.env, tenantId, templateData);
  return c.json(newTemplate, 201);
});

// --- AI Usage Analytics Endpoints ---
app.get("/api/tenants/:tenantId/ai/usage-analytics", async (c) => {
  const tenantId = c.req.param("tenantId");
  const analytics = await d1DatabaseService.getAIUsageAnalytics(c.env, tenantId);
  return c.json(analytics);
});

app.post("/api/tenants/:tenantId/ai/usage", async (c) => {
  const tenantId = c.req.param("tenantId");
  const metadata = await c.req.json();
  await d1DatabaseService.recordAIGeneration(c.env, tenantId, metadata);
  return c.json({ success: true });
});

// --- AI Styles Endpoints ---
app.get("/api/tenants/:tenantId/ai/styles", async (c) => {
  const tenantId = c.req.param("tenantId");
  const styles = await d1DatabaseService.getAIStyles(c.env, tenantId);
  return c.json(styles);
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
  const tenantId = c.req.param("tenantId");
  const types = await d1DatabaseService.getAIArrangementTypes(c.env, tenantId);
  return c.json(types);
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
  const tenantId = c.req.param("tenantId");
  const occasions = await d1DatabaseService.getAIOccasions(c.env, tenantId);
  return c.json(occasions);
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
  const tenantId = c.req.param("tenantId");
  const budgetTiers = await d1DatabaseService.getAIBudgetTiers(c.env, tenantId);
  return c.json(budgetTiers);
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
  const tenantId = c.req.param("tenantId");
  const customerData = await d1DatabaseService.getAICustomerData(c.env, tenantId);
  return c.json(customerData);
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
  const tenantId = c.req.param("tenantId");
  const dateRange = c.req.query("dateRange");
  const compareWith = c.req.query("compareWith");
  const productType = c.req.query("productType");
  const storeId = c.req.query("storeId");

  if (!dateRange || !compareWith) {
    return c.json({ error: "Missing required query parameters: dateRange and compareWith" }, 400);
  }

  try {
    const analyticsData = await d1DatabaseService.getShopifyAnalytics(c.env, tenantId, {
      dateRange,
      compareWith,
      productType: productType ?? undefined,
      storeId: storeId ?? undefined,
    });
    return c.json(analyticsData);
  } catch (error: any) {
    console.error(`Analytics Error: ${error.message}`);
    return c.json({ error: "Failed to fetch Shopify analytics", details: error.message }, 500);
  }
});

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
  const userId = c.get("jwtPayload").sub
  
  const { photo_id, status, date_range, user_id } = c.req.query()
  
  try {
    let query = `
      SELECT fpu.*, pd.title, pd.description, pd.style, pd.occasion, pd.arrangement_type
      FROM florist_photo_uploads fpu
      LEFT JOIN photo_descriptions pd ON fpu.id = pd.photo_id
      WHERE fpu.tenant_id = ?
    `
    const params = [tenantId]
    
    if (photo_id) {
      query += " AND fpu.id = ?"
      params.push(photo_id)
    }
    
    if (status) {
      query += " AND fpu.upload_status = ?"
      params.push(status)
    }
    
    if (user_id) {
      query += " AND fpu.user_id = ?"
      params.push(user_id)
    }
    
    if (date_range) {
      const [start, end] = date_range.split(',')
      query += " AND fpu.created_at BETWEEN ? AND ?"
      params.push(start, end)
    }
    
    query += " ORDER BY fpu.created_at DESC"
    
    const { results } = await c.env.DB.prepare(query).bind(...params).all()
    
    return c.json(results)
  } catch (error) {
    console.error("Get photos error:", error)
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

// Catch-all route for static assets and SPA routing (must be last, after all API routes)
app.get("*", async (c) => {
  try {
    // Let the Assets module handle the request
    return await c.env.ASSETS.fetch(c.req)
  } catch (e) {
    // If the asset is not found, serve the index.html for SPA routing
    const a = await c.env.ASSETS.fetch(new Request(new URL("/index.html", c.req.url)))
    return new Response(a.body, {
      headers: {
        "Content-Type": "text/html",
      },
    })
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

// --- AI Knowledge Base Analytics ---
app.get('/api/tenants/:tenantId/ai/knowledge-base/analytics', async (c) => {
  try {
    const { tenantId } = c.req.param();
    const db = c.env.DB;

    if (!tenantId) {
      return c.json({ error: 'Tenant ID is required.' }, 400);
    }

    // Get comprehensive analytics about product coverage
    const [
      totalProductsResult,
      categoryBreakdownResult,
      tagCoverageResult,
      recentProductsResult,
      priorityDistributionResult
    ] = await Promise.all([
      // Total products count
      db.prepare(`SELECT COUNT(*) as total FROM saved_products WHERE tenant_id = ?`).bind(tenantId).all(),
      
      // Product category breakdown
      db.prepare(`
        SELECT 
          product_type,
          COUNT(*) as count,
          COUNT(CASE WHEN tags IS NOT NULL AND tags != '[]' THEN 1 END) as tagged_count,
          COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as described_count
        FROM saved_products 
        WHERE tenant_id = ? 
        GROUP BY product_type 
        ORDER BY count DESC
      `).bind(tenantId).all(),
      
      // Tag coverage analysis
      db.prepare(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(CASE WHEN tags IS NOT NULL AND tags != '[]' THEN 1 END) as tagged_products,
          COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as described_products,
          COUNT(CASE WHEN price IS NOT NULL THEN 1 END) as priced_products
        FROM saved_products 
        WHERE tenant_id = ?
      `).bind(tenantId).all(),
      
      // Recent products (last 30 days)
      db.prepare(`
        SELECT COUNT(*) as recent_count 
        FROM saved_products 
        WHERE tenant_id = ? 
        AND created_at >= datetime('now', '-30 days')
      `).bind(tenantId).all(),
      
      // Priority distribution
      db.prepare(`
        SELECT 
          CASE 
            WHEN tags IS NOT NULL AND tags != '[]' THEN 'high_priority'
            WHEN description IS NOT NULL AND description != '' THEN 'medium_priority'
            ELSE 'low_priority'
          END as priority_level,
          COUNT(*) as count
        FROM saved_products 
        WHERE tenant_id = ?
        GROUP BY priority_level
      `).bind(tenantId).all()
    ]);

    const analytics = {
      totalProducts: totalProductsResult.results[0]?.total || 0,
      categoryBreakdown: categoryBreakdownResult.results || [],
      tagCoverage: {
        total: tagCoverageResult.results[0]?.total_products || 0,
        tagged: tagCoverageResult.results[0]?.tagged_products || 0,
        described: tagCoverageResult.results[0]?.described_products || 0,
        priced: tagCoverageResult.results[0]?.priced_products || 0
      },
      recentProducts: recentProductsResult.results[0]?.recent_count || 0,
      priorityDistribution: priorityDistributionResult.results || [],
      knowledgeBaseLimit: 500,
      coveragePercentage: Math.min(100, (500 / (Number(totalProductsResult.results[0]?.total) || 1)) * 100)
    };

    return c.json(analytics);

  } catch (error) {
    console.error('Error fetching knowledge base analytics:', error);
    return c.json({ error: 'Failed to fetch knowledge base analytics.' }, 500);
  }
});

export default {
  fetch: app.fetch,
  // The scheduled handler is optional
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(Promise.resolve())
  },
}
