import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMobileView } from './Dashboard';
import type { Store } from '../types';

interface StoreSelectorProps {
  stores: Store[];
  selectedStoreId: string | null;
  onStoreChange: (storeId: string | null) => void;
  showOrderCounts?: boolean;
  orderCounts?: { [storeId: string]: number };
}

export function StoreSelector({ 
  stores, 
  selectedStoreId, 
  onStoreChange, 
  showOrderCounts = false, 
  orderCounts = {} 
}: StoreSelectorProps) {
  const { isMobileView } = useMobileView();
  
  return (
    <Select 
      value={selectedStoreId || 'all'} 
      onValueChange={(value) => onStoreChange(value === 'all' ? null : value)}
    >
      <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-[280px]'}`}>
        <SelectValue placeholder="Select store" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center justify-between w-full">
            <span className={`${isMobileView ? 'text-sm' : ''}`}>All Stores</span>
            {showOrderCounts && (
              <Badge variant="outline" className={`ml-2 ${isMobileView ? 'text-xs' : ''}`}>
                {Object.values(orderCounts).reduce((sum, count) => sum + count, 0)}
              </Badge>
            )}
          </div>
        </SelectItem>
        {stores.map(store => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                <div 
                  className={`${isMobileView ? 'w-2 h-2 mr-1' : 'w-3 h-3 mr-2'} rounded-full`} 
                  style={{ backgroundColor: store.color }}
                />
                <span className={`${isMobileView ? 'text-sm' : ''}`}>{store.name}</span>
              </div>
              {showOrderCounts && orderCounts[store.id] !== undefined && (
                <Badge variant="outline" className={`ml-2 ${isMobileView ? 'text-xs' : ''}`}>
                  {orderCounts[store.id]}
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}