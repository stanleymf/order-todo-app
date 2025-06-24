// Script to retrieve Tenant ID and Store ID for webhook configuration
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev";

async function getIDs() {
  console.log("🔍 Retrieving Tenant and Store IDs...\n");

  try {
    // Get all tenants (for debugging)
    const tenantsResponse = await fetch(`${API_BASE_URL}/api/tenants`);
    if (tenantsResponse.ok) {
      const tenants = await tenantsResponse.json();
      console.log("📋 Available Tenants:");
      tenants.forEach((tenant: any, index: number) => {
        console.log(`  ${index + 1}. Name: ${tenant.name}, ID: ${tenant.id}, Domain: ${tenant.domain}`);
      });
      console.log("");

      // For each tenant, get their stores
      for (const tenant of tenants) {
        console.log(`🏪 Stores for Tenant "${tenant.name}" (ID: ${tenant.id}):`);
        
        const storesResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenant.id}/stores`);
        if (storesResponse.ok) {
          const stores = await storesResponse.json();
          if (stores.length === 0) {
            console.log("  No stores found for this tenant");
          } else {
            stores.forEach((store: any, index: number) => {
              console.log(`  ${index + 1}. Name: ${store.name}, ID: ${store.id}, Type: ${store.type}`);
              console.log(`     Domain: ${store.settings?.domain || 'Not configured'}`);
              console.log(`     Webhook URL: https://order-to-do.stanleytan92.workers.dev/api/webhooks/shopify/orders-create/${tenant.id}/${store.id}`);
            });
          }
        } else {
          console.log("  ❌ Failed to fetch stores for this tenant");
        }
        console.log("");
      }
    } else {
      console.log("❌ Failed to fetch tenants");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

getIDs(); 