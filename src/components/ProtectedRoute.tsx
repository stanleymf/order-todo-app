import React, { ReactNode } from "react"
import { Permission } from "../types"
import { useAuth } from "../contexts/AuthContext"

// Protected route props
interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: "owner" | "admin" | "florist" | "viewer"
  requiredPermissions?: Permission[]
  requiredStoreAccess?: boolean
  fallback?: ReactNode
  redirectTo?: string
}

// Tenant route props
interface TenantRouteProps {
  children: ReactNode
  fallback?: ReactNode
}

// Role-based route props
interface RoleBasedRouteProps {
  children: ReactNode
  roles: ("owner" | "admin" | "florist" | "viewer")[]
  fallback?: ReactNode
}

// Permission-based route props
interface PermissionBasedRouteProps {
  children: ReactNode
  permissions: Permission[]
  fallback?: ReactNode
}

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
  </div>
)

// Access denied component
const AccessDenied = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <div className="text-6xl mb-4">🚫</div>
    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
    <p className="text-gray-600">You don't have permission to access this resource.</p>
  </div>
)

// Not authenticated component
const NotAuthenticated = () => (
  <div className="flex flex-col items-center justify-center min-h-screen">
    <div className="text-6xl mb-4">🔐</div>
    <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
    <p className="text-gray-600">Please log in to access this resource.</p>
  </div>
)

// Protected Route Component
export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermissions,
  requiredStoreAccess = false,
  fallback,
  redirectTo,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, tenant, currentStore, loading } = useAuth()

  // Show loading while auth is initializing
  if (loading) {
    return <LoadingSpinner />
  }

  // Check if user is authenticated
  if (!isAuthenticated || !user || !tenant) {
    return fallback || <NotAuthenticated />
  }

  // Check role requirement
  if (requiredRole && user.role !== requiredRole) {
    return fallback || <AccessDenied />
  }

  // Check permissions requirement
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission)
    )

    if (!hasAllPermissions) {
      return fallback || <AccessDenied />
    }
  }

  // Check store access requirement
  if (requiredStoreAccess && !currentStore) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-6xl mb-4">🏪</div>
          <h1 className="text-2xl font-bold mb-2">Store Access Required</h1>
          <p className="text-gray-600">Please select a store to continue.</p>
        </div>
      )
    )
  }

  return <>{children}</>
}

// Tenant Route Component
export function TenantRoute({ children, fallback }: TenantRouteProps) {
  const { tenant, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!tenant) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-6xl mb-4">🏢</div>
          <h1 className="text-2xl font-bold mb-2">Tenant Not Found</h1>
          <p className="text-gray-600">Unable to load tenant information.</p>
        </div>
      )
    )
  }

  return <>{children}</>
}

// Role-Based Route Component
export function RoleBasedRoute({ children, roles, fallback }: RoleBasedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user || !roles.includes(user.role)) {
    return fallback || <AccessDenied />
  }

  return <>{children}</>
}

// Permission-Based Route Component
export function PermissionBasedRoute({
  children,
  permissions,
  fallback,
}: PermissionBasedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return fallback || <NotAuthenticated />
  }

  const hasAllPermissions = permissions.every((permission) => user.permissions.includes(permission))

  if (!hasAllPermissions) {
    return fallback || <AccessDenied />
  }

  return <>{children}</>
}

// Store Required Route Component
export function StoreRequiredRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  const { currentStore, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!currentStore) {
    return (
      fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="text-6xl mb-4">🏪</div>
          <h1 className="text-2xl font-bold mb-2">Store Selection Required</h1>
          <p className="text-gray-600">Please select a store to access this feature.</p>
        </div>
      )
    )
  }

  return <>{children}</>
}

// Admin Only Route Component
export function AdminOnlyRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="admin" fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

// Owner Only Route Component
export function OwnerOnlyRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="owner" fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

// Florist Only Route Component
export function FloristOnlyRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute requiredRole="florist" fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

// Orders Management Route Component
export function OrdersManagementRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute
      requiredPermissions={["orders:read", "orders:write"]}
      requiredStoreAccess={true}
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  )
}

// Products Management Route Component
export function ProductsManagementRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute
      requiredPermissions={["products:read", "products:write"]}
      requiredStoreAccess={true}
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  )
}

// Analytics Route Component
export function AnalyticsRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute requiredPermissions={["analytics:read"]} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}

// Settings Route Component
export function SettingsRoute({
  children,
  fallback,
}: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ProtectedRoute requiredPermissions={["settings:read", "settings:write"]} fallback={fallback}>
      {children}
    </ProtectedRoute>
  )
}
