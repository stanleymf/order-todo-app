import React, { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog"
import { Label } from "./ui/label"
import {
  Trash2,
  Plus,
  Tag,
  Search,
  X,
  ExternalLink,
  Package,
  RefreshCw,
  Loader2,
  Download,
  Save,
  Eye,
  Edit,
  FilterX,
} from "lucide-react"
import { useMobileView } from "./Dashboard"
import { useAuth } from "../contexts/AuthContext"
import {
  getProducts,
  getProductLabels,
  getStores,
  createProductLabel,
  deleteProductLabel,
  updateProduct,
  syncProducts,
  getSavedProducts,
  saveProducts,
  deleteSavedProduct,
  addProductLabel,
  updateProductLabel,
  syncShopifyProduct,
  removeProductLabel,
} from "../services/api"
import type { ProductLabel, Store, Product, SavedProduct } from "../types"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Checkbox } from "./ui/checkbox"

// Custom hook for drag-to-select functionality
const useDragToSelect = (
  products: any[], 
  selectedItems: Set<string>, 
  onToggleSelect: (id: string) => void
) => {
  const [isDragging, setIsDragging] = useState(false)
  const [draggedItems, setDraggedItems] = useState<Set<string>>(new Set())
  const dragStartRef = useRef<string | null>(null)
  const tableRef = useRef<HTMLTableElement>(null)

  // Reset drag state when products change
  useEffect(() => {
    setIsDragging(false)
    setDraggedItems(new Set())
    dragStartRef.current = null
  }, [products])

  const handleMouseDown = useCallback((productId: string) => {
    setIsDragging(true)
    dragStartRef.current = productId
    setDraggedItems(new Set([productId]))
  }, [])

  const handleMouseEnter = useCallback((productId: string) => {
    if (isDragging && dragStartRef.current) {
      setDraggedItems(prev => new Set([...prev, productId]))
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    if (isDragging && draggedItems.size > 0) {
      // Apply selections
      draggedItems.forEach(id => {
        if (!selectedItems.has(id)) {
          onToggleSelect(id)
        }
      })
    }
    setIsDragging(false)
    setDraggedItems(new Set())
    dragStartRef.current = null
  }, [isDragging, draggedItems, selectedItems, onToggleSelect])

  // Global mouse up listener to handle drag end even outside the table
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp()
      }
    }

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, handleMouseUp])

  const getRowProps = useCallback((productId: string) => {
    const isBeingDragged = draggedItems.has(productId)
    return {
      onMouseDown: () => handleMouseDown(productId),
      onMouseEnter: () => handleMouseEnter(productId),
      className: isBeingDragged 
        ? 'bg-blue-50 cursor-pointer select-none border-blue-200 transition-colors' 
        : 'cursor-pointer select-none hover:bg-gray-50 transition-colors',
      style: { 
        userSelect: 'none' as const,
        WebkitUserSelect: 'none' as const,
        MozUserSelect: 'none' as const,
        msUserSelect: 'none' as const
      }
    }
  }, [draggedItems, handleMouseDown, handleMouseEnter])

  return {
    tableRef,
    getRowProps,
    isDragging,
    draggedItems
  }
}

