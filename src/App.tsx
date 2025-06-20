import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute, TenantRoute } from './components/ProtectedRoute';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { LoadingSpinner } from './components/ui/loading-spinner';

// Main app content wrapped with auth context
function AppContent() {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Login />;
  }

  return (
    <TenantRoute>
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    </TenantRoute>
  );
}

// Root app component with providers
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;