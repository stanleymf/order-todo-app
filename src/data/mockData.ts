import type { User, Product, Order, FloristStats, Store } from '../types';

export const mockUsers: User[] = [
  {
    id: 'admin-1',
    name: 'Sarah Manager',
    role: 'admin',
    email: 'sarah@floralshop.com'
  },
  {
    id: 'florist-1',
    name: 'Maya',
    role: 'florist',
    email: 'maya@floralshop.com'
  },
  {
    id: 'florist-2',
    name: 'Jenny',
    role: 'florist',
    email: 'jenny@floralshop.com'
  },
  {
    id: 'florist-3',
    name: 'Serena',
    role: 'florist',
    email: 'serena@floralshop.com'
  },
  {
    id: 'florist-4',
    name: 'Julie',
    role: 'florist',
    email: 'julie@floralshop.com'
  },
  {
    id: 'florist-5',
    name: 'Enie',
    role: 'florist',
    email: 'enie@floralshop.com'
  }
];

export const mockStores: Store[] = [
  {
    id: 'store-1',
    name: 'Windflower Florist',
    domain: 'windflower-florist.myshopify.com',
    color: '#10B981' // emerald-500
  },
  {
    id: 'store-2',
    name: 'Bloom & Co',
    domain: 'bloom-and-co.myshopify.com',
    color: '#8B5CF6' // violet-500
  },
  {
    id: 'store-3',
    name: 'Garden Dreams',
    domain: 'garden-dreams.myshopify.com',
    color: '#F59E0B' // amber-500
  }
];

