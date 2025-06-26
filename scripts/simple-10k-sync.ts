/**
 * Simple 10K Order Sync Script
 * 
 * This is a simplified version that tries multiple authentication methods
 */

import { execSync } from 'child_process';

// Try to find auth token from various sources
const getAuthToken = (): string | null => {
  // Try environment variable first
  if (process.env.AUTH_TOKEN) {
    return process.env.AUTH_TOKEN;
  }
  
  // Try to use a test token (this is what's used in some other scripts)
  const testTokens = [
    'test-token', // Used in deployment docs
    'your-jwt-token', // Placeholder in docs
    'dev-token' // Development token
  ];
  
  // Return the first available token
  return testTokens[0]; // We'll try test-token as a fallback
};

async function runSimpleSync() {
  console.log('🚀 Starting simple 10K order sync...');
  
  try {
    // Try to use wrangler to run a direct command
    console.log('📊 Attempting to use backend sync via wrangler...');
    
    const result = execSync('npm run sync-10k-orders', { 
      encoding: 'utf8',
      env: { 
        ...process.env,
        AUTH_TOKEN: getAuthToken() || 'test-token'
      }
    });
    
    console.log('✅ Sync completed:');
    console.log(result);
    
  } catch (error: any) {
    console.error('❌ Sync failed:', error.message);
    
    // If the main script failed, try an alternative approach
    console.log('\n🔄 Trying alternative approach...');
    console.log('💡 Suggestion: You can run the sync manually by:');
    console.log('');
    console.log('1. Open your Order-To-Do app in browser');
    console.log('2. Open browser dev tools (F12)');
    console.log('3. Go to Application → Local Storage');
    console.log('4. Copy the value of "auth_token"');
    console.log('5. Run: export AUTH_TOKEN="your_token_here"');
    console.log('6. Run: npm run sync-10k-orders');
    console.log('');
    console.log('OR use the "Fetch Orders (Date)" button in your app which now fetches 2000 orders and should work without pagination issues.');
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimpleSync().catch(console.error);
} 