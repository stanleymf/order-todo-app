import type { Product, ProductVariant, ProductImage, ProductMetafield } from "../../types"
import type { Store } from "../../types"

// Shopify API configuration
interface ShopifyConfig {
  storeDomain: string
  accessToken: string
  apiVersion: string
}

// Shopify API response types
interface ShopifyProductResponse {
  product: {
    id: number
    title: string
    handle: string
    body_html: string
    product_type: string
    vendor: string
    tags: string
    status: string
    published_at: string
    created_at: string
    updated_at: string
    variants: ShopifyVariantResponse[]
    images: ShopifyImageResponse[]
    metafields: ShopifyMetafieldResponse[]
  }
}

interface ShopifyVariantResponse {
  id: number
  title: string
  sku: string
  price: string
  compare_at_price: string
  inventory_quantity: number
  weight: number
  weight_unit: string
  requires_shipping: boolean
  taxable: boolean
  barcode: string
  position: number
  created_at: string
  updated_at: string
}

interface ShopifyImageResponse {
  id: number
  src: string
  alt: string
  width: number
  height: number
  position: number
  created_at: string
  updated_at: string
}

interface ShopifyMetafieldResponse {
  id: number
  namespace: string
  key: string
  value: string
  type: string
  description: string
  created_at: string
  updated_at: string
}

interface ShopifyProductsResponse {
  products: ShopifyProductResponse["product"][]
}

// Shopify API service class
export class ShopifyApiService {
  private config: ShopifyConfig
  private store: Store

  constructor(store: Store, accessToken: string) {
    this.config = {
      storeDomain: store.settings?.domain || "placeholder.myshopify.com",
      accessToken,
      apiVersion: "2023-10", // Use a more stable version
    }
    this.store = store
  }

  private getBaseUrl(): string {
    return `https://${this.config.storeDomain}/admin/api/${this.config.apiVersion}`
  }

  private getHeaders(): HeadersInit {
    return {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": this.config.accessToken,
    }
  }

