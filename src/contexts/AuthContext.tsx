import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { login as authLogin, logout as authLogout, refreshToken as authRefreshToken, getStoredToken, getTokenUser, isTokenExpired } from '../services/auth';
import type { LoginRequest, LoginResponse, User, Tenant } from '../types/multi-tenant';

// Auth state interface
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

// Auth actions
export type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; tenant: Tenant; token: string } }
  | { type: 'AUTH_FAILURE'; payload: { error: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'UPDATE_TENANT'; payload: Tenant };

// Auth context interface
export interface AuthContextType extends AuthState {
  login: (request: LoginRequest) => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: User) => void;
  updateTenant: (tenant: Tenant) => void;
}

// Initial auth state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tenant: null,
  token: null,
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
        loading: false,
        error: null
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tenant: null,
        token: null,
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
        const token = getStoredToken();
        
        if (token && !isTokenExpired(token)) {
          const user = getTokenUser(token);
          if (user) {
            // For now, we'll create a mock tenant since we don't have tenant info in the token
            const mockTenant: Tenant = {
              id: user.tenantId,
              name: 'Demo Tenant',
              domain: 'demo',
              subscriptionPlan: 'starter',
              status: 'active',
              settings: {
                timezone: 'UTC',
                currency: 'USD',
                businessHours: { start: '09:00', end: '17:00' },
                features: {
                  analytics: true,
                  multiStore: false,
                  advancedReporting: false
                }
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            dispatch({
              type: 'AUTH_SUCCESS',
              payload: {
                user,
                tenant: mockTenant,
                token
              }
            });
          } else {
            dispatch({ type: 'AUTH_LOGOUT' });
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
  const login = async (request: LoginRequest): Promise<{ success: boolean }> => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response: LoginResponse = await authLogin(request);
      
      if (response.success && response.user && response.tenant) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: response.user,
            tenant: response.tenant,
            token: response.accessToken || ''
          }
        });
        return { success: true };
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: { error: response.error || 'Login failed' }
        });
        return { success: false };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: { error: errorMessage }
      });
      return { success: false };
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await authLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Update user function
  const updateUser = (user: User): void => {
    dispatch({ type: 'UPDATE_USER', payload: user });
  };

  // Update tenant function
  const updateTenant = (tenant: Tenant): void => {
    dispatch({ type: 'UPDATE_TENANT', payload: tenant });
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
    updateUser,
    updateTenant
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 