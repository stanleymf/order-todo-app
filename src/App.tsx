import React, { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { Login } from "./components/Login"
import { Dashboard } from "./components/Dashboard"
import { OrdersView } from "./components/OrdersView"
import { ProductManagement } from "./components/ProductManagement"
import { Settings } from "./components/Settings"
import { AIIntegration } from "./components/AIIntegration"
import { Analytics } from "./components/Analytics"
import CustomerAIFlorist from "./components/CustomerAIFlorist"
import MobileCameraWidget from "./components/MobileCameraWidget"
import { Toaster } from "./components/ui/sonner"
import "./index.css"
import { getTenantSettings } from "./services/api"
import { useMobileView } from "./components/Dashboard"

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppContent() {
  const { tenant } = useAuth()
  const isMobile = useMobileView()
  const [cameraWidgetEnabled, setCameraWidgetEnabled] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      if (tenant?.id) {
        try {
          const settings = await getTenantSettings(tenant.id)
          if (settings.mobileCameraWidget) {
            setCameraWidgetEnabled(settings.mobileCameraWidget.enabled)
          }
        } catch (error) {
          console.error("Failed to fetch tenant settings:", error)
        }
      }
    }
    fetchSettings()
  }, [tenant?.id])

  return (
    <>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/ai-florist" element={<CustomerAIFlorist />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<OrdersView />} />
            <Route path="orders" element={<OrdersView />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="ai-integration" element={<AIIntegration />} />
            <Route path="settings/:tab?" element={<Settings />} />
          </Route>
        </Routes>
        {isMobile && cameraWidgetEnabled && tenant?.id && (
          <MobileCameraWidget tenantId={tenant.id} />
        )}
      </Router>
      <Toaster />
    </>
  )
}

// Root App Component
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
