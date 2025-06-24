import React from "react"
import { useAuth } from "../contexts/AuthContext"

export const Orders: React.FC = () => {
  const { user, tenant } = useAuth()

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Orders Page</h1>
      <p>Welcome {user?.email || 'User'}</p>
      <p>Tenant: {tenant?.name || 'No tenant'}</p>
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Debug Info</h2>
        <p>This is the Orders component working correctly!</p>
        <p>Current time: {new Date().toLocaleString()}</p>
      </div>
    </div>
  )
} 