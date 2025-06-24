import React, { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { Login } from "./components/Login"
import { Dashboard } from "./components/Dashboard"
import { DashboardView } from "./components/DashboardView"

import { ProductManagement } from "./components/ProductManagement"
import { Settings } from "./components/Settings"
import { AIIntegration } from "./components/AIIntegration"
import { Analytics } from "./components/Analytics"
import { Orders } from "./components/Orders"
import CustomerAIFlorist from "./components/CustomerAIFlorist"
import AIFlorist from "./components/AIFlorist"
import MobileCameraWidget from "./components/MobileCameraWidget"
import { Toaster } from "./components/ui/sonner"
import { ProductsManagementRoute } from "./components/ProtectedRoute"
import "./index.css"
import { getTenantSettings } from "./services/api"
import { useIsMobile } from "./components/hooks/use-mobile"

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
  const isMobile = useIsMobile()
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
          <Route path="/ai-florist-widget" element={<AIFlorist />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<Orders />} />
            <Route path="dashboard" element={<Orders />} />
            <Route path="orders" element={<Orders />} />

            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductsManagementRoute><ProductManagement /></ProductsManagementRoute>} />
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
