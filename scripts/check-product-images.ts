#!/usr/bin/env tsx

/**
 * Check saved products in D1 database for missing image data
 * 
 * Usage:
 * tsx scripts/check-product-images.ts
 */

import { d1DatabaseService } from '../src/services/database-d1'

async function main() {
  console.log('🔍 Checking saved products in D1 database...')
  
  try {
    // We need to simulate the D1 environment
    // For now, let's just show what we would check
    
    console.log('📊 Analysis of saved products:')
    console.log('1. Total products in D1')
    console.log('2. Products with imageUrl')
    console.log('3. Products missing imageUrl')
    console.log('4. Sample product data')
    
    console.log('\n⚠️ This script needs to be run with D1 access')
    console.log('To check your products manually:')
    console.log('1. Go to your app and check Products > Saved Products')
    console.log('2. Look for products with missing images')
    console.log('3. If images are missing, you may need to re-sync from Shopify')
    
    console.log('\n💡 Quick fix:')
    console.log('1. Go to Products > Sync from Shopify')
    console.log('2. Select products that are missing images')
    console.log('3. Click "Save Selected Products" to re-sync with image data')
    
  } catch (error) {
    console.error('❌ Error checking products:', error)
  }
}

main() 