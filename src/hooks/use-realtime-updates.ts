import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentSingaporeTime } from '../lib/utils'

// API configuration
const API_BASE_URL = "https://order-to-do.stanleytan92.workers.dev"

interface RealtimeUpdate {
  type: 'order_updated' | 'order_created' | 'order_deleted'
  orderId: string
  tenantId: string
  timestamp: string
  updatedBy?: string
  status?: string
  assignedTo?: string
  notes?: string
  sortOrder?: number // Add sort order support for drag-and-drop
}

interface UseRealtimeUpdatesOptions {
  enabled?: boolean
  pollInterval?: number // in milliseconds
  onUpdate?: (update: RealtimeUpdate) => void
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { enabled = true, pollInterval = 1000, onUpdate } = options // Even faster polling for debugging
  const { tenant } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string>(getCurrentSingaporeTime())
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const pollIntervalRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastKnownStates = useRef<Map<string, string>>(new Map()) // Track last known states

  // Enhanced polling-based real-time updates (no SSE)
  const checkForUpdates = useCallback(async () => {
    if (!tenant?.id || !enabled) {
      console.log('❌ [POLLING] Skipped - tenantId:', tenant?.id, 'enabled:', enabled)
      return
    }

    try {
      const url = `${API_BASE_URL}/api/tenants/${tenant.id}/order-card-states/realtime-check`
      console.log('🔄 [POLLING] Checking for order card state changes...', url)
      
      // Check for changes in order_card_states table directly
      const response = await fetch(url)

      console.log('🔄 [POLLING] Response status:', response.status, response.statusText)

      if (response.ok) {
        const data = await response.json()
        console.log('🔄 [POLLING] Response received:', data)
        console.log('🔄 [POLLING] Number of changes:', data.changes?.length || 0)
        
        if (data.changes && data.changes.length > 0) {
          const newUpdates: RealtimeUpdate[] = []
          
          console.log('🔍 [POLLING] Processing changes:', data.changes)
          
          for (const change of data.changes) {
            const stateKey = `${change.cardId}-${change.status}-${change.assignedTo || 'none'}-${change.notes || 'none'}-${change.sortOrder || 0}`
            const lastKnownState = lastKnownStates.current.get(change.cardId)
            
            console.log(`🔍 [POLLING] Checking change for ${change.cardId}:`, {
              stateKey,
              lastKnownState,
              isNew: lastKnownState !== stateKey,
              notes: change.notes,
              sortOrder: change.sortOrder
            })
            
            if (lastKnownState !== stateKey) {
              console.log(`🔥 [POLLING] DETECTED CHANGE for ${change.cardId}:`, {
                old: lastKnownState,
                new: stateKey
              })
              
              lastKnownStates.current.set(change.cardId, stateKey)
              
              const update: RealtimeUpdate = {
                type: 'order_updated',
                orderId: change.cardId,
                tenantId: tenant.id,
                timestamp: change.updatedAt,
                updatedBy: change.assignedBy || 'unknown',
                status: change.status,
                assignedTo: change.assignedTo,
                notes: change.notes,
                sortOrder: change.sortOrder
              }
              
              newUpdates.push(update)
            } else {
              console.log(`⏸️ [POLLING] No change detected for ${change.cardId} (same state)`)
            }
          }
          
          if (newUpdates.length > 0) {
            setUpdates(prev => [...prev, ...newUpdates])
            setIsConnected(true) // Mark as connected when we get successful responses
            
            // Call the onUpdate callback for each update
            newUpdates.forEach(update => {
              console.log('🎯 [POLLING] Triggering update callback for:', update.orderId)
              onUpdate?.(update)
            })
          }
        } else {
          setIsConnected(true) // Still connected, just no changes
        }
      } else {
        console.error('🚨 [POLLING] Failed to check for updates:', response.status)
        setIsConnected(false)
      }
    } catch (error) {
      console.error('🚨 [POLLING] Error checking for updates:', error)
      setIsConnected(false)
    }
  }, [tenant?.id, enabled, onUpdate])

  // Function to establish SSE connection
  const connectSSE = useCallback(() => {
    if (!tenant?.id || !enabled) return

    try {
      const eventSource = new EventSource(`${API_BASE_URL}/api/tenants/${tenant.id}/realtime/orders`)
      
      eventSource.onopen = () => {
        setIsConnected(true)
        console.log('🚀 REAL-TIME SSE CONNECTION ESTABLISHED!')
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
        if (data) {
          console.log('[SSE-FRONTEND] 🔥 RECEIVED ORDER UPDATE EVENT:', data);
          
          const update: RealtimeUpdate = {
            type: data.type || 'order_updated',
            orderId: data.orderId,
            tenantId: tenant?.id || '',
            timestamp: data.updatedAt || data.timestamp,
            updatedBy: data.updatedBy || 'unknown',
          };
          
          console.log('[SSE-FRONTEND] 🎯 PROCESSED UPDATE FOR ORDER:', update.orderId, 'BY:', update.updatedBy);
          setUpdates(prev => [...prev, update]);
          onUpdate?.(update);
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

  // Effect to start polling (SSE disabled due to HTTP/2 issues)
  useEffect(() => {
    if (!enabled || !tenant?.id) {
      console.log('❌ [POLLING] Not starting - enabled:', enabled, 'tenantId:', tenant?.id)
      return
    }

    console.log('🚀 [POLLING] Starting polling-based real-time updates...', {
      tenantId: tenant.id,
      pollInterval,
      enabled
    })
    
    // Start polling for real-time updates
    pollIntervalRef.current = setInterval(checkForUpdates, pollInterval) as unknown as number
    console.log('⏰ [POLLING] Interval set with ID:', pollIntervalRef.current)

    // Initial check
    console.log('🎯 [POLLING] Running initial check...')
    checkForUpdates()

    // Cleanup on unmount
    return () => {
      console.log('🧹 [POLLING] Cleaning up polling interval:', pollIntervalRef.current)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [enabled, tenant?.id, pollInterval, checkForUpdates])

  // Effect to handle tenant changes
  useEffect(() => {
    if (tenant?.id) {
      disconnect()
      // Reconnect with new tenant
      setTimeout(() => {
        if (enabled) {
          connectSSE()
          pollIntervalRef.current = setInterval(checkForUpdates, pollInterval) as unknown as number
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