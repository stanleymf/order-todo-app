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
import type { User } from '../types/multi-tenant';
import type { Order, Store } from '../types';

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
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [florists, setFlorists] = useState<User[]>([]);
  const [productLabels, setProductLabels] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState<boolean>(false);
  
  // Get mobile view context
  const { isMobileView } = useMobileView();

  // TODO: Replace with D1 API calls
  const loadData = useCallback(() => {
    // For now, show empty state while we migrate to D1
    setOrders([]);
    setStores([]);
    setFlorists([]);
    setProductLabels([]);
  }, [selectedDate, selectedStore, selectedDifficultyLabel, selectedProductTypeLabel, selectedStatus, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrderUpdate = () => {
    loadData();
  };

  // Handle status filter clicks
  const handleStatusFilter = (status: string) => {
    if (selectedStatus === status) {
      setSelectedStatus('all');
    } else {
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
    setSelectedOrderIds(new Set(orders.map(order => order.id)));
  };

  const clearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  const batchAssignToMe = () => {
    // TODO: Implement with D1 API
    console.log('Batch assign to me:', Array.from(selectedOrderIds));
  };

  const batchUnassign = () => {
    // TODO: Implement with D1 API
    console.log('Batch unassign:', Array.from(selectedOrderIds));
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned to Me</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(order => order.assignedFloristId === currentUser.id).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(order => order.status === 'completed').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter(order => order.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {calendarDate ? format(calendarDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={calendarDate}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Store Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Store</label>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter('all')}
            >
              All
            </Button>
            <Button
              variant={selectedStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter('pending')}
            >
              Pending
            </Button>
            <Button
              variant={selectedStatus === 'in_progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter('in_progress')}
            >
              In Progress
            </Button>
            <Button
              variant={selectedStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusFilter('completed')}
            >
              Completed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Orders</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={isBatchMode ? 'default' : 'outline'}
                size="sm"
                onClick={toggleBatchMode}
              >
                {isBatchMode ? 'Exit Batch Mode' : 'Batch Mode'}
              </Button>
              {isBatchMode && (
                <>
                  <Button size="sm" onClick={selectAllOrders}>
                    Select All
                  </Button>
                  <Button size="sm" onClick={clearSelection}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={batchAssignToMe}>
                    Assign to Me
                  </Button>
                  <Button size="sm" onClick={batchUnassign}>
                    Unassign
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No orders found for the selected criteria.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Orders will appear here once we connect to the D1 database.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currentUser={currentUser}
                  onUpdate={handleOrderUpdate}
                  isSelected={selectedOrderIds.has(order.id)}
                  onToggleSelection={() => toggleOrderSelection(order.id)}
                  showSelection={isBatchMode}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 