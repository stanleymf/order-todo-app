import Database from 'better-sqlite3'

const db = new Database('order-todo-db.sqlite3')
const domain = 'windflowerflorist.myshopify.com'

// 1. Find all store IDs for the domain
type StoreRow = { id: string }
const storeRows: StoreRow[] = db.prepare('SELECT id FROM shopify_stores WHERE shopify_domain = ?').all(domain)

if (storeRows.length === 0) {
  console.log('No stores found for domain:', domain)
  process.exit(0)
}

console.log(`Found ${storeRows.length} store(s) for domain: ${domain}`)

for (const { id: storeId } of storeRows) {
  // Delete orders for this store
  const delOrders = db.prepare('DELETE FROM tenant_orders WHERE store_id = ?').run(storeId)
  console.log(`Deleted ${delOrders.changes} orders for store ${storeId}`)

  // Delete products for this store (if you have a products table with store_id)
  try {
    const delProducts = db.prepare('DELETE FROM products WHERE store_id = ?').run(storeId)
    console.log(`Deleted ${delProducts.changes} products for store ${storeId}`)
  } catch (e) {
    // Table may not exist, ignore
  }

  // Delete the store itself
  const delStore = db.prepare('DELETE FROM shopify_stores WHERE id = ?').run(storeId)
  console.log(`Deleted store ${storeId}`)
}

console.log('Cleanup complete.') 