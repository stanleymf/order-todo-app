import React, { useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Wifi, WifiOff, RefreshCw, Users, Clock } from 'lucide-react'
import { useRealtimeUpdates } from '../hooks/use-realtime-updates'

export const RealtimeDemo: React.FC = () => {
  const handleUpdate = useCallback((update: any) => {
    console.log('Demo: Real-time update received:', update)
  }, []);

  const { isConnected, updates, checkForUpdates, lastUpdate } = useRealtimeUpdates({
    enabled: true,
    pollInterval: 3000,
    onUpdate: handleUpdate,
  })

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Real-time Updates Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status:</span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-gray-400" />
            )}
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>
        </div>

        {/* Last Update */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Last Check:</span>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-gray-500" />
            <span className="text-xs text-gray-600">
              {formatTime(lastUpdate)}
            </span>
          </div>
        </div>

        {/* Update Count */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Updates Received:</span>
          <Badge variant="outline">
            {updates.length} update{updates.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Manual Refresh */}
        <Button 
          onClick={checkForUpdates} 
          variant="outline" 
          size="sm" 
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Check for Updates
        </Button>

        {/* Recent Updates */}
        {updates.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Recent Updates:</span>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {updates.slice(-5).map((update, index) => (
                <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                  <div className="font-medium">{update.type}</div>
                  <div className="text-gray-600">
                    Order: {update.orderId.slice(0, 8)}...
                  </div>
                  <div className="text-gray-500">
                    {formatTime(update.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 