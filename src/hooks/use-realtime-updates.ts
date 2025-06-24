import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

// API configuration
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev"

interface RealtimeUpdate {
  type: 'order_updated' | 'order_created' | 'order_deleted'
  orderId: string
  tenantId: string
  timestamp: string
  updatedBy?: string
}

interface UseRealtimeUpdatesOptions {
  enabled?: boolean
  pollInterval?: number // in milliseconds
  onUpdate?: (update: RealtimeUpdate) => void
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { enabled = true, pollInterval = 5000, onUpdate } = options
  const { tenant } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString())
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const pollIntervalRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Function to check for updates
  const checkForUpdates = useCallback(async () => {
    if (!tenant?.id || !enabled) return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/tenants/${tenant.id}/orders/realtime-status?lastUpdate=${lastUpdate}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
        }
      )

      if (response.ok) {
        const data = await response.json()
        
        if (data.hasUpdates && data.updates.length > 0) {
          // Process updates
          const newUpdates: RealtimeUpdate[] = data.updates.map((order: any) => ({
            type: 'order_updated',
            orderId: order.id,
            tenantId: order.tenantId,
            timestamp: order.updatedAt,
            updatedBy: order.assignedTo || 'unknown'
          }))

          setUpdates(prev => [...prev, ...newUpdates])
          setLastUpdate(data.timestamp)

          // Call the onUpdate callback for each update
          newUpdates.forEach(update => {
            onUpdate?.(update)
          })
        }
      }
    } catch (error) {
      console.error('Error checking for updates:', error)
    }
  }, [tenant?.id, lastUpdate, enabled, onUpdate])

  // Function to establish SSE connection
  const connectSSE = useCallback(() => {
    if (!tenant?.id || !enabled) return

    try {
      const eventSource = new EventSource(`${API_BASE_URL}/api/tenants/${tenant.id}/realtime/orders`)
      
      eventSource.onopen = () => {
        setIsConnected(true)
        console.log('Real-time connection established')
      }

      const handleEvent = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          return data;
        } catch (error) {
          console.error('Error parsing SSE message:', error);
          return null;
        }
      };

      eventSource.addEventListener('connected', (event) => {
        const data = handleEvent(event);
        if (data) {
            console.log('SSE connected:', data.message)
        }
      });

      eventSource.addEventListener('order_update', (event) => {
        const data = handleEvent(event);
        if (data && data.data) {
           data.data.forEach((updateData: any) => {
            const update: RealtimeUpdate = {
              type: 'order_updated',
              orderId: updateData.id,
              tenantId: tenant?.id || '',
              timestamp: updateData.updatedAt,
              updatedBy: updateData.assignedTo || 'unknown',
            };
            setUpdates(prev => [...prev, update]);
            onUpdate?.(update);
          });
        }
      });

      eventSource.addEventListener('heartbeat', (event) => {
        const data = handleEvent(event);
        if (data) {
          console.log('SSE heartbeat:', data.timestamp)
        }
      });

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)
        setIsConnected(false)
        eventSource.close()
      }

      eventSourceRef.current = eventSource
    } catch (error) {
      console.error('Error establishing SSE connection:', error)
    }
  }, [tenant?.id, enabled, onUpdate])

  // Function to disconnect
  const disconnect = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setIsConnected(false)
  }, [])

  // Effect to start polling and SSE
  useEffect(() => {
    if (!enabled || !tenant?.id) return

    // Start polling as fallback
    pollIntervalRef.current = setInterval(checkForUpdates, pollInterval)

    // Try to establish SSE connection
    connectSSE()

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [enabled, tenant?.id, pollInterval, checkForUpdates, connectSSE, disconnect])

  // Effect to handle tenant changes
  useEffect(() => {
    if (tenant?.id) {
      disconnect()
      // Reconnect with new tenant
      setTimeout(() => {
        if (enabled) {
          connectSSE()
          pollIntervalRef.current = setInterval(checkForUpdates, pollInterval)
        }
      }, 1000)
    }
  }, [tenant?.id])

  return {
    isConnected,
    updates,
    lastUpdate,
    checkForUpdates,
    connectSSE,
    disconnect
  }
} 