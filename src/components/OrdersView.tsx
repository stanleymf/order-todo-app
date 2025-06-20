import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, Package, Users, CheckCircle, Search, X, UserPlus, UserMinus } from 'lucide-react';
import { format } from 'date-fns';
import { OrderCard } from './OrderCard';
import { useMobileView } from './Dashboard';
import type { User, Order, Store } from '../types';
import { 
  getOrdersByDateStoreAndLabels, 
  getStores, 
  getFlorists, 
  getProductLabels,
  updateFloristStats,
  assignOrder
} from '../utils/storage';

interface OrdersViewProps {
  currentUser: User;
}

export function OrdersView({ currentUser }: OrdersViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [selectedStore, setSelectedStore] = useState<string>('all');
  const [selectedDifficultyLabel, setSelectedDifficultyLabel] = useState<string>('all');
  const [selectedProductTypeLabel, setSelectedProductTypeLabel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // New status filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [florists, setFlorists] = useState<User[]>([]);
  const [productLabels, setProductLabels] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  
  // Get mobile view context
  const { isMobileView } = useMobileView();

  // Sorting function with hierarchical order
  const sortOrders = (orders: Order[]) => {
    const labels = getProductLabels();
    
    return orders.sort((a, b) => {
      // 1. Assigned florist (current user's assignments first)
      const floristA = getFloristPriority(a.assignedFloristId);
      const floristB = getFloristPriority(b.assignedFloristId);
      if (floristA !== floristB) {
        return floristA - floristB;
      }
      
      // 2. Timeslot (earlier times first)
      const timeA = parseTimeSlot(a.timeslot);
      const timeB = parseTimeSlot(b.timeslot);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      
      // 3. Product titles (alphabetical, same titles grouped)
      const productComparison = a.productName.localeCompare(b.productName);
      if (productComparison !== 0) {
        return productComparison;
      }
      
      // 4. Difficulty (based on product labelling and current filtering)
      const difficultyA = getDifficultyPriority(a.difficultyLabel, labels);
      const difficultyB = getDifficultyPriority(b.difficultyLabel, labels);
      if (difficultyA !== difficultyB) {
        return difficultyA - difficultyB;
      }
      
      // 5. Product type (based on product labelling and current filtering)
      const productTypeA = getProductTypePriority(a.productTypeLabel, labels);
      const productTypeB = getProductTypePriority(b.productTypeLabel, labels);
      return productTypeA - productTypeB;
    });
  };

  // Helper function to parse timeslot into comparable number
  const parseTimeSlot = (timeslot: string): number => {
    try {
      // Extract start time from timeslot (e.g., "9:00 AM - 11:00 AM" -> "9:00 AM")
      const startTime = timeslot.split(' - ')[0];
      const [time, period] = startTime.split(' ');
      const [hours, minutes] = time.split(':').map(num => parseInt(num));
      
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) hour24 += 12;
      if (period === 'AM' && hours === 12) hour24 = 0;
      
      return hour24 * 60 + minutes; // Convert to minutes for comparison
    } catch {
      return 9999; // Put invalid times at the end
    }
  };

  // Helper function to get difficulty priority
  const getDifficultyPriority = (difficultyLabel: string, labels: any[]): number => {
    const difficultyLabels = labels.filter(label => label.category === 'difficulty');
    const label = difficultyLabels.find(label => label.name === difficultyLabel);
    return label ? label.priority : 9999; // Unknown difficulties go to end
  };

  // Helper function to get product type priority
  const getProductTypePriority = (productTypeLabel: string, labels: any[]): number => {
    const productTypeLabels = labels.filter(label => label.category === 'productType');
    const label = productTypeLabels.find(label => label.name === productTypeLabel);
    return label ? label.priority : 9999; // Unknown types go to end
  };

  // Helper function to get florist assignment priority (current user first)
  const getFloristPriority = (assignedFloristId?: string): number => {
    if (!assignedFloristId) {
      return 2; // Unassigned orders come after current user's orders but before other florists'
    }
    if (assignedFloristId === currentUser.id) {
      return 1; // Current user's orders come first
    }
    return 3; // Other florists' orders come last
  };

  const loadData = useCallback(() => {
    const storeId = selectedStore === 'all' ? undefined : selectedStore;
    const difficultyLabel = selectedDifficultyLabel === 'all' ? undefined : selectedDifficultyLabel;
    const productTypeLabel = selectedProductTypeLabel === 'all' ? undefined : selectedProductTypeLabel;
    let filteredOrders = getOrdersByDateStoreAndLabels(selectedDate, storeId, difficultyLabel, productTypeLabel);
    
    // Apply status filter
    if (selectedStatus !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === selectedStatus);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredOrders = filteredOrders.filter(order => 
        order.productName.toLowerCase().includes(query) ||
        order.productVariant.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query) ||
        (order.remarks && order.remarks.toLowerCase().includes(query)) ||
        (order.productCustomizations && order.productCustomizations.toLowerCase().includes(query)) ||
        order.difficultyLabel.toLowerCase().includes(query) ||
        order.productTypeLabel.toLowerCase().includes(query) ||
        order.timeslot.toLowerCase().includes(query)
      );
    }
    
    // Apply hierarchical sorting
    filteredOrders = sortOrders(filteredOrders);
    
    setOrders(filteredOrders);
    setStores(getStores());
    setFlorists(getFlorists());
    setProductLabels(getProductLabels());
  }, [selectedDate, selectedStore, selectedDifficultyLabel, selectedProductTypeLabel, selectedStatus, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderUpdate = () => {
    loadData();
    updateFloristStats();
  };

  // Handle status filter clicks
  const handleStatusFilter = (status: string) => {
    if (selectedStatus === status) {
      // If already selected, reset to show all
      setSelectedStatus('all');
    } else {
      // Select the new status
      setSelectedStatus(status);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setCalendarDate(date);
      setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  // Batch selection handlers
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedOrderIds(new Set());
  };

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const selectAllOrders = () => {
    const allOrderIds = new Set(orders.map(order => order.id));
    setSelectedOrderIds(allOrderIds);
  };

  const clearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  const batchAssignToMe = () => {
    selectedOrderIds.forEach(orderId => {
      assignOrder(orderId, currentUser.id);
    });
    setSelectedOrderIds(new Set());
    handleOrderUpdate();
  };

  const batchUnassign = () => {
    selectedOrderIds.forEach(orderId => {
      assignOrder(orderId, 'unassigned');
    });
    setSelectedOrderIds(new Set());
    handleOrderUpdate();
  };

  // Calculate order statistics
  const getOrderStats = (storeOrders: Order[]) => {
    const pending = storeOrders.filter(order => order.status === 'pending').length;
    const assigned = storeOrders.filter(order => order.status === 'assigned').length;
    const completed = storeOrders.filter(order => order.status === 'completed').length;
    const total = storeOrders.length;
    
    return { pending, assigned, completed, total };
  };

  // Get unfiltered orders for stats display (so users can see total counts)
  const getUnfilteredOrders = () => {
    const storeId = selectedStore === 'all' ? undefined : selectedStore;
    const difficultyLabel = selectedDifficultyLabel === 'all' ? undefined : selectedDifficultyLabel;
    const productTypeLabel = selectedProductTypeLabel === 'all' ? undefined : selectedProductTypeLabel;
    return getOrdersByDateStoreAndLabels(selectedDate, storeId, difficultyLabel, productTypeLabel);
  };

  const unfilteredOrders = getUnfilteredOrders();

  // Group orders by store for multi-store view
  const ordersByStore = stores.reduce((acc, store) => {
    const storeOrders = orders.filter(order => order.storeId === store.id);
    if (storeOrders.length > 0) {
      acc[store.id] = {
        store,
        orders: sortOrders(storeOrders), // Apply sorting to store orders
        stats: getOrderStats(storeOrders)
      };
    }
    return acc;
  }, {} as { [storeId: string]: { store: Store; orders: Order[]; stats: any } });

  const totalStats = getOrderStats(unfilteredOrders);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className={`flex gap-4 items-start justify-between ${isMobileView ? 'flex-col' : 'flex-col sm:flex-row sm:items-center'}`}>
        <div>
          <div className="flex items-center gap-3">
            <h2 className={`font-bold text-gray-900 ${isMobileView ? 'text-lg' : 'text-2xl'}`}>
              {isMobileView ? 'Orders' : 'Orders Dashboard'}
            </h2>
            {selectedStatus !== 'all' && (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  selectedStatus === 'pending' ? 'bg-orange-500' : 
                  selectedStatus === 'assigned' ? 'bg-blue-500' : 
                  'bg-green-500'
                }`} />
                <span className={`text-gray-600 capitalize ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                  Showing {selectedStatus} orders
                </span>
                <button 
                  onClick={() => setSelectedStatus('all')}
                  className="text-gray-400 hover:text-gray-600 ml-1"
                  title="Clear filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
          {!isMobileView && selectedStatus === 'all' && (
            <p className="text-gray-600">Manage daily flower orders across all stores</p>
          )}
        </div>
        
        <div className={`flex ${isMobileView ? 'flex-col gap-2' : 'gap-3'}`}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`justify-start text-left font-normal ${isMobileView ? 'w-full' : 'w-[280px]'} ${!calendarDate && "text-muted-foreground"}`}
              >
                <CalendarDays className="mr-2 h-4 w-4 text-gray-500" />
                {calendarDate ? format(calendarDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="start">
              <Calendar
                mode="single"
                selected={calendarDate}
                onSelect={handleDateSelect}
                initialFocus
                className="[--cell-size:3.5rem] text-base"
              />
            </PopoverContent>
          </Popover>
          
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-48'}`}>
              <SelectValue placeholder="Select store" />
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

          <Select value={selectedDifficultyLabel} onValueChange={setSelectedDifficultyLabel}>
            <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-48'}`}>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              {productLabels.filter(label => label.category === 'difficulty').sort((a, b) => a.priority - b.priority).map(label => (
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

          <Select value={selectedProductTypeLabel} onValueChange={setSelectedProductTypeLabel}>
            <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-48'}`}>
              <SelectValue placeholder="Select product type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Product Types</SelectItem>
              {productLabels.filter(label => label.category === 'productType').sort((a, b) => a.priority - b.priority).map(label => (
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

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-48'}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500" />
                  Pending
                </div>
              </SelectItem>
              <SelectItem value="assigned">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  Assigned
                </div>
              </SelectItem>
              <SelectItem value="completed">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  Completed
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overall Stats (when viewing all stores) */}
      {selectedStore === 'all' && (
        <div className={`grid gap-4 mb-6 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-4'}`}>
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStatus === 'all' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => handleStatusFilter('all')}
          >
            <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
              <div className={`flex items-center ${isMobileView ? 'gap-2' : 'gap-3'}`}>
                <Package className={`${isMobileView ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600`} />
                <div>
                  <p className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Total Orders</p>
                  <p className={`font-bold text-gray-900 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>{totalStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStatus === 'pending' ? 'ring-2 ring-orange-500 bg-orange-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => handleStatusFilter('pending')}
          >
            <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
              <div className={`flex items-center ${isMobileView ? 'gap-2' : 'gap-3'}`}>
                <Users className={`${isMobileView ? 'h-6 w-6' : 'h-8 w-8'} text-orange-600`} />
                <div>
                  <p className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Pending</p>
                  <p className={`font-bold text-orange-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>{totalStats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStatus === 'assigned' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => handleStatusFilter('assigned')}
          >
            <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
              <div className={`flex items-center ${isMobileView ? 'gap-2' : 'gap-3'}`}>
                <Users className={`${isMobileView ? 'h-6 w-6' : 'h-8 w-8'} text-blue-600`} />
                <div>
                  <p className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Assigned</p>
                  <p className={`font-bold text-blue-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>{totalStats.assigned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
              selectedStatus === 'completed' ? 'ring-2 ring-green-500 bg-green-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => handleStatusFilter('completed')}
          >
            <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
              <div className={`flex items-center ${isMobileView ? 'gap-2' : 'gap-3'}`}>
                <CheckCircle className={`${isMobileView ? 'h-6 w-6' : 'h-8 w-8'} text-green-600`} />
                <div>
                  <p className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Completed</p>
                  <p className={`font-bold text-green-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>{totalStats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search orders by ID, product, variant, remarks, or labels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-sm text-gray-500 mt-2">
            {orders.length} order{orders.length !== 1 ? 's' : ''} found for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Batch Controls */}
      {orders.length > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant={isBatchMode ? "default" : "outline"}
              size="sm"
              onClick={toggleBatchMode}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              {isBatchMode ? 'Exit Batch Mode' : 'Batch Select'}
            </Button>
            
            {isBatchMode && (
              <>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllOrders}
                    disabled={selectedOrderIds.size === orders.length}
                  >
                    Select All ({orders.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedOrderIds.size === 0}
                  >
                    Clear
                  </Button>
                </div>
                
                {selectedOrderIds.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      {selectedOrderIds.size} selected
                    </span>
                    <Button
                      size="sm"
                      onClick={batchAssignToMe}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                      <UserPlus className="h-3 w-3" />
                      Assign to Me
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={batchUnassign}
                      className="flex items-center gap-2"
                    >
                      <UserMinus className="h-3 w-3" />
                      Unassign
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Multi-Store View */}
      {selectedStore === 'all' ? (
        <div className="space-y-8">
          {Object.values(ordersByStore).map(({ store, orders: storeOrders, stats }) => (
            <Card key={store.id} className="overflow-hidden">
              <CardHeader className={`${isMobileView ? 'pb-2' : 'pb-4'}`}>
                <div className={`${isMobileView ? 'space-y-3' : 'flex items-center justify-between'}`}>
                  <CardTitle className={`flex items-center gap-3 ${isMobileView ? 'text-base' : ''}`}>
                    <div 
                      className={`${isMobileView ? 'w-3 h-3' : 'w-4 h-4'} rounded-full`} 
                      style={{ backgroundColor: store.color }}
                    />
                    <span>{store.name}</span>
                    <Badge variant="outline" className={`ml-2 ${isMobileView ? 'text-xs' : ''}`}>
                      {stats.total} orders
                    </Badge>
                  </CardTitle>
                  
                  {/* Store-specific stats */}
                  <div className={`flex ${isMobileView ? 'gap-2 flex-wrap' : 'gap-4'} ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                    <div className="flex items-center gap-1">
                      <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-orange-500`} />
                      <span className="text-orange-600 font-medium">{stats.pending} Pending</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-blue-500`} />
                      <span className="text-blue-600 font-medium">{stats.assigned} Assigned</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-green-500`} />
                      <span className="text-green-600 font-medium">{stats.completed} Completed</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className={`${isMobileView ? 'pt-1' : 'pt-0'}`}>
                {storeOrders.length > 0 ? (
                  <div className={`${isMobileView ? 'space-y-2' : 'space-y-3'}`}>
                    {storeOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        currentUser={currentUser}
                        florists={florists}
                        stores={stores}
                        onOrderUpdate={handleOrderUpdate}
                        isBatchMode={isBatchMode}
                        isSelected={selectedOrderIds.has(order.id)}
                        onToggleSelection={toggleOrderSelection}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`text-center text-gray-500 ${isMobileView ? 'py-6 text-sm' : 'py-8'}`}>
                    No orders for this store on {selectedDate}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          
          {Object.keys(ordersByStore).length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
                <p className="text-gray-500">No orders scheduled for {selectedDate}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Single Store View */
        <Card>
          <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
            <div className={`${isMobileView ? 'space-y-3' : 'flex items-center justify-between'}`}>
              <CardTitle className={`flex items-center gap-3 ${isMobileView ? 'text-base' : ''}`}>
                <div 
                  className={`${isMobileView ? 'w-3 h-3' : 'w-4 h-4'} rounded-full`} 
                  style={{ backgroundColor: stores.find(s => s.id === selectedStore)?.color }}
                />
                <span>{stores.find(s => s.id === selectedStore)?.name}</span>
                <Badge variant="outline" className={`ml-2 ${isMobileView ? 'text-xs' : ''}`}>
                  {orders.length} orders
                </Badge>
              </CardTitle>
              
              {/* Single store stats */}
              <div className={`flex ${isMobileView ? 'gap-2 flex-wrap' : 'gap-4'} ${isMobileView ? 'text-xs' : 'text-sm'}`}>
                <div className="flex items-center gap-1">
                  <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-orange-500`} />
                  <span className="text-orange-600 font-medium">{totalStats.pending} Pending</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-blue-500`} />
                  <span className="text-blue-600 font-medium">{totalStats.assigned} Assigned</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`${isMobileView ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full bg-green-500`} />
                  <span className="text-green-600 font-medium">{totalStats.completed} Completed</span>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className={`${isMobileView ? 'pt-1' : ''}`}>
            {orders.length > 0 ? (
              <div className={`${isMobileView ? 'space-y-2' : 'space-y-3'}`}>
                {orders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currentUser={currentUser}
                    florists={florists}
                    stores={stores}
                    onOrderUpdate={handleOrderUpdate}
                    isBatchMode={isBatchMode}
                    isSelected={selectedOrderIds.has(order.id)}
                    onToggleSelection={toggleOrderSelection}
                  />
                ))}
              </div>
            ) : (
              <div className={`text-center text-gray-500 ${isMobileView ? 'py-6 text-sm' : 'py-8'}`}>
                No orders for this store on {selectedDate}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}