export function ProductManagement() {
  const { tenant, isAuthenticated, loading: authLoading } = useAuth()
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([])
  const [fetchedProducts, setFetchedProducts] = useState<any[]>([])
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedSavedProducts, setSelectedSavedProducts] = useState<Set<string>>(new Set())
  const [selectedDifficultyLabel, setSelectedDifficultyLabel] = useState<string>("")
  const [selectedProductTypeLabel, setSelectedProductTypeLabel] = useState<string>("")
  const [labels, setLabels] = useState<ProductLabel[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [isAddingLabel, setIsAddingLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState("")
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6")
  const [newLabelCategory, setNewLabelCategory] = useState<"difficulty" | "productType">(
    "difficulty"
  )
  const [newLabelPriority, setNewLabelPriority] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [savedProductSearch, setSavedProductSearch] = useState("")
  const [isFetchingProducts, setIsFetchingProducts] = useState(false)
  const [isFetchingNotSavedProducts, setIsFetchingNotSavedProducts] = useState(false)
  const [syncStoreId, setSyncStoreId] = useState("")
  const [syncTitleFilter, setSyncTitleFilter] = useState("")
  const [syncTagFilter, setSyncTagFilter] = useState("")
  const [syncExcludeTags, setSyncExcludeTags] = useState("")
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isSavingProducts, setIsSavingProducts] = useState(false)

  // New state for saved/not saved filter
  const [savedFilter, setSavedFilter] = useState<"all" | "saved" | "not-saved">("all")

  // New state for labelled/not-labelled filter
  const [labelledFilter, setLabelledFilter] = useState<"all" | "labelled" | "not-labelled">("all")

  // New state for store filtering in saved products
  const [savedProductStoreFilter, setSavedProductStoreFilter] = useState<string>("all")

  // State for shift+click selection
  const [lastSelectedProductId, setLastSelectedProductId] = useState<string | null>(null)

  // Get mobile view context
  const { isMobileView } = useMobileView()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)

  // Search state for All Products
  const [allProductsSearch, setAllProductsSearch] = useState("")

  // Pagination state for Saved Products
  const [savedProductsPage, setSavedProductsPage] = useState(1)
  const [savedProductsPerPage] = useState(100)

  const [nextPageInfo, setNextPageInfo] = useState<string | undefined>(undefined)

  // Edit label state
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editingLabel, setEditingLabel] = useState<ProductLabel | null>(null)
  const [editLabelName, setEditLabelName] = useState("")
  const [editLabelColor, setEditLabelColor] = useState("#3b82f6")
  const [editLabelCategory, setEditLabelCategory] = useState<"difficulty" | "productType" | "custom">("difficulty")
  const [editLabelPriority, setEditLabelPriority] = useState(1)

  // New state for removing labels
  const [isRemovingLabels, setIsRemovingLabels] = useState(false)

  // Helper to fetch latest product data from Shopify by productId
  async function fetchShopifyProductById(shopifyProductId: string) {
    if (!tenant?.id || !syncStoreId) return null
    try {
      const result = await syncShopifyProduct(tenant.id, syncStoreId, shopifyProductId)
      // The API returns { success: true, ...productData }, so extract the product
      if (result && result.success && result.product) {
        return result.product
      }
      // Fallback: if the API just returns the product
      if (result && result.title) {
        return result
      }
      return null
    } catch (err) {
      console.error('Failed to fetch product from Shopify:', err)
      return null
    }
  }

  // Guard: Don't render until auth and tenant context is ready
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated || !tenant?.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
        <p className="text-gray-600">Please log in to view products.</p>
      </div>
    )
  }

  // Load data when component mounts and tenant is available
  useEffect(() => {
    if (tenant?.id) {
      loadData()
    }
  }, [tenant?.id])

  const loadData = async () => {
    if (!tenant?.id) {
      console.warn('Tenant context not ready, skipping data load')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      console.log('Loading data for tenant:', tenant.id)
      const [labelsData, storesData, savedProductsData] = await Promise.all([
        getProductLabels(tenant.id),
        getStores(tenant.id),
        getSavedProducts(tenant.id),
      ])
      setLabels(labelsData)
      setStores(storesData)
      setSavedProducts(savedProductsData)

      // Set default store for sync dialog if not already set
      if (storesData.length > 0 && !syncStoreId) {
        setSyncStoreId(storesData[0].id)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLabel = async () => {
    if (!tenant?.id || !newLabelName.trim()) return

    try {
      await createProductLabel(tenant.id, {
        name: newLabelName.trim(),
        color: newLabelColor,
        category: newLabelCategory,
        priority: newLabelPriority,
      })

      setNewLabelName("")
      setNewLabelColor("#3b82f6")
      setNewLabelCategory("difficulty")
      setNewLabelPriority(1)
      setIsAddingLabel(false)
      loadData() // Reload data
    } catch (err) {
      console.error("Error creating label:", err)
      setError("Failed to create label. Please try again.")
    }
  }

  const handleFetchProducts = async (page: number = 1, sinceId?: number, pageInfo?: string) => {
    if (!tenant?.id || !syncStoreId) {
      toast.error("Please select a store to fetch from.")
      return
    }
    try {
      setIsFetchingProducts(true)
      toast.info(`Fetching products from Shopify (page ${page})...`)

      const response = await syncProducts(tenant.id, syncStoreId, {
        title: syncTitleFilter,
        tag: syncTagFilter,
        page,
        limit: 250,
        sinceId,
        pageInfo,
      })

      if (response.success && response.products) {
        console.log("Fetch response:", response)
        console.log("Pagination from response:", response.pagination)
        if (page === 1) {
          setFetchedProducts(response.products)
          setPagination(response.pagination)
          setCurrentPage(1)
        } else {
          setFetchedProducts((prev) => [...prev, ...response.products])
          setPagination(response.pagination)
          setCurrentPage(page)
        }
        setNextPageInfo(response.pagination?.nextPageInfo)
        toast.success(`Successfully fetched ${response.products.length} products from Shopify!`)
      } else {
        toast.error("No products returned from Shopify")
      }
    } catch (err) {
      console.error("Error fetching products:", err)
      toast.error("Failed to fetch products. Please try again.")
    } finally {
      setIsFetchingProducts(false)
    }
  }

  const handleFetchNotSavedProducts = async (page: number = 1, sinceId?: number, pageInfo?: string) => {
    if (!tenant?.id || !syncStoreId) {
      toast.error("Please select a store to fetch from.")
      return
    }
    try {
      setIsFetchingNotSavedProducts(true)
      toast.info(`Fetching not-saved products from Shopify (page ${page})...`)

      // Step 1: Fetch all products from Shopify
      const response = await syncProducts(tenant.id, syncStoreId, {
        title: syncTitleFilter,
        tag: syncTagFilter,
        page,
        limit: 250,
        sinceId,
        pageInfo,
      })

      if (!response.success || !response.products) {
        toast.error("No products returned from Shopify")
        return
      }

      // Step 2: Get current saved products from D1 (for this store only)
      const allSavedProducts = await getSavedProducts(tenant.id)
      const currentSavedProducts = allSavedProducts.filter(p => p.storeId === syncStoreId)

      // Step 3: Create set of saved product+variant combinations for fast lookup
      const savedCombinations = new Set(
        currentSavedProducts.map(p => `${p.shopifyProductId}-${p.shopifyVariantId}`)
      )

      // Step 4: Filter products to show only those with unsaved variants
      const notSavedProducts = response.products.map((product: any) => {
        // Filter variants to only include those not yet saved
        const notSavedVariants = (product.variants || []).filter((variant: any) => {
          const combination = `${product.shopifyId}-${variant.id}`
          return !savedCombinations.has(combination)
        })

        // Return product with only unsaved variants, or null if all variants are saved
        return notSavedVariants.length > 0 ? {
          ...product,
          variants: notSavedVariants,
          originalVariantCount: product.variants?.length || 0,
          unsavedVariantCount: notSavedVariants.length
        } : null
      }).filter(Boolean) // Remove null entries (products with all variants already saved)

      console.log("Fetch not-saved response:", {
        totalFromShopify: response.products.length,
        totalSaved: currentSavedProducts.length,
        notSavedProducts: notSavedProducts.length
      })

      if (page === 1) {
        setFetchedProducts(notSavedProducts)
        setPagination(response.pagination)
        setCurrentPage(1)
      } else {
        setFetchedProducts((prev) => [...prev, ...notSavedProducts])
        setPagination(response.pagination)
        setCurrentPage(page)
      }
      setNextPageInfo(response.pagination?.nextPageInfo)

      const totalNewVariants = notSavedProducts.reduce((sum: number, product: any) => 
        sum + (product.unsavedVariantCount || 0), 0
      )

      if (notSavedProducts.length > 0) {
        toast.success(
          `Found ${notSavedProducts.length} products with ${totalNewVariants} unsaved variants!`,
          {
            duration: 4000,
            description: `These products have variants that aren't saved yet. Products with all variants saved are hidden.`
          }
        )
      } else {
        toast.info(
          `All products from this page are already fully saved!`,
          {
            duration: 4000,
            description: `No new variants found. Try fetching more pages or adjusting filters.`
          }
        )
      }
    } catch (err) {
      console.error("Error fetching not-saved products:", err)
      toast.error("Failed to fetch not-saved products. Please try again.")
    } finally {
      setIsFetchingNotSavedProducts(false)
    }
  }

  const handleLoadMoreProducts = () => {
    console.log("Load More clicked. Pagination state:", pagination)
    console.log("hasNext:", pagination?.hasNext)
    console.log("nextPageInfo:", nextPageInfo)
    if (pagination?.hasNext && nextPageInfo) {
      console.log("Loading more products with pageInfo:", nextPageInfo)
      handleFetchProducts(currentPage + 1, undefined, nextPageInfo)
    } else if (pagination?.hasNext && pagination.nextSinceId) {
      // fallback for sinceId
      console.log("Loading more products with sinceId:", pagination.nextSinceId)
      handleFetchProducts(currentPage + 1, pagination.nextSinceId)
    } else {
      console.log("Cannot load more - missing hasNext or nextPageInfo/sinceId")
    }
  }

  const handleDeleteLabel = async (labelId: string) => {
    if (!tenant?.id) return

    if (!confirm("Are you sure you want to delete this label? This action cannot be undone.")) {
      return
    }

    try {
      await deleteProductLabel(tenant.id, labelId)
      loadData() // Reload data
    } catch (err) {
      console.error("Error deleting label:", err)
      setError("Failed to delete label. Please try again.")
    }
  }

  const handleEditLabel = (label: ProductLabel) => {
    setEditingLabel(label)
    setEditLabelName(label.name)
    setEditLabelColor(label.color)
    setEditLabelCategory(label.category)
    setEditLabelPriority(label.priority)
    setIsEditingLabel(true)
  }

  const handleSaveEditLabel = async () => {
    if (!tenant?.id || !editingLabel || !editLabelName.trim()) return

    try {
      await updateProductLabel(tenant.id, editingLabel.id, {
        name: editLabelName.trim(),
        color: editLabelColor,
        category: editLabelCategory,
        priority: editLabelPriority,
      })

      // Reset edit state
      setIsEditingLabel(false)
      setEditingLabel(null)
      setEditLabelName("")
      setEditLabelColor("#3b82f6")
      setEditLabelCategory("difficulty")
      setEditLabelPriority(1)
      
      loadData() // Reload data
      toast.success("Label updated successfully!")
    } catch (err) {
      console.error("Error updating label:", err)
      toast.error("Failed to update label. Please try again.")
    }
  }

  const handleCancelEditLabel = () => {
    setIsEditingLabel(false)
    setEditingLabel(null)
    setEditLabelName("")
    setEditLabelColor("#3b82f6")
    setEditLabelCategory("difficulty")
    setEditLabelPriority(1)
  }

  const handleUpdateProductDifficultyLabel = async (productId: string, newLabel: string) => {
    if (!tenant?.id) return

    try {
      await updateProduct(tenant.id, productId, { difficultyLabel: newLabel })
      loadData() // Reload data
    } catch (err) {
      console.error("Error updating product difficulty label:", err)
      setError("Failed to update product difficulty label. Please try again.")
    }
  }

  const handleUpdateProductTypeLabel = async (productId: string, newLabel: string) => {
    if (!tenant?.id) return

    try {
      await updateProduct(tenant.id, productId, { productTypeLabel: newLabel })
      loadData() // Reload data
    } catch (err) {
      console.error("Error updating product type label:", err)
      setError("Failed to update product type label. Please try again.")
    }
  }

  const getLabelByName = (name: string) => {
    return labels.find((label) => label.name === name)
  }

  // Helper function to check if a product is already saved
  const isProductAlreadySaved = (shopifyId: string) => {
    return savedProducts.some((sp) => sp.shopifyProductId === shopifyId)
  }

  // Filter saved products based on search, label status, and store
  const filteredSavedProducts = savedProducts.filter((product) => {
    // Store filter
    if (savedProductStoreFilter !== "all" && product.storeId !== savedProductStoreFilter) {
      return false
    }

    // Label filter
    if (labelledFilter === "labelled" && (!product.labelNames || product.labelNames.length === 0)) {
      return false
    }
    if (labelledFilter === "not-labelled" && product.labelNames && product.labelNames.length > 0) {
      return false
    }

    // Search filter
    if (!savedProductSearch.trim()) return true
    const searchLower = savedProductSearch.toLowerCase()
    return (
      product.title?.toLowerCase().includes(searchLower) ||
      product.variantTitle?.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      product.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    )
  })

  const difficultyLabels = labels.filter((label) => label.category === "difficulty")
  const productTypeLabels = labels.filter((label) => label.category === "productType")

  // Pagination for saved products
  const totalSavedProductsPages = Math.ceil(filteredSavedProducts.length / savedProductsPerPage)
  const startIndex = (savedProductsPage - 1) * savedProductsPerPage
  const endIndex = startIndex + savedProductsPerPage
  const paginatedSavedProducts = filteredSavedProducts.slice(startIndex, endIndex)
  const hasNextSavedProductsPage = savedProductsPage < totalSavedProductsPages

  const handleNextSavedProductsPage = () => {
    if (hasNextSavedProductsPage) {
      setSavedProductsPage((prev) => prev + 1)
    }
  }

  const handlePrevSavedProductsPage = () => {
    if (savedProductsPage > 1) {
      setSavedProductsPage((prev) => prev - 1)
    }
  }

  const handleFirstSavedProductsPage = () => {
    setSavedProductsPage(1)
  }

  const handleLastSavedProductsPage = () => {
    setSavedProductsPage(totalSavedProductsPages)
  }

  const clearSearch = () => {
    setAllProductsSearch("")
  }

  const clearAllFilters = () => {
    setAllProductsSearch("")
    setSavedFilter("all")
    setSyncTitleFilter("")
    setSyncTagFilter("")
    setSyncExcludeTags("")
  }

  const clearSavedProductFilters = () => {
    setSavedProductSearch("")
    setLabelledFilter("all")
    setSavedProductStoreFilter("all")
  }

  const openShopifyProduct = (product: any) => {
    if (product.shopifyId && product.handle) {
      const store = stores.find((s) => s.id === product.storeId)
      if (store) {
        const shopifyUrl = `https://${store.settings?.domain}/admin/products/${product.shopifyId}`
        window.open(shopifyUrl, "_blank")
      }
    }
  }

  const handleToggleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
  }

  const handleToggleSelectSavedProduct = (productId: string) => {
    const newSelected = new Set(selectedSavedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedSavedProducts(newSelected)
  }

  const handleToggleSelectAll = () => {
    if (selectedProducts.size === finalFilteredProducts.length) {
      setSelectedProducts(new Set())
    } else {
      setSelectedProducts(new Set(finalFilteredProducts.map((p) => p.id)))
    }
  }

  const handleToggleSelectAllSavedProducts = () => {
    if (selectedSavedProducts.size === paginatedSavedProducts.length) {
      setSelectedSavedProducts(new Set())
    } else {
      setSelectedSavedProducts(new Set(paginatedSavedProducts.map((p) => p.id)))
    }
  }

  const handleSaveSelectedProducts = async () => {
    if (!tenant?.id || selectedProducts.size === 0) {
      toast.error("Please select products to save.")
      return
    }

    try {
      setIsSavingProducts(true)

             const productsToSave = fetchedProducts.filter((product) => selectedProducts.has(product.id))

             // Check for duplicates by comparing shopify product ID + variant ID combinations
       const allProductVariantPairs = productsToSave.flatMap((product) =>
         (product.variants || []).map((variant: any) => ({
           shopifyProductId: product.shopifyId,
           shopifyVariantId: variant.id,
         }))
       )

      const savedProductVariantPairs = savedProducts.map((product) => ({
        shopifyProductId: product.shopifyProductId,
        shopifyVariantId: product.shopifyVariantId,
      }))

      const duplicates = allProductVariantPairs.filter((newPair) =>
        savedProductVariantPairs.some(
          (savedPair) =>
            savedPair.shopifyProductId === newPair.shopifyProductId &&
            savedPair.shopifyVariantId === newPair.shopifyVariantId
        )
      )

      const newProductVariantPairs = allProductVariantPairs.filter(
        (newPair) =>
          !savedProductVariantPairs.some(
            (savedPair) =>
              savedPair.shopifyProductId === newPair.shopifyProductId &&
              savedPair.shopifyVariantId === newPair.shopifyVariantId
          )
      )

      if (newProductVariantPairs.length === 0) {
        toast.info(`ℹ️ All variants of the ${productsToSave.length} selected products are already saved!`, {
          duration: 4000,
          description: `No new product variants were added to your saved products.`,
        })
        setSelectedProducts(new Set())
        return
      }

             // Create a product data entry for EACH variant of each selected product
       const productsData = productsToSave.flatMap((product) =>
         (product.variants || []).map((variant: any) => ({
          shopifyProductId: product.shopifyId,
          shopifyVariantId: variant.id,
          title: product.title,
          variantTitle: variant.title,
          description: product.description,
          price: parseFloat(variant.price || "0"),
          tags: product.tags || [],
          productType: product.productType,
          vendor: product.vendor,
          handle: product.handle,
          imageUrl: product.images?.[0]?.src,
          imageAlt: product.images?.[0]?.alt,
          imageWidth: product.images?.[0]?.width,
          imageHeight: product.images?.[0]?.height,
          storeId: syncStoreId, // Add store ID to saved products
        }))
      )

      // Filter out variants that are already saved
      const newProductsData = productsData.filter((productData) =>
        newProductVariantPairs.some(
          (newPair) =>
            newPair.shopifyProductId === productData.shopifyProductId &&
            newPair.shopifyVariantId === productData.shopifyVariantId
        )
      )

      await saveProducts(tenant.id, newProductsData)

      // Update saved products state directly instead of calling loadData()
      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)

      setSelectedProducts(new Set())

      // Show appropriate toast based on results
      const totalVariants = productsData.length
      const newVariants = newProductsData.length
      const duplicateVariants = duplicates.length

      if (duplicateVariants > 0) {
        toast.success(
          `✅ Saved ${newVariants} new product variants! ${duplicateVariants} variants were already saved.`,
          {
            duration: 4000,
            description: `Total: ${totalVariants} variants from ${productsToSave.length} products. You can find them in "Saved Products".`,
          }
        )
      } else {
        toast.success(
          `✅ Successfully saved ${newVariants} product variants from ${productsToSave.length} products!`,
          {
            duration: 4000,
            description: `Each variant is saved separately. You can now find them in the "Saved Products" section.`,
          }
        )
      }
    } catch (err) {
      console.error("Error saving products:", err)
      toast.error("❌ Failed to save products. Please try again.", {
        duration: 5000,
      })
    } finally {
      setIsSavingProducts(false)
    }
  }

  const handleBulkDeleteSavedProducts = async () => {
    if (!tenant?.id || selectedSavedProducts.size === 0) return

    if (
      !confirm(
        `Are you sure you want to delete ${selectedSavedProducts.size} saved products? This action cannot be undone.`
      )
    ) {
      return
    }

    try {
      const deletePromises = Array.from(selectedSavedProducts).map((productId) =>
        deleteSavedProduct(tenant.id, productId)
      )

      await Promise.all(deletePromises)

      // Update saved products state directly instead of calling loadData()
      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)

      setSelectedSavedProducts(new Set())

      toast.success(`✅ Successfully deleted ${selectedSavedProducts.size} products!`, {
        duration: 4000,
      })
    } catch (err) {
      console.error("Error deleting saved products:", err)
      toast.error("❌ Failed to delete products. Please try again.", {
        duration: 5000,
      })
    }
  }

  const handleBulkApplyLabel = async () => {
    if (
      !tenant?.id ||
      selectedSavedProducts.size === 0 ||
      (!selectedDifficultyLabel && !selectedProductTypeLabel)
    ) {
      toast.error("Please select products and at least one label to apply.")
      return
    }

    const labelsToApply = [
      labels.find((l) => l.id === selectedDifficultyLabel),
      labels.find((l) => l.id === selectedProductTypeLabel),
    ].filter((l): l is ProductLabel => !!l)

    if (labelsToApply.length === 0) {
      toast.error("Selected labels could not be found.")
      return
    }

    try {
      const applyPromises = Array.from(selectedSavedProducts).flatMap((productId) =>
        labelsToApply.map((label) => addProductLabel(tenant.id, productId, label.id))
      )

      await Promise.all(applyPromises)

      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)

      setSelectedSavedProducts(new Set())
      setSelectedDifficultyLabel("")
      setSelectedProductTypeLabel("")

      toast.success(
        `✅ Successfully applied ${labelsToApply.map((l) => `"${l.name}"`).join(" and ")} label(s) to ${
          selectedSavedProducts.size
        } products!`,
        {
          duration: 4000,
        }
      )
    } catch (err) {
      console.error("Error applying labels to saved products:", err)
      toast.error("❌ Failed to apply labels. Please try again.", {
        duration: 5000,
      })
    }
  }

  // Filter fetched products based on search
  const filteredFetchedProducts = fetchedProducts.filter((product) => {
    if (!allProductsSearch.trim()) return true

    const searchLower = allProductsSearch.toLowerCase()
    return (
      product.title?.toLowerCase().includes(searchLower) ||
      product.variants?.[0]?.title?.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      product.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
    )
  })

  // Apply saved filter
  const savedFilteredProducts =
    savedFilter === "all"
      ? filteredFetchedProducts
      : savedFilter === "saved"
        ? filteredFetchedProducts.filter((product) => isProductAlreadySaved(product.shopifyId))
        : filteredFetchedProducts.filter((product) => !isProductAlreadySaved(product.shopifyId))

  // Apply exclude tags filter
  const excludeTags = syncExcludeTags
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
  const finalFilteredProducts =
    excludeTags.length > 0
      ? savedFilteredProducts.filter((product) => {
          const productTags = product.tags?.map((tag: string) => tag.toLowerCase()) || []
          return !excludeTags.some((excludeTag) => productTags.includes(excludeTag))
        })
      : savedFilteredProducts

  // Handler to update selected saved products
  const handleUpdateSelectedSavedProducts = async () => {
    if (!tenant?.id || selectedSavedProducts.size === 0) return
    setIsSavingProducts(true)
    try {
      // Find the selected saved products
      const productsToUpdate = savedProducts.filter((product) => selectedSavedProducts.has(product.id))
      // Fetch latest data from Shopify for each product
      // (Assume you have a function fetchShopifyProductById that returns the latest product data)
      const updatedProductsData = await Promise.all(productsToUpdate.map(async (product) => {
        // You may need to implement fetchShopifyProductById in your services
        const latest = await fetchShopifyProductById(product.shopifyProductId)
        if (!latest) return null
        return {
          shopifyProductId: latest.shopifyId,
          shopifyVariantId: latest.variants?.[0]?.id || "",
          title: latest.title,
          variantTitle: latest.variants?.[0]?.title,
          description: latest.description,
          price: parseFloat(latest.variants?.[0]?.price || "0"),
          tags: latest.tags || [],
          productType: latest.productType,
          vendor: latest.vendor,
          handle: latest.handle,
          imageUrl: latest.images?.[0]?.src,
          imageAlt: latest.images?.[0]?.alt,
          imageWidth: latest.images?.[0]?.width,
          imageHeight: latest.images?.[0]?.height,
        }
      }))
      // Filter out any nulls (in case a product couldn't be fetched)
      const validUpdates = updatedProductsData.filter(Boolean)
      if (validUpdates.length === 0) {
        toast.info('No products could be updated from Shopify.', { duration: 4000 })
        setIsSavingProducts(false)
        return
      }
      await saveProducts(tenant.id, validUpdates)
      // Refresh saved products list
      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)
      setSelectedSavedProducts(new Set())
      toast.success(`✅ Updated ${validUpdates.length} products from Shopify!`, { duration: 4000 })
    } catch (err) {
      console.error('Error updating saved products:', err)
      toast.error('❌ Failed to update products. Please try again.', { duration: 5000 })
    } finally {
      setIsSavingProducts(false)
    }
  }

  // Bulk remove all labels from selected saved products
  const handleBulkRemoveLabels = async () => {
    if (!tenant?.id || selectedSavedProducts.size === 0) return
    setIsRemovingLabels(true)
    try {
      // Find the selected saved products
      const productsToRemoveLabels = savedProducts.filter((product) => selectedSavedProducts.has(product.id))
      // For each product, remove all its labels
      const removePromises: Promise<any>[] = []
      for (const product of productsToRemoveLabels) {
        if (product.labelIds && product.labelIds.length > 0) {
          for (const labelId of product.labelIds) {
            removePromises.push(removeProductLabel(tenant.id, product.id, labelId))
          }
        }
      }
      await Promise.all(removePromises)
      // Refresh saved products list
      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)
      setSelectedSavedProducts(new Set())
      toast.success(`✅ Removed all labels from ${productsToRemoveLabels.length} products!`, { duration: 4000 })
    } catch (err) {
      console.error('Error removing labels from saved products:', err)
      toast.error('❌ Failed to remove labels. Please try again.', { duration: 5000 })
    } finally {
      setIsRemovingLabels(false)
    }
  }

  // Initialize drag-to-select hooks for both tables
  const allProductsDrag = useDragToSelect(
    finalFilteredProducts,
    selectedProducts,
    handleToggleSelectProduct
  )

  const savedProductsDrag = useDragToSelect(
    paginatedSavedProducts,
    selectedSavedProducts,
    handleToggleSelectSavedProduct
  )

  if (!tenant?.id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenant context...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <div className="text-sm text-gray-500 mt-2">Loading products...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-semibold">Error Loading Data</h3>
            <p className="text-sm text-gray-600 mt-2">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobileView ? "space-y-4" : "space-y-6"}`}>
      {/* Labels Management Section */}
      <Card>
        <CardHeader className={`${isMobileView ? "pb-2" : ""}`}>
          <div
            className={`flex justify-between ${isMobileView ? "flex-col gap-2" : "items-center"}`}
          >
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <Tag className={`${isMobileView ? "h-4 w-4" : "h-5 w-5"}`} />
              {isMobileView ? "Labels" : "Product Labels"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Dialog open={isAddingLabel} onOpenChange={setIsAddingLabel}>
                <DialogTrigger asChild>
                  <Button size="sm" className={`${isMobileView ? "w-full" : ""}`}>
                    <Plus className={`${isMobileView ? "h-3 w-3 mr-1" : "h-4 w-4 mr-2"}`} />
                    Add Label
                  </Button>
                </DialogTrigger>
                <DialogContent className={isMobileView ? "w-[95vw] max-w-none" : ""}>
                  <DialogHeader>
                    <DialogTitle className={isMobileView ? "text-lg" : ""}>Add New Product Label</DialogTitle>
                    <DialogDescription className={isMobileView ? "text-sm" : ""}>
                      Create and categorize a new label for your products. This helps in organizing
                      and filtering them later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className={`space-y-4 ${isMobileView ? "space-y-3" : ""}`}>
                    <div>
                      <Label htmlFor="labelName" className={isMobileView ? "text-sm" : ""}>Label Name</Label>
                      <Input
                        id="labelName"
                        value={newLabelName}
                        onChange={(e) => setNewLabelName(e.target.value)}
                        placeholder="e.g., Very Hard"
                        className={isMobileView ? "h-9 text-sm" : ""}
                      />
                    </div>
                    <div>
                      <Label htmlFor="labelCategory" className={isMobileView ? "text-sm" : ""}>Category</Label>
                      <Select
                        value={newLabelCategory}
                        onValueChange={(value: "difficulty" | "productType") =>
                          setNewLabelCategory(value)
                        }
                      >
                        <SelectTrigger className={isMobileView ? "h-9 text-sm" : ""}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="difficulty">Difficulty</SelectItem>
                          <SelectItem value="productType">Product Type</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="labelColor" className={isMobileView ? "text-sm" : ""}>Color</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id="labelColor"
                          type="color"
                          value={newLabelColor}
                          onChange={(e) => setNewLabelColor(e.target.value)}
                          className={`rounded border ${isMobileView ? "w-10 h-8" : "w-12 h-10"}`}
                        />
                        <Input
                          value={newLabelColor}
                          onChange={(e) => setNewLabelColor(e.target.value)}
                          placeholder="#3b82f6"
                          className={isMobileView ? "h-9 text-sm" : ""}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="labelPriority" className={isMobileView ? "text-sm" : ""}>
                        Priority (lower numbers = higher priority)
                      </Label>
                      <Input
                        id="labelPriority"
                        type="number"
                        min="1"
                        value={newLabelPriority}
                        onChange={(e) => setNewLabelPriority(parseInt(e.target.value) || 1)}
                        placeholder="1"
                        className={isMobileView ? "h-9 text-sm" : ""}
                      />
                    </div>
                    <div className={`flex justify-end gap-2 ${isMobileView ? "pt-2" : ""}`}>
                      <Button variant="outline" onClick={() => setIsAddingLabel(false)} className={isMobileView ? "text-sm" : ""}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddLabel} className={isMobileView ? "text-sm" : ""}>Add Label</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        {/* Edit Label Modal */}
        <Dialog open={isEditingLabel} onOpenChange={setIsEditingLabel}>
          <DialogContent className={isMobileView ? "w-[95vw] max-w-[95vw]" : ""}>
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2 ${isMobileView ? "text-lg" : ""}`}>
                <Edit className={`${isMobileView ? "h-4 w-4" : "h-5 w-5"}`} />
                Edit Label
              </DialogTitle>
              <DialogDescription className={isMobileView ? "text-sm" : ""}>
                Update the label properties below.
              </DialogDescription>
            </DialogHeader>
            <div className={`space-y-4 ${isMobileView ? "space-y-3" : ""}`}>
              <div>
                <Label htmlFor="editLabelName" className={isMobileView ? "text-sm" : ""}>Label Name</Label>
                <Input
                  id="editLabelName"
                  value={editLabelName}
                  onChange={(e) => setEditLabelName(e.target.value)}
                  placeholder="Enter label name"
                  className={isMobileView ? "h-9 text-sm" : ""}
                />
              </div>
              <div>
                <Label htmlFor="editLabelCategory" className={isMobileView ? "text-sm" : ""}>Category</Label>
                <Select
                  value={editLabelCategory}
                  onValueChange={(value: "difficulty" | "productType" | "custom") =>
                    setEditLabelCategory(value)
                  }
                >
                  <SelectTrigger className={isMobileView ? "h-9 text-sm" : ""}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="difficulty">Difficulty</SelectItem>
                    <SelectItem value="productType">Product Type</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="editLabelColor" className={isMobileView ? "text-sm" : ""}>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="editLabelColor"
                    type="color"
                    value={editLabelColor}
                    onChange={(e) => setEditLabelColor(e.target.value)}
                    className={`rounded border ${isMobileView ? "w-10 h-8" : "w-12 h-10"}`}
                  />
                  <Input
                    value={editLabelColor}
                    onChange={(e) => setEditLabelColor(e.target.value)}
                    placeholder="#3b82f6"
                    className={isMobileView ? "h-9 text-sm" : ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editLabelPriority" className={isMobileView ? "text-sm" : ""}>
                  Priority (lower numbers = higher priority)
                </Label>
                <Input
                  id="editLabelPriority"
                  type="number"
                  min="1"
                  value={editLabelPriority}
                  onChange={(e) => setEditLabelPriority(parseInt(e.target.value) || 1)}
                  placeholder="1"
                  className={isMobileView ? "h-9 text-sm" : ""}
                />
              </div>
              <div className={`flex justify-end gap-2 ${isMobileView ? "pt-2" : ""}`}>
                <Button variant="outline" onClick={handleCancelEditLabel} className={isMobileView ? "text-sm" : ""}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEditLabel} className={isMobileView ? "text-sm" : ""}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <CardContent className={`${isMobileView ? "pt-2" : ""}`}>
          <div className={`${isMobileView ? "space-y-3" : "space-y-4"}`}>
            {/* Difficulty Labels */}
            <div>
              <h4
                className={`font-medium text-gray-700 ${isMobileView ? "text-xs mb-1" : "text-sm mb-2"}`}
              >
                Difficulty Labels
              </h4>
              <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-2"}`}>
                {difficultyLabels
                  .sort((a, b) => a.priority - b.priority)
                  .map((label) => (
                    <div key={label.id} className="flex items-center gap-1">
                      <Badge
                        style={{ backgroundColor: label.color, color: "white" }}
                        className={`text-white ${isMobileView ? "text-xs px-2 py-1" : ""}`}
                      >
                        {label.name} ({label.priority})
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditLabel(label)}
                        className={`p-0 hover:bg-blue-100 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                      >
                        <Edit
                          className={`text-blue-500 ${isMobileView ? "h-2 w-2" : "h-3 w-3"}`}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteLabel(label.id)}
                        className={`p-0 hover:bg-red-100 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                      >
                        <Trash2
                          className={`text-red-500 ${isMobileView ? "h-2 w-2" : "h-3 w-3"}`}
                        />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Product Type Labels */}
            <div>
              <h4
                className={`font-medium text-gray-700 ${isMobileView ? "text-xs mb-1" : "text-sm mb-2"}`}
              >
                Product Type Labels
              </h4>
              <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-2"}`}>
                {productTypeLabels
                  .sort((a, b) => a.priority - b.priority)
                  .map((label) => (
                    <div key={label.id} className="flex items-center gap-1">
                      <Badge
                        style={{ backgroundColor: label.color, color: "white" }}
                        className={`text-white ${isMobileView ? "text-xs px-2 py-1" : ""}`}
                      >
                        {label.name} ({label.priority})
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditLabel(label)}
                        className={`p-0 hover:bg-blue-100 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                      >
                        <Edit
                          className={`text-blue-500 ${isMobileView ? "h-2 w-2" : "h-3 w-3"}`}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteLabel(label.id)}
                        className={`p-0 hover:bg-red-100 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                      >
                        <Trash2
                          className={`text-red-500 ${isMobileView ? "h-2 w-2" : "h-3 w-3"}`}
                        />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Products Section */}
      <Card>
        <CardHeader className={isMobileView ? "pb-3" : ""}>
          <div className={`flex flex-col ${isMobileView ? "gap-3" : "sm:flex-row sm:items-center sm:justify-between gap-2"}`}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <Package className={`${isMobileView ? "h-4 w-4" : "h-5 w-5"}`} />
              {isMobileView ? "All Products" : "All Products"}
            </CardTitle>
            <div className={`flex flex-col ${isMobileView ? "gap-2" : "sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full sm:w-auto"}`}>
              <div className={`flex flex-col ${isMobileView ? "gap-2" : "sm:flex-row sm:flex-wrap sm:items-center gap-2"}`}>
                <Select value={syncStoreId} onValueChange={setSyncStoreId}>
                  <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-40"}`}>
                    <SelectValue placeholder="Select a store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={savedFilter}
                  onValueChange={(value: "all" | "saved" | "not-saved") => setSavedFilter(value)}
                >
                  <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-40"}`}>
                    <SelectValue placeholder="Filter by saved status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="saved">Saved Only</SelectItem>
                    <SelectItem value="not-saved">Not Saved</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className={`${isMobileView ? "w-full h-9 text-sm" : "w-40"}`}
                  value={syncTitleFilter}
                  onChange={(e) => setSyncTitleFilter(e.target.value)}
                  placeholder="Filter by title"
                />
                <Input
                  className={`${isMobileView ? "w-full h-9 text-sm" : "w-40"}`}
                  value={syncTagFilter}
                  onChange={(e) => setSyncTagFilter(e.target.value)}
                  placeholder="Filter by tag"
                />
                <Input
                  className={`${isMobileView ? "w-full h-9 text-sm" : "w-40"}`}
                  value={syncExcludeTags}
                  onChange={(e) => setSyncExcludeTags(e.target.value)}
                  placeholder="Exclude tags (comma separated)"
                />
              </div>
              <div className={`flex flex-col ${isMobileView ? "gap-2" : "sm:flex-row sm:items-center gap-2 sm:ml-auto"}`}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFetchProducts(1)}
                  disabled={isFetchingProducts}
                  className={isMobileView ? "w-full h-9 text-sm" : ""}
                >
                  {isFetchingProducts ? (
                    <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  ) : (
                    <RefreshCw className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  )}
                  Fetch Products
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleFetchNotSavedProducts(1)}
                  disabled={isFetchingNotSavedProducts}
                  className={isMobileView ? "w-full h-9 text-sm" : ""}
                >
                  {isFetchingNotSavedProducts ? (
                    <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  ) : (
                    <FilterX className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  )}
                  Fetch Not-Saved
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveSelectedProducts}
                  disabled={selectedProducts.size === 0 || isSavingProducts}
                  className={isMobileView ? "w-full h-9 text-sm" : ""}
                >
                  {isSavingProducts ? (
                    <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  ) : (
                    <Save className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  )}
                  Save Selected ({selectedProducts.size})
                </Button>
                <Button size="sm" variant="outline" onClick={clearAllFilters} className={isMobileView ? "w-full h-9 text-sm" : ""}>
                  <X className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                  Clear Filters
                </Button>
              </div>
            </div>
          </div>
          {/* Search bar for All Products */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
            <Input
              type="text"
              placeholder="Search fetched products..."
              value={allProductsSearch}
              onChange={(e) => setAllProductsSearch(e.target.value)}
              className={`pl-10 ${isMobileView ? "h-9 text-sm" : ""}`}
            />
            {allProductsSearch && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAllProductsSearch("")}
                className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto ${isMobileView ? "w-6 h-6" : "w-8 h-8"}`}
              >
                <X className={`text-gray-400 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
              </Button>
            )}
          </div>

          {/* Filter Summary */}
          {(allProductsSearch ||
            savedFilter !== "all" ||
            syncTitleFilter ||
            syncTagFilter ||
            syncExcludeTags) && (
            <div className={`flex flex-wrap ${isMobileView ? "gap-1 mt-2" : "gap-2 mt-2"}`}>
              {allProductsSearch && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  Search: "{allProductsSearch}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllProductsSearch("")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
              {savedFilter !== "all" && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  {savedFilter === "saved" ? "Saved Only" : "Not Saved"}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSavedFilter("all")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
              {syncTitleFilter && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  Title: "{syncTitleFilter}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSyncTitleFilter("")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
              {syncTagFilter && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  Tag: "{syncTagFilter}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSyncTagFilter("")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
              {syncExcludeTags && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  Exclude: "{syncExcludeTags}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSyncExcludeTags("")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className={isMobileView ? "pt-0" : ""}>
          {finalFilteredProducts.length > 0 ? (
            <>
              {!isMobileView && (
                <div className="mb-3 text-xs text-gray-500 flex items-center gap-1">
                  <span>💡 Tip: Click and drag across checkboxes to select multiple products at once</span>
                </div>
              )}
              <div className={`overflow-x-auto ${isMobileView ? "-mx-3" : ""}`}>
                <Table ref={allProductsDrag.tableRef}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${isMobileView ? "w-[40px] px-2" : "w-[50px]"}`}>
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={
                              selectedProducts.size === finalFilteredProducts.length &&
                              finalFilteredProducts.length > 0
                            }
                            onCheckedChange={handleToggleSelectAll}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          {!isMobileView && (
                            <span className="text-xs text-gray-400 ml-1" title="Drag to select multiple">
                              ↕
                            </span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Image</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Title and Variant Title</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Tags</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalFilteredProducts.map((product) => (
                      <TableRow key={product.id} {...allProductsDrag.getRowProps(product.id)}>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => handleToggleSelectProduct(product.id)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          {product.images?.[0]?.src ? (
                            <div className="relative">
                              <img
                                src={product.images[0].src}
                                alt={product.images[0].alt || product.title}
                                className={`object-cover rounded ${isMobileView ? "w-10 h-10" : "w-12 h-12"}`}
                              />
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`absolute -top-1 -right-1 p-0 bg-white border rounded-full shadow-sm hover:bg-gray-50 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                                  >
                                    <Eye className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className={`${isMobileView ? "w-[95vw] max-w-none" : "max-w-2xl"}`}>
                                  <DialogHeader>
                                    <DialogTitle className={isMobileView ? "text-lg" : ""}>{product.title}</DialogTitle>
                                  </DialogHeader>
                                  <div className="flex justify-center">
                                    <img
                                      src={product.images[0].src}
                                      alt={product.images[0].alt || product.title}
                                      className="max-w-full max-h-96 object-contain"
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <div className={`bg-gray-100 rounded flex items-center justify-center ${isMobileView ? "w-10 h-10" : "w-12 h-12"}`}>
                              <Package className={`text-gray-400 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <div className={`font-medium ${isMobileView ? "text-sm" : ""}`}>{product.title}</div>
                          <div className={`text-muted-foreground ${isMobileView ? "text-xs" : "text-sm"}`}>
                            {product.variants?.[0]?.title}
                          </div>
                          {isProductAlreadySaved(product.shopifyId) && (
                            <Badge variant="outline" className={`mt-1 ${isMobileView ? "text-[10px]" : "text-xs"}`}>
                              ✓ Already Saved
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-1"}`}>
                            {product.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className={isMobileView ? "text-[10px]" : ""}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2 text-sm" : ""}>{product.variants?.[0]?.price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {pagination && (
                <div className={`flex justify-between items-center mt-4 ${isMobileView ? "flex-col gap-2" : ""}`}>
                  <div className={`text-gray-600 ${isMobileView ? "text-xs" : "text-sm"}`}>
                    Showing {finalFilteredProducts.length} of ~{pagination.total} products
                  </div>
                  <div className="flex gap-2">
                    {pagination.hasNext && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleLoadMoreProducts}
                        disabled={isFetchingProducts}
                        className={isMobileView ? "text-xs px-3 py-1 h-8" : ""}
                      >
                        {isFetchingProducts ? (
                          <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                        ) : null}
                        Load More
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className={isMobileView ? "text-sm" : ""}>No products fetched yet.</p>
              <p className={`${isMobileView ? "text-xs" : "text-sm"}`}>Use the "Fetch Products" button to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Products Section */}
      <Card>
        <CardHeader className={isMobileView ? "pb-3" : ""}>
          <div className={`flex flex-col ${isMobileView ? "gap-3" : "sm:flex-row sm:items-center sm:justify-between"}`}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? "text-base" : ""}`}>
              <Save className={`${isMobileView ? "h-4 w-4" : "h-5 w-5"}`} />
              Saved Products
            </CardTitle>
          </div>
          {/* --- Responsive Filters and Actions Layout --- */}
          <div className={`w-full ${isMobileView ? "flex flex-col gap-2" : "flex flex-row flex-wrap items-center gap-2 justify-between mt-4"}`}>
            {/* Filters */}
            <div className={`${isMobileView ? "flex flex-col gap-2 w-full" : "flex flex-row flex-wrap gap-2 items-center"}`}>
              <div className={isMobileView ? "w-full" : "w-64"}>
                <Input
                  placeholder="Search saved products..."
                  value={savedProductSearch}
                  onChange={(e) => setSavedProductSearch(e.target.value)}
                  className={isMobileView ? "h-9 text-sm" : ""}
                />
              </div>
              <Select
                value={savedProductStoreFilter}
                onValueChange={setSavedProductStoreFilter}
              >
                <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-48"}`}>
                  <SelectValue placeholder="Filter by store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={labelledFilter}
                onValueChange={(value: "all" | "labelled" | "not-labelled") =>
                  setLabelledFilter(value)
                }
              >
                <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-48"}`}>
                  <SelectValue placeholder="Filter by label status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Saved</SelectItem>
                  <SelectItem value="labelled">Labelled</SelectItem>
                  <SelectItem value="not-labelled">Not Labelled</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={clearSavedProductFilters} className={isMobileView ? "w-full h-9 text-sm" : ""}>
                <X className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                Clear Filters
              </Button>
            </div>
            {/* Bulk Actions */}
            <div className={`${isMobileView ? "flex flex-col gap-2 w-full" : "flex flex-row gap-2 items-center"}`}>
              <Select value={selectedDifficultyLabel} onValueChange={setSelectedDifficultyLabel}>
                <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-48"}`}>
                  <SelectValue placeholder="Select difficulty label" />
                </SelectTrigger>
                <SelectContent>
                  {difficultyLabels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedProductTypeLabel} onValueChange={setSelectedProductTypeLabel}>
                <SelectTrigger className={`${isMobileView ? "w-full h-9 text-sm" : "w-48"}`}>
                  <SelectValue placeholder="Select product type label" />
                </SelectTrigger>
                <SelectContent>
                  {productTypeLabels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: label.color }}
                        />
                        {label.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkApplyLabel}
                disabled={
                  selectedSavedProducts.size === 0 ||
                  (!selectedDifficultyLabel && !selectedProductTypeLabel)
                }
                className={isMobileView ? "w-full h-9 text-sm" : ""}
              >
                <Tag className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                Apply Labels ({selectedSavedProducts.size})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDeleteSavedProducts}
                disabled={selectedSavedProducts.size === 0}
                className={isMobileView ? "w-full h-9 text-sm" : ""}
              >
                <Trash2 className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                Delete ({selectedSavedProducts.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUpdateSelectedSavedProducts}
                disabled={selectedSavedProducts.size === 0 || isSavingProducts}
                className={isMobileView ? "w-full h-9 text-sm" : ""}
              >
                {isSavingProducts ? (
                  <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                ) : (
                  <RefreshCw className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                )}
                Update Selected ({selectedSavedProducts.size})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkRemoveLabels}
                disabled={selectedSavedProducts.size === 0 || isRemovingLabels}
                className={isMobileView ? "w-full h-9 text-sm" : ""}
              >
                {isRemovingLabels ? (
                  <Loader2 className={`animate-spin mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                ) : (
                  <Tag className={`mr-2 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                )}
                Remove Labels ({selectedSavedProducts.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className={isMobileView ? "pt-0" : ""}>
          {paginatedSavedProducts.length > 0 ? (
            <>
              {!isMobileView && (
                <div className="mb-3 text-xs text-gray-500 flex items-center gap-1">
                  <span>💡 Tip: Click and drag across checkboxes to select multiple products at once</span>
                </div>
              )}
              <div className={`overflow-x-auto ${isMobileView ? "-mx-3" : ""}`}>
                <Table ref={savedProductsDrag.tableRef}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${isMobileView ? "w-[40px] px-2" : "w-[50px]"}`}>
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={
                              selectedSavedProducts.size === paginatedSavedProducts.length &&
                              paginatedSavedProducts.length > 0
                            }
                            onCheckedChange={handleToggleSelectAllSavedProducts}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                          {!isMobileView && (
                            <span className="text-xs text-gray-400 ml-1" title="Drag to select multiple">
                              ↕
                            </span>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Image</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Title and Variant Title</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Tags</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Labels</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSavedProducts.map((product) => (
                      <TableRow key={product.id} {...savedProductsDrag.getRowProps(product.id)}>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <Checkbox
                            checked={selectedSavedProducts.has(product.id)}
                            onCheckedChange={() => handleToggleSelectSavedProduct(product.id)}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          {product.imageUrl ? (
                            <div className="relative">
                              <img
                                src={product.imageUrl}
                                alt={product.imageAlt || product.title}
                                className={`object-cover rounded ${isMobileView ? "w-10 h-10" : "w-12 h-12"}`}
                              />
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`absolute -top-1 -right-1 p-0 bg-white border rounded-full shadow-sm hover:bg-gray-50 ${isMobileView ? "h-5 w-5" : "h-6 w-6"}`}
                                  >
                                    <Eye className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className={`${isMobileView ? "w-[95vw] max-w-none" : "max-w-2xl"}`}>
                                  <DialogHeader>
                                    <DialogTitle className={isMobileView ? "text-lg" : ""}>{product.title}</DialogTitle>
                                  </DialogHeader>
                                  <div className="flex justify-center">
                                    <img
                                      src={product.imageUrl}
                                      alt={product.imageAlt || product.title}
                                      className="max-w-full max-h-96 object-contain"
                                    />
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <div className={`bg-gray-100 rounded flex items-center justify-center ${isMobileView ? "w-10 h-10" : "w-12 h-12"}`}>
                              <Package className={`text-gray-400 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <div className={`font-medium ${isMobileView ? "text-sm" : ""}`}>{product.title}</div>
                          <div className={`text-muted-foreground ${isMobileView ? "text-xs" : "text-sm"}`}>{product.variantTitle}</div>
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-1"}`}>
                            {product.tags.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className={isMobileView ? "text-[10px]" : ""}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <div className={`flex flex-wrap ${isMobileView ? "gap-1" : "gap-1"}`}>
                            {product.labelNames?.map((labelName: string) => {
                              const labelObj = labels.find((l) => l.name === labelName)
                              return (
                                <Badge
                                  key={labelName}
                                  variant="secondary"
                                  style={
                                    labelObj ? { backgroundColor: labelObj.color, color: "#fff" } : {}
                                  }
                                  className={isMobileView ? "text-[10px]" : ""}
                                >
                                  {labelName}
                                </Badge>
                              )
                            })}
                          </div>
                        </TableCell>
                        <TableCell className={isMobileView ? "px-2 text-sm" : ""}>{product.price}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls for Saved Products */}
              {totalSavedProductsPages > 1 && (
                <div className={`flex justify-between items-center mt-4 ${isMobileView ? "flex-col gap-2" : ""}`}>
                  <div className={`text-gray-600 ${isMobileView ? "text-xs" : "text-sm"}`}>
                    Showing {(savedProductsPage - 1) * savedProductsPerPage + 1} to{" "}
                    {Math.min(
                      savedProductsPage * savedProductsPerPage,
                      filteredSavedProducts.length
                    )}{" "}
                    of {filteredSavedProducts.length} saved products
                  </div>
                  <div className={`flex gap-2 ${isMobileView ? "flex-wrap justify-center" : ""}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFirstSavedProductsPage}
                      disabled={savedProductsPage === 1}
                      className={isMobileView ? "text-xs px-2 py-1 h-8" : ""}
                    >
                      First
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handlePrevSavedProductsPage}
                      disabled={savedProductsPage === 1}
                      className={isMobileView ? "text-xs px-2 py-1 h-8" : ""}
                    >
                      Previous
                    </Button>
                    <span className={`flex items-center px-3 ${isMobileView ? "text-xs" : "text-sm"}`}>
                      Page {savedProductsPage} of {totalSavedProductsPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNextSavedProductsPage}
                      disabled={!hasNextSavedProductsPage}
                      className={isMobileView ? "text-xs px-2 py-1 h-8" : ""}
                    >
                      Next
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleLastSavedProductsPage}
                      disabled={!hasNextSavedProductsPage}
                      className={isMobileView ? "text-xs px-2 py-1 h-8" : ""}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className={isMobileView ? "text-sm" : ""}>No saved products found.</p>
              <p className={`${isMobileView ? "text-xs" : "text-sm"}`}>Use the search bar to find saved products.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
