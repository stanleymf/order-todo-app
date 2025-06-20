import type { Product, ProductVariant, ProductImage, ProductMetafield, Store } from '../types';

// Shopify API configuration
interface ShopifyConfig {
  storeDomain: string;
  accessToken: string;
  apiVersion: string;
}

// Shopify API response types
interface ShopifyProductResponse {
  product: {
    id: number;
    title: string;
    handle: string;
    body_html: string;
    product_type: string;
    vendor: string;
    tags: string;
    status: string;
    published_at: string;
    created_at: string;
    updated_at: string;
    variants: ShopifyVariantResponse[];
    images: ShopifyImageResponse[];
    metafields: ShopifyMetafieldResponse[];
  };
}

interface ShopifyVariantResponse {
  id: number;
  title: string;
  sku: string;
  price: string;
  compare_at_price: string;
  inventory_quantity: number;
  weight: number;
  weight_unit: string;
  requires_shipping: boolean;
  taxable: boolean;
  barcode: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ShopifyImageResponse {
  id: number;
  src: string;
  alt: string;
  width: number;
  height: number;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ShopifyMetafieldResponse {
  id: number;
  namespace: string;
  key: string;
  value: string;
  type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyProductsResponse {
  products: ShopifyProductResponse['product'][];
}

// Shopify API service class
export class ShopifyApiService {
  private config: ShopifyConfig;

  constructor(store: Store, accessToken: string) {
    this.config = {
      storeDomain: store.domain,
      accessToken,
      apiVersion: '2024-01' // Latest stable version
    };
  }

  private getBaseUrl(): string {
    return `https://${this.config.storeDomain}/admin/api/${this.config.apiVersion}`;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': this.config.accessToken,
    };
  }

  // Fetch all products from Shopify
  async fetchProducts(limit: number = 250): Promise<Product[]> {
    try {
      const url = `${this.getBaseUrl()}/products.json?limit=${limit}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data: ShopifyProductsResponse = await response.json();
      return data.products.map(this.mapShopifyProductToLocal);
    } catch (error) {
      console.error('Error fetching products from Shopify:', error);
      throw error;
    }
  }

  // Fetch a single product by Shopify ID
  async fetchProduct(shopifyId: string): Promise<Product | null> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}.json`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }

      const data: ShopifyProductResponse = await response.json();
      return this.mapShopifyProductToLocal(data.product);
    } catch (error) {
      console.error('Error fetching product from Shopify:', error);
      throw error;
    }
  }

  // Update product metafields for florist-specific data
  async updateProductMetafields(
    shopifyId: string, 
    metafields: Array<{ namespace: string; key: string; value: string; type: string }>
  ): Promise<void> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}/metafields.json`;
      
      for (const metafield of metafields) {
        const response = await fetch(url, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ metafield }),
        });

        if (!response.ok) {
          throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error updating product metafields:', error);
      throw error;
    }
  }

  // Update product tags
  async updateProductTags(shopifyId: string, tags: string[]): Promise<void> {
    try {
      const url = `${this.getBaseUrl()}/products/${shopifyId}.json`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          product: {
            id: shopifyId,
            tags: tags.join(', ')
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating product tags:', error);
      throw error;
    }
  }

  // Map Shopify product response to local Product interface
  private mapShopifyProductToLocal(shopifyProduct: ShopifyProductResponse['product']): Product {
    // Extract florist-specific metadata from metafields
    const floristMetadata = this.extractFloristMetadata(shopifyProduct.metafields);
    
    // Extract difficulty and product type from tags or metafields
    const tags = shopifyProduct.tags ? shopifyProduct.tags.split(',').map(tag => tag.trim()) : [];
    const difficultyLabel = this.extractDifficultyFromTags(tags) || 'Medium';
    const productTypeLabel = this.extractProductTypeFromTags(tags) || 'Bouquet';

    return {
      id: `shopify-${shopifyProduct.id}`,
      shopifyId: shopifyProduct.id.toString(),
      name: shopifyProduct.title,
      variant: shopifyProduct.variants?.[0]?.title || '',
      difficultyLabel,
      productTypeLabel,
      storeId: '', // Will be set by the calling function
      handle: shopifyProduct.handle,
      description: shopifyProduct.body_html,
      productType: shopifyProduct.product_type,
      vendor: shopifyProduct.vendor,
      tags,
      status: shopifyProduct.status as 'active' | 'archived' | 'draft',
      publishedAt: shopifyProduct.published_at,
      createdAt: shopifyProduct.created_at,
      updatedAt: shopifyProduct.updated_at,
      variants: shopifyProduct.variants?.map(this.mapShopifyVariantToLocal),
      images: shopifyProduct.images?.map(this.mapShopifyImageToLocal),
      metafields: shopifyProduct.metafields?.map(this.mapShopifyMetafieldToLocal),
      floristMetadata,
    };
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
    };
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
    };
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
    };
  }

  // Extract florist-specific metadata from metafields
  private extractFloristMetadata(metafields: ShopifyMetafieldResponse[]): Product['floristMetadata'] {
    const metadata: Product['floristMetadata'] = {};

    for (const metafield of metafields) {
      if (metafield.namespace === 'florist') {
        switch (metafield.key) {
          case 'difficulty_level':
            metadata.difficultyLevel = metafield.value;
            break;
          case 'estimated_time':
            metadata.estimatedTime = parseInt(metafield.value) || 0;
            break;
          case 'special_instructions':
            metadata.specialInstructions = metafield.value;
            break;
          case 'seasonal_availability':
            metadata.seasonalAvailability = metafield.value.split(',').map(s => s.trim());
            break;
          case 'materials':
            metadata.materials = metafield.value.split(',').map(s => s.trim());
            break;
        }
      }
    }

    return metadata;
  }

  // Extract difficulty from tags
  private extractDifficultyFromTags(tags: string[]): string | null {
    const difficultyTags = tags.filter(tag => 
      ['easy', 'medium', 'hard', 'very hard'].includes(tag.toLowerCase())
    );
    return difficultyTags.length > 0 ? difficultyTags[0] : null;
  }

  // Extract product type from tags
  private extractProductTypeFromTags(tags: string[]): string | null {
    const productTypeTags = tags.filter(tag => 
      ['bouquet', 'vase', 'arrangement', 'wreath', 'bundle'].includes(tag.toLowerCase())
    );
    return productTypeTags.length > 0 ? productTypeTags[0] : null;
  }
}

// Utility function to create Shopify API service for a store
export function createShopifyApiService(store: Store, accessToken: string): ShopifyApiService {
  return new ShopifyApiService(store, accessToken);
}

// Utility function to sync products from Shopify to local storage
export async function syncProductsFromShopify(
  store: Store, 
  accessToken: string
): Promise<Product[]> {
  const apiService = createShopifyApiService(store, accessToken);
  const products = await apiService.fetchProducts();
  
  // Add store ID to each product
  const productsWithStoreId = products.map(product => ({
    ...product,
    storeId: store.id
  }));

  return productsWithStoreId;
} 