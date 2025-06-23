// Test script for bouquet image generation
async function testBouquetImageGeneration() {
  const tenantId = "84caf0bf-b8a7-448f-9a33-8697cb8d6918";
  const knowledgeBaseUrl = `https://order-to-do.stanleytan92.workers.dev/api/tenants/${tenantId}/ai/knowledge-base`;
  const imageGenerationUrl = "https://order-to-do.stanleytan92.workers.dev/api/ai/generate-bouquet-image";

  console.log("🎨 Testing Bouquet Image Generation...");
  console.log("📍 Knowledge base endpoint:", knowledgeBaseUrl);
  console.log("📍 Image generation endpoint:", imageGenerationUrl);
  console.log("🏢 Tenant ID:", tenantId);

  // 1. Fetch the real knowledge base
  let knowledgeBase;
  try {
    const kbRes = await fetch(knowledgeBaseUrl);
    if (!kbRes.ok) {
      throw new Error(`Failed to fetch knowledge base: ${kbRes.status} ${kbRes.statusText}`);
    }
    knowledgeBase = await kbRes.json();
    console.log("✅ Knowledge base fetched. Products:", knowledgeBase.products?.length);
  } catch (err) {
    console.error("❌ Could not fetch knowledge base:", err);
    return;
  }

  // 2. Create a sample conversation and design specs
  const sampleConversation = [
    { sender: 'user', text: 'I need a romantic bouquet for my anniversary' },
    { sender: 'ai', text: 'That sounds wonderful! What colors do you prefer?' },
    { sender: 'user', text: 'I love pink and white roses' },
    { sender: 'ai', text: 'Perfect! Pink and white roses are classic for anniversaries.' }
  ];

  const designSpecs = {
    style: 'romantic',
    occasion: 'anniversary',
    colorPalette: ['pink', 'white'],
    flowerTypes: ['roses'],
    arrangement: 'round',
    size: 'medium',
    budget: 'premium'
  };

  // 3. Send image generation request
  const testPayload = {
    messages: sampleConversation,
    knowledgeBase,
    tenantId,
    designSpecs
  };

  try {
    console.log("\n🎨 Sending image generation request...");
    console.log("📋 Design specs:", designSpecs);
    
    const response = await fetch(imageGenerationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    console.log("📊 Response status:", response.status);
    console.log("📊 Response status text:", response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Success! Generated Image Data:");
      console.log("🆔 ID:", data.id);
      console.log("🎨 Prompt:", data.prompt);
      console.log("🖼️ Image URL:", data.generatedImage);
      console.log("💰 Cost:", data.cost);
      console.log("📊 Status:", data.status);
      console.log("🎯 Design Specs:", data.designSpecs);
      
      if (data.generatedImage && !data.generatedImage.includes('unsplash')) {
        console.log("🎉 Real DALL-E 3 image generated successfully!");
      } else {
        console.log("⚠️ Fallback image used (DALL-E 3 may have failed)");
      }
    } else {
      const errorData = await response.text();
      console.log("❌ Error response:", errorData);
    }
  } catch (error) {
    console.error("💥 Network error:", error);
  }
}

testBouquetImageGeneration(); 