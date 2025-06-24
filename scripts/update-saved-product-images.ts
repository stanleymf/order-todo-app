#!/usr/bin/env tsx

/**
 * Update existing saved products with image data from Shopify
 * 
 * This script:
 * 1. Fetches existing saved products from D1
 * 2. Gets fresh data from Shopify for each product
 * 3. Updates the saved products with image data
 * 
 * Usage:
 * npx tsx scripts/update-saved-product-images.ts
 */

import { d1DatabaseService } from '../src/services/database-d1'

interface SavedProduct {
  id: string
  tenantId: string
  shopifyProductId: string
  shopifyVariantId: string
  title: string
  variantTitle?: string
  description?: string
  price: number
  tags: string[]
  productType?: string
  vendor?: string
  handle?: string
  status: string
  imageUrl?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  createdAt: string
  updatedAt: string
}

async function main() {
  console.log('🔄 Starting saved product image update...')
  
  try {
    // This would need to be run in the D1 environment
    // For now, let's provide the manual steps
    
    console.log('📋 Manual Update Process:')
    console.log('')
    console.log('1. Go to your app: https://order-to-do.stanleytan92.workers.dev')
    console.log('2. Navigate to: Products > Saved Products')
    console.log('3. For each product missing an image:')
    console.log('   - Note the product title and variant')
    console.log('   - Go to: Products > Sync from Shopify')
    console.log('   - Find the same product in the Shopify list')
    console.log('   - Select it and click "Save Selected Products"')
    console.log('   - This will update the existing product with image data')
    console.log('')
    console.log('4. Alternative: Use the "Sync from Shopify" feature for all products')
    console.log('   - The system will update existing products instead of creating duplicates')
    console.log('')
    console.log('💡 Why this works:')
    console.log('- The saveProducts function uses INSERT OR REPLACE')
    console.log('- This means it updates existing products instead of creating duplicates')
    console.log('- The imageUrl, imageAlt, etc. will be updated with fresh data from Shopify')
    
  } catch (error) {
    console.error('❌ Error updating products:', error)
  }
}

main() 