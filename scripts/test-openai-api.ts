// Test script for OpenAI API key functionality (full flow)
async function testOpenAIAPI() {
  const tenantId = "84caf0bf-b8a7-448f-9a33-8697cb8d6918";
  const knowledgeBaseUrl = `https://order-to-do.stanleytan92.workers.dev/api/tenants/${tenantId}/ai/knowledge-base`;
  const chatUrl = "https://order-to-do.stanleytan92.workers.dev/api/ai/chat";

  console.log("🧪 Testing OpenAI API key and chat endpoint (full flow)...");
  console.log("📍 Knowledge base endpoint:", knowledgeBaseUrl);
  console.log("📍 Chat endpoint:", chatUrl);
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

  // 2. Send a real chat request
  const testPayload = {
    messages: [
      { sender: 'user', text: 'Hello, can you help me design a bouquet?' }
    ],
    knowledgeBase,
    tenantId
  };

  try {
    console.log("\n📤 Sending chat request...");
    const response = await fetch(chatUrl, {
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
      console.log("✅ Success! AI Response:", data);
      console.log("✅ OpenAI API key and chat endpoint are working correctly!");
    } else {
      const errorData = await response.text();
      console.log("❌ Error response:", errorData);
      if (response.status === 503) {
        console.log("🔑 The 503 error suggests the OpenAI API key is not configured.");
        console.log("💡 Please go to the AI Integration page and save your OpenAI API key.");
      }
    }
  } catch (error) {
    console.error("💥 Network error:", error);
  }
}

testOpenAIAPI(); 