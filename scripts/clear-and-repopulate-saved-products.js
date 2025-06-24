const BASE_URL = 'https://order-to-do.stanleytan92.workers.dev';

// Updated with actual values from the user's browser
const TENANT_ID = '84caf0bf-b8a7-448f-9a33-8697cb8d6918';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGVlZjU3Yy1iZDgxLTQ3YTctYWY2OC1jOTRiNTdmMTY0OTIiLCJ0ZW5hbnRJZCI6Ijg0Y2FmMGJmLWI4YTctNDQ4Zi05YTMzLTg2OTdjYjhkNjkxOCIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc1MDgxMjkzMX0.YelnhlE6zoFW_YcGknTJijW2D_9a4f1z7uTYeOCEh_M';

async function clearAllSavedProducts() {
  console.log('🗑️ Clearing all saved products...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/saved-products`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 Clear response:', data);
    
    if (response.ok) {
      console.log('✅ Successfully cleared all saved products');
      return true;
    } else {
      console.log('❌ Failed to clear saved products:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error clearing saved products:', error);
    return false;
  }
}

async function getStores() {
  console.log('🏪 Fetching stores...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/stores`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const stores = await response.json();
    console.log('📊 Stores found:', stores.length);
    
    if (stores.length > 0) {
      console.log('✅ Store found:', {
        id: stores[0].id,
        domain: stores[0].shopifyDomain,
        hasAccessToken: !!stores[0].accessToken
      });
      return stores[0];
    } else {
      console.log('❌ No stores found');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching stores:', error);
    return null;
  }
}

async function syncProductsFromStore(store) {
  console.log('🔄 Syncing products from store...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/stores/${store.id}/sync-products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page: 1,
        limit: 250
      })
    });
    
    const data = await response.json();
    console.log('📊 Sync response:', {
      success: data.success,
      productsCount: data.products?.length || 0,
      pagination: data.pagination
    });
    
    if (response.ok && data.success && data.products) {
      console.log('✅ Successfully synced products from Shopify');
      return data.products;
    } else {
      console.log('❌ Failed to sync products:', data);
      return [];
    }
  } catch (error) {
    console.error('❌ Error syncing products:', error);
    return [];
  }
}

async function saveProductsToDatabase(products) {
  console.log('💾 Saving products to database...');
  
  if (products.length === 0) {
    console.log('⚠️ No products to save');
    return false;
  }
  
  // Transform Shopify products to the format expected by the save endpoint
  const productsToSave = products.map(product => ({
    shopifyProductId: product.shopifyId,
    shopifyVariantId: product.variants?.[0]?.id || '',
    title: product.title,
    variantTitle: product.variants?.[0]?.title,
    description: product.description,
    price: parseFloat(product.variants?.[0]?.price || '0'),
    tags: product.tags || [],
    productType: product.productType,
    vendor: product.vendor,
    handle: product.handle,
    imageUrl: product.images?.[0]?.src,
    imageAlt: product.images?.[0]?.alt,
    imageWidth: product.images?.[0]?.width,
    imageHeight: product.images?.[0]?.height,
  }));
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/saved-products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        products: productsToSave
      })
    });
    
    const data = await response.json();
    console.log('📊 Save response:', {
      success: response.ok,
      savedCount: Array.isArray(data) ? data.length : 0
    });
    
    if (response.ok && Array.isArray(data)) {
      console.log('✅ Successfully saved products to database');
      return true;
    } else {
      console.log('❌ Failed to save products:', data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error saving products:', error);
    return false;
  }
}

async function verifySavedProducts() {
  console.log('🔍 Verifying saved products...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/saved-products`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const products = await response.json();
    console.log('📊 Verification response:', {
      count: products.length,
      hasProducts: products.length > 0
    });
    
    if (products.length > 0) {
      console.log('✅ Found saved products in database');
      console.log('📋 Sample products:');
      products.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title}`);
        console.log(`     Image URL: ${product.imageUrl || 'NULL'}`);
        console.log(`     Image Width: ${product.imageWidth || 'NULL'}`);
        console.log(`     Image Height: ${product.imageHeight || 'NULL'}`);
      });
      return true;
    } else {
      console.log('❌ No saved products found in database');
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying saved products:', error);
    return false;
  }
}

async function runClearAndRepopulate() {
  console.log('🚀 Starting clear and repopulate process...\n');
  
  // Step 1: Clear all saved products
  const cleared = await clearAllSavedProducts();
  if (!cleared) {
    console.log('❌ Failed to clear products. Stopping process.');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Step 2: Get store information
  const store = await getStores();
  if (!store) {
    console.log('❌ No store found. Stopping process.');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Step 3: Sync products from Shopify
  const products = await syncProductsFromStore(store);
  if (products.length === 0) {
    console.log('❌ No products synced from Shopify. Stopping process.');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Step 4: Save products to database
  const saved = await saveProductsToDatabase(products);
  if (!saved) {
    console.log('❌ Failed to save products to database. Stopping process.');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Step 5: Verify the saved products
  const verified = await verifySavedProducts();
  
  console.log('\n' + '='.repeat(50));
  if (verified) {
    console.log('🎉 SUCCESS: Clear and repopulate process completed successfully!');
    console.log('✅ All saved products have been cleared and repopulated with fresh data from Shopify.');
  } else {
    console.log('⚠️ WARNING: Process completed but verification failed.');
    console.log('Please check the saved products in your app.');
  }
  console.log('='.repeat(50));
}

// Run the process if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runClearAndRepopulate();
}

export {
  clearAllSavedProducts,
  getStores,
  syncProductsFromStore,
  saveProductsToDatabase,
  verifySavedProducts,
  runClearAndRepopulate
}; 