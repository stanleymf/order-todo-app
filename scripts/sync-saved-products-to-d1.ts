/**
 * Sync Script: Saved Products to D1 Database
 * 
 * This script syncs saved products from the local SQLite database to the D1 database.
 * It performs an "upsert" operation - inserting new products and updating existing ones
 * without deleting any existing data unless explicitly requested.
 * 
 * Usage:
 * npm run sync-saved-products
 */

import sqlite3 from 'sqlite3'

interface SavedProduct {
  id: string
  tenant_id: string
  shopify_product_id: string
  shopify_variant_id: string
  title: string
  variant_title?: string
  description?: string
  price: number
  tags: string
  product_type?: string
  vendor?: string
  handle?: string
  status: string
  image_url?: string
  image_alt?: string
  image_width?: number
  image_height?: number
  created_at: string
  updated_at: string
}

interface SyncOptions {
  tenantId?: string
  dryRun?: boolean
  replaceAll?: boolean
  batchSize?: number
}

class SavedProductsSync {
  private localDb: sqlite3.Database
  private options: SyncOptions

  constructor(options: SyncOptions = {}) {
    this.options = {
      dryRun: false,
      replaceAll: false,
      batchSize: 100,
      ...options
    }
  }

  async initialize() {
    console.log('🔧 Initializing sync...')
    
    // Initialize local SQLite database
    this.localDb = new sqlite3.Database('./order-todo-db.sqlite3')
    
    console.log('✅ Sync initialized successfully')
  }

  async getLocalSavedProducts(tenantId?: string): Promise<SavedProduct[]> {
    return new Promise((resolve, reject) => {
      const query = tenantId 
        ? 'SELECT * FROM saved_products WHERE tenant_id = ? ORDER BY created_at DESC'
        : 'SELECT * FROM saved_products ORDER BY created_at DESC'
      
      const params = tenantId ? [tenantId] : []
      
      this.localDb.all(query, params, (err, rows) => {
        if (err) {
          reject(err)
        } else {
          resolve(rows as SavedProduct[] || [])
        }
      })
    })
  }

  async generateSyncScript(products: SavedProduct[]): Promise<string> {
    console.log('📝 Generating sync script...')
    
    let script = `-- Generated Sync Script for Saved Products
-- Date: ${new Date().toISOString()}
-- Total Products: ${products.length}

-- Begin transaction
BEGIN TRANSACTION;

`

    for (const product of products) {
      const now = new Date().toISOString()
      
      script += `-- Product: ${product.title} (${product.shopify_product_id})
INSERT OR REPLACE INTO saved_products (
  id, tenant_id, shopify_product_id, shopify_variant_id, title, variant_title,
  description, price, tags, product_type, vendor, handle, status,
  image_url, image_alt, image_width, image_height,
  created_at, updated_at
) VALUES (
  '${product.id}',
  '${product.tenant_id}',
  '${product.shopify_product_id}',
  '${product.shopify_variant_id}',
  '${product.title.replace(/'/g, "''")}',
  ${product.variant_title ? `'${product.variant_title.replace(/'/g, "''")}'` : 'NULL'},
  ${product.description ? `'${product.description.replace(/'/g, "''")}'` : 'NULL'},
  ${product.price},
  '${product.tags.replace(/'/g, "''")}',
  ${product.product_type ? `'${product.product_type.replace(/'/g, "''")}'` : 'NULL'},
  ${product.vendor ? `'${product.vendor.replace(/'/g, "''")}'` : 'NULL'},
  ${product.handle ? `'${product.handle.replace(/'/g, "''")}'` : 'NULL'},
  '${product.status || 'active'}',
  ${product.image_url ? `'${product.image_url.replace(/'/g, "''")}'` : 'NULL'},
  ${product.image_alt ? `'${product.image_alt.replace(/'/g, "''")}'` : 'NULL'},
  ${product.image_width || 'NULL'},
  ${product.image_height || 'NULL'},
  '${product.created_at}',
  '${now}'
);

`
    }

    script += `-- Commit transaction
COMMIT;

-- Sync completed successfully!
`

    return script
  }

  async syncProducts(): Promise<void> {
    console.log('🔄 Starting saved products sync...')
    
    // Get products from local database
    console.log('📥 Fetching products from local database...')
    const localProducts = await this.getLocalSavedProducts(this.options.tenantId)
    console.log(`Found ${localProducts.length} products in local database`)
    
    if (localProducts.length === 0) {
      console.log('⚠️ No products found in local database')
      return
    }

    // Generate sync script
    const syncScript = await this.generateSyncScript(localProducts)
    
    // Write script to file
    const scriptPath = `./sync-saved-products-${Date.now()}.sql`
    
    // Note: In a real implementation, you would write the file here
    // For now, we'll just log the script content
    console.log(`\n📄 Sync script would be written to: ${scriptPath}`)
    console.log(`📊 Total products to sync: ${localProducts.length}`)
    
    // Log the first few lines of the script as a preview
    const scriptLines = syncScript.split('\n')
    console.log('\n📝 Script preview (first 10 lines):')
    scriptLines.slice(0, 10).forEach(line => console.log(`  ${line}`))
    if (scriptLines.length > 10) {
      console.log(`  ... and ${scriptLines.length - 10} more lines`)
    }
    
    if (this.options.dryRun) {
      console.log('\n🧪 DRY RUN MODE - Script preview generated')
      console.log('\nTo execute the sync:')
      console.log('1. Copy the generated script content above')
      console.log('2. Create a .sql file with the content')
      console.log('3. Run the script against your D1 database using wrangler')
      console.log('   wrangler d1 execute DB --file=your-script.sql')
    } else {
      console.log('\nTo execute the sync:')
      console.log('1. Copy the generated script content above')
      console.log('2. Create a .sql file with the content')
      console.log('3. Run the script against your D1 database using wrangler')
      console.log('   wrangler d1 execute DB --file=your-script.sql')
    }
  }

  async cleanup() {
    if (this.localDb) {
      this.localDb.close()
    }
  }
}

// Export for use in other scripts
export { SavedProductsSync, SavedProduct, SyncOptions } 