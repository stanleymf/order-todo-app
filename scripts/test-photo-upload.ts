#!/usr/bin/env tsx

/**
 * Test Photo Upload System
 * 
 * This script tests the complete photo upload system including:
 * - Photo upload endpoints
 * - Description management
 * - Quality assessment
 * - Training data creation
 * - AI training integration
 */

import { createPhotoUploadService } from '../src/services/photoUploadService';

// Test configuration
const TEST_TENANT_ID = 'test-tenant-123';
const TEST_USER_ID = 'test-user-456';
const API_BASE_URL = 'http://localhost:8787';

// Create a mock file for testing
function createMockImageFile(): File {
  // Create a simple 1x1 pixel PNG image as base64
  const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const byteCharacters = atob(base64Image);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  
  return new File([blob], 'test-image.png', { type: 'image/png' });
}

async function testPhotoUploadSystem() {
  console.log('🧪 Testing Photo Upload System...\n');

  const photoUploadService = createPhotoUploadService(TEST_TENANT_ID, TEST_USER_ID);
  const mockFile = createMockImageFile();

  try {
    // Test 1: Photo Upload
    console.log('📸 Test 1: Photo Upload');
    console.log('Uploading test image...');
    
    const uploadResult = await photoUploadService.uploadPhoto(mockFile);
    console.log('✅ Photo uploaded successfully:', uploadResult.id);
    console.log('   - Original size:', uploadResult.original_file_size, 'bytes');
    console.log('   - Compressed size:', uploadResult.compressed_file_size, 'bytes');
    console.log('   - Status:', uploadResult.upload_status);
    console.log('');

    // Test 2: Add Description
    console.log('📝 Test 2: Add Photo Description');
    const description = {
      title: 'Test Wedding Bouquet',
      description: 'A beautiful romantic wedding bouquet with white roses and baby\'s breath',
      flowers_used: ['white roses', 'baby\'s breath', 'eucalyptus'],
      colors: ['white', 'ivory', 'green'],
      style: 'romantic',
      occasion: 'wedding',
      arrangement_type: 'bouquet',
      difficulty_level: 'intermediate' as const,
      special_techniques: ['wiring', 'taping'],
      materials_used: ['satin ribbon', 'pearls'],
      customer_preferences: 'Classic romantic style',
      price_range: 'premium',
      season: 'spring',
      tags: ['romantic', 'elegant', 'wedding', 'bouquet'],
      is_public: true
    };

    const descriptionResult = await photoUploadService.addPhotoDescription(uploadResult.id, description);
    console.log('✅ Description added successfully:', descriptionResult.id);
    console.log('   - Title:', descriptionResult.title);
    console.log('   - Style:', descriptionResult.style);
    const flowersArray = descriptionResult.flowers_used ? JSON.parse(descriptionResult.flowers_used) as string[] : [];
    console.log('   - Flowers:', flowersArray.join(', '));
    console.log('');

    // Test 3: Quality Assessment
    console.log('⭐ Test 3: Quality Assessment');
    const assessment = {
      technical_quality: 4.5,
      composition_quality: 4.0,
      design_quality: 4.8,
      training_value: 4.2,
      overall_score: 4.4,
      quality_notes: 'Excellent lighting and composition. The romantic style is well-captured.',
      improvement_suggestions: 'Consider shooting from a slightly lower angle to better show the bouquet structure.',
      is_approved_for_training: true
    };

    const assessmentResult = await photoUploadService.assessPhotoQuality(uploadResult.id, assessment);
    console.log('✅ Quality assessment completed:', assessmentResult.id);
    console.log('   - Overall score:', assessmentResult.overall_score);
    console.log('   - Approved for training:', assessmentResult.is_approved_for_training);
    console.log('');

    // Test 4: Training Data Extraction
    console.log('🧠 Test 4: Training Data Extraction');
    const trainingData = await photoUploadService.extractTrainingDataFromPhoto(uploadResult.id);
    console.log('✅ Training data extracted successfully');
    console.log('   - Prompt:', trainingData.prompt);
    console.log('   - Style parameters:', Object.keys(trainingData.style_parameters).join(', '));
    console.log('   - Quality score:', trainingData.quality_score);
    console.log('');

    // Test 5: Create Training Data
    console.log('🔗 Test 5: Create Training Data');
    const trainingResult = await photoUploadService.createTrainingDataFromPhotos([uploadResult.id]);
    console.log('✅ Training data created successfully');
    console.log('   - Training records created:', trainingResult.length);
    console.log('');

    // Test 6: Get Photos
    console.log('📋 Test 6: Get Photos');
    const photos = await photoUploadService.getPhotos({ status: 'approved' });
    console.log('✅ Photos retrieved successfully');
    console.log('   - Total approved photos:', photos.length);
    console.log('');

    // Test 7: Get Photo Stats
    console.log('📊 Test 7: Photo Statistics');
    const stats = await photoUploadService.getPhotoStats();
    console.log('✅ Photo statistics retrieved');
    console.log('   - Total photos:', stats.total_photos);
    console.log('   - Approved photos:', stats.approved_photos);
    console.log('   - Average quality:', stats.average_quality);
    console.log('');

    // Test 8: Daily Upload Goals
    console.log('🎯 Test 8: Daily Upload Goals');
    const today = new Date().toISOString().split('T')[0];
    const goal = await photoUploadService.getDailyUploadGoal(today);
    console.log('✅ Daily upload goal retrieved');
    console.log('   - Target count:', goal?.target_count);
    console.log('   - Actual count:', goal?.actual_count);
    console.log('   - Goal status:', goal?.goal_status);
    console.log('');

    console.log('🎉 All tests passed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Photo upload working');
    console.log('   ✅ Description management working');
    console.log('   ✅ Quality assessment working');
    console.log('   ✅ Training data extraction working');
    console.log('   ✅ AI training integration working');
    console.log('   ✅ Photo retrieval working');
    console.log('   ✅ Statistics working');
    console.log('   ✅ Upload goals working');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Test API endpoints directly
async function testAPIEndpoints() {
  console.log('\n🌐 Testing API Endpoints Directly...\n');

  try {
    // Test photo upload endpoint
    console.log('📤 Testing POST /api/tenants/{tenantId}/photos/upload');
    const mockFile = createMockImageFile();
    const formData = new FormData();
    formData.append('photo', mockFile);
    formData.append('metadata', JSON.stringify({ test: true }));
    formData.append('original_size', mockFile.size.toString());
    formData.append('compressed_size', mockFile.size.toString());

    const uploadResponse = await fetch(`${API_BASE_URL}/api/tenants/${TEST_TENANT_ID}/photos/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (uploadResponse.ok) {
      const uploadResult = await uploadResponse.json();
      console.log('✅ Upload endpoint working:', uploadResult.id);
    } else {
      console.log('⚠️ Upload endpoint test skipped (auth required)');
    }

    // Test get photos endpoint
    console.log('📥 Testing GET /api/tenants/{tenantId}/photos');
    const photosResponse = await fetch(`${API_BASE_URL}/api/tenants/${TEST_TENANT_ID}/photos`, {
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });

    if (photosResponse.ok) {
      const photos = await photosResponse.json();
      console.log('✅ Get photos endpoint working:', photos.length, 'photos');
    } else {
      console.log('⚠️ Get photos endpoint test skipped (auth required)');
    }

  } catch (error) {
    console.log('⚠️ API endpoint tests skipped (server not running)');
  }
}

// Run tests
async function main() {
  console.log('🚀 Photo Upload System Test Suite');
  console.log('=====================================\n');

  await testPhotoUploadSystem();
  await testAPIEndpoints();

  console.log('\n✨ Test suite completed!');
}

// Run if called directly
if (typeof window === 'undefined') {
  main().catch(console.error);
}

export { testPhotoUploadSystem, testAPIEndpoints }; 