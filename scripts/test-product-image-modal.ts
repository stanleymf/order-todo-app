import { D1Database } from '@cloudflare/workers-types';

// Test configuration
const D1_TENANT_ID = '84caf0bf-b8a7-448f-9a33-8697cb8d6918';
const D1_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMGVlZjU3Yy1iZDgxLTQ3YTctYWY2OC1jOTRiNTdmMTY0OTIiLCJ0ZW5hbnRJZCI6Ijg0Y2FmMGJmLWI4YTctNDQ4Zi05YTMzLTg2OTdjYjhkNjkxOCIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc1MDgxMjkzMX0.YelnhlE6zoFW_YcGknTJijW2D_9a4f1z7uTYeOCEh_M';

// Get the deployed URL from wrangler config
const DEPLOYED_URL = 'https://order-todo-app.windflowerflorist.workers.dev';

// Sample Shopify product IDs to test (these should have images)
const testProductIds = [
  '8675038494944', // [TEST] DIY Floral Jamming - Fresh Flowers
  '8892038086880', // test
  '8714632954080', // TEST
  '8216116855008', // Test
  '8102450856160', // test
];

async function testProductImageModal() {
  console.log('🧪 Testing Product Image Modal API...\n');
  console.log(`Using deployed URL: ${DEPLOYED_URL}\n`);

  for (const shopifyId of testProductIds) {
    console.log(`Testing product ID: ${shopifyId}`);
    
    try {
      // Test the API endpoint that the modal uses
      const response = await fetch(`${DEPLOYED_URL}/api/saved-products/${shopifyId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${D1_AUTH_TOKEN}`,
          'X-Tenant-ID': D1_TENANT_ID,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const product = await response.json();
        console.log(`✅ Product found: ${product.title}`);
        console.log(`   Image URL: ${product.imageUrl || product.image_url || 'No image'}`);
        console.log(`   Has image: ${!!(product.imageUrl || product.image_url)}`);
      } else {
        console.log(`❌ Failed to fetch product: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   Error details: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Error testing product ${shopifyId}:`, error.message);
    }
    
    console.log('---');
  }

  console.log('\n🎯 Test Summary:');
  console.log('- If products show "Has image: true", the modal should work correctly');
  console.log('- If products show "No image", they legitimately don\'t have images in Shopify');
  console.log('- The modal should now display images for products that have them');
}

// Run the test
testProductImageModal().catch(console.error); 