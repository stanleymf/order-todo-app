import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StoreSelector } from './StoreSelector';
import { useMobileView } from './Dashboard';
import type { FloristStats, TimeFrame, Store } from '../types';
import { getFloristStats, updateFloristStats, getStores } from '../utils/storage';

export function Analytics() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [stats, setStats] = useState<FloristStats[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Get mobile view context
  const { isMobileView } = useMobileView();

  useEffect(() => {
    // Update stats from current orders and then get them
    updateFloristStats();
    const floristStats = getFloristStats();
    setStats(floristStats);
    setStores(getStores());
  }, []);

  const formatTime = (minutes: number): string => {
    if (minutes === 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getTimeFrameLabel = (frame: TimeFrame): string => {
    switch (frame) {
      case 'daily': return 'Today';
      case 'weekly': return 'This Week';
      case 'monthly': return 'This Month';
      default: return 'This Week';
    }
  };

  // Filter stats by store if selected
  const getFilteredStats = () => {
    if (!selectedStoreId) return stats;
    
    return stats.map(stat => {
      const storeData = stat.storeBreakdown?.[selectedStoreId];
      if (!storeData) {
        return {
          ...stat,
          completedOrders: 0,
          averageCompletionTime: 0
        };
      }
      return {
        ...stat,
        completedOrders: storeData.orders,
        averageCompletionTime: storeData.avgTime
      };
    });
  };

  const filteredStats = getFilteredStats();
  const sortedStats = [...filteredStats].sort((a, b) => b.completedOrders - a.completedOrders);

  const selectedStore = stores.find(s => s.id === selectedStoreId);

  return (
    <div className={`${isMobileView ? 'p-3' : 'p-6'} max-w-6xl mx-auto`}>
      <div className={`flex justify-between ${isMobileView ? 'flex-col gap-3 mb-4' : 'items-center mb-6'}`}>
        <h2 className={`font-bold text-gray-900 ${isMobileView ? 'text-lg' : 'text-2xl'}`}>
          {isMobileView ? 'Analytics' : 'Analytics Dashboard'}
        </h2>
        <div className={`flex ${isMobileView ? 'flex-col gap-2' : 'items-center space-x-4'}`}>
          <StoreSelector
            stores={stores}
            selectedStoreId={selectedStoreId}
            onStoreChange={setSelectedStoreId}
          />
          <Select value={timeFrame} onValueChange={(value: TimeFrame) => setTimeFrame(value)}>
            <SelectTrigger className={`${isMobileView ? 'w-full' : 'w-[180px]'}`}>
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Today</SelectItem>
              <SelectItem value="weekly">This Week</SelectItem>
              <SelectItem value="monthly">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedStore && (
        <div className={`${isMobileView ? 'mb-4' : 'mb-6'}`}>
          <Card className="border-l-4" style={{ borderLeftColor: selectedStore.color }}>
            <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
              <div className="flex items-center">
                <div 
                  className={`${isMobileView ? 'w-3 h-3 mr-2' : 'w-4 h-4 mr-3'} rounded-full`} 
                  style={{ backgroundColor: selectedStore.color }}
                />
                <span className={`font-medium ${isMobileView ? 'text-sm' : ''}`}>
                  {isMobileView ? selectedStore.name : `Showing analytics for ${selectedStore.name}`}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1 mb-6' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'}`}>
        {/* Total Orders */}
        <Card>
          <CardHeader className={`${isMobileView ? 'pb-1' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Total Orders Completed</CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
            <div className={`font-bold text-green-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>
              {filteredStats.reduce((sum, stat) => sum + stat.completedOrders, 0)}
            </div>
            <p className={`text-gray-500 mt-1 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>
              {getTimeFrameLabel(timeFrame)}
              {selectedStore && !isMobileView && ` • ${selectedStore.name}`}
            </p>
          </CardContent>
        </Card>

        {/* Average Completion Time */}
        <Card>
          <CardHeader className={`${isMobileView ? 'pb-1' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Average Completion Time</CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
            <div className={`font-bold text-blue-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>
              {filteredStats.length > 0 
                ? formatTime(Math.round(filteredStats.reduce((sum, stat) => sum + stat.averageCompletionTime, 0) / filteredStats.length))
                : 'N/A'
              }
            </div>
            <p className={`text-gray-500 mt-1 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>Across all florists</p>
          </CardContent>
        </Card>

        {/* Top Performer */}
        <Card>
          <CardHeader className={`${isMobileView ? 'pb-1' : 'pb-2'}`}>
            <CardTitle className={`font-medium text-gray-600 ${isMobileView ? 'text-xs' : 'text-sm'}`}>Top Performer</CardTitle>
          </CardHeader>
          <CardContent className={`${isMobileView ? 'pt-2' : ''}`}>
            {sortedStats.length > 0 && sortedStats[0].completedOrders > 0 ? (
              <>
                <div className={`font-bold text-purple-600 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>{sortedStats[0].floristName}</div>
                <p className={`text-gray-500 mt-1 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>{sortedStats[0].completedOrders} orders completed</p>
              </>
            ) : (
              <div className={`font-bold text-gray-400 ${isMobileView ? 'text-xl' : 'text-2xl'}`}>N/A</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Store Breakdown for All Stores View */}
      {!selectedStoreId && (
        <div className={`${isMobileView ? 'mb-6' : 'mb-8'}`}>
          <Card>
            <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
              <CardTitle className={`${isMobileView ? 'text-base' : ''}`}>
                {isMobileView ? 'By Store' : `Performance by Store - ${getTimeFrameLabel(timeFrame)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-4 ${isMobileView ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                {stores.map(store => {
                  const storeStats = stats.map(stat => ({
                    ...stat,
                    completedOrders: stat.storeBreakdown?.[store.id]?.orders || 0,
                    averageCompletionTime: stat.storeBreakdown?.[store.id]?.avgTime || 0
                  }));
                  const totalOrders = storeStats.reduce((sum, stat) => sum + stat.completedOrders, 0);
                  const avgTime = storeStats.length > 0 
                    ? Math.round(storeStats.reduce((sum, stat) => sum + stat.averageCompletionTime, 0) / storeStats.length)
                    : 0;

                                      return (
                      <Card key={store.id} className="border-l-4" style={{ borderLeftColor: store.color }}>
                        <CardContent className={`${isMobileView ? 'p-3' : 'p-4'}`}>
                          <div className={`flex items-center ${isMobileView ? 'mb-2' : 'mb-3'}`}>
                            <div 
                              className={`${isMobileView ? 'w-2 h-2 mr-2' : 'w-3 h-3 mr-2'} rounded-full`} 
                              style={{ backgroundColor: store.color }}
                            />
                            <span className={`font-medium ${isMobileView ? 'text-xs' : 'text-sm'}`}>{store.name}</span>
                          </div>
                          <div className={`${isMobileView ? 'space-y-1' : 'space-y-2'}`}>
                            <div>
                              <div className={`font-bold text-green-600 ${isMobileView ? 'text-base' : 'text-lg'}`}>{totalOrders}</div>
                              <div className={`text-gray-500 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>Orders Completed</div>
                            </div>
                            <div>
                              <div className={`font-bold text-blue-600 ${isMobileView ? 'text-base' : 'text-lg'}`}>{formatTime(avgTime)}</div>
                              <div className={`text-gray-500 ${isMobileView ? 'text-[10px]' : 'text-xs'}`}>Avg. Time</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Stats Table */}
      <Card>
        <CardHeader className={`${isMobileView ? 'pb-2' : ''}`}>
          <CardTitle className={`${isMobileView ? 'text-base' : ''}`}>
            {isMobileView ? 'Florist Performance' : `Florist Performance - ${getTimeFrameLabel(timeFrame)}`}
            {selectedStore && !isMobileView && ` • ${selectedStore.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isMobileView ? (
            // Mobile Card Layout
            <div className="space-y-3">
              {sortedStats.map((stat, index) => {
                const isTopPerformer = index === 0 && stat.completedOrders > 0;
                const isFastestFlorist = filteredStats.length > 1 && 
                  stat.averageCompletionTime > 0 && 
                  stat.averageCompletionTime === Math.min(...filteredStats.filter(s => s.averageCompletionTime > 0).map(s => s.averageCompletionTime));
                
                return (
                  <Card key={stat.floristId} className="border border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-600">#{index + 1}</span>
                          <span className="font-medium text-gray-900 text-sm">{stat.floristName}</span>
                        </div>
                        <div className="flex gap-1">
                          {isTopPerformer && (
                            <Badge variant="default" className="bg-purple-100 text-purple-800 text-xs">Top</Badge>
                          )}
                          {isFastestFlorist && stat.completedOrders > 0 && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">Fast</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-500">Orders</div>
                          <div className="font-bold text-gray-900">{stat.completedOrders}</div>
                        </div>
                        <div>
                          <div className="text-gray-500">Avg. Time</div>
                          <div className="font-bold text-gray-900">{formatTime(stat.averageCompletionTime)}</div>
                        </div>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap gap-1">
                        {stat.completedOrders >= 20 && (
                          <Badge variant="outline" className="text-[10px]">High Volume</Badge>
                        )}
                        {stat.averageCompletionTime > 0 && stat.averageCompletionTime <= 40 && (
                          <Badge variant="outline" className="text-[10px]">Efficient</Badge>
                        )}
                        {stat.completedOrders === 0 && (
                          <Badge variant="secondary" className="text-[10px]">No Activity</Badge>
                        )}
                      </div>
                      
                      {!selectedStoreId && (
                        <div className="mt-2">
                          <div className="text-[10px] text-gray-500 mb-1">Store Breakdown</div>
                          <div className="flex flex-wrap gap-1">
                            {stores.map(store => {
                              const storeData = stat.storeBreakdown?.[store.id];
                              if (!storeData || storeData.orders === 0) return null;
                              return (
                                <div key={store.id} className="flex items-center text-[10px] bg-gray-50 px-1 rounded">
                                  <div 
                                    className="w-2 h-2 rounded-full mr-1" 
                                    style={{ backgroundColor: store.color }}
                                  />
                                  <span>{storeData.orders}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Desktop Table Layout
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Rank</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Florist</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Orders Completed</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Avg. Completion Time</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Performance</th>
                    {!selectedStoreId && (
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Store Breakdown</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                {sortedStats.map((stat, index) => {
                  const isTopPerformer = index === 0 && stat.completedOrders > 0;
                  const isFastestFlorist = filteredStats.length > 1 && 
                    stat.averageCompletionTime > 0 && 
                    stat.averageCompletionTime === Math.min(...filteredStats.filter(s => s.averageCompletionTime > 0).map(s => s.averageCompletionTime));
                  
                  return (
                    <tr key={stat.floristId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="text-sm font-medium">#{index + 1}</span>
                          {isTopPerformer && (
                            <Badge variant="default" className="ml-2 bg-purple-100 text-purple-800">
                              Top
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{stat.floristName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">{stat.completedOrders}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <span className="text-sm text-gray-900">{formatTime(stat.averageCompletionTime)}</span>
                          {isFastestFlorist && stat.completedOrders > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
                              Fastest
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-1">
                          {stat.completedOrders >= 20 && (
                            <Badge variant="outline" className="text-xs">High Volume</Badge>
                          )}
                          {stat.averageCompletionTime > 0 && stat.averageCompletionTime <= 40 && (
                            <Badge variant="outline" className="text-xs">Efficient</Badge>
                          )}
                          {stat.completedOrders === 0 && (
                            <Badge variant="secondary" className="text-xs">No Activity</Badge>
                          )}
                        </div>
                      </td>
                      {!selectedStoreId && (
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {stores.map(store => {
                              const storeData = stat.storeBreakdown?.[store.id];
                              if (!storeData || storeData.orders === 0) return null;
                              return (
                                <div key={store.id} className="flex items-center text-xs">
                                  <div 
                                    className="w-2 h-2 rounded-full mr-1" 
                                    style={{ backgroundColor: store.color }}
                                  />
                                  <span>{storeData.orders}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
          
          {filteredStats.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No performance data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}