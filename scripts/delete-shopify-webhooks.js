// Usage: node scripts/delete-shopify-webhooks.js <access_token>
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const SHOP_DOMAIN = 'windflowerflorist.myshopify.com';
const API_VERSION = '2023-10';
const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.error('Usage: node scripts/delete-shopify-webhooks.js <access_token>');
  process.exit(1);
}

const BASE_URL = `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}`;

async function listWebhooks() {
  const res = await fetch(`${BASE_URL}/webhooks.json`, {
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to list webhooks: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.webhooks || [];
}

async function deleteWebhook(id) {
  const res = await fetch(`${BASE_URL}/webhooks/${id}.json`, {
    method: 'DELETE',
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete webhook ${id}: ${res.status} ${await res.text()}`);
  }
}

(async () => {
  try {
    const webhooks = await listWebhooks();
    if (webhooks.length === 0) {
      console.log('No webhooks found.');
      return;
    }
    console.log(`Found ${webhooks.length} webhooks. Deleting...`);
    for (const webhook of webhooks) {
      console.log(`Deleting webhook ${webhook.id} (${webhook.address})`);
      await deleteWebhook(webhook.id);
    }
    console.log('All webhooks deleted.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})(); 