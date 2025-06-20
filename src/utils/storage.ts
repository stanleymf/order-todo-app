import type { User, Order, Product, ProductLabel, FloristStats, AuthState, Store } from '../types';
import { mockUsers, mockOrders, mockProducts, mockFloristStats, mockStores } from '../data/mockData';

const STORAGE_KEYS = {
  AUTH: 'florist-dashboard-auth',
  ORDERS: 'florist-dashboard-orders',
  PRODUCTS: 'florist-dashboard-products',
  PRODUCT_LABELS: 'florist-dashboard-product-labels',
  STATS: 'florist-dashboard-stats',
  STORES: 'florist-dashboard-stores'
};

// Default product labels
const defaultProductLabels: ProductLabel[] = [
  // Difficulty labels
  { id: '1', name: 'Easy', color: '#22c55e', category: 'difficulty', priority: 1, createdAt: new Date() },
  { id: '2', name: 'Medium', color: '#eab308', category: 'difficulty', priority: 2, createdAt: new Date() },
  { id: '3', name: 'Hard', color: '#f97316', category: 'difficulty', priority: 3, createdAt: new Date() },
  { id: '4', name: 'Very Hard', color: '#ef4444', category: 'difficulty', priority: 4, createdAt: new Date() },
  // Product type labels
  { id: '5', name: 'Bouquet', color: '#8b5cf6', category: 'productType', priority: 1, createdAt: new Date() },
  { id: '6', name: 'Vase', color: '#3b82f6', category: 'productType', priority: 2, createdAt: new Date() },
  { id: '7', name: 'Arrangement', color: '#10b981', category: 'productType', priority: 3, createdAt: new Date() },
  { id: '8', name: 'Wreath', color: '#f59e0b', category: 'productType', priority: 4, createdAt: new Date() },
  { id: '9', name: 'Bundle', color: '#ec4899', category: 'productType', priority: 5, createdAt: new Date() }
];

// Initialize localStorage with mock data if not present
export const initializeStorage = () => {
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mockOrders));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mockProducts));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCT_LABELS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCT_LABELS, JSON.stringify(defaultProductLabels));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STATS)) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(mockFloristStats));
  }
  if (!localStorage.getItem(STORAGE_KEYS.STORES)) {
    localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(mockStores));
  }
};

// Force refresh localStorage with latest mock data
export const refreshMockData = () => {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mockOrders));
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mockProducts));
  localStorage.setItem(STORAGE_KEYS.PRODUCT_LABELS, JSON.stringify(defaultProductLabels));
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(mockFloristStats));
  localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(mockStores));
};

// Auth functions
export const getAuthState = (): AuthState => {
  const stored = localStorage.getItem(STORAGE_KEYS.AUTH);
  if (stored) {
    return JSON.parse(stored);
  }
  return { user: null, isAuthenticated: false };
};

export const setAuthState = (authState: AuthState) => {
  localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(authState));
};

export const login = (email: string, password: string): User | null => {
  // Simple mock authentication
  const user = mockUsers.find(u => u.email === email);
  if (user && password === 'password') {
    const authState: AuthState = { user, isAuthenticated: true };
    setAuthState(authState);
    return user;
  }
  return null;
};

export const logout = () => {
  localStorage.removeItem(STORAGE_KEYS.AUTH);
};

// Stores functions
export const getStores = (): Store[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.STORES);
  return stored ? JSON.parse(stored) : [];
};

export const saveStores = (stores: Store[]) => {
  localStorage.setItem(STORAGE_KEYS.STORES, JSON.stringify(stores));
};

// Product Labels functions
export const getProductLabels = (): ProductLabel[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.PRODUCT_LABELS);
  if (stored) {
    const labels = JSON.parse(stored);
    return labels.map((label: any, index: number) => ({
      ...label,
      priority: label.priority ?? (index + 1), // Assign default priority if missing
      createdAt: new Date(label.createdAt)
    }));
  }
  return defaultProductLabels;
};

export const saveProductLabels = (labels: ProductLabel[]) => {
  localStorage.setItem(STORAGE_KEYS.PRODUCT_LABELS, JSON.stringify(labels));
};

export const addProductLabel = (name: string, color: string, category: 'difficulty' | 'productType', priority: number): ProductLabel => {
  const labels = getProductLabels();
  const newLabel: ProductLabel = {
    id: Date.now().toString(),
    name,
    color,
    category,
    priority,
    createdAt: new Date()
  };
  labels.push(newLabel);
  saveProductLabels(labels);
  return newLabel;
};

