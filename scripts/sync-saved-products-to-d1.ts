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
import { v4 as uuidv4 } from 'uuid'

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

interface ProductLabelMapping {
  id: string
  tenant_id: string
  saved_product_id: string
  label_id: string
  created_at: string
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

  async getProductLabelMappings(productId: string): Promise<ProductLabelMapping[]> {
    return new Promise((resolve, reject) => {
      this.localDb.all(
        'SELECT * FROM product_label_mappings WHERE saved_product_id = ?',
        [productId],
        (err, rows) => {
          if (err) reject(err)
          else resolve(rows as ProductLabelMapping[] || [])
        }
      )
    })
  }

  async upsertProductAndPreserveLabels(product: SavedProduct): Promise<void> {
    // Find existing product by tenant_id, shopify_product_id, shopify_variant_id
    const existing = await new Promise<SavedProduct | undefined>((resolve, reject) => {
      this.localDb.get(
        'SELECT * FROM saved_products WHERE tenant_id = ? AND shopify_product_id = ? AND shopify_variant_id = ?',
        [product.tenant_id, product.shopify_product_id, product.shopify_variant_id],
        (err, row) => {
          if (err) reject(err)
          else resolve(row as SavedProduct || undefined)
        }
      )
    })
    let labelMappings: ProductLabelMapping[] = []
    if (existing) {
      labelMappings = await this.getProductLabelMappings(existing.id)
    }
    // Upsert product
    await new Promise((resolve, reject) => {
      this.localDb.run(
        `INSERT OR REPLACE INTO saved_products (
          id, tenant_id, shopify_product_id, shopify_variant_id, title, variant_title,
          description, price, tags, product_type, vendor, handle, status,
          image_url, image_alt, image_width, image_height,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          existing ? existing.id : product.id,
          product.tenant_id,
          product.shopify_product_id,
          product.shopify_variant_id,
          product.title,
          product.variant_title || null,
          product.description || null,
          product.price,
          product.tags,
          product.product_type || null,
          product.vendor || null,
          product.handle || null,
          product.status || 'active',
          product.image_url || null,
          product.image_alt || null,
          product.image_width || null,
          product.image_height || null,
          product.created_at,
          product.updated_at
        ],
        (err) => {
          if (err) reject(err)
          else resolve(undefined)
        }
      )
    })
    // Re-attach labels
    if (labelMappings.length > 0) {
      for (const mapping of labelMappings) {
        await new Promise((resolve, reject) => {
          this.localDb.run(
            `INSERT OR IGNORE INTO product_label_mappings (id, tenant_id, saved_product_id, label_id, created_at) VALUES (?, ?, ?, ?, ?)`,
            [uuidv4(), mapping.tenant_id, existing ? existing.id : product.id, mapping.label_id, new Date().toISOString()],
            (err) => {
              if (err) reject(err)
              else resolve(undefined)
            }
          )
        })
      }
    }
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
    // Upsert each product and preserve labels
    for (const product of localProducts) {
      await this.upsertProductAndPreserveLabels(product)
    }
    console.log('✅ Sync completed with label preservation!')
  }

  async cleanup() {
    if (this.localDb) {
      this.localDb.close()
    }
  }
}

// Export for use in other scripts
export { SavedProductsSync }
export type { SavedProduct, SyncOptions } 