  // Fetch all products from Shopify with pagination
  async fetchProducts(
    page: number = 1,
    limit: number = 250,
    sinceId?: number,
    pageInfo?: string
  ): Promise<{
    products: any[]
    pagination: {
      page: number
      limit: number
      hasNext: boolean
      total: number
      nextSinceId?: number
      nextPageInfo?: string
    }
  }> {
    try {
      // Build URL with proper pagination parameters
      const params = new URLSearchParams()
      params.append("limit", limit.toString())

      // Use page_info for cursor-based pagination (Shopify's preferred method)
      if (pageInfo) {
        params.append("page_info", pageInfo)
      } else if (sinceId) {
        // Fallback to since_id if page_info is not available
        params.append("since_id", sinceId.toString())
      }

      const url = `${this.getBaseUrl()}/products.json?${params.toString()}`
      console.log("Shopify API URL:", url)
      console.log("Shopify API Headers:", this.getHeaders())

      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      console.log("Shopify API Response Status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Shopify API Error Response:", errorText)
        throw new Error(
          `Shopify API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data: ShopifyProductsResponse = await response.json()

      // Check if there are more products by looking at the Link header
      const linkHeader = response.headers.get("Link")
      let hasNext = false
      let nextSinceId: number | undefined
      let nextPageInfo: string | undefined

      console.log("Link header:", linkHeader)
      console.log("Products received:", data.products.length)
      console.log("Limit:", limit)
      console.log(
        "Last product ID:",
        data.products.length > 0 ? data.products[data.products.length - 1].id : "no products"
      )

      if (linkHeader) {
        // Parse Link header to find next page
        const links = linkHeader.split(",").map((link) => {
          const [url, rel] = link.split(";").map((s) => s.trim())
          const relMatch = rel.match(/rel="([^"]+)"/)
          return {
            url: url.replace(/[<>]/g, ""),
            rel: relMatch ? relMatch[1] : "",
          }
        })

        const nextLink = links.find((link) => link.rel === "next")
        if (nextLink) {
          hasNext = true
          // Extract page_info from next URL (Shopify uses page_info for pagination)
          const nextUrl = new URL(nextLink.url)
          const pageInfoParam = nextUrl.searchParams.get("page_info")
          if (pageInfoParam) {
            nextPageInfo = pageInfoParam
            console.log("Found page_info:", nextPageInfo)
          } else {
            // Fallback to since_id if page_info is not present
            const nextSinceIdParam = nextUrl.searchParams.get("since_id")
            if (nextSinceIdParam) {
              nextSinceId = parseInt(nextSinceIdParam)
              console.log("Found since_id:", nextSinceId)
            }
          }
        }
      } else {
        // Fallback: if we got a full page, assume there might be more
        // and use the last product's ID as the next since_id
        hasNext = data.products.length === limit
        console.log("Fallback logic - hasNext:", hasNext)
        if (hasNext && data.products.length > 0) {
          // Use the ID of the last product as the since_id for the next request
          const lastProduct = data.products[data.products.length - 1]
          nextSinceId = lastProduct.id
          console.log("Set nextSinceId to:", nextSinceId)
        }
      }

      console.log(
        "Final pagination state - hasNext:",
        hasNext,
        "nextSinceId:",
        nextSinceId,
        "nextPageInfo:",
        nextPageInfo
      )

      const products = data.products.map((product) => ({
        id: `shopify-${product.id}`,
        title: product.title,
        name: product.title,
        description: product.body_html,
        productType: product.product_type,
        vendor: product.vendor,
        tags: product.tags ? product.tags.split(",").map((tag) => tag.trim()) : [],
        status: product.status,
        handle: product.handle,
        shopifyId: product.id.toString(),
        variants:
          product.variants?.map((variant) => ({
            id: variant.id.toString(),
            title: variant.title,
            price: variant.price,
            sku: variant.sku,
          })) || [],
        images:
          product.images?.map((img) => ({
            id: img.id.toString(),
            src: img.src,
            alt: img.alt,
          })) || [],
      }))

      return {
        products,
        pagination: {
          page,
          limit,
          hasNext,
          total: page * limit + (hasNext ? limit : 0), // Estimate total
          nextSinceId,
          nextPageInfo,
        },
      }
    } catch (error) {
      console.error("Error fetching Shopify products:", error)
      throw error
    }
  }

  // Fetch all orders from Shopify with pagination support
  async getOrders(filters?: { name?: string; status?: string; limit?: number; maxTotal?: number; dateRange?: { start: string; end: string } }): Promise<any[]> {
    try {
      const allOrders: any[] = []
      let pageInfo: string | undefined = undefined
      const limit = filters?.limit || 250 // Use maximum limit for efficiency
      const maxTotal = filters?.maxTotal || Infinity // Maximum total orders to fetch
      
      console.log(`[SHOPIFY-ORDERS] Starting paginated fetch with limit: ${limit}, maxTotal: ${maxTotal === Infinity ? 'unlimited' : maxTotal}`)
      
      do {
        const params = new URLSearchParams()
        
        // Add pagination parameters
        params.append("limit", limit.toString())
        if (pageInfo) {
          // CRITICAL FIX: When using page_info, we cannot include status or name filters
          params.append("page_info", pageInfo)
        } else {
          // Only add filters on the first page (when no page_info)
          if (filters?.status) {
            params.append("status", filters.status)
          }
          // Remove default "status=any" to avoid pagination conflicts
          
          // Add name filter if provided (for order lookup)
          if (filters?.name) {
            params.append("name", filters.name)
          }
          
          // Add date range filtering if provided
          if (filters?.dateRange) {
            params.append("created_at_min", filters.dateRange.start)
            params.append("created_at_max", filters.dateRange.end)
            console.log(`[SHOPIFY-ORDERS] Filtering by date range: ${filters.dateRange.start} to ${filters.dateRange.end}`)
          }
          
          // CRITICAL: Sort by created_at descending to get latest orders first
          params.append("order", "created_at desc")
        }
        
        const url = `${this.getBaseUrl()}/orders.json?${params.toString()}`
        console.log(`[SHOPIFY-ORDERS] Fetching page: ${url}`)
        
        const response = await fetch(url, {
          method: "GET",
          headers: this.getHeaders(),
        })

        // Handle rate limiting with retry logic
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After") || "1"
          const waitTime = parseInt(retryAfter) * 1000
          console.log(`[SHOPIFY-ORDERS] Rate limited. Waiting ${waitTime}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue // Retry the same request
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(
            `Shopify API error: ${response.status} ${response.statusText} - ${errorText}`
          )
        }

        const data = await response.json()
        const orders = data.orders || []
        
        // Check if adding all orders would exceed maxTotal
        if (allOrders.length + orders.length > maxTotal) {
          const remainingSlots = maxTotal - allOrders.length
          allOrders.push(...orders.slice(0, remainingSlots))
          console.log(`[SHOPIFY-ORDERS] Page fetched: ${remainingSlots} orders (limited), Final total: ${allOrders.length}`)
          break // Stop fetching as we've reached the limit
        } else {
          allOrders.push(...orders)
          console.log(`[SHOPIFY-ORDERS] Page fetched: ${orders.length} orders, Total so far: ${allOrders.length}`)
        }
        
        // Check for next page using Link header
        const linkHeader = response.headers.get("Link")
        pageInfo = undefined
        
        if (linkHeader) {
          // Parse Link header to find next page
          const links = linkHeader.split(",").map((link) => {
            const [url, rel] = link.split(";").map((s) => s.trim())
            const relMatch = rel.match(/rel="([^"]+)"/)
            return {
              url: url.replace(/[<>]/g, ""),
              rel: relMatch ? relMatch[1] : "",
            }
          })

          const nextLink = links.find((link) => link.rel === "next")
          if (nextLink) {
            // Extract page_info from next URL
            const nextUrl = new URL(nextLink.url)
            const pageInfoParam = nextUrl.searchParams.get("page_info")
            if (pageInfoParam) {
              pageInfo = pageInfoParam
              console.log(`[SHOPIFY-ORDERS] Found next page_info:`, pageInfo.substring(0, 20) + "...")
            }
          }
        }
        
                 // Break if we got less than the limit (last page) or no more page_info
         if (orders.length < limit || !pageInfo) {
           console.log(`[SHOPIFY-ORDERS] Reached last page. Final count: ${allOrders.length} orders`)
           break
         }
         
         // Add small delay between requests to be respectful of API limits
         if (pageInfo) {
           console.log(`[SHOPIFY-ORDERS] Waiting 500ms before next page...`)
           await new Promise(resolve => setTimeout(resolve, 500))
         }
         
       } while (pageInfo)
      
