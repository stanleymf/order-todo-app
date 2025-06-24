#!/usr/bin/env tsx

/**
 * Runner script for syncing saved products to D1
 * 
 * Usage:
 * npm run sync-saved-products
 */

import { SavedProductsSync } from './sync-saved-products-to-d1'

async function main() {
  const args = process.argv.slice(2)
  const options: any = {}
  
  // Parse command line arguments
  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--replace-all') {
      options.replaceAll = true
    } else if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1]
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1])
    }
  }

  const sync = new SavedProductsSync(options)
  
  try {
    await sync.initialize()
    await sync.syncProducts()
    console.log('\n✅ Sync script generation completed successfully!')
  } catch (error) {
    console.error('\n❌ Sync failed:', error)
    process.exit(1)
  } finally {
    await sync.cleanup()
  }
}

// Run the script
main() 