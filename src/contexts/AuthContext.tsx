import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react"
import type { LoginRequest, LoginResponse, User, Tenant } from "../types"
import { login as authLogin, getStoredToken, removeStoredToken } from "../services/auth"
import { register } from "../services/api"

// API configuration
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev"

interface AuthState {
  isAuthenticated: boolean
  user: User | null
  tenant: Tenant | null
  currentStore: string | null
  loading: boolean
  error: string | null
}

type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: { user: User; tenant: Tenant; token: string } }
  | { type: "AUTH_FAILURE"; payload: { error: string } }
  | { type: "AUTH_LOGOUT" }
  | { type: "SET_CURRENT_STORE"; payload: { storeId: string } }
  | { type: "INIT_AUTH"; payload: { user: User; tenant: Tenant } }

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tenant: null,
  currentStore: null,
  loading: true,
  error: null,
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "AUTH_START":
      return { ...state, loading: true, error: null }
    case "AUTH_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        tenant: action.payload.tenant,
        loading: false,
        error: null,
      }
    case "AUTH_FAILURE":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tenant: null,
        loading: false,
        error: action.payload.error,
      }
    case "AUTH_LOGOUT":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tenant: null,
        currentStore: null,
        loading: false,
        error: null,
      }
    case "SET_CURRENT_STORE":
      return {
        ...state,
        currentStore: action.payload.storeId,
      }
    case "INIT_AUTH":
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        tenant: action.payload.tenant,
        loading: false,
        error: null,
      }
    default:
      return state
  }
}

interface AuthContextType extends AuthState {
  login: (request: LoginRequest) => Promise<{ success: boolean }>
  logout: () => Promise<void>
  setCurrentStore: (storeId: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth state from localStorage on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token")
        const userData = localStorage.getItem("auth_user")
        const tenantData = localStorage.getItem("auth_tenant")

        if (token && userData && tenantData) {
          // Validate token with backend
          try {
            const response = await fetch(`${API_BASE_URL}/api/auth/validate`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            })
            
            if (response.ok) {
              const validationResult = await response.json()
              if (validationResult.valid) {
                // Token is valid, use the data from validation
                dispatch({
                  type: "INIT_AUTH",
                  payload: { user: validationResult.user, tenant: validationResult.tenant },
                })
              } else {
                // Token is invalid, clear storage and logout
                console.log("Token validation failed, logging out")
                removeStoredToken()
                localStorage.removeItem("auth_user")
                localStorage.removeItem("auth_tenant")
                localStorage.removeItem("refresh_token")
                dispatch({ type: "AUTH_FAILURE", payload: { error: "Token expired" } })
              }
            } else {
              // Token is invalid, clear storage and logout
              console.log("Token validation failed, logging out")
              removeStoredToken()
              localStorage.removeItem("auth_user")
              localStorage.removeItem("auth_tenant")
              localStorage.removeItem("refresh_token")
              dispatch({ type: "AUTH_FAILURE", payload: { error: "Token expired" } })
            }
          } catch (error) {
            console.error("Token validation error:", error)
            // Network error or other issue, clear storage and logout
            removeStoredToken()
            localStorage.removeItem("auth_user")
            localStorage.removeItem("auth_tenant")
            localStorage.removeItem("refresh_token")
            dispatch({ type: "AUTH_FAILURE", payload: { error: "Authentication failed" } })
          }
        } else {
          dispatch({ type: "AUTH_FAILURE", payload: { error: "No stored authentication" } })
        }
      } catch (error) {
        console.error("Auth initialization error:", error)
        dispatch({ type: "AUTH_FAILURE", payload: { error: "Failed to initialize auth" } })
      }
    }

    initializeAuth()
  }, [])

  // Login function
  const login = async (request: LoginRequest): Promise<{ success: boolean }> => {
    try {
      dispatch({ type: "AUTH_START" })

      console.log("Frontend: Attempting login with:", request)
      const response: LoginResponse = await authLogin(request)
      console.log("Frontend: Received login response:", response)

      if (response.success && response.user && response.tenant) {
        console.log("Frontend: Login successful, dispatching AUTH_SUCCESS")

        // Store auth data in localStorage
        localStorage.setItem("auth_token", response.accessToken || "")
        localStorage.setItem("auth_user", JSON.stringify(response.user))
        localStorage.setItem("auth_tenant", JSON.stringify(response.tenant))

        dispatch({
          type: "AUTH_SUCCESS",
          payload: {
            user: response.user,
            tenant: response.tenant,
            token: response.accessToken || "",
          },
        })
        return { success: true }
      } else {
        console.log("Frontend: Login failed - missing required fields:", {
          success: response.success,
          hasUser: !!response.user,
          hasTenant: !!response.tenant,
        })
        dispatch({
          type: "AUTH_FAILURE",
          payload: { error: response.error || "Login failed" },
        })
        return { success: false }
      }
    } catch (error) {
      console.error("Frontend: Login error:", error)
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      dispatch({
        type: "AUTH_FAILURE",
        payload: { error: errorMessage },
      })
      return { success: false }
    }
  }

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      // TODO: Call logout API if needed
      // await authLogout();
    } catch (error) {
      console.error("Logout API call failed:", error)
    } finally {
      // Clear localStorage
      removeStoredToken()
      localStorage.removeItem("auth_user")
      localStorage.removeItem("auth_tenant")
      localStorage.removeItem("refresh_token")

      dispatch({ type: "AUTH_LOGOUT" })
    }
  }

  // Set current store
  const setCurrentStore = (storeId: string) => {
    dispatch({ type: "SET_CURRENT_STORE", payload: { storeId } })
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setCurrentStore }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
