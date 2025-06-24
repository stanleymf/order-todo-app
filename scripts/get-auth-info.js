// This script helps you extract authentication information from your browser
// Run this in your browser's developer console while logged into your app

console.log('🔍 Authentication Information Extractor');
console.log('=====================================');

// Get auth token from localStorage
const authToken = localStorage.getItem('authToken') || localStorage.getItem('token');
if (authToken) {
  console.log('✅ Auth Token found:', authToken);
} else {
  console.log('❌ No auth token found in localStorage');
}

// Get tenant information from localStorage
const tenantInfo = localStorage.getItem('tenant') || localStorage.getItem('tenantInfo');
if (tenantInfo) {
  try {
    const tenant = JSON.parse(tenantInfo);
    console.log('✅ Tenant Info found:', tenant);
    console.log('   Tenant ID:', tenant.id);
  } catch (error) {
    console.log('❌ Could not parse tenant info:', tenantInfo);
  }
} else {
  console.log('❌ No tenant info found in localStorage');
}

// Check for other potential auth-related keys
console.log('\n🔍 Checking for other auth-related keys in localStorage:');
const authKeys = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && (key.includes('auth') || key.includes('token') || key.includes('tenant') || key.includes('user'))) {
    authKeys.push(key);
  }
}

if (authKeys.length > 0) {
  console.log('Found auth-related keys:', authKeys);
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`  ${key}:`, value);
  });
} else {
  console.log('No auth-related keys found');
}

console.log('\n📝 Instructions:');
console.log('1. Copy the auth token and tenant ID from above');
console.log('2. Update the TENANT_ID and AUTH_TOKEN in scripts/test-saved-products-debug.js');
console.log('3. Run: node scripts/test-saved-products-debug.js');
console.log('4. Check the worker logs for debugging information');

// Also check sessionStorage
console.log('\n🔍 Checking sessionStorage:');
const sessionAuthKeys = [];
for (let i = 0; i < sessionStorage.length; i++) {
  const key = sessionStorage.key(i);
  if (key && (key.includes('auth') || key.includes('token') || key.includes('tenant') || key.includes('user'))) {
    sessionAuthKeys.push(key);
  }
}

if (sessionAuthKeys.length > 0) {
  console.log('Found auth-related keys in sessionStorage:', sessionAuthKeys);
  sessionAuthKeys.forEach(key => {
    const value = sessionStorage.getItem(key);
    console.log(`  ${key}:`, value);
  });
} else {
  console.log('No auth-related keys found in sessionStorage');
} 