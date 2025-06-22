import React, { useState, useEffect } from "react"
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
} from "../services/api"
import type { ProductLabel, Store, Product, SavedProduct } from "../types"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { Checkbox } from "./ui/checkbox"

export function ProductManagement() {
  const { tenant } = useAuth()
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

  // State for shift+click selection
  const [lastSelectedProductId, setLastSelectedProductId] = useState<string | null>(null)

  // Get mobile view context
  const { isMobileView } = useMobileView()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<{
    page: number
    limit: number
    hasNext: boolean
    total: number
    nextSinceId?: number
  } | null>(null)

  // Search state for All Products
  const [allProductsSearch, setAllProductsSearch] = useState("")

  // Pagination state for Saved Products
  const [savedProductsPage, setSavedProductsPage] = useState(1)
  const [savedProductsPerPage] = useState(100)

  const [nextPageInfo, setNextPageInfo] = useState<string | undefined>(undefined)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!tenant?.id) {
      setError("No tenant found")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch products, labels, and stores
      const [productsData, labelsData, storesData, savedProductsData] = await Promise.all([
        getProducts(tenant.id),
        getProductLabels(tenant.id),
        getStores(tenant.id),
        getSavedProducts(tenant.id),
      ])

      setFetchedProducts(productsData)
      setLabels(labelsData)
      setStores(storesData)
      setSavedProducts(savedProductsData)

      // Set default store for sync dialog if not already set
      if (storesData.length > 0 && !syncStoreId) {
        setSyncStoreId(storesData[0].id)
      }
    } catch (err) {
      console.error("Error loading data:", err)
      setError("Failed to load data. Please try again.")
      setFetchedProducts([])
      setLabels([])
      setStores([])
      setSavedProducts([])
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

    try {
      await deleteProductLabel(tenant.id, labelId)
      loadData() // Reload data
    } catch (err) {
      console.error("Error deleting label:", err)
      setError("Failed to delete label. Please try again.")
    }
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

  // Filter saved products based on search and label status
  const filteredSavedProducts = savedProducts.filter((product) => {
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
    if (!tenant?.id || selectedProducts.size === 0) return

    setIsSavingProducts(true)
    try {
      const productsToSave = fetchedProducts.filter((product) => selectedProducts.has(product.id))

      // Check for duplicates by comparing shopifyProductId
      const existingProductIds = new Set(savedProducts.map((sp) => sp.shopifyProductId))
      const newProducts = productsToSave.filter(
        (product) => !existingProductIds.has(product.shopifyId)
      )
      const duplicates = productsToSave.filter((product) =>
        existingProductIds.has(product.shopifyId)
      )

      if (newProducts.length === 0) {
        // All products are duplicates
        toast.info(`ℹ️ All ${productsToSave.length} selected products are already saved!`, {
          duration: 4000,
          description: `No new products were added to your saved products.`,
        })
        setSelectedProducts(new Set())
        return
      }

      const productsData = newProducts.map((product) => ({
        shopifyProductId: product.shopifyId,
        shopifyVariantId: product.variants?.[0]?.id || "",
        title: product.title,
        variantTitle: product.variants?.[0]?.title,
        description: product.description,
        price: parseFloat(product.variants?.[0]?.price || "0"),
        tags: product.tags || [],
        productType: product.productType,
        vendor: product.vendor,
        handle: product.handle,
        imageUrl: product.images?.[0]?.src,
        imageAlt: product.images?.[0]?.alt,
        imageWidth: product.images?.[0]?.width,
        imageHeight: product.images?.[0]?.height,
      }))

      await saveProducts(tenant.id, productsData)

      // Update saved products state directly instead of calling loadData()
      const newSavedProducts = await getSavedProducts(tenant.id)
      setSavedProducts(newSavedProducts)

      setSelectedProducts(new Set())

      // Show appropriate toast based on results
      if (duplicates.length > 0) {
        toast.success(
          `✅ Saved ${newProducts.length} new products! ${duplicates.length} were already saved.`,
          {
            duration: 4000,
            description: `You can now find the new products in the "Saved Products" section below.`,
          }
        )
      } else {
        toast.success(
          `✅ Successfully saved ${productsData.length} products to your saved products!`,
          {
            duration: 4000,
            description: `You can now find them in the "Saved Products" section below.`,
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">Error</div>
          <div className="text-sm text-gray-500 mt-2">{error}</div>
          <Button onClick={loadData} className="mt-4">
            Retry
          </Button>
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
              <div className={`overflow-x-auto ${isMobileView ? "-mx-3" : ""}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${isMobileView ? "w-[40px] px-2" : "w-[50px]"}`}>
                        <Checkbox
                          checked={
                            selectedProducts.size === finalFilteredProducts.length &&
                            finalFilteredProducts.length > 0
                          }
                          onCheckedChange={handleToggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Image</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Title and Variant Title</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Tags</TableHead>
                      <TableHead className={isMobileView ? "px-2" : ""}>Product Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finalFilteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <Checkbox
                            checked={selectedProducts.has(product.id)}
                            onCheckedChange={() => handleToggleSelectProduct(product.id)}
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
          <div className={`flex flex-col ${isMobileView ? "gap-3" : "sm:flex-row sm:items-center sm:justify-between mt-4"}`}>
            {/* Filters on the left */}
            <div className={`flex flex-col ${isMobileView ? "gap-2" : "sm:flex-row sm:flex-wrap sm:items-center gap-2"}`}>
              <div className={isMobileView ? "w-full" : "w-64"}>
                <Input
                  placeholder="Search saved products..."
                  value={savedProductSearch}
                  onChange={(e) => setSavedProductSearch(e.target.value)}
                  className={isMobileView ? "h-9 text-sm" : ""}
                />
              </div>
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

            {/* Actions on the right */}
            <div className={`flex flex-col ${isMobileView ? "gap-2" : "sm:flex-row sm:items-center gap-2 mt-2 sm:mt-0"}`}>
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
            </div>
          </div>
          {(savedProductSearch || labelledFilter !== "all") && (
            <div className={`flex flex-wrap ${isMobileView ? "gap-1 mt-2" : "gap-2 mt-2"}`}>
              {savedProductSearch && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  Search: "{savedProductSearch}"
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSavedProductSearch("")}
                    className={`ml-1 p-0 ${isMobileView ? "h-3 w-3" : "h-4 w-4"}`}
                  >
                    <X className={`${isMobileView ? "h-2 w-2" : "h-3 w-3"}`} />
                  </Button>
                </Badge>
              )}
              {labelledFilter !== "all" && (
                <Badge variant="secondary" className={`${isMobileView ? "text-xs" : "text-xs"}`}>
                  {labelledFilter === "labelled" ? "Labelled" : "Not Labelled"}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLabelledFilter("all")}
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
          {paginatedSavedProducts.length > 0 ? (
            <>
              <div className={`overflow-x-auto ${isMobileView ? "-mx-3" : ""}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={`${isMobileView ? "w-[40px] px-2" : "w-[50px]"}`}>
                        <Checkbox
                          checked={
                            selectedSavedProducts.size === paginatedSavedProducts.length &&
                            paginatedSavedProducts.length > 0
                          }
                          onCheckedChange={handleToggleSelectAllSavedProducts}
                        />
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
                      <TableRow key={product.id}>
                        <TableCell className={isMobileView ? "px-2" : ""}>
                          <Checkbox
                            checked={selectedSavedProducts.has(product.id)}
                            onCheckedChange={() => handleToggleSelectSavedProduct(product.id)}
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
