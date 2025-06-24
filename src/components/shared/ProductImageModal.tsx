import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { Badge } from "../ui/badge"
import { Label } from "../ui/label"
import { Loader2, Save, X, RefreshCw } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { getStoredToken } from "../../services/auth"
import { syncShopifyProduct } from "../../services/api"
import { Package } from "lucide-react"

interface ProductImageModalProps {
  isOpen: boolean
  onClose: () => void
  shopifyProductId?: string
  shopifyVariantId?: string
  tenantId?: string
  notes?: string
  onNotesChange?: (notes: string) => void
  onSave?: (notes: string) => Promise<void>
  onSyncProduct?: (shopifyProductId: string) => Promise<void>
}

interface ProductImageData {
  imageUrl?: string
  imageAlt?: string
  title?: string
  variantTitle?: string
  description?: string
  price?: number
  tags?: string[]
  productType?: string
  vendor?: string
}

export const ProductImageModal: React.FC<ProductImageModalProps> = ({
  isOpen,
  onClose,
  shopifyProductId,
  shopifyVariantId,
  tenantId,
  notes = "",
  onNotesChange,
  onSave,
  onSyncProduct,
}) => {
  const { user } = useAuth()
  const [productData, setProductData] = useState<ProductImageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localNotes, setLocalNotes] = useState(notes)
  const [error, setError] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    console.log('ProductImageModal useEffect triggered', { isOpen, shopifyProductId, shopifyVariantId, tenantId });
    if (isOpen && shopifyProductId) {
      fetchProductImage();
    }
  }, [isOpen, shopifyProductId, shopifyVariantId, tenantId]);

  const fetchProductImage = async () => {
    const resolvedTenantId = tenantId || user?.tenantId;
    if (!resolvedTenantId || !shopifyProductId) return

    setLoading(true)
    setError(null)

    try {
      // Use the correct endpoint that returns complete saved product data
      const url = `/api/tenants/${resolvedTenantId}/saved-products/by-shopify-id?shopify_product_id=${encodeURIComponent(shopifyProductId)}&shopify_variant_id=${encodeURIComponent(shopifyVariantId || '')}`

      const token = getStoredToken()
      if (!token) {
        setError("Authentication token not found.")
        setLoading(false)
        return
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError("Product image not found. This product may not be saved in your product library.")
        } else {
          throw new Error(`Failed to fetch product image: ${response.status}`)
        }
        return
      }

      const product = await response.json()
      
      // Map the saved product data to the expected ProductImageData format
      console.log('Product fetched for modal:', product);
      const imageUrl = product?.imageUrl || product?.image_url;
      const imageAlt = product?.imageAlt || product?.image_alt || 'Product image';

      if (!product) {
        console.warn('No product found for modal!');
      }
      if (!imageUrl) {
        console.warn('No imageUrl/image_url found for product:', product);
      }

      setProductData({
        imageUrl: imageUrl,
        imageAlt: imageAlt,
        title: product.title,
        variantTitle: product.variantTitle,
        description: product.description,
        price: product.price,
        tags: product.tags,
        productType: product.productType,
        vendor: product.vendor,
      })
    } catch (err) {
      console.error("Error fetching product image:", err)
      setError("Failed to load product image. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!onSave) return

    setSaving(true)
    try {
      await onSave(localNotes)
      onClose()
    } catch (err) {
      console.error("Error saving notes:", err)
      setError("Failed to save notes. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleNotesChange = (value: string) => {
    setLocalNotes(value)
    onNotesChange?.(value)
  }

  const formatPrice = (price?: number) => {
    if (!price) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price)
  }

  const handleSyncProduct = async () => {
    if (!onSyncProduct || !shopifyProductId) return
    setIsSyncing(true)
    setError(null)
    try {
      await onSyncProduct(shopifyProductId)
      // After syncing, try fetching the image again
      await fetchProductImage()
    } catch (err) {
      console.error("Error syncing product:", err)
      setError("Failed to sync product from Shopify. Please try again.")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Product Details</span>
          </DialogTitle>
          <DialogDescription>
            View product image and add custom notes for this order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading product image...</span>
            </div>
          )}

          {/* Error State with Sync Button */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-800 text-sm font-semibold">{error}</p>
              {error.includes("not found") && shopifyProductId && onSyncProduct && (
                <div className="mt-4">
                  <p className="text-xs text-gray-600 mb-2">
                    This product might be missing from your library.
                  </p>
                  <Button
                    onClick={handleSyncProduct}
                    disabled={isSyncing}
                    size="sm"
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Sync from Shopify
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Product Image */}
          {productData?.imageUrl && (
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-lg border">
                <img
                  src={productData.imageUrl}
                  alt={productData.imageAlt || productData.title || "Product image"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = "none"
                    setError("Failed to load product image")
                  }}
                />
              </div>

              {/* Product Details */}
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{productData.title}</h3>
                  {productData.variantTitle && (
                    <p className="text-sm text-muted-foreground">{productData.variantTitle}</p>
                  )}
                </div>

                {productData.description && (
                  <p 
                    className="text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: productData.description }} 
                  />
                )}

                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{formatPrice(productData.price)}</span>
                  {productData.productType && (
                    <Badge variant="secondary">{productData.productType}</Badge>
                  )}
                  {productData.vendor && (
                    <span className="text-muted-foreground">by {productData.vendor}</span>
                  )}
                </div>

                {productData.tags && productData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {productData.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* No Image Found State with Sync Button */}
          {!loading && !error && !productData?.imageUrl && (
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-2">
                <Package className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-semibold">No product image available</p>
              <p className="text-sm text-gray-500 mt-1">
                This product may not be in your saved product library.
              </p>
              {shopifyProductId && onSyncProduct && (
                 <div className="mt-4">
                   <Button
                     onClick={handleSyncProduct}
                     disabled={isSyncing}
                     size="sm"
                   >
                     {isSyncing ? (
                       <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     ) : (
                       <RefreshCw className="h-4 w-4 mr-2" />
                     )}
                     Sync from Shopify
                   </Button>
                 </div>
               )}
            </div>
          )}

          {/* Notes Section */}
          <div className="space-y-3">
            <Label htmlFor="order-notes">Order Notes</Label>
            <Textarea
              id="order-notes"
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add custom notes for this order..."
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              These notes will be saved with the order and visible to all team members
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            {onSave && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Notes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 