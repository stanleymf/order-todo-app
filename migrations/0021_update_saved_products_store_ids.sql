-- Migration: Update saved_products store_id based on product analysis
-- Version: 0021
-- Date: 2025-06-25
-- Purpose: Properly distribute saved products between stores based on product characteristics

-- Step 1: Analyze current distribution
SELECT 
  'Before Update' as phase,
  ss.shopify_domain,
  COUNT(sp.id) as product_count
FROM saved_products sp
LEFT JOIN shopify_stores ss ON sp.store_id = ss.id
GROUP BY sp.store_id, ss.shopify_domain;

-- Step 2: Update products that have clear Singapore/HelloFlowers indicators
UPDATE saved_products 
SET store_id = '2a23fac3-625d-4ee8-95d9-33153c7d5535' -- helloflowerssg
WHERE (
  lower(title) LIKE '%hello%' OR 
  lower(title) LIKE '%singapore%' OR 
  lower(title) LIKE '%sg%' OR
  lower(title) LIKE '%helloflowers%' OR
  lower(description) LIKE '%singapore%' OR
  lower(tags) LIKE '%singapore%' OR
  lower(tags) LIKE '%hello%'
) AND store_id = '40a6082e-14ed-4b7c-b3fd-4d9bc67c1cf7';

-- Step 3: Check if we need more balanced distribution
-- Count how many products were moved in step 2
SELECT COUNT(*) as products_moved_to_helloflowers
FROM saved_products 
WHERE store_id = '2a23fac3-625d-4ee8-95d9-33153c7d5535';

-- Step 4: If needed, distribute some products more evenly
-- This moves every 3rd product (by creation date) to HelloFlowers if less than 20% went there
-- Uncomment the lines below if you want a more even distribution:

-- UPDATE saved_products 
-- SET store_id = '2a23fac3-625d-4ee8-95d9-33153c7d5535'
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
--     FROM saved_products 
--     WHERE store_id = '40a6082e-14ed-4b7c-b3fd-4d9bc67c1cf7'
--   ) WHERE rn % 3 = 0
--   LIMIT 400
-- );

-- Step 5: Final verification - show the distribution after updates
SELECT 
  'After Update' as phase,
  ss.shopify_domain,
  COUNT(sp.id) as product_count,
  ROUND(COUNT(sp.id) * 100.0 / (SELECT COUNT(*) FROM saved_products), 2) as percentage
FROM saved_products sp
LEFT JOIN shopify_stores ss ON sp.store_id = ss.id
GROUP BY sp.store_id, ss.shopify_domain
ORDER BY product_count DESC; 