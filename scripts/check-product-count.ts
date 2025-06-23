import { createAITrainingService } from '../src/services/aiTrainingService';

async function checkProductCount() {
  console.log('Checking product count in database...');
  
  try {
    // Use a test tenant ID
    const tenantId = 'test-tenant';
    const aiTrainingService = createAITrainingService(tenantId);
    
    // Get training data stats
    const stats = await aiTrainingService.getTrainingDataStats();
    
    console.log('Training Data Stats:');
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\nProduct count breakdown:');
    console.log(`- Total Products: ${stats.total_products}`);
    console.log(`- Total Prompts: ${stats.total_prompts}`);
    console.log(`- Total Images: ${stats.total_images}`);
    console.log(`- Total Feedback: ${stats.total_feedback}`);
    
  } catch (error) {
    console.error('Error checking product count:', error);
  }
}

checkProductCount().catch(console.error); 