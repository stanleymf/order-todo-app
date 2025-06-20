import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Trash2, Plus, Tag, Search, X, RefreshCw, ExternalLink, Settings } from 'lucide-react';
import { useMobileView } from './Dashboard';
import type { Product, ProductLabel, Store } from '../types';
import { 
  getProducts, 
  getProductLabels, 
  getStores,
  addProductLabel, 
  deleteProductLabel, 
  updateProductDifficultyLabel,
  updateProductTypeLabel 
} from '../utils/storage';
import { syncProductsFromShopify } from '../utils/shopifyApi';

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [labels, setLabels] = useState<ProductLabel[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [isAddingLabel, setIsAddingLabel] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');
  const [newLabelCategory, setNewLabelCategory] = useState<'difficulty' | 'productType'>('difficulty');
  const [newLabelPriority, setNewLabelPriority] = useState(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<{ [storeId: string]: boolean }>({});
  const [selectedStore, setSelectedStore] = useState<string>('all');
  
  // Get mobile view context
  const { isMobileView } = useMobileView();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setProducts(getProducts());
    setLabels(getProductLabels());
    setStores(getStores());
  };

  const handleAddLabel = () => {
    if (newLabelName.trim()) {
      addProductLabel(newLabelName.trim(), newLabelColor, newLabelCategory, newLabelPriority);
      setNewLabelName('');
      setNewLabelColor('#3b82f6');
      setNewLabelCategory('difficulty');
      setNewLabelPriority(1);
      setIsAddingLabel(false);
      loadData();
    }
  };

  const handleDeleteLabel = (labelId: string) => {
    if (confirm('Are you sure you want to delete this label? Products using this label will be updated to use the default label.')) {
      deleteProductLabel(labelId);
      loadData();
    }
  };

  const handleUpdateProductDifficultyLabel = (productId: string, newLabel: string) => {
    updateProductDifficultyLabel(productId, newLabel);
    loadData();
  };

  const handleUpdateProductTypeLabel = (productId: string, newLabel: string) => {
    updateProductTypeLabel(productId, newLabel);
    loadData();
  };

  const getLabelByName = (name: string) => {
    return labels.find(label => label.name === name);
  };

  const getStoreById = (storeId: string) => {
    return stores.find(store => store.id === storeId);
  };

  // Handle Shopify sync for a specific store
  const handleShopifySync = async (store: Store) => {
    setIsSyncing(prev => ({ ...prev, [store.id]: true }));
    
    try {
      // In a real implementation, you would get the access token from secure storage
      const accessToken = 'your-shopify-access-token'; // This should come from secure storage
      
      const syncedProducts = await syncProductsFromShopify(store, accessToken);
      
      // Update local storage with synced products
      const existingProducts = getProducts();
      const updatedProducts = [
        ...existingProducts.filter(p => p.storeId !== store.id),
        ...syncedProducts
      ];
      
      // Save to localStorage (you'll need to implement this in storage.ts)
      localStorage.setItem('florist-dashboard-products', JSON.stringify(updatedProducts));
      
      loadData();
      alert(`Successfully synced ${syncedProducts.length} products from ${store.name}`);
    } catch (error) {
      console.error('Error syncing products:', error);
      alert(`Error syncing products from ${store.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(prev => ({ ...prev, [store.id]: false }));
    }
  };

  // Filter products based on search query and selected store
  const filteredProducts = products.filter(product => {
    // Store filter
    if (selectedStore !== 'all' && product.storeId !== selectedStore) {
      return false;
    }
    
    // Search filter
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase().trim();
    return (
      product.name.toLowerCase().includes(query) ||
      (product.variant && product.variant.toLowerCase().includes(query)) ||
      product.difficultyLabel.toLowerCase().includes(query) ||
      product.productTypeLabel.toLowerCase().includes(query) ||
      (product.shopifyId && product.shopifyId.includes(query)) ||
      (product.handle && product.handle.toLowerCase().includes(query))
    );
  });

  // Group filtered products by store
  const productsByStore = filteredProducts.reduce((acc, product) => {
    if (!acc[product.storeId]) {
      acc[product.storeId] = [];
    }
    acc[product.storeId].push(product);
    return acc;
  }, {} as { [storeId: string]: Product[] });

  const clearSearch = () => {
    setSearchQuery('');
  };

  const openShopifyProduct = (product: Product) => {
    if (product.shopifyId && product.handle) {
      const store = getStoreById(product.storeId);
      if (store) {
        const shopifyUrl = `https://${store.domain}/admin/products/${product.shopifyId}`;
        window.open(shopifyUrl, '_blank');
      }
    }
  };

  return (
    <div className={`${isMobileView ? 'space-y-4 p-3' : 'space-y-6'}`}>
      {/* Labels Management Section */}
      <Card>
        <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
          <div className={`flex justify-between ${isMobileView ? 'flex-col gap-2' : 'items-center'}`}>
            <CardTitle className={`flex items-center gap-2 ${isMobileView ? 'text-base' : ''}`}>
              <Tag className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
              {isMobileView ? 'Labels' : 'Product Labels'}
            </CardTitle>
            <Dialog open={isAddingLabel} onOpenChange={setIsAddingLabel}>
              <DialogTrigger asChild>
                <Button size="sm" className={`${isMobileView ? 'w-full' : ''}`}>
                  <Plus className={`${isMobileView ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
                  Add Label
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Product Label</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="labelName">Label Name</Label>
                    <Input
                      id="labelName"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="e.g., Very Hard"
                    />
                  </div>
                  <div>
                    <Label htmlFor="labelCategory">Category</Label>
                    <Select value={newLabelCategory} onValueChange={(value: 'difficulty' | 'productType') => setNewLabelCategory(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="difficulty">Difficulty</SelectItem>
                        <SelectItem value="productType">Product Type</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="labelColor">Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="labelColor"
                        type="color"
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        className="w-12 h-10 rounded border"
                      />
                      <Input
                        value={newLabelColor}
                        onChange={(e) => setNewLabelColor(e.target.value)}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="labelPriority">Priority (lower numbers = higher priority)</Label>
                    <Input
                      id="labelPriority"
                      type="number"
                      min="1"
                      value={newLabelPriority}
                      onChange={(e) => setNewLabelPriority(parseInt(e.target.value) || 1)}
                      placeholder="1"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddingLabel(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddLabel}>
                      Add Label
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
          <div className={`${isMobileView ? 'space-y-3' : 'space-y-4'}`}>
            {/* Difficulty Labels */}
            <div>
              <h4 className={`font-medium text-gray-700 ${isMobileView ? 'text-xs mb-1' : 'text-sm mb-2'}`}>Difficulty Labels</h4>
              <div className={`flex flex-wrap ${isMobileView ? 'gap-1' : 'gap-2'}`}>
                {labels.filter(label => label.category === 'difficulty').sort((a, b) => a.priority - b.priority).map(label => (
                  <div key={label.id} className="flex items-center gap-1">
                    <Badge 
                      style={{ backgroundColor: label.color, color: 'white' }}
                      className={`text-white ${isMobileView ? 'text-xs px-2 py-1' : ''}`}
                    >
                      {label.name} ({label.priority})
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLabel(label.id)}
                      className={`p-0 hover:bg-red-100 ${isMobileView ? 'h-5 w-5' : 'h-6 w-6'}`}
                    >
                      <Trash2 className={`text-red-500 ${isMobileView ? 'h-2 w-2' : 'h-3 w-3'}`} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Type Labels */}
            <div>
              <h4 className={`font-medium text-gray-700 ${isMobileView ? 'text-xs mb-1' : 'text-sm mb-2'}`}>Product Type Labels</h4>
              <div className={`flex flex-wrap ${isMobileView ? 'gap-1' : 'gap-2'}`}>
                {labels.filter(label => label.category === 'productType').sort((a, b) => a.priority - b.priority).map(label => (
                  <div key={label.id} className="flex items-center gap-1">
                    <Badge 
                      style={{ backgroundColor: label.color, color: 'white' }}
                      className={`text-white ${isMobileView ? 'text-xs px-2 py-1' : ''}`}
                    >
                      {label.name} ({label.priority})
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLabel(label.id)}
                      className={`p-0 hover:bg-red-100 ${isMobileView ? 'h-5 w-5' : 'h-6 w-6'}`}
                    >
                      <Trash2 className={`text-red-500 ${isMobileView ? 'h-2 w-2' : 'h-3 w-3'}`} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Selector and Sync Controls */}
      <Card>
        <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
          <CardTitle className={`flex items-center gap-2 ${isMobileView ? 'text-base' : ''}`}>
            <Settings className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
            {isMobileView ? 'Store & Sync' : 'Store Management & Sync'}
          </CardTitle>
        </CardHeader>
        <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
          <div className={`space-y-4 ${isMobileView ? '' : 'flex items-center gap-4'}`}>
            {/* Store Selector */}
            <div className={`${isMobileView ? 'w-full' : 'flex-1'}`}>
              <Label htmlFor="store-select" className={`${isMobileView ? 'text-xs' : 'text-sm'}`}>
                Filter by Store
              </Label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className={`${isMobileView ? 'mt-1' : 'mt-2'}`}>
                  <SelectValue placeholder="Select a store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: store.color }}
                        />
                        {store.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync Buttons */}
            <div className={`${isMobileView ? 'space-y-2' : 'flex gap-2'}`}>
              {stores.map(store => (
                <Button
                  key={store.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleShopifySync(store)}
                  disabled={isSyncing[store.id]}
                  className={`${isMobileView ? 'w-full' : ''}`}
                >
                  <RefreshCw className={`mr-2 ${isSyncing[store.id] ? 'animate-spin' : ''} ${isMobileView ? 'h-3 w-3' : 'h-4 w-4'}`} />
                  {isSyncing[store.id] ? 'Syncing...' : `Sync ${store.name}`}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Bar */}
      <Card>
        <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
          <CardTitle className={`flex items-center gap-2 ${isMobileView ? 'text-base' : ''}`}>
            <Search className={`${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
            {isMobileView ? 'Search Products' : 'Search Products'}
          </CardTitle>
        </CardHeader>
        <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 ${isMobileView ? 'h-4 w-4' : 'h-5 w-5'}`} />
            <Input
              type="text"
              placeholder="Search by product name, variant, difficulty, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 pr-10 ${isMobileView ? 'text-sm' : ''}`}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSearch}
                className={`absolute right-1 top-1/2 transform -translate-y-1/2 p-1 h-auto ${isMobileView ? 'w-6 h-6' : 'w-8 h-8'}`}
              >
                <X className={`text-gray-400 ${isMobileView ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>
            )}
          </div>
          {searchQuery && (
            <div className={`mt-2 text-sm text-gray-600 ${isMobileView ? 'text-xs' : ''}`}>
              Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} matching "{searchQuery}"
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products by Store */}
      {Object.entries(productsByStore).map(([storeId, storeProducts]) => {
        const store = getStoreById(storeId);
        return (
          <Card key={storeId}>
            <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
              <CardTitle className={`flex items-center gap-2 ${isMobileView ? 'text-base' : ''}`}>
                <div 
                  className={`${isMobileView ? 'w-3 h-3' : 'w-4 h-4'} rounded-full`} 
                  style={{ backgroundColor: store?.color || '#gray' }}
                />
                {store?.name || 'Unknown Store'}
                <span className={`font-normal text-gray-500 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  ({storeProducts.length} products)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
              <div className={`${isMobileView ? 'space-y-2' : 'space-y-3'}`}>
                {storeProducts.map(product => {
                  const currentDifficultyLabel = getLabelByName(product.difficultyLabel);
                  const currentProductTypeLabel = getLabelByName(product.productTypeLabel);
                  return (
                    <div key={product.id} className={`border rounded-lg ${isMobileView ? 'p-2 space-y-2' : 'flex items-center justify-between p-3'}`}>
                      <div className={`${isMobileView ? '' : 'flex-1'}`}>
                        <div className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                          {product.name}
                          {product.shopifyId && (
                            <span className="ml-2 text-xs text-gray-500 font-mono">
                              #{product.shopifyId}
                            </span>
                          )}
                        </div>
                        {product.variant && (
                          <div className={`text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>{product.variant}</div>
                        )}
                        {product.handle && (
                          <div className={`text-blue-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                            /products/{product.handle}
                          </div>
                        )}
                        {product.status && (
                          <Badge 
                            variant={product.status === 'active' ? 'default' : 'secondary'}
                            className={`mt-1 ${isMobileView ? 'text-xs' : ''}`}
                          >
                            {product.status}
                          </Badge>
                        )}
                      </div>
                      <div className={`${isMobileView ? 'space-y-2' : 'flex items-center gap-3'}`}>
                        {/* Shopify Link Button */}
                        {product.shopifyId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openShopifyProduct(product)}
                            className={`p-2 ${isMobileView ? 'h-8 w-8' : 'h-8 w-8'}`}
                            title="Open in Shopify Admin"
                          >
                            <ExternalLink className={`${isMobileView ? 'h-3 w-3' : 'h-4 w-4'}`} />
                          </Button>
                        )}

                        {/* Difficulty Label */}
                        <div className={`flex items-center ${isMobileView ? 'gap-1' : 'gap-2'}`}>
                          <span className={`text-gray-500 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Difficulty:</span>
                          <Select
                            value={product.difficultyLabel}
                            onValueChange={(value) => handleUpdateProductDifficultyLabel(product.id, value)}
                          >
                            <SelectTrigger className={`${isMobileView ? 'w-24' : 'w-32'}`}>
                              <SelectValue>
                                {currentDifficultyLabel && (
                                  <Badge 
                                    style={{ backgroundColor: currentDifficultyLabel.color, color: 'white' }}
                                    className={`text-white ${isMobileView ? 'text-[10px] px-1 py-0' : 'text-xs'}`}
                                  >
                                    {currentDifficultyLabel.name}
                                  </Badge>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {labels.filter(label => label.category === 'difficulty').sort((a, b) => a.priority - b.priority).map(label => (
                                <SelectItem key={label.id} value={label.name}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: label.color }}
                                    />
                                    {label.name} (Priority: {label.priority})
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Product Type Label */}
                        <div className={`flex items-center ${isMobileView ? 'gap-1' : 'gap-2'}`}>
                          <span className={`text-gray-500 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Type:</span>
                          <Select
                            value={product.productTypeLabel}
                            onValueChange={(value) => handleUpdateProductTypeLabel(product.id, value)}
                          >
                            <SelectTrigger className={`${isMobileView ? 'w-24' : 'w-32'}`}>
                              <SelectValue>
                                {currentProductTypeLabel && (
                                  <Badge 
                                    style={{ backgroundColor: currentProductTypeLabel.color, color: 'white' }}
                                    className={`text-white ${isMobileView ? 'text-[10px] px-1 py-0' : 'text-xs'}`}
                                  >
                                    {currentProductTypeLabel.name}
                                  </Badge>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {labels.filter(label => label.category === 'productType').sort((a, b) => a.priority - b.priority).map(label => (
                                <SelectItem key={label.id} value={label.name}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: label.color }}
                                    />
                                    {label.name} (Priority: {label.priority})
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}