export const mockProducts: Product[] = [
  // Windflower Florist products
  {
    id: 'prod-1',
    name: 'Trio Matthiola in White',
    variant: 'Bouquet',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  {
    id: 'prod-2',
    name: 'Unconditional Love',
    variant: '7 stalks',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  {
    id: 'prod-3',
    name: 'Windflower x Sarah\'s Loft Cupcake Bundle',
    variant: 'Bright Smile',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Bundle',
    storeId: 'store-1'
  },
  {
    id: 'prod-4',
    name: 'Daily Surprise - Fresh Flowers',
    variant: 'Warm Pastels / Small',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  {
    id: 'prod-15',
    name: 'Rose Elegance',
    variant: 'Red Roses / 12 stalks',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  {
    id: 'prod-16',
    name: 'Sunflower Delight',
    variant: 'Bright Yellow / Large',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Arrangement',
    storeId: 'store-1'
  },
  {
    id: 'prod-17',
    name: 'Orchid Paradise',
    variant: 'Purple Orchids / Premium',
    difficultyLabel: 'Very Hard',
    productTypeLabel: 'Arrangement',
    storeId: 'store-1'
  },
  {
    id: 'prod-18',
    name: 'Lily Bouquet',
    variant: 'White Lilies / 6 stalks',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  {
    id: 'prod-19',
    name: 'Carnation Mix',
    variant: 'Assorted Colors / Medium',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Arrangement',
    storeId: 'store-1'
  },
  {
    id: 'prod-20',
    name: 'Peony Collection',
    variant: 'Pink Peonies / Seasonal',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Bouquet',
    storeId: 'store-1'
  },
  // Bloom & Co products
  {
    id: 'prod-5',
    name: 'Marigold Elegance',
    variant: 'Bouquet / Double Down',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Bouquet',
    storeId: 'store-2'
  },
  {
    id: 'prod-6',
    name: 'Infinity Love In White',
    variant: 'Vase / Standard',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Vase',
    storeId: 'store-2'
  },
  {
    id: 'prod-7',
    name: 'Tulip White',
    variant: '3 Stalks / Vase',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Vase',
    storeId: 'store-2'
  },
  {
    id: 'prod-8',
    name: 'Ruby Quartz Vase',
    variant: '',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Vase',
    storeId: 'store-2'
  },
  // Garden Dreams products
  {
    id: 'prod-9',
    name: 'Celestial Blue Romance',
    variant: '',
    difficultyLabel: 'Very Hard',
    productTypeLabel: 'Arrangement',
    storeId: 'store-3'
  },
  {
    id: 'prod-10',
    name: 'Sunrise Bouquet',
    variant: 'Fresh Flowers - Warm Pastels / Large',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Bouquet',
    storeId: 'store-3'
  },
  {
    id: 'prod-11',
    name: 'Garden Party Mix',
    variant: 'Seasonal Selection',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Arrangement',
    storeId: 'store-3'
  },
  {
    id: 'prod-12',
    name: 'Dreamy Whites',
    variant: 'Premium Collection',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Wreath',
    storeId: 'store-3'
  }
];

const today = new Date().toISOString().split('T')[0];

// Helper function to generate random order data
const generateWindflowerOrder = (index: number): Order => {
  const products = mockProducts.filter(p => p.storeId === 'store-1');
  const product = products[index % products.length];
  const florists = ['florist-1', 'florist-2', 'florist-3', 'florist-4', 'florist-5'];
  const timeslots = [
    '10:00 AM - 02:00 PM',
    '02:00 PM - 06:00 PM',
    '06:00 PM - 10:00 PM'
  ];
  
  const shouldAssign = Math.random() > 0.3; // 70% chance of being assigned
  const shouldComplete = shouldAssign && Math.random() > 0.6; // 40% of assigned orders are completed
  
  let assignedFloristId: string | undefined;
  let assignedAt: Date | undefined;
  let completedAt: Date | undefined;
  let status: 'pending' | 'assigned' | 'completed' = 'pending';
  
  if (shouldAssign) {
    assignedFloristId = florists[Math.floor(Math.random() * florists.length)];
    assignedAt = new Date(Date.now() - Math.random() * 6 * 60 * 60 * 1000); // Random time in last 6 hours
    status = 'assigned';
    
    if (shouldComplete) {
      completedAt = new Date(assignedAt.getTime() + Math.random() * 2 * 60 * 60 * 1000); // Completed within 2 hours of assignment
      status = 'completed';
    }
  }
  
  const remarks = Math.random() > 0.8 ? [
    'Handle with extra care',
    'Customer requested specific delivery time',
    'Include care instructions',
    'Gift wrapping required',
    'Fragile - special packaging needed'
  ][Math.floor(Math.random() * 5)] : '';
  
  return {
    id: `WF${75000 + index}`,
    storeId: 'store-1',
    productId: product.id,
    productName: product.name,
    productVariant: product.variant,
    difficultyLabel: product.difficultyLabel || 'Easy', // Inherit difficulty label from product
    productTypeLabel: product.productTypeLabel || 'Bouquet', // Inherit product type label from product
    timeslot: timeslots[Math.floor(Math.random() * timeslots.length)],
    remarks,
    assignedFloristId,
    assignedAt,
    completedAt,
    status,
    date: today
  };
};

export const mockOrders: Order[] = [
  // Generate 50 Windflower Florist orders
  ...Array.from({ length: 50 }, (_, index) => generateWindflowerOrder(index)),
  
  // Bloom & Co orders (keeping original smaller set)
  {
    id: 'BC76024',
    storeId: 'store-2',
    productId: 'prod-5',
    productName: 'Marigold Elegance',
    productVariant: 'Bouquet / Double Down',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Bouquet',
    timeslot: '10:00 AM - 02:00 PM',
    remarks: '',
    status: 'pending',
    date: today
  },
  {
    id: 'BC76033',
    storeId: 'store-2',
    productId: 'prod-6',
    productName: 'Infinity Love In White',
    productVariant: 'Vase / Standard',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Vase',
    timeslot: '10:00 AM - 02:00 PM',
    remarks: '',
    status: 'pending',
    date: today
  },
  {
    id: 'BC76041',
    storeId: 'store-2',
    productId: 'prod-7',
    productName: 'Tulip White',
    productVariant: '3 Stalks / Vase',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Vase',
    timeslot: '10:00 AM - 02:00 PM',
    remarks: '',
    status: 'pending',
    date: today
  },
  {
    id: 'BC74768',
    storeId: 'store-2',
    productId: 'prod-8',
    productName: 'Ruby Quartz Vase',
    productVariant: '',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Vase',
    timeslot: '02:00 PM - 06:00 PM',
    remarks: '',
    assignedFloristId: 'florist-5',
    assignedAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    status: 'assigned',
    date: today
  },
  {
    id: 'BC76019',
    storeId: 'store-2',
    productId: 'prod-6',
    productName: 'Infinity Love In White',
    productVariant: 'Vase / Standard',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Vase',
    timeslot: '02:00 PM - 06:00 PM',
    remarks: '',
    assignedFloristId: 'florist-2',
    assignedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'completed',
    date: today
  },
  
  // Garden Dreams orders (keeping original smaller set)
  {
    id: 'GD75718',
    storeId: 'store-3',
    productId: 'prod-9',
    productName: 'Celestial Blue Romance',
    productVariant: '',
    difficultyLabel: 'Very Hard',
    productTypeLabel: 'Arrangement',
    timeslot: '06:00 PM - 10:00 PM',
    remarks: '',
    status: 'pending',
    date: today
  },
  {
    id: 'GD75617',
    storeId: 'store-3',
    productId: 'prod-10',
    productName: 'Sunrise Bouquet',
    productVariant: 'Fresh Flowers - Warm Pastels / Large',
    difficultyLabel: 'Easy',
    productTypeLabel: 'Bouquet',
    timeslot: '10:00 AM - 02:00 PM',
    remarks: '',
    assignedFloristId: 'florist-4',
    assignedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
    status: 'assigned',
    date: today
  },
  {
    id: 'GD75621',
    storeId: 'store-3',
    productId: 'prod-11',
    productName: 'Garden Party Mix',
    productVariant: 'Seasonal Selection',
    difficultyLabel: 'Medium',
    productTypeLabel: 'Arrangement',
    timeslot: '02:00 PM - 06:00 PM',
    remarks: 'Customer requested extra care with packaging',
    status: 'pending',
    date: today
  },
  {
    id: 'GD76055',
    storeId: 'store-3',
    productId: 'prod-12',
    productName: 'Dreamy Whites',
    productVariant: 'Premium Collection',
    difficultyLabel: 'Hard',
    productTypeLabel: 'Wreath',
    timeslot: '02:00 PM - 06:00 PM',
    remarks: '',
    assignedFloristId: 'florist-3',
    assignedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000), // 2.5 hours ago
    completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    status: 'completed',
    date: today
  }
];

export const mockFloristStats: FloristStats[] = [
  {
    floristId: 'florist-1',
    floristName: 'Maya',
    completedOrders: 23,
    averageCompletionTime: 45,
    storeBreakdown: {
      'store-1': { orders: 12, avgTime: 42 },
      'store-2': { orders: 8, avgTime: 48 },
      'store-3': { orders: 3, avgTime: 50 }
    }
  },
  {
    floristId: 'florist-2',
    floristName: 'Jenny',
    completedOrders: 19,
    averageCompletionTime: 52,
    storeBreakdown: {
      'store-1': { orders: 7, avgTime: 55 },
      'store-2': { orders: 9, avgTime: 49 },
      'store-3': { orders: 3, avgTime: 53 }
    }
  },
  {
    floristId: 'florist-3',
    floristName: 'Serena',
    completedOrders: 21,
    averageCompletionTime: 38,
    storeBreakdown: {
      'store-1': { orders: 8, avgTime: 35 },
      'store-2': { orders: 6, avgTime: 40 },
      'store-3': { orders: 7, avgTime: 40 }
    }
  },
  {
    floristId: 'florist-4',
    floristName: 'Julie',
    completedOrders: 17,
    averageCompletionTime: 41,
    storeBreakdown: {
      'store-1': { orders: 5, avgTime: 38 },
      'store-2': { orders: 4, avgTime: 45 },
      'store-3': { orders: 8, avgTime: 42 }
    }
  },
  {
    floristId: 'florist-5',
    floristName: 'Enie',
    completedOrders: 25,
    averageCompletionTime: 35,
    storeBreakdown: {
      'store-1': { orders: 10, avgTime: 33 },
      'store-2': { orders: 11, avgTime: 36 },
      'store-3': { orders: 4, avgTime: 38 }
    }
  }
];