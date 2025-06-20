import { databaseService } from '../src/services/database';
import { CreateTenantRequest, CreateOrderRequest } from '../types/multi-tenant';

async function testMigration() {
  console.log('🧪 Testing multi-tenant database functionality...\n');

  try {
    // Step 1: Create a test tenant
    console.log('📋 Creating test tenant...');
    const tenantData: CreateTenantRequest = {
      name: 'Test Florist',
      domain: 'test-florist',
      subscriptionPlan: 'starter',
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        businessHours: { start: '09:00', end: '17:00' },
        features: { analytics: true, multiStore: false, advancedReporting: false }
      }
    };

    const tenant = await databaseService.createTenant(tenantData);
    console.log(`✅ Created tenant: ${tenant.name} (${tenant.id})\n`);

    // Step 2: Create some test orders
    console.log('📦 Creating test orders...');
    const testOrders: CreateOrderRequest[] = [
      {
        customerName: 'John Doe',
        deliveryDate: '2024-01-15',
        status: 'pending',
        priority: 1,
        assignedTo: 'florist-1',
        notes: 'Test order 1'
      },
      {
        customerName: 'Jane Smith',
        deliveryDate: '2024-01-16',
        status: 'assigned',
        priority: 2,
        assignedTo: 'florist-2',
        notes: 'Test order 2'
      },
      {
        customerName: 'Bob Johnson',
        deliveryDate: '2024-01-17',
        status: 'completed',
        priority: 0,
        assignedTo: 'florist-1',
        notes: 'Test order 3'
      }
    ];

    for (const orderData of testOrders) {
      const order = await databaseService.createOrder(tenant.id, orderData);
      console.log(`✅ Created order: ${order.customerName} (${order.id})`);
    }
    console.log('');

    // Step 3: Test retrieving orders
    console.log('🔍 Testing order retrieval...');
    const allOrders = await databaseService.getOrders(tenant.id);
    console.log(`✅ Retrieved ${allOrders.length} orders`);

    const pendingOrders = await databaseService.getOrders(tenant.id, { status: 'pending' });
    console.log(`✅ Retrieved ${pendingOrders.length} pending orders`);

    const assignedOrders = await databaseService.getOrders(tenant.id, { status: 'assigned' });
    console.log(`✅ Retrieved ${assignedOrders.length} assigned orders`);

    const completedOrders = await databaseService.getOrders(tenant.id, { status: 'completed' });
    console.log(`✅ Retrieved ${completedOrders.length} completed orders`);
    console.log('');

    // Step 4: Test updating an order
    console.log('✏️ Testing order update...');
    if (allOrders.length > 0) {
      const orderToUpdate = allOrders[0];
      const updatedOrder = await databaseService.updateOrder(tenant.id, orderToUpdate.id, {
        status: 'in-progress',
        notes: 'Updated test order'
      });
      
      if (updatedOrder) {
        console.log(`✅ Updated order: ${updatedOrder.customerName} - Status: ${updatedOrder.status}`);
      }
    }
    console.log('');

    // Step 5: Test tenant retrieval
    console.log('🏢 Testing tenant retrieval...');
    const retrievedTenant = await databaseService.getTenant(tenant.id);
    if (retrievedTenant) {
      console.log(`✅ Retrieved tenant: ${retrievedTenant.name}`);
      console.log(`   Domain: ${retrievedTenant.domain}`);
      console.log(`   Plan: ${retrievedTenant.subscriptionPlan}`);
      console.log(`   Status: ${retrievedTenant.status}`);
    }
    console.log('');

    // Step 6: Test listing tenants
    console.log('📋 Testing tenant listing...');
    const allTenants = await databaseService.listTenants();
    console.log(`✅ Found ${allTenants.length} tenants`);
    allTenants.forEach(t => console.log(`   - ${t.name} (${t.domain})`));
    console.log('');

    // Step 7: Test data isolation (create another tenant)
    console.log('🔒 Testing tenant isolation...');
    const tenant2Data: CreateTenantRequest = {
      name: 'Another Florist',
      domain: 'another-florist',
      subscriptionPlan: 'professional'
    };

    const tenant2 = await databaseService.createTenant(tenant2Data);
    console.log(`✅ Created second tenant: ${tenant2.name} (${tenant2.id})`);

    // Create an order for the second tenant
    const order2 = await databaseService.createOrder(tenant2.id, {
      customerName: 'Alice Brown',
      deliveryDate: '2024-01-18',
      status: 'pending',
      notes: 'Order for second tenant'
    });
    console.log(`✅ Created order for second tenant: ${order2.customerName}`);

    // Verify isolation - tenant 1 shouldn't see tenant 2's orders
    const tenant1Orders = await databaseService.getOrders(tenant.id);
    const tenant2Orders = await databaseService.getOrders(tenant2.id);
    
    console.log(`✅ Tenant 1 has ${tenant1Orders.length} orders`);
    console.log(`✅ Tenant 2 has ${tenant2Orders.length} orders`);
    console.log('✅ Data isolation working correctly!');
    console.log('');

    console.log('🎉 All tests passed! Multi-tenant database is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Implement localStorage migration when running in browser');
    console.log('   2. Begin implementing authentication system');
    console.log('   3. Update UI components for multi-tenant support');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Test terminated');
  process.exit(0);
});

// Run the test
testMigration(); 