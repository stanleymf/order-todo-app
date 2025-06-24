import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN as string;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN as string;
const SHOPIFY_API_VERSION = '2023-10';

if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_ACCESS_TOKEN) {
  console.error('❌ Please set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in your .env file.');
  process.exit(1);
}

const shopifyProductId = '7735363895520'; // Radiant Smile

async function fetchShopifyProduct(productId: string) {
  const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/products/${productId}.json`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Shopify API error:', response.status, response.statusText, errorText);
    process.exit(1);
  }

  const data = await response.json() as any;
  const images = data.product.images;
  if (images && images.length > 0) {
    console.log(`✅ Found ${images.length} image(s) for product '${data.product.title}':`);
    images.forEach((img: any, idx: number) => {
      console.log(`  [${idx + 1}] ${img.src}`);
    });
  } else {
    console.log(`⚠️ No images found for product '${data.product.title}'.`);
  }
}

fetchShopifyProduct(shopifyProductId).catch(console.error); 