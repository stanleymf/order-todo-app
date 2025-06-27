import React, { useState, useEffect } from 'react'
import { useRealtimeUpdates } from '../hooks/use-realtime-updates'

interface DebugState {
  timestamp: string;
  clientId: string;
  isConnected: boolean;
  authTokenStatus: string;
  pollCount: number;
}

export const RealtimeDebugInfo: React.FC = () => {
  // Only show debug info if URL contains 'debug=true'
  const showDebug = window.location.href.includes('debug=true')
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  
  const [debugInfo, setDebugInfo] = useState<DebugState>({
    timestamp: '',
    clientId: '',
    isConnected: false,
    authTokenStatus: '',
    pollCount: 0
  })

  const realtimeHook = useRealtimeUpdates({
    enabled: showDebug, // Only enable if debugging
    onUpdate: (update) => {
      console.log('🔄 Real-time update received:', update)
      setDebugInfo(prev => ({
        ...prev,
        pollCount: prev.pollCount + 1,
        timestamp: new Date().toLocaleTimeString()
      }))
    }
  })

  const isConnected = realtimeHook?.isConnected || false

  useEffect(() => {
    if (!showDebug) return

    const updateDebugInfo = () => {
      const clientType = navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
      const authToken = localStorage.getItem('auth_token')
      
      setDebugInfo(prev => ({
        ...prev,
        timestamp: new Date().toLocaleTimeString(),
        clientId: `${clientType}-${Date.now()}`,
        isConnected: isConnected,
        authTokenStatus: authToken ? `✅ Token: ${authToken.substring(0, 8)}...` : '❌ No Token'
      }))
    }

    updateDebugInfo()
    const interval = setInterval(updateDebugInfo, 3000)

    return () => clearInterval(interval)
  }, [isConnected, showDebug])
  
  if (!showDebug) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white rounded-lg text-xs max-w-xs z-50 shadow-lg">
      <div 
        className="flex items-center justify-between p-2 cursor-pointer hover:bg-white/10"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="font-bold">🔍 Real-Time Debug</div>
        <div className="text-lg">{isCollapsed ? '▼' : '▲'}</div>
      </div>
      
      {!isCollapsed && (
        <div className="p-2 pt-0 space-y-1">
          <div>Client: {debugInfo.clientId}</div>
          <div>Status: {debugInfo.isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
          <div>Auth: {debugInfo.authTokenStatus}</div>
          <div>Last Update: {debugInfo.timestamp}</div>
          <div>Updates: {debugInfo.pollCount}</div>
        </div>
      )}
    </div>
  )
} 