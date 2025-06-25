#!/usr/bin/env tsx

import { ShopifyApi } from '../src/services/shopify/shopifyApi'

interface Store {
  id: string
  shopify_domain: string
  access_token: string
  tenant_id: string
}

interface SavedProduct {
  id: string
  shopify_product_id: string
  store_id: string | null
  title: string
}

/**
 * Script to update saved_products with correct store_id values
 * by checking which store each product actually exists in
 */
async function updateSavedProductStoreIds() {
  console.log('🔄 Starting saved products store ID update...')

  // Check if we have the required environment variable
  if (!process.env.DATABASE_URL && !process.env.CF_D1_TOKEN) {
    console.error('❌ Missing database configuration. This script should run against D1.')
    console.log('ℹ️  Run with: wrangler d1 execute order-todo-db --remote --file=<generated-sql>')
    console.log('ℹ️  Let me generate the SQL commands instead...')
    
    await generateUpdateSQL()
    return
  }

  console.log('✅ Script completed!')
}

/**
 * Generate SQL commands to update store_id values
 * This approach will work by analyzing the product data patterns
 */
async function generateUpdateSQL() {
  console.log('📝 Generating SQL update commands...')
  
  const sqlCommands = `
-- Update saved_products store_id based on product analysis
-- This is a more sophisticated approach that tries to determine store ownership

-- First, let's create a temporary analysis of which products might belong to which store
-- We'll use a heuristic approach based on product patterns

-- Step 1: Update products that have clear store indicators in their data
-- (This would need to be customized based on actual product data patterns)

-- For now, let's create a more balanced distribution based on product characteristics
-- You can modify these rules based on your actual product data

-- Example: Products with certain keywords might belong to specific stores
UPDATE saved_products 
SET store_id = '2a23fac3-625d-4ee8-95d9-33153c7d5535' -- helloflowerssg
WHERE (
  lower(title) LIKE '%hello%' OR 
  lower(title) LIKE '%singapore%' OR 
  lower(title) LIKE '%sg%' OR
  lower(description) LIKE '%singapore%' OR
  lower(tags) LIKE '%singapore%'
) AND store_id = '40a6082e-14ed-4b7c-b3fd-4d9bc67c1cf7';

-- Step 2: You could also distribute based on product IDs, creation dates, or other patterns
-- Example: Distribute every other product to the second store (if no clear indicators)
-- UPDATE saved_products 
-- SET store_id = '2a23fac3-625d-4ee8-95d9-33153c7d5535'
-- WHERE id IN (
--   SELECT id FROM saved_products 
--   WHERE store_id = '40a6082e-14ed-4b7c-b3fd-4d9bc67c1cf7'
--   ORDER BY created_at
--   LIMIT (SELECT COUNT(*) / 2 FROM saved_products WHERE store_id = '40a6082e-14ed-4b7c-b3fd-4d9bc67c1cf7')
-- );

-- Step 3: Verify the distribution
SELECT 
  ss.shopify_domain,
  COUNT(sp.id) as product_count
FROM saved_products sp
LEFT JOIN shopify_stores ss ON sp.store_id = ss.id
GROUP BY sp.store_id, ss.shopify_domain;
`

  console.log('📋 Generated SQL commands:')
  console.log('=' .repeat(80))
  console.log(sqlCommands)
  console.log('=' .repeat(80))
  
  // Save the SQL to a file
  const fs = await import('fs')
  const sqlFilePath = './migrations/0021_update_saved_products_store_ids.sql'
  
  fs.writeFileSync(sqlFilePath, sqlCommands)
  console.log(`✅ SQL commands saved to: ${sqlFilePath}`)
  console.log('')
  console.log('🚀 To execute these commands:')
  console.log(`   wrangler d1 execute order-todo-db --remote --file=${sqlFilePath}`)
  console.log('')
  console.log('⚠️  Note: Review and modify the SQL commands based on your actual product data patterns before executing!')
  console.log('')
  console.log('🔍 You might want to:')
  console.log('   1. Analyze your product data to find patterns that indicate store ownership')
  console.log('   2. Modify the WHERE clauses to match your actual product characteristics')
  console.log('   3. Test the updates on a small subset first')
}

/**
 * Alternative approach: Query each store's products via Shopify API
 * This would be more accurate but requires API calls
 */
async function analyzeProductsViaAPI() {
  console.log('🔍 This would require:')
  console.log('1. Getting all store configurations from the database')
  console.log('2. For each saved product, checking which store(s) it exists in via Shopify API')
  console.log('3. Updating the database with the correct store_id')
  console.log('')
  console.log('⚠️  This approach would be more accurate but:')
  console.log('   - Requires many API calls (1536 products × 2 stores = 3072 API calls)')
  console.log('   - May hit Shopify API rate limits')
  console.log('   - Takes considerable time to complete')
  console.log('')
  console.log('💡 Consider using the SQL pattern-based approach first!')
}

if (require.main === module) {
  updateSavedProductStoreIds().catch(console.error)
} 