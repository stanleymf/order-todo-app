// Diagnostic script to troubleshoot order fetching issues
// Run this to diagnose why orders aren't appearing for a new store

import Database from 'better-sqlite3'

const db = new Database('./order-todo-db.sqlite3')

interface DiagnosticResult {
  issue: string
  status: 'OK' | 'WARNING' | 'ERROR'
  details: any
  recommendation?: string
}

async function diagnoseOrderFetching(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []
  
  console.log('🔍 DIAGNOSING ORDER FETCHING ISSUES...\n')
  
  // 1. Check if stores exist
  console.log('1️⃣ Checking stores configuration...')
  try {
    const stores = db.prepare('SELECT * FROM shopify_stores ORDER BY created_at DESC').all()
    
    if (stores.length === 0) {
      results.push({
        issue: 'No stores configured',
        status: 'ERROR',
        details: 'No Shopify stores found in database',
        recommendation: 'Add a store in Settings > Stores first'
      })
    } else {
      console.log(`   ✅ Found ${stores.length} store(s)`)
      
      // Show latest store details
      const latestStore = stores[0]
      console.log(`   📱 Latest store: ${latestStore.name}`)
      console.log(`   🏪 Domain: ${latestStore.settings ? JSON.parse(latestStore.settings).domain : 'Not set'}`)
      console.log(`   🔑 Has access token: ${latestStore.settings ? !!JSON.parse(latestStore.settings).accessToken : false}`)
      
      results.push({
        issue: 'Store configuration',
        status: 'OK',
        details: {
          totalStores: stores.length,
          latestStore: {
            id: latestStore.id,
            name: latestStore.name,
            domain: latestStore.settings ? JSON.parse(latestStore.settings).domain : null,
            hasAccessToken: latestStore.settings ? !!JSON.parse(latestStore.settings).accessToken : false
          }
        }
      })
    }
  } catch (error) {
    results.push({
      issue: 'Store configuration check failed',
      status: 'ERROR',
      details: error.message,
      recommendation: 'Check database connectivity'
    })
  }
  
  // 2. Check for recent orders in database
  console.log('\n2️⃣ Checking for orders in database...')
  try {
    const recentOrders = db.prepare(`
      SELECT COUNT(*) as count, 
             MIN(delivery_date) as earliest_date,
             MAX(delivery_date) as latest_date,
             GROUP_CONCAT(DISTINCT delivery_date) as all_dates
      FROM tenant_orders 
      WHERE created_at > datetime('now', '-30 days')
    `).get()
    
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM tenant_orders').get()
    
    if (totalOrders.count === 0) {
      results.push({
        issue: 'No orders in database',
        status: 'ERROR',
        details: 'No orders found in tenant_orders table',
        recommendation: 'Orders need to be synced from Shopify first. Try "Update Orders" button.'
      })
    } else {
      console.log(`   ✅ Total orders in database: ${totalOrders.count}`)
      console.log(`   📅 Recent orders (30 days): ${recentOrders.count}`)
      console.log(`   📅 Date range: ${recentOrders.earliest_date} to ${recentOrders.latest_date}`)
      
      results.push({
        issue: 'Database orders',
        status: 'OK',
        details: {
          totalOrders: totalOrders.count,
          recentOrders: recentOrders.count,
          dateRange: `${recentOrders.earliest_date} to ${recentOrders.latest_date}`,
          availableDates: recentOrders.all_dates?.split(',') || []
        }
      })
    }
  } catch (error) {
    results.push({
      issue: 'Database order check failed',
      status: 'ERROR',
      details: error.message
    })
  }
  
  // 3. Check orders for today's date
  console.log('\n3️⃣ Checking orders for today...')
  try {
    const today = new Date().toLocaleDateString('en-GB')
    const todayOrders = db.prepare(`
      SELECT * FROM tenant_orders 
      WHERE delivery_date = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(today)
    
    if (todayOrders.length === 0) {
      results.push({
        issue: `No orders for today (${today})`,
        status: 'WARNING',
        details: `No orders found for delivery date ${today}`,
        recommendation: `Try checking other dates or ensure orders have the correct delivery date tags`
      })
    } else {
      console.log(`   ✅ Found ${todayOrders.length} orders for today (${today})`)
      todayOrders.forEach((order, i) => {
        console.log(`   📦 Order ${i + 1}: ${order.shopify_order_id} - ${order.customer_name}`)
      })
      
      results.push({
        issue: `Orders for today (${today})`,
        status: 'OK',
        details: {
          count: todayOrders.length,
          sampleOrders: todayOrders.map(o => ({
            shopifyOrderId: o.shopify_order_id,
            customerName: o.customer_name,
            storeId: o.store_id
          }))
        }
      })
    }
  } catch (error) {
    results.push({
      issue: 'Today\'s orders check failed',
      status: 'ERROR',
      details: error.message
    })
  }
  
  // 4. Check for orders with delivery date tags
  console.log('\n4️⃣ Checking for orders with delivery date tags...')
  try {
    const ordersWithTags = db.prepare(`
      SELECT shopify_order_id, delivery_date, 
             json_extract(shopify_order_data, '$.tags') as tags,
             store_id, customer_name
      FROM tenant_orders 
      WHERE shopify_order_data IS NOT NULL 
        AND json_extract(shopify_order_data, '$.tags') IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `).all()
    
    if (ordersWithTags.length === 0) {
      results.push({
        issue: 'No orders with tags found',
        status: 'WARNING',
        details: 'No orders found with Shopify tags data',
        recommendation: 'Check if orders in Shopify have delivery date tags'
      })
    } else {
      console.log(`   ✅ Found ${ordersWithTags.length} orders with tags`)
      ordersWithTags.slice(0, 3).forEach((order, i) => {
        console.log(`   🏷️ Order ${i + 1}: ${order.shopify_order_id}`)
        console.log(`      📅 Delivery: ${order.delivery_date}`)
        console.log(`      🏷️ Tags: ${order.tags}`)
        console.log(`      🏪 Store: ${order.store_id}`)
      })
      
      results.push({
        issue: 'Orders with delivery tags',
        status: 'OK',
        details: {
          count: ordersWithTags.length,
          sampleOrders: ordersWithTags.slice(0, 3).map(o => ({
            shopifyOrderId: o.shopify_order_id,
            deliveryDate: o.delivery_date,
            tags: o.tags,
            storeId: o.store_id
          }))
        }
      })
    }
  } catch (error) {
    results.push({
      issue: 'Tag analysis failed',
      status: 'ERROR',
      details: error.message
    })
  }
  
  // 5. Check store ID matching
  console.log('\n5️⃣ Checking store ID consistency...')
  try {
    const storeIds = db.prepare('SELECT DISTINCT id, name FROM shopify_stores').all()
    const orderStoreIds = db.prepare('SELECT DISTINCT store_id FROM tenant_orders WHERE store_id IS NOT NULL').all()
    
    console.log(`   🏪 Store IDs in shopify_stores:`, storeIds.map(s => `${s.id} (${s.name})`))
    console.log(`   📦 Store IDs in orders:`, orderStoreIds.map(o => o.store_id))
    
    const missingStoreMatches = orderStoreIds.filter(order => 
      !storeIds.some(store => store.id === order.store_id)
    )
    
    if (missingStoreMatches.length > 0) {
      results.push({
        issue: 'Store ID mismatch',
        status: 'WARNING',
        details: {
          orderStoreIds: orderStoreIds.map(o => o.store_id),
          configuredStoreIds: storeIds.map(s => s.id),
          missingMatches: missingStoreMatches.map(m => m.store_id)
        },
        recommendation: 'Some orders have store IDs that don\'t match configured stores'
      })
    } else {
      results.push({
        issue: 'Store ID consistency',
        status: 'OK',
        details: {
          orderStoreIds: orderStoreIds.map(o => o.store_id),
          configuredStoreIds: storeIds.map(s => s.id)
        }
      })
    }
  } catch (error) {
    results.push({
      issue: 'Store ID check failed',
      status: 'ERROR',
      details: error.message
    })
  }
  
  return results
}

// Main execution
async function main() {
  try {
    const results = await diagnoseOrderFetching()
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 DIAGNOSTIC SUMMARY')
    console.log('='.repeat(60))
    
    const errors = results.filter(r => r.status === 'ERROR')
    const warnings = results.filter(r => r.status === 'WARNING')
    const ok = results.filter(r => r.status === 'OK')
    
    console.log(`✅ OK: ${ok.length}`)
    console.log(`⚠️  WARNING: ${warnings.length}`)
    console.log(`❌ ERROR: ${errors.length}`)
    
    if (errors.length > 0) {
      console.log('\n🚨 ERRORS FOUND:')
      errors.forEach(error => {
        console.log(`   ❌ ${error.issue}: ${error.details}`)
        if (error.recommendation) {
          console.log(`      💡 Recommendation: ${error.recommendation}`)
        }
      })
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️ WARNINGS:')
      warnings.forEach(warning => {
        console.log(`   ⚠️  ${warning.issue}: ${JSON.stringify(warning.details)}`)
        if (warning.recommendation) {
          console.log(`      💡 Recommendation: ${warning.recommendation}`)
        }
      })
    }
    
    console.log('\n🔧 TROUBLESHOOTING STEPS:')
    console.log('1. Ensure your new store is properly configured in Settings > Stores')
    console.log('2. Check that your Shopify orders have delivery date tags (e.g., "27/06/2025")')
    console.log('3. Try clicking "Update Orders" to sync from Shopify')
    console.log('4. Verify you\'re checking the correct date')
    console.log('5. Check browser console (F12) for any JavaScript errors')
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
  } finally {
    db.close()
  }
}

// Auto-run if this is the main module
main() 