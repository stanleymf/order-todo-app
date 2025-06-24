const BASE_URL = 'https://order-to-do.stanleytan92.workers.dev';

// Updated with actual values from the user's browser
const TENANT_ID = '84caf0bf-b8a7-448f-9a33-8697cb8d6918';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGVlZjU3Yy1iZDgxLTQ3YTctYWY2OC1jOTRiNTdmMTY0OTIiLCJ0ZW5hbnRJZCI6Ijg0Y2FmMGJmLWI4YTctNDQ4Zi05YTMzLTg2OTdjYjhkNjkxOCIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc1MDgxMjkzMX0.YelnhlE6zoFW_YcGknTJijW2D_9a4f1z7uTYeOCEh_M';

async function testDebugEndpoint() {
  console.log('🔍 Testing debug endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/debug/saved-products`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 Debug endpoint response:', data);
    
    if (data.products && data.products.length > 0) {
      console.log('✅ Found products in database:');
      data.products.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} (ID: ${product.id})`);
        console.log(`     Image URL: ${product.image_url || 'NULL'}`);
        console.log(`     Image Alt: ${product.image_alt || 'NULL'}`);
        console.log(`     Image Width: ${product.image_width || 'NULL'}`);
        console.log(`     Image Height: ${product.image_height || 'NULL'}`);
      });
    } else {
      console.log('❌ No products found in database');
    }
  } catch (error) {
    console.error('❌ Error testing debug endpoint:', error);
  }
}

async function testSavedProductsEndpoint() {
  console.log('\n🔍 Testing saved products endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/saved-products`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 Saved products endpoint response count:', data.length);
    
    if (data && data.length > 0) {
      console.log('✅ Found products via API:');
      data.slice(0, 3).forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} (ID: ${product.id})`);
        console.log(`     Image URL: ${product.imageUrl || 'NULL'}`);
        console.log(`     Image Alt: ${product.imageAlt || 'NULL'}`);
        console.log(`     Image Width: ${product.imageWidth || 'NULL'}`);
        console.log(`     Image Height: ${product.imageHeight || 'NULL'}`);
      });
    } else {
      console.log('❌ No products found via API');
    }
  } catch (error) {
    console.error('❌ Error testing saved products endpoint:', error);
  }
}

async function testSaveProduct() {
  console.log('\n🔍 Testing save product endpoint...');
  
  const testProduct = {
    products: [{
      shopifyProductId: 'test-product-123',
      shopifyVariantId: 'test-variant-456',
      title: 'Test Product',
      variantTitle: 'Test Variant',
      description: 'This is a test product',
      price: 29.99,
      tags: ['test', 'debug'],
      productType: 'Test Type',
      vendor: 'Test Vendor',
      handle: 'test-product',
      imageUrl: 'https://example.com/test-image.jpg',
      imageAlt: 'Test product image',
      imageWidth: 400,
      imageHeight: 600
    }]
  };
  
  try {
    const response = await fetch(`${BASE_URL}/api/tenants/${TENANT_ID}/saved-products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testProduct)
    });
    
    const data = await response.json();
    console.log('📊 Save product response:', data);
    
    if (response.ok) {
      console.log('✅ Product saved successfully');
    } else {
      console.log('❌ Failed to save product:', data);
    }
  } catch (error) {
    console.error('❌ Error testing save product endpoint:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting saved products debugging tests...\n');
  
  await testDebugEndpoint();
  await testSavedProductsEndpoint();
  await testSaveProduct();
  
  console.log('\n✅ Debugging tests completed!');
  console.log('\n📝 Instructions:');
  console.log('1. Replace TENANT_ID with your actual tenant ID');
  console.log('2. Replace AUTH_TOKEN with your actual auth token');
  console.log('3. Run this script with: node scripts/test-saved-products-debug.js');
  console.log('4. Check the console output and worker logs for debugging information');
}

// Run the tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export {
  testDebugEndpoint,
  testSavedProductsEndpoint,
  testSaveProduct
}; 