export const deleteProductLabel = (labelId: string) => {
  const labels = getProductLabels();
  const labelToDelete = labels.find(l => l.id === labelId);
  if (!labelToDelete) return;
  
  const filteredLabels = labels.filter(label => label.id !== labelId);
  saveProductLabels(filteredLabels);
  
  // Update any products/orders using this label to use a default label
  const products = getProducts();
  const orders = getOrders();
  
  // Find default label for the same category
  const defaultLabel = filteredLabels.find(l => l.category === labelToDelete.category)?.name || 
    (labelToDelete.category === 'difficulty' ? 'Easy' : 'Bouquet');
  
  // Update products
  const updatedProducts = products.map(product => {
    if (labelToDelete.category === 'difficulty' && product.difficultyLabel === labelToDelete.name) {
      return { ...product, difficultyLabel: defaultLabel };
    } else if (labelToDelete.category === 'productType' && product.productTypeLabel === labelToDelete.name) {
      return { ...product, productTypeLabel: defaultLabel };
    }
    return product;
  });
  saveProducts(updatedProducts);
  
  // Update orders
  const updatedOrders = orders.map(order => {
    if (labelToDelete.category === 'difficulty' && order.difficultyLabel === labelToDelete.name) {
      return { ...order, difficultyLabel: defaultLabel };
    } else if (labelToDelete.category === 'productType' && order.productTypeLabel === labelToDelete.name) {
      return { ...order, productTypeLabel: defaultLabel };
    }
    return order;
  });
  saveOrders(updatedOrders);
};

// Orders functions
export const getOrders = (): Order[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ORDERS);
  if (stored) {
    const orders = JSON.parse(stored);
    // Convert date strings back to Date objects
    return orders.map((order: any) => ({
      ...order,
      assignedAt: order.assignedAt ? new Date(order.assignedAt) : undefined,
      completedAt: order.completedAt ? new Date(order.completedAt) : undefined
    }));
  }
  return [];
};

export const saveOrders = (orders: Order[]) => {
  localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
};

export const getOrdersByDate = (date: string): Order[] => {
  const orders = getOrders();
  return orders.filter(order => order.date === date);
};

export const getOrdersByDateAndStore = (date: string, storeId?: string): Order[] => {
  const orders = getOrdersByDate(date);
  if (!storeId) return orders;
  return orders.filter(order => order.storeId === storeId);
};

export const getOrdersByDateStoreAndLabels = (
  date: string, 
  storeId?: string, 
  difficultyLabel?: string, 
  productTypeLabel?: string
): Order[] => {
  let orders = getOrdersByDate(date);
  
  if (storeId) {
    orders = orders.filter(order => order.storeId === storeId);
  }
  
  if (difficultyLabel) {
    orders = orders.filter(order => order.difficultyLabel === difficultyLabel);
  }
  
  if (productTypeLabel) {
    orders = orders.filter(order => order.productTypeLabel === productTypeLabel);
  }
  
  return orders;
};

export const assignOrder = (orderId: string, floristId: string) => {
  const orders = getOrders();
  const orderIndex = orders.findIndex(order => order.id === orderId);
  if (orderIndex !== -1) {
    if (floristId === 'unassigned') {
      // Unassign the order
      orders[orderIndex] = {
        ...orders[orderIndex],
        assignedFloristId: undefined,
        assignedAt: undefined,
        status: 'pending'
      };
    } else {
      // Assign to florist
      orders[orderIndex] = {
        ...orders[orderIndex],
        assignedFloristId: floristId,
        assignedAt: new Date(),
        status: 'assigned'
      };
    }
    saveOrders(orders);
  }
};

export const completeOrder = (orderId: string) => {
  const orders = getOrders();
  const orderIndex = orders.findIndex(order => order.id === orderId);
  if (orderIndex !== -1) {
    const order = orders[orderIndex];
    
    if (order.status === 'completed') {
      // Toggle back to previous status
      const previousStatus = order.assignedFloristId ? 'assigned' : 'pending';
      orders[orderIndex] = {
        ...order,
        status: previousStatus,
        completedAt: undefined
      };
    } else {
      // Mark as completed
      orders[orderIndex] = {
        ...order,
        status: 'completed',
        completedAt: new Date()
      };
    }
    
    saveOrders(orders);
  }
};

export const updateOrderRemarks = (orderId: string, remarks: string) => {
  const orders = getOrders();
  const orderIndex = orders.findIndex(order => order.id === orderId);
  if (orderIndex !== -1) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      remarks
    };
    saveOrders(orders);
  }
};

export const updateProductCustomizations = (orderId: string, customizations: string) => {
  const orders = getOrders();
  const orderIndex = orders.findIndex(order => order.id === orderId);
  if (orderIndex !== -1) {
    orders[orderIndex] = {
      ...orders[orderIndex],
      productCustomizations: customizations
    };
    saveOrders(orders);
  }
};

