// scripts/fix-missing-product-images.ts

import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()

const API_BASE = process.env.D1_API_BASE || 'https://order-to-do.stanleytan92.workers.dev/api'
const TENANT_ID = process.env.D1_TENANT_ID
const AUTH_TOKEN = process.env.D1_AUTH_TOKEN

if (!TENANT_ID || !AUTH_TOKEN) {
  console.error('Missing D1_TENANT_ID or D1_AUTH_TOKEN in .env')
  process.exit(1)
}

async function fetchSavedProducts() {
  const res = await fetch(`${API_BASE}/tenants/${TENANT_ID}/saved-products`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  })
  if (!res.ok) throw new Error(`Failed to fetch saved products: ${res.status}`)
  return res.json()
}

async function fetchShopifyProduct(shopifyProductId: string) {
  // Use your backend endpoint to sync/fetch latest Shopify product data
  const res = await fetch(`${API_BASE}/tenants/${TENANT_ID}/shopify/products/${shopifyProductId}/sync`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
  })
  if (!res.ok) return null
  return res.json()
}

async function updateSavedProduct(productId: string, update: any) {
  const res = await fetch(`${API_BASE}/tenants/${TENANT_ID}/saved-products/${productId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
  })
  return res.ok
}

(async () => {
  console.log('Fetching all saved products...')
  const products = await fetchSavedProducts()
  const missingImage = products.filter((p: any) => !p.imageUrl && !p.image_url)
  console.log(`Found ${missingImage.length} products missing images out of ${products.length}`)

  let updated = 0
  for (const product of missingImage) {
    const shopifyId = product.shopifyProductId || product.shopify_product_id
    if (!shopifyId) continue
    console.log(`Fetching Shopify data for product ${product.title} (${shopifyId})...`)
    const shopify = await fetchShopifyProduct(shopifyId)
    if (!shopify || !shopify.images || !shopify.images[0]) {
      console.warn(`No image found for Shopify product ${shopifyId}`)
      continue
    }
    const img = shopify.images[0]
    const update = {
      imageUrl: img.src,
      imageAlt: img.alt || '',
      imageWidth: img.width || null,
      imageHeight: img.height || null,
    }
    const ok = await updateSavedProduct(product.id, update)
    if (ok) {
      updated++
      console.log(`Updated product ${product.title} (${product.id}) with image.`)
    } else {
      console.warn(`Failed to update product ${product.title} (${product.id})`)
    }
  }
  console.log(`Done. Updated ${updated} products with images.`)
})() 