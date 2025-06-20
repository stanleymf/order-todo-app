import { useState, useEffect, createContext, useContext } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut, Calendar, BarChart3, Package, Smartphone, Monitor } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { Analytics } from './Analytics';
import { ProductManagement } from './ProductManagement';
import { useAuth } from '../contexts/AuthContext';

// Mobile View Context
interface MobileViewContextType {
  isMobileView: boolean;
  toggleMobileView: () => void;
}

const MobileViewContext = createContext<MobileViewContextType>({
  isMobileView: false,
  toggleMobileView: () => {},
});

export const useMobileView = () => useContext(MobileViewContext);

export function Dashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [isMobileView, setIsMobileView] = useState(false);

  const toggleMobileView = () => {
    setIsMobileView(!isMobileView);
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return null; // This shouldn't happen due to ProtectedRoute
  }

  return (
    <MobileViewContext.Provider value={{ isMobileView, toggleMobileView }}>
      <div className={`min-h-screen bg-gray-50 ${isMobileView ? 'max-w-[393px] mx-auto border-x-4 border-gray-400 shadow-2xl' : ''}`}>
        <header className="bg-white shadow-sm border-b">
          <div className={`mx-auto ${isMobileView ? 'px-3' : 'max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
            <div className={`flex justify-between items-center h-16 ${isMobileView ? 'gap-2' : ''}`}>
              <div className="flex items-center">
                <h1 className={`font-semibold text-gray-900 ${isMobileView ? 'text-base' : 'text-xl'}`}>
                  {isMobileView ? 'Dashboard' : 'Florist Dashboard'}
                </h1>
                <span className={`px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full ${isMobileView ? 'ml-2' : 'ml-4'}`}>
                  {user.role}
                </span>
                {isMobileView && (
                  <span className="ml-1 px-1 py-1 bg-orange-100 text-orange-800 text-[10px] rounded-full">
                    📱
                  </span>
                )}
              </div>
              <div className={`flex items-center ${isMobileView ? 'space-x-1' : 'space-x-4'}`}>
                {!isMobileView && (
                  <span className="text-sm text-gray-700">Welcome, {user.name}</span>
                )}
                
                {/* Mobile View Toggle */}
                <Button
                  variant={isMobileView ? "default" : "outline"}
                  size="sm"
                  onClick={toggleMobileView}
                  className={`${isMobileView ? 'bg-orange-600 hover:bg-orange-700 text-xs px-2' : ''}`}
                  title={isMobileView ? "Switch to Desktop View" : "Switch to Mobile View"}
                >
                  {isMobileView ? (
                    <>
                      <Monitor className="h-3 w-3 mr-1" />
                      Desktop
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Mobile
                    </>
                  )}
                </Button>
                
                <Button variant="outline" size="sm" onClick={handleLogout} className={isMobileView ? 'text-xs px-2' : ''}>
                  <LogOut className={`${isMobileView ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
                  {isMobileView ? 'Out' : 'Logout'}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className={`mx-auto py-4 ${isMobileView ? 'px-3' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-8'}`}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className={`${isMobileView ? 'space-y-4' : 'space-y-6'}`}>
            <TabsList className={`grid w-full ${isMobileView ? 'grid-cols-2 h-10' : 'grid-cols-3'}`}>
              <TabsTrigger value="orders" className={`flex items-center gap-2 ${isMobileView ? 'text-xs px-2' : ''}`}>
                <Calendar className={`${isMobileView ? 'h-3 w-3' : 'h-4 w-4'}`} />
                Orders
              </TabsTrigger>
              <TabsTrigger value="analytics" className={`flex items-center gap-2 ${isMobileView ? 'text-xs px-2' : ''}`}>
                <BarChart3 className={`${isMobileView ? 'h-3 w-3' : 'h-4 w-4'}`} />
                Analytics
              </TabsTrigger>
              {user.role === 'admin' && !isMobileView && (
                <TabsTrigger value="products" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Products
                </TabsTrigger>
              )}
            </TabsList>

            {/* Admin Products Tab for Mobile - Show as separate row */}
            {user.role === 'admin' && isMobileView && (
              <TabsList className="grid w-full grid-cols-1 h-10">
                <TabsTrigger value="products" className="flex items-center gap-2 text-xs px-2">
                  <Package className="h-3 w-3" />
                  Products
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="orders">
              <OrdersView currentUser={user} />
            </TabsContent>

            <TabsContent value="analytics">
              <Analytics />
            </TabsContent>

            {user.role === 'admin' && (
              <TabsContent value="products">
                <ProductManagement />
              </TabsContent>
            )}
          </Tabs>
        </main>
      </div>
    </MobileViewContext.Provider>
  );
}