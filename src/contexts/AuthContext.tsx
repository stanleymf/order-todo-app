import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authService, AuthResult, LoginCredentials, JWTPayload, Session } from '../services/auth';
import { databaseService } from '../services/database';
import { User, Tenant, ShopifyStore } from '../types/multi-tenant';

// Auth state interface
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tenant: Tenant | null;
  currentStore: ShopifyStore | null;
  stores: ShopifyStore[];
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

// Auth actions
export type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; tenant: Tenant; token: string; refreshToken: string } }
  | { type: 'AUTH_FAILURE'; payload: { error: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_STORE'; payload: ShopifyStore }
  | { type: 'SET_STORES'; payload: ShopifyStore[] }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'UPDATE_TENANT'; payload: Tenant };

// Auth context interface
export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  switchStore: (storeId: string) => Promise<AuthResult>;
  clearError: () => void;
  updateUser: (user: User) => void;
  updateTenant: (tenant: Tenant) => void;
}

// Initial auth state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tenant: null,
  currentStore: null,
  stores: [],
  token: null,
  refreshToken: null,
  loading: true,
  error: null
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        loading: true,
        error: null
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        tenant: action.payload.tenant,
        token: action.payload.token,
        refreshToken: action.payload.refreshToken,
        loading: false,
        error: null
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tenant: null,
        currentStore: null,
        stores: [],
        token: null,
        refreshToken: null,
        loading: false,
        error: action.payload.error
      };

    case 'AUTH_LOGOUT':
      return {
        ...initialState,
        loading: false
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };

    case 'SET_CURRENT_STORE':
      return {
        ...state,
        currentStore: action.payload
      };

    case 'SET_STORES':
      return {
        ...state,
        stores: action.payload
      };

    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload
      };

    case 'UPDATE_TENANT':
      return {
        ...state,
        tenant: action.payload
      };

    default:
      return state;
  }
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const refreshToken = localStorage.getItem('auth_refresh_token');

        if (token && refreshToken) {
          // Validate token
          const payload = await authService.validateToken(token);
          if (payload) {
            // Token is valid, get session
            const session = await authService.getCurrentSession(token);
            if (session) {
              // Get user and tenant data
              const tenant = await databaseService.getTenant(session.tenantId);
              const users = await databaseService.getUsers(session.tenantId);
              const user = users.find((u: any) => u.id === session.userId);

              if (tenant && user) {
                dispatch({
                  type: 'AUTH_SUCCESS',
                  payload: {
                    user,
                    tenant,
                    token,
                    refreshToken
                  }
                });

                // Load stores for the tenant
                const stores = await databaseService.getStores(session.tenantId);
                dispatch({ type: 'SET_STORES', payload: stores });

                // Set current store if available
                if (session.currentStoreId) {
                  const currentStore = stores.find((s: any) => s.id === session.currentStoreId);
                  if (currentStore) {
                    dispatch({ type: 'SET_CURRENT_STORE', payload: currentStore });
                  }
                }
              } else {
                // Invalid session, clear tokens
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_refresh_token');
                dispatch({ type: 'AUTH_LOGOUT' });
              }
            } else {
              // Session not found, clear tokens
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_refresh_token');
              dispatch({ type: 'AUTH_LOGOUT' });
            }
          } else {
            // Token invalid, try refresh
            const refreshResult = await authService.refreshToken(refreshToken);
            if (refreshResult.success && refreshResult.token && refreshResult.refreshToken) {
              localStorage.setItem('auth_token', refreshResult.token);
              localStorage.setItem('auth_refresh_token', refreshResult.refreshToken);
              
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: {
                  user: refreshResult.user!,
                  tenant: refreshResult.tenant!,
                  token: refreshResult.token,
                  refreshToken: refreshResult.refreshToken
                }
              });
            } else {
              // Refresh failed, clear tokens
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_refresh_token');
              dispatch({ type: 'AUTH_LOGOUT' });
            }
          }
        } else {
          dispatch({ type: 'AUTH_LOGOUT' });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<AuthResult> => {
    dispatch({ type: 'AUTH_START' });

    try {
      const result = await authService.login(credentials);
      
      if (result.success && result.token && result.refreshToken) {
        // Store tokens in localStorage
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('auth_refresh_token', result.refreshToken);

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: result.user!,
            tenant: result.tenant!,
            token: result.token,
            refreshToken: result.refreshToken
          }
        });

        // Load stores for the tenant
        const stores = await databaseService.getStores(result.tenant!.id);
        dispatch({ type: 'SET_STORES', payload: stores });
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: { error: result.error || 'Login failed' }
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: { error: errorMessage }
      });
      return { success: false, error: errorMessage };
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      if (state.token) {
        await authService.logout(state.token);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear tokens from localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_refresh_token');
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Refresh authentication
  const refreshAuth = async (): Promise<void> => {
    if (!state.refreshToken) return;

    try {
      const result = await authService.refreshToken(state.refreshToken);
      
      if (result.success && result.token && result.refreshToken) {
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('auth_refresh_token', result.refreshToken);

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: result.user!,
            tenant: result.tenant!,
            token: result.token,
            refreshToken: result.refreshToken
          }
        });
      } else {
        // Refresh failed, logout
        await logout();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
    }
  };

  // Switch store
  const switchStore = async (storeId: string): Promise<AuthResult> => {
    if (!state.token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const result = await authService.switchStore(state.token, storeId);
      
      if (result.success && result.token) {
        localStorage.setItem('auth_token', result.token);
        
        const store = state.stores.find(s => s.id === storeId);
        if (store) {
          dispatch({ type: 'SET_CURRENT_STORE', payload: store });
        }
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Store switch failed';
      return { success: false, error: errorMessage };
    }
  };

  // Clear error
  const clearError = (): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Update user
  const updateUser = (user: User): void => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  // Update tenant
  const updateTenant = (tenant: Tenant): void => {
    dispatch({ type: 'UPDATE_TENANT', payload: tenant });
  };

  // Context value
  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshAuth,
    switchStore,
    clearError,
    updateUser,
    updateTenant
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Auth hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to get tenant from auth service (for non-React contexts)
export async function getTenant(tenantId: string) {
  // This would need to be implemented in the auth service
  // For now, we'll use the database service directly
  return null;
} 