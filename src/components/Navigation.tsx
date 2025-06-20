import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { User } from '../types';
import { logout } from '../utils/storage';

interface NavigationProps {
  user: User;
  currentView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
}

export function Navigation({ user, currentView, onViewChange, onLogout }: NavigationProps) {
  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <h1 className="text-xl font-bold text-green-700">Florist Dashboard</h1>
          <div className="flex space-x-4">
            <Button
              variant={currentView === 'dashboard' ? 'default' : 'ghost'}
              onClick={() => onViewChange('dashboard')}
              className={currentView === 'dashboard' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Dashboard
            </Button>
            <Button
              variant={currentView === 'analytics' ? 'default' : 'ghost'}
              onClick={() => onViewChange('analytics')}
              className={currentView === 'analytics' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Analytics
            </Button>
            {user.role === 'admin' && (
              <Button
                variant={currentView === 'products' ? 'default' : 'ghost'}
                onClick={() => onViewChange('products')}
                className={currentView === 'products' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                Product Management
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Welcome, {user.name}</span>
            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
              {user.role === 'admin' ? 'Admin' : 'Florist'}
            </Badge>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}