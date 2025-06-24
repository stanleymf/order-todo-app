// Test script to verify store creation functionality
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev"

async function testStoreCreation() {
  console.log("Testing store creation functionality...")
  
  // First, let's test the login to get a valid token
  const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "admin@windflowerflorist.com",
      password: "admin123",
      tenantDomain: "windflowerflorist.com",
    }),
  })

  if (!loginResponse.ok) {
    console.error("Login failed:", await loginResponse.text())
    return
  }

  const loginData = await loginResponse.json()
  const token = loginData.accessToken
  const tenantId = loginData.tenant.id

  console.log("✅ Login successful")
  console.log("Tenant ID:", tenantId)

  // Test the test-shopify endpoint
  console.log("\n🔍 Testing Shopify connection endpoint...")
  const testResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/test-shopify`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  })

  if (testResponse.ok) {
    const testData = await testResponse.json()
    console.log("✅ Shopify connection test successful:", testData)
  } else {
    const errorData = await testResponse.text()
    console.log("❌ Shopify connection test failed:", testResponse.status, errorData)
  }

  // Test store creation
  console.log("\n🏪 Testing store creation...")
  const createStoreResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/stores`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Test Store",
      type: "shopify",
      settings: {
        domain: "test-store.myshopify.com",
        accessToken: "shpat_test_token",
        apiSecretKey: "shpss_test_secret",
      },
    }),
  })

  if (createStoreResponse.ok) {
    const storeData = await createStoreResponse.json()
    console.log("✅ Store created successfully:", storeData)
    
    // Test getting stores
    console.log("\n📋 Testing get stores...")
    const getStoresResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/stores`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (getStoresResponse.ok) {
      const stores = await getStoresResponse.json()
      console.log("✅ Stores retrieved successfully:", stores)
    } else {
      console.log("❌ Failed to get stores:", await getStoresResponse.text())
    }
  } else {
    console.log("❌ Store creation failed:", await createStoreResponse.text())
  }

  console.log("\n✅ Store creation functionality test completed!")
}

testStoreCreation().catch(console.error) 