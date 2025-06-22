import { getOrderCardConfig, saveOrderCardConfig } from '../src/services/api'
import { getAllFields } from '../src/types/orderCardFields'

// Test configuration persistence
async function testOrderCardConfig() {
  console.log('🧪 Testing Order Card Configuration Persistence...')
  
  // Mock tenant ID for testing
  const tenantId = 'test-tenant-id'
  
  try {
    // 1. Get initial config
    console.log('\n1. Getting initial config...')
    const initialConfig = await getOrderCardConfig(tenantId)
    console.log('Initial config:', JSON.stringify(initialConfig, null, 2))
    
    // 2. Create a test configuration
    console.log('\n2. Creating test configuration...')
    const testConfig = {
      fields: getAllFields().map(field => ({
        ...field,
        isVisible: field.id === 'productTitle' ? false : field.isVisible, // Hide product title
        shopifyFields: field.id === 'orderId' ? ['custom:test_field'] : field.shopifyFields,
        transformation: field.id === 'orderTags' ? 'extract' : field.transformation,
        transformationRule: field.id === 'orderTags' ? 'split(",")' : field.transformationRule
      }))
    }
    
    console.log('Test config to save:', JSON.stringify(testConfig, null, 2))
    
    // 3. Save the configuration
    console.log('\n3. Saving configuration...')
    const saveResult = await saveOrderCardConfig(tenantId, testConfig)
    console.log('Save result:', saveResult)
    
    // 4. Get the configuration again
    console.log('\n4. Getting saved configuration...')
    const savedConfig = await getOrderCardConfig(tenantId)
    console.log('Saved config:', JSON.stringify(savedConfig, null, 2))
    
    // 5. Verify the configuration persisted
    console.log('\n5. Verifying configuration persistence...')
    const productTitleField = savedConfig.fields.find(f => f.id === 'productTitle')
    const orderIdField = savedConfig.fields.find(f => f.id === 'orderId')
    const orderTagsField = savedConfig.fields.find(f => f.id === 'orderTags')
    
    console.log('Product Title field visible:', productTitleField?.isVisible)
    console.log('Order ID shopify fields:', orderIdField?.shopifyFields)
    console.log('Order Tags transformation:', orderTagsField?.transformation)
    
    if (productTitleField?.isVisible === false && 
        orderIdField?.shopifyFields?.includes('custom:test_field') &&
        orderTagsField?.transformation === 'extract') {
      console.log('✅ Configuration persistence test PASSED!')
    } else {
      console.log('❌ Configuration persistence test FAILED!')
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run the test
testOrderCardConfig() 