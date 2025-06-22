import React from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./contexts/AuthContext"
import { Login } from "./components/Login"
import { Dashboard } from "./components/Dashboard"
import { OrdersView } from "./components/OrdersView"
import { ProductManagement } from "./components/ProductManagement"
import { Settings } from "./components/Settings"
import { Analytics } from "./components/Analytics"
import { Toaster } from "./components/ui/sonner"
import "./index.css"

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

// Root App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}>
            <Route index element={<OrdersView />} />
            <Route path="orders" element={<OrdersView />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="settings/:tab?" element={<Settings />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  )
}

export default App
