import { d1DatabaseService } from '../src/services/database-d1';

// Mock environment for testing
const mockEnv = {
  DB: {
    prepare: (query: string) => ({
      bind: (...params: any[]) => ({
        run: async () => ({ success: true }),
        first: async () => ({ id: 'test-id' }),
        all: async () => ({ results: [] })
      })
    })
  }
};

async function addSampleOrders() {
  const tenantId = 'default';
  const now = new Date();
  
  const sampleOrders = [
    {
      customerName: 'Sarah Johnson',
      deliveryDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      priority: 1,
      assignedTo: 'florist1',
      notes: 'Wedding bouquet - romantic style with pink roses',
      shopifyOrderId: 'SHOP001',
      product_label: 'wedding-romantic',
      total_price: 150.00,
      currency: 'USD',
      customer_email: 'sarah@example.com',
      line_items: '[{"title": "Romantic Wedding Bouquet", "quantity": 1, "price": 150.00}]',
      product_titles: 'Romantic Wedding Bouquet with Pink Roses',
      quantities: '1',
      session_id: 'session-001',
      store_id: 'store-001',
      product_type: 'bouquet'
    },
    {
      customerName: 'Michael Chen',
      deliveryDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'in_progress',
      priority: 2,
      assignedTo: 'florist2',
      notes: 'Birthday arrangement - modern style with white lilies',
      shopifyOrderId: 'SHOP002',
      product_label: 'birthday-modern',
      total_price: 85.00,
      currency: 'USD',
      customer_email: 'michael@example.com',
      line_items: '[{"title": "Modern Birthday Arrangement", "quantity": 1, "price": 85.00}]',
      product_titles: 'Modern Birthday Arrangement with White Lilies',
      quantities: '1',
      session_id: 'session-002',
      store_id: 'store-001',
      product_type: 'arrangement'
    },
    {
      customerName: 'Emily Rodriguez',
      deliveryDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'completed',
      priority: 1,
      assignedTo: 'florist1',
      notes: 'Anniversary bouquet - rustic style with sunflowers',
      shopifyOrderId: 'SHOP003',
      product_label: 'anniversary-rustic',
      total_price: 120.00,
      currency: 'USD',
      customer_email: 'emily@example.com',
      line_items: '[{"title": "Rustic Anniversary Bouquet", "quantity": 1, "price": 120.00}]',
      product_titles: 'Rustic Anniversary Bouquet with Sunflowers',
      quantities: '1',
      session_id: 'session-003',
      store_id: 'store-001',
      product_type: 'bouquet'
    },
    {
      customerName: 'David Thompson',
      deliveryDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      priority: 3,
      assignedTo: 'florist3',
      notes: 'Sympathy arrangement - elegant style with white roses',
      shopifyOrderId: 'SHOP004',
      product_label: 'sympathy-elegant',
      total_price: 95.00,
      currency: 'USD',
      customer_email: 'david@example.com',
      line_items: '[{"title": "Elegant Sympathy Arrangement", "quantity": 1, "price": 95.00}]',
      product_titles: 'Elegant Sympathy Arrangement with White Roses',
      quantities: '1',
      session_id: 'session-004',
      store_id: 'store-001',
      product_type: 'arrangement'
    },
    {
      customerName: 'Lisa Wang',
      deliveryDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'pending',
      priority: 1,
      assignedTo: 'florist1',
      notes: 'Thank you bouquet - tropical style with exotic flowers',
      shopifyOrderId: 'SHOP005',
      product_label: 'thank-you-tropical',
      total_price: 180.00,
      currency: 'USD',
      customer_email: 'lisa@example.com',
      line_items: '[{"title": "Tropical Thank You Bouquet", "quantity": 1, "price": 180.00}]',
      product_titles: 'Tropical Thank You Bouquet with Exotic Flowers',
      quantities: '1',
      session_id: 'session-005',
      store_id: 'store-001',
      product_type: 'bouquet'
    }
  ];

  console.log('Adding sample orders...');
  
  for (const orderData of sampleOrders) {
    try {
      const order = await d1DatabaseService.createOrder(mockEnv as any, tenantId, orderData);
      console.log(`Created order: ${order.customerName} - $${orderData.total_price}`);
    } catch (error) {
      console.error(`Failed to create order for ${orderData.customerName}:`, error);
    }
  }
  
  console.log('Sample orders added successfully!');
}

// Test analytics function
async function testAnalytics() {
  const tenantId = 'default';
  
  try {
    const analytics = await d1DatabaseService.getShopifyAnalytics(mockEnv as any, tenantId, {
      dateRange: '30d',
      compareWith: 'previous'
    });
    
    console.log('Analytics data:', JSON.stringify(analytics, null, 2));
  } catch (error) {
    console.error('Analytics test failed:', error);
  }
}

// Run tests
async function runTests() {
  await addSampleOrders();
  await testAnalytics();
}

runTests().catch(console.error); 