      console.log(`[SHOPIFY-ORDERS] Pagination complete. Total orders fetched: ${allOrders.length}`)
      return allOrders
      
    } catch (error) {
      console.error("Error fetching Shopify orders:", error)
      throw error
    }
  }

  // Fetch a single product by Shopify ID
  async fetchProduct(shopifyId: string): Promise<Product | null> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}.json`
      const response = await fetch(url, {
        method: "GET",
        headers: this.getHeaders(),
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
      }

      const data: ShopifyProductResponse = await response.json()
      return this.mapShopifyProductToLocal(data.product)
    } catch (error) {
      console.error("Error fetching product from Shopify:", error)
      throw error
    }
  }

  // Update product metafields for florist-specific data
  async updateProductMetafields(
    shopifyId: string,
    metafields: Array<{ namespace: string; key: string; value: string; type: string }>
  ): Promise<void> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}/metafields.json`

      for (const metafield of metafields) {
        const response = await fetch(url, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify({ metafield }),
        })

        if (!response.ok) {
          throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
        }
      }
    } catch (error) {
      console.error("Error updating product metafields:", error)
      throw error
    }
  }

  // Update product tags
  async updateProductTags(shopifyId: string, tags: string[]): Promise<void> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}.json`
      const response = await fetch(url, {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify({
          product: {
            id: shopifyId,
            tags: tags.join(", "),
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error("Error updating product tags:", error)
      throw error
    }
  }

  // Map Shopify product response to local Product interface
  private mapShopifyProductToLocal(shopifyProduct: ShopifyProductResponse["product"]): Product {
    // Extract florist-specific metadata from metafields
    const floristMetadata = this.extractFloristMetadata(shopifyProduct.metafields || [])

    // Extract difficulty and product type from tags or metafields
    const tags = shopifyProduct.tags ? shopifyProduct.tags.split(",").map((tag) => tag.trim()) : []
    const difficultyLabel = this.extractDifficultyFromTags(tags) || "Medium"
    const productTypeLabel = this.extractProductTypeFromTags(tags) || "Bouquet"

    return {
      id: `shopify-${shopifyProduct.id}`,
      tenantId: this.store.tenantId,
      shopifyId: shopifyProduct.id.toString(),
      name: shopifyProduct.title,
      variant: shopifyProduct.variants?.[0]?.title || "",
      difficultyLabel,
      productTypeLabel,
      storeId: "", // Will be set by the calling function
      handle: shopifyProduct.handle,
      description: shopifyProduct.body_html,
      productType: shopifyProduct.product_type,
      vendor: shopifyProduct.vendor,
      tags,
      status: shopifyProduct.status as "active" | "archived" | "draft",
      publishedAt: shopifyProduct.published_at,
      createdAt: shopifyProduct.created_at,
      updatedAt: shopifyProduct.updated_at,
      variants: shopifyProduct.variants?.map((v) => this.mapShopifyVariantToLocal(v)) || [],
      images: shopifyProduct.images?.map((img) => this.mapShopifyImageToLocal(img)) || [],
      metafields: shopifyProduct.metafields?.map((m) => this.mapShopifyMetafieldToLocal(m)) || [],
      floristMetadata,
    }
  }

  // Map Shopify variant response to local ProductVariant interface
  private mapShopifyVariantToLocal(shopifyVariant: ShopifyVariantResponse): ProductVariant {
    return {
      id: `shopify-variant-${shopifyVariant.id}`,
      shopifyId: shopifyVariant.id.toString(),
      title: shopifyVariant.title,
      sku: shopifyVariant.sku,
      price: shopifyVariant.price,
      compareAtPrice: shopifyVariant.compare_at_price,
      inventoryQuantity: shopifyVariant.inventory_quantity,
      weight: shopifyVariant.weight,
      weightUnit: shopifyVariant.weight_unit,
      requiresShipping: shopifyVariant.requires_shipping,
      taxable: shopifyVariant.taxable,
      barcode: shopifyVariant.barcode,
      position: shopifyVariant.position,
      createdAt: shopifyVariant.created_at,
      updatedAt: shopifyVariant.updated_at,
    }
  }

  // Map Shopify image response to local ProductImage interface
  private mapShopifyImageToLocal(shopifyImage: ShopifyImageResponse): ProductImage {
    return {
      id: `shopify-image-${shopifyImage.id}`,
      shopifyId: shopifyImage.id.toString(),
      src: shopifyImage.src,
      alt: shopifyImage.alt,
      width: shopifyImage.width,
      height: shopifyImage.height,
      position: shopifyImage.position,
      createdAt: shopifyImage.created_at,
      updatedAt: shopifyImage.updated_at,
    }
  }

  // Map Shopify metafield response to local ProductMetafield interface
  private mapShopifyMetafieldToLocal(shopifyMetafield: ShopifyMetafieldResponse): ProductMetafield {
    return {
      id: `shopify-metafield-${shopifyMetafield.id}`,
      shopifyId: shopifyMetafield.id.toString(),
      namespace: shopifyMetafield.namespace,
      key: shopifyMetafield.key,
      value: shopifyMetafield.value,
      type: shopifyMetafield.type,
      description: shopifyMetafield.description,
      createdAt: shopifyMetafield.created_at,
      updatedAt: shopifyMetafield.updated_at,
    }
  }

  // Extract florist-specific metadata from metafields
  private extractFloristMetadata(
    metafields: ShopifyMetafieldResponse[]
  ): Product["floristMetadata"] {
    const metadata: Product["floristMetadata"] = {}

    for (const metafield of metafields) {
      if (metafield.namespace === "florist") {
        switch (metafield.key) {
          case "difficulty_level":
            metadata.difficultyLevel = metafield.value
            break
          case "estimated_time":
            metadata.estimatedTime = parseInt(metafield.value) || 0
            break
          case "special_instructions":
            metadata.specialInstructions = metafield.value
            break
          case "seasonal_availability":
            metadata.seasonalAvailability = metafield.value.split(",").map((s) => s.trim())
            break
          case "materials":
            metadata.materials = metafield.value.split(",").map((s) => s.trim())
            break
        }
      }
    }

    return metadata
  }

  // Extract difficulty from tags
  private extractDifficultyFromTags(tags: string[]): string | null {
    const difficultyTags = tags.filter((tag) =>
      ["easy", "medium", "hard", "very hard"].includes(tag.toLowerCase())
    )
    return difficultyTags.length > 0 ? difficultyTags[0] : null
  }

  // Extract product type from tags
  private extractProductTypeFromTags(tags: string[]): string | null {
    const productTypeTags = tags.filter((tag) =>
      ["bouquet", "vase", "arrangement", "wreath", "bundle"].includes(tag.toLowerCase())
    )
    return productTypeTags.length > 0 ? productTypeTags[0] : null
  }

  // Fetch a single order by Shopify ID using GraphQL
  async fetchOrderByIdGraphQL(orderGid: string): Promise<any> {
    const url = `https://${this.config.storeDomain}/admin/api/2023-10/graphql.json`;
    const query = `
      query getOrder($id: ID!) {
        order(id: $id) {
          id
          name
          createdAt
          displayFulfillmentStatus
          displayFinancialStatus
          tags
          note
          email
          phone
          customer {
            firstName
            lastName
            email
          }
          shippingAddress {
            firstName
            lastName
            name
            address1
            address2
            city
            province
            country
            zip
            phone
          }
          customAttributes {
            key
            value
          }
          lineItems(first: 50) {
            edges {
              node {
                title
                quantity
                variant {
                  id
                  title
                  sku
                }
                product {
                  id
                  productType
                }
              }
            }
          }
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalTaxSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          currencyCode
        }
      }
    `;
    const variables = { id: orderGid };
    const response = await fetch(url, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Shopify GraphQL error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    if (data.errors) {
      throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
    }
    return data.data.order;
  }
}

// Utility function to create Shopify API service for a store
export function createShopifyApiService(store: Store, accessToken: string): ShopifyApiService {
  return new ShopifyApiService(store, accessToken)
}

// Utility function to sync products from Shopify to local storage
export async function syncProductsFromShopify(
  store: Store,
  accessToken: string
): Promise<Product[]> {
  const apiService = createShopifyApiService(store, accessToken)
  const products = await apiService.fetchProducts()

  // Add store ID to each product
  const productsWithStoreId = products.products.map((product) => ({
    ...product,
    storeId: store.id,
  }))

  return productsWithStoreId
}
