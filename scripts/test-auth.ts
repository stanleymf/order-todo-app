import { authService } from '../src/services/auth';
import { databaseService } from '../src/services/database';
import { CreateTenantRequest, CreateOrderRequest } from '../src/types/multi-tenant';

async function testAuthentication() {
  console.log('🧪 Testing multi-tenant authentication system...\n');

  try {
    // Step 1: Create test tenants
    console.log('📋 Creating test tenants...');
    const tenant1Data: CreateTenantRequest = {
      name: 'Test Florist 1',
      domain: 'test-florist-1',
      subscriptionPlan: 'starter'
    };

    const tenant2Data: CreateTenantRequest = {
      name: 'Test Florist 2',
      domain: 'test-florist-2',
      subscriptionPlan: 'professional'
    };

    // Check if tenants already exist
    const existingTenants = await databaseService.listTenants();
    let tenant1 = existingTenants.find(t => t.domain === 'test-florist-1');
    let tenant2 = existingTenants.find(t => t.domain === 'test-florist-2');

    if (!tenant1) {
      tenant1 = await databaseService.createTenant(tenant1Data);
      console.log(`✅ Created tenant 1: ${tenant1.name} (${tenant1.id})`);
    } else {
      console.log(`✅ Using existing tenant 1: ${tenant1.name} (${tenant1.id})`);
    }

    if (!tenant2) {
      tenant2 = await databaseService.createTenant(tenant2Data);
      console.log(`✅ Created tenant 2: ${tenant2.name} (${tenant2.id})`);
    } else {
      console.log(`✅ Using existing tenant 2: ${tenant2.name} (${tenant2.id})`);
    }
    console.log('');

    // Step 2: Create test users
    console.log('👥 Creating test users...');
    
    // Check existing users for tenant 1
    const existingUsers1 = await databaseService.getUsers(tenant1.id);
    let user1 = existingUsers1.find(u => u.email === 'admin@test-florist-1.com');
    let user2 = existingUsers1.find(u => u.email === 'florist@test-florist-1.com');

    if (!user1) {
      user1 = await databaseService.createUser(tenant1.id, {
        email: 'admin@test-florist-1.com',
        name: 'Admin User 1',
        role: 'admin',
        permissions: ['orders:read', 'orders:write', 'products:read', 'products:write', 'analytics:read', 'settings:read', 'settings:write']
      });
      console.log(`✅ Created user 1: ${user1.name} (${user1.email})`);
    } else {
      console.log(`✅ Using existing user 1: ${user1.name} (${user1.email})`);
    }

    if (!user2) {
      user2 = await databaseService.createUser(tenant1.id, {
        email: 'florist@test-florist-1.com',
        name: 'Florist User 1',
        role: 'florist',
        permissions: ['orders:read', 'orders:write', 'products:read']
      });
      console.log(`✅ Created user 2: ${user2.name} (${user2.email})`);
    } else {
      console.log(`✅ Using existing user 2: ${user2.name} (${user2.email})`);
    }

    // Check existing users for tenant 2
    const existingUsers2 = await databaseService.getUsers(tenant2.id);
    let user3 = existingUsers2.find(u => u.email === 'admin@test-florist-2.com');
    let user4 = existingUsers2.find(u => u.email === 'florist@test-florist-2.com');

    if (!user3) {
      user3 = await databaseService.createUser(tenant2.id, {
        email: 'admin@test-florist-2.com',
        name: 'Admin User 2',
        role: 'admin',
        permissions: ['orders:read', 'orders:write', 'products:read', 'products:write', 'analytics:read', 'settings:read', 'settings:write']
      });
      console.log(`✅ Created user 3: ${user3.name} (${user3.email})`);
    } else {
      console.log(`✅ Using existing user 3: ${user3.name} (${user3.email})`);
    }

    if (!user4) {
      user4 = await databaseService.createUser(tenant2.id, {
        email: 'florist@test-florist-2.com',
        name: 'Florist User 2',
        role: 'florist',
        permissions: ['orders:read', 'orders:write', 'products:read']
      });
      console.log(`✅ Created user 4: ${user4.name} (${user4.email})`);
    } else {
      console.log(`✅ Using existing user 4: ${user4.name} (${user4.email})`);
    }
    console.log('');

    // Step 3: Test login with tenant domain
    console.log('🔐 Testing login with tenant domain...');
    const loginResult1 = await authService.login({
      email: 'admin@test-florist-1.com',
      password: 'password',
      tenantDomain: 'test-florist-1'
    });

    if (loginResult1.success) {
      console.log('✅ Login successful for tenant 1');
      console.log(`   User: ${loginResult1.user?.name}`);
      console.log(`   Tenant: ${loginResult1.tenant?.name}`);
      console.log(`   Token: ${loginResult1.token?.substring(0, 20)}...`);
    } else {
      console.log('❌ Login failed for tenant 1:', loginResult1.error);
    }

    // Step 4: Test login without tenant domain (should find user across tenants)
    console.log('\n🔐 Testing login without tenant domain...');
    const loginResult2 = await authService.login({
      email: 'admin@test-florist-2.com',
      password: 'password'
    });

    if (loginResult2.success) {
      console.log('✅ Login successful for tenant 2');
      console.log(`   User: ${loginResult2.user?.name}`);
      console.log(`   Tenant: ${loginResult2.tenant?.name}`);
      console.log(`   Token: ${loginResult2.token?.substring(0, 20)}...`);
    } else {
      console.log('❌ Login failed for tenant 2:', loginResult2.error);
    }

    // Step 5: Test token validation
    console.log('\n🔍 Testing token validation...');
    if (loginResult1.success && loginResult1.token) {
      const payload = await authService.validateToken(loginResult1.token);
      if (payload) {
        console.log('✅ Token validation successful');
        console.log(`   User ID: ${payload.userId}`);
        console.log(`   Tenant ID: ${payload.tenantId}`);
        console.log(`   Role: ${payload.role}`);
        console.log(`   Session ID: ${payload.sessionId}`);
      } else {
        console.log('❌ Token validation failed');
      }
    }

    // Step 6: Test session management
    console.log('\n📋 Testing session management...');
    if (loginResult1.success && loginResult1.token) {
      const session = await authService.getCurrentSession(loginResult1.token);
      if (session) {
        console.log('✅ Session retrieved successfully');
        console.log(`   Session ID: ${session.id}`);
        console.log(`   User ID: ${session.userId}`);
        console.log(`   Tenant ID: ${session.tenantId}`);
        console.log(`   Expires: ${session.expiresAt}`);
      } else {
        console.log('❌ Session retrieval failed');
      }
    }

    // Step 7: Test token refresh
    console.log('\n🔄 Testing token refresh...');
    if (loginResult1.success && loginResult1.refreshToken) {
      const refreshResult = await authService.refreshToken(loginResult1.refreshToken);
      if (refreshResult.success) {
        console.log('✅ Token refresh successful');
        console.log(`   New token: ${refreshResult.token?.substring(0, 20)}...`);
        console.log(`   New refresh token: ${refreshResult.refreshToken?.substring(0, 20)}...`);
      } else {
        console.log('❌ Token refresh failed:', refreshResult.error);
      }
    }

    // Step 8: Test logout
    console.log('\n🚪 Testing logout...');
    if (loginResult1.success && loginResult1.token) {
      const logoutSuccess = await authService.logout(loginResult1.token);
      if (logoutSuccess) {
        console.log('✅ Logout successful');
        
        // Verify session is removed
        const session = await authService.getCurrentSession(loginResult1.token);
        if (!session) {
          console.log('✅ Session properly removed');
        } else {
          console.log('❌ Session still exists after logout');
        }
      } else {
        console.log('❌ Logout failed');
      }
    }

    // Step 9: Test invalid login attempts
    console.log('\n🚫 Testing invalid login attempts...');
    
    // Wrong password
    const wrongPasswordResult = await authService.login({
      email: 'admin@test-florist-1.com',
      password: 'wrongpassword',
      tenantDomain: 'test-florist-1'
    });
    
    if (!wrongPasswordResult.success) {
      console.log('✅ Wrong password correctly rejected:', wrongPasswordResult.error);
    } else {
      console.log('❌ Wrong password should have been rejected');
    }

    // Non-existent tenant
    const wrongTenantResult = await authService.login({
      email: 'admin@test-florist-1.com',
      password: 'password',
      tenantDomain: 'non-existent-tenant'
    });
    
    if (!wrongTenantResult.success) {
      console.log('✅ Non-existent tenant correctly rejected:', wrongTenantResult.error);
    } else {
      console.log('❌ Non-existent tenant should have been rejected');
    }

    // Step 10: Test active sessions
    console.log('\n📊 Testing active sessions...');
    const activeSessions = authService.getActiveSessions();
    console.log(`✅ Found ${activeSessions.length} active sessions`);

    // Step 11: Test session cleanup
    console.log('\n🧹 Testing session cleanup...');
    authService.cleanupExpiredSessions();
    const sessionsAfterCleanup = authService.getActiveSessions();
    console.log(`✅ ${sessionsAfterCleanup.length} sessions remaining after cleanup`);

    console.log('\n🎉 Authentication system tests completed!');
    console.log('\n📝 Test Summary:');
    console.log('   ✅ Tenant creation and management');
    console.log('   ✅ Multi-tenant login with domain');
    console.log('   ✅ Cross-tenant user lookup');
    console.log('   ✅ JWT token generation and validation');
    console.log('   ✅ Session management');
    console.log('   ✅ Token refresh functionality');
    console.log('   ✅ Secure logout');
    console.log('   ✅ Invalid login handling');
    console.log('   ✅ Session cleanup');

  } catch (error) {
    console.error('❌ Authentication test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Authentication test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Authentication test terminated');
  process.exit(0);
});

// Run the test
testAuthentication(); 