// Products functions
export const getProducts = (): Product[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  return stored ? JSON.parse(stored) : [];
};

export const getProductsByStore = (storeId: string): Product[] => {
  const products = getProducts();
  return products.filter(product => product.storeId === storeId);
};

export const saveProducts = (products: Product[]) => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
};

export const updateProductDifficultyLabel = (productId: string, difficultyLabel: string) => {
  const products = getProducts();
  const productIndex = products.findIndex(product => product.id === productId);
  if (productIndex !== -1) {
    products[productIndex] = {
      ...products[productIndex],
      difficultyLabel: difficultyLabel
    };
    saveProducts(products);
    
    // Also update any existing orders with this product
    const orders = getOrders();
    const updatedOrders = orders.map(order => 
      order.productId === productId 
        ? { ...order, difficultyLabel }
        : order
    );
    saveOrders(updatedOrders);
  }
};

export const updateProductTypeLabel = (productId: string, productTypeLabel: string) => {
  const products = getProducts();
  const productIndex = products.findIndex(product => product.id === productId);
  if (productIndex !== -1) {
    products[productIndex] = {
      ...products[productIndex],
      productTypeLabel: productTypeLabel
    };
    saveProducts(products);
    
    // Also update any existing orders with this product
    const orders = getOrders();
    const updatedOrders = orders.map(order => 
      order.productId === productId 
        ? { ...order, productTypeLabel }
        : order
    );
    saveOrders(updatedOrders);
  }
};

// Users functions
export const getUsers = (): User[] => {
  return mockUsers;
};

export const getFlorists = (): User[] => {
  return mockUsers.filter(user => user.role === 'florist');
};

// Helper function to calculate completion rate accounting for batch processing
const calculateCompletionRate = (floristOrders: Order[]) => {
  if (floristOrders.length === 0) return 0;

  // Group orders by date to calculate daily work sessions
  const ordersByDate: { [date: string]: Order[] } = {};
  
  for (const order of floristOrders) {
    if (!ordersByDate[order.date]) {
      ordersByDate[order.date] = [];
    }
    ordersByDate[order.date].push(order);
  }

  let totalWorkTimeMinutes = 0;
  let totalOrdersCompleted = 0;

  // Calculate work time for each day
  for (const dayOrders of Object.values(ordersByDate)) {
    const ordersWithTimes = dayOrders.filter(order => order.assignedAt && order.completedAt);
    
    if (ordersWithTimes.length === 0) continue;

    // Find the earliest assignment time and latest completion time for the day
    const assignmentTimes = ordersWithTimes.map(order => order.assignedAt!.getTime());
    const completionTimes = ordersWithTimes.map(order => order.completedAt!.getTime());
    
    const earliestAssignment = Math.min(...assignmentTimes);
    const latestCompletion = Math.max(...completionTimes);
    
    // Total work time for the day (from first assignment to last completion)
    const dayWorkTime = (latestCompletion - earliestAssignment) / (1000 * 60); // Convert to minutes
    
    totalWorkTimeMinutes += dayWorkTime;
    totalOrdersCompleted += ordersWithTimes.length;
  }

  // Return average minutes per order
  return totalOrdersCompleted > 0 ? Math.round(totalWorkTimeMinutes / totalOrdersCompleted) : 0;
};

// Stats functions
export const getFloristStats = (): FloristStats[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.STATS);
  return stored ? JSON.parse(stored) : [];
};

export const updateFloristStats = () => {
  const orders = getOrders();
  const florists = getFlorists();
  const stores = getStores();
  
  const stats: FloristStats[] = florists.map(florist => {
    const floristOrders = orders.filter(order => 
      order.assignedFloristId === florist.id && order.status === 'completed'
    );
    
    const completedOrders = floristOrders.length;
    const averageCompletionTime = calculateCompletionRate(floristOrders);
    
    // Calculate store breakdown using the same logic
    const storeBreakdown: { [storeId: string]: { orders: number; avgTime: number } } = {};
    
    for (const store of stores) {
      const storeOrders = floristOrders.filter(order => order.storeId === store.id);
      const storeOrderCount = storeOrders.length;
      const storeAvgTime = calculateCompletionRate(storeOrders);
      
      if (storeOrderCount > 0) {
        storeBreakdown[store.id] = {
          orders: storeOrderCount,
          avgTime: storeAvgTime
        };
      }
    }
    
    return {
      floristId: florist.id,
      floristName: florist.name,
      completedOrders,
      averageCompletionTime,
      storeBreakdown
    };
  });
  
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  return stats;
};