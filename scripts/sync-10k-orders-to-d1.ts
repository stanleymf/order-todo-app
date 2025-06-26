/**
 * Sync Script: Latest 10K Orders to D1 Database
 * 
 * This script fetches the latest 10,000 orders from Shopify and saves them
 * directly to the D1 remote database with proper GraphQL data and tag processing.
 * 
 * Usage:
 * npm run sync-10k-orders
 */

interface ShopifyOrder {
  id: string
  order_number: string
  customer: {
    first_name?: string
    last_name?: string
    email?: string
  } | null
  email: string | null
  phone: string | null
  tags: string
  note: string | null
  total_price: string
  currency: string
  line_items: any[]
  checkout_id: string | null
}

interface ShopifyStore {
  id: string
  name: string
  settings: {
    domain: string
    accessToken: string
  }
}

class OrderSync {
  private tenantId = '84caf0bf-b8a7-448f-9a33-8697cb8d6918' // Your tenant ID
  private apiBaseUrl = 'https://order-to-do.stanleytan92.workers.dev'
  private authToken = process.env.AUTH_TOKEN || ''

  async initialize() {
    console.log('🔧 Initializing 10K order sync...')
    
    if (!this.authToken) {
      throw new Error('AUTH_TOKEN environment variable is required')
    }
    
    console.log('✅ Sync initialized successfully')
  }

  async getStores(): Promise<ShopifyStore[]> {
    console.log('📥 Fetching stores...')
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tenants/${this.tenantId}/stores`, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch stores: ${response.status} ${response.statusText}`)
      }

      const stores = await response.json()
      console.log(`Found ${stores.length} stores`)
      return stores
    } catch (error) {
      console.error('❌ Error fetching stores:', error)
      throw error
    }
  }

  async fetchOrdersFromShopify(store: ShopifyStore): Promise<ShopifyOrder[]> {
    console.log(`📥 Fetching latest 10,000 orders from ${store.settings.domain}...`)
    
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tenants/${this.tenantId}/stores/${store.id}/orders/fetch-latest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          maxTotal: 10000 // Fetch latest 10K orders
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log(`✅ Fetched ${result.orders?.length || 0} orders from Shopify`)
      return result.orders || []
    } catch (error) {
      console.error('❌ Error fetching orders from Shopify:', error)
      throw error
    }
  }

  extractDeliveryDateFromTags(tags: string | string[]): string | null {
    if (!tags) return null
    
    // Handle both string and array formats
    let tagArray: string[]
    if (Array.isArray(tags)) {
      tagArray = tags
    } else if (typeof tags === 'string') {
      tagArray = tags.split(", ")
    } else {
      return null
    }
    
    // Look for date pattern DD/MM/YYYY
    const dateTag = tagArray.find((tag: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(tag.trim()))
    return dateTag || null
  }

  async saveOrdersToD1(store: ShopifyStore, orders: ShopifyOrder[]): Promise<void> {
    console.log(`💾 Saving ${orders.length} orders to D1 database...`)
    
    let savedCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const order of orders) {
      try {
        // Extract delivery date from tags
        const deliveryDate = this.extractDeliveryDateFromTags(order.tags)
        
        if (!deliveryDate) {
          console.log(`⏭️  Skipping order ${order.id} - no delivery date found in tags`)
          skippedCount++
          continue
        }

        // Fetch GraphQL order data for proper order names
        let shopifyOrderGraphQL = null
        try {
          const orderGid = `gid://shopify/Order/${order.id}`
          const response = await fetch(`${this.apiBaseUrl}/api/tenants/${this.tenantId}/stores/${store.id}/orders/fetch-graphql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ orderGid })
          })
          
          if (response.ok) {
            const result = await response.json()
            shopifyOrderGraphQL = result.order
          }
        } catch (err) {
          // Continue without GraphQL data if fetch fails
          console.warn(`⚠️  Could not fetch GraphQL data for order ${order.id}`)
        }

        // Prepare order data
        const customerName = `${order.customer?.first_name || ""} ${order.customer?.last_name || ""}`.trim() || "Guest"
        
        const orderData = {
          shopifyOrderId: order.id.toString(),
          orderNumber: order.order_number,
          customerName: customerName,
          customerEmail: order.email || order.customer?.email || "",
          deliveryDate: deliveryDate,
          notes: order.note || "",
          status: "pending",
          totalPrice: parseFloat(order.total_price),
          currency: order.currency,
          lineItems: JSON.stringify(order.line_items),
          productTitles: JSON.stringify(order.line_items.map(item => item.title)),
          quantities: JSON.stringify(order.line_items.map(item => item.quantity)),
          sessionId: order.checkout_id,
          storeId: store.id,
          productType: order.line_items?.[0]?.product_type || 'Unknown',
          tags: order.tags,
          shopifyOrderData: shopifyOrderGraphQL // Include GraphQL data for proper order names
        }

        // Save to D1 via API
        const response = await fetch(`${this.apiBaseUrl}/api/tenants/${this.tenantId}/stores/${store.id}/orders/upsert`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderData)
        })

        if (response.ok) {
          const result = await response.json()
          if (result.isNew) {
            savedCount++
          } else {
            updatedCount++
          }
          
          if ((savedCount + updatedCount) % 100 === 0) {
            console.log(`📊 Progress: ${savedCount + updatedCount}/${orders.length} orders processed`)
          }
        } else {
          console.error(`❌ Failed to save order ${order.id}: ${response.status}`)
        }

      } catch (error) {
        console.error(`❌ Error processing order ${order.id}:`, error)
      }
    }

    console.log('📊 Final Results:')
    console.log(`   ✅ Saved: ${savedCount} new orders`)
    console.log(`   🔄 Updated: ${updatedCount} existing orders`)
    console.log(`   ⏭️  Skipped: ${skippedCount} orders (no delivery date)`)
    console.log(`   📈 Total processed: ${savedCount + updatedCount} orders`)
  }

  async run(): Promise<void> {
    try {
      await this.initialize()
      
      // Get stores
      const stores = await this.getStores()
      if (stores.length === 0) {
        throw new Error('No stores found')
      }

      // Process each store
      for (const store of stores) {
        console.log(`\n🏪 Processing store: ${store.settings.domain}`)
        console.log('='.repeat(50))
        
        // Fetch orders from Shopify
        const orders = await this.fetchOrdersFromShopify(store)
        
        if (orders.length === 0) {
          console.log('⚠️ No orders found for this store')
          continue
        }

        // Save orders to D1
        await this.saveOrdersToD1(store, orders)
      }

      console.log('\n🎉 SUCCESS: 10K order sync completed!')
      console.log('✅ All orders have been saved to D1 remote database.')
      console.log('👉 You can now use "Refresh from Database" to see them in the frontend.')
      
    } catch (error) {
      console.error('❌ Sync failed:', error)
      throw error
    }
  }
}

// Export for use as module
export { OrderSync }

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const sync = new OrderSync()
  sync.run().catch(console.error)
} 