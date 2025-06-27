import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

interface RealtimeUpdate {
  type: 'order_updated' | 'order_created' | 'order_deleted' | 'bulk_update'
  orderId?: string
  orderIds?: string[]
  tenantId: string
  timestamp: string
  updatedBy: string
  changes: {
    status?: string
    assignedTo?: string
    notes?: string
    sortOrder?: number
  }
  source: 'local' | 'remote' // Track if update originated locally
}

interface UseRealtimeWebSocketOptions {
  enabled?: boolean
  batchDelay?: number // Milliseconds to batch rapid updates
  onUpdate?: (update: RealtimeUpdate) => void
}

export function useRealtimeWebSocket(options: UseRealtimeWebSocketOptions = {}) {
  const { enabled = true, batchDelay = 300, onUpdate } = options
  const { tenant, user } = useAuth()
  
  const [isConnected, setIsConnected] = useState(false)
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  
  // Use SSE instead of WebSocket for more reliable real-time updates
  const eventSourceRef = useRef<EventSource | null>(null)
  const updateBatchRef = useRef<RealtimeUpdate[]>([])
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pendingOptimisticUpdates = useRef<Map<string, RealtimeUpdate>>(new Map())
  
  // Prevent duplicate processing
  const processedUpdateIds = useRef<Set<string>>(new Set())
  
  // ANTI-FLICKER: Batch rapid updates together
  const batchUpdate = useCallback((update: RealtimeUpdate) => {
    updateBatchRef.current.push(update)
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
    }
    
    batchTimeoutRef.current = setTimeout(() => {
      const batch = updateBatchRef.current
      updateBatchRef.current = []
      
      if (batch.length > 0) {
        console.log(`📦 [SSE-REALTIME] Processing batch of ${batch.length} updates`)
        
        // Group by order ID to merge rapid changes to same order
        const mergedUpdates = new Map<string, RealtimeUpdate>()
        
        batch.forEach(update => {
          const key = update.orderId || 'bulk'
          const existing = mergedUpdates.get(key)
          
          if (existing && update.orderId) {
            // Merge changes for same order
            mergedUpdates.set(key, {
              ...existing,
              changes: { ...existing.changes, ...update.changes },
              timestamp: update.timestamp // Use latest timestamp
            })
          } else {
            mergedUpdates.set(key, update)
          }
        })
        
        // Process merged updates
        mergedUpdates.forEach(update => {
          onUpdate?.(update)
        })
        
        setUpdates(prev => [...prev, ...Array.from(mergedUpdates.values())])
      }
    }, batchDelay)
  }, [batchDelay, onUpdate])
  
  // ANTI-LOOP: Optimistic update (for future use)
  const sendOptimisticUpdate = useCallback((orderId: string, changes: any) => {
    if (!tenant?.id || !user) return
    
    const optimisticUpdate: RealtimeUpdate = {
      type: 'order_updated',
      orderId,
      tenantId: tenant.id,
      timestamp: new Date().toISOString(),
      updatedBy: user.id,
      changes,
      source: 'local'
    }
    
    // Apply optimistically (immediate UI update)
    onUpdate?.(optimisticUpdate)
    
    console.log('📤 [SSE-REALTIME] Optimistic update applied:', optimisticUpdate)
    
  }, [tenant?.id, user, onUpdate])
  
  // SSE connection management
  const connect = useCallback(() => {
    if (!tenant?.id || !enabled) return
    
    // Cleanup existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    
    setConnectionStatus('connecting')
    
    const sseUrl = `https://order-to-do.stanleytan92.workers.dev/api/tenants/${tenant.id}/realtime/orders`
    
    console.log('🔌 [SSE-REALTIME] Connecting to:', sseUrl)
    
    try {
      eventSourceRef.current = new EventSource(sseUrl)
      
      eventSourceRef.current.onopen = () => {
        console.log('✅ [SSE-REALTIME] Connected')
        setIsConnected(true)
        setConnectionStatus('connected')
      }
      
      eventSourceRef.current.addEventListener('connected', (event) => {
        console.log('🎉 [SSE-REALTIME] Connection established')
      })
      
      eventSourceRef.current.addEventListener('order_update', (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 [SSE-REALTIME] Order update received:', data.type)
          
          // ANTI-LOOP: Skip updates from this user (already applied optimistically)
          if (data.updatedBy === user?.id) {
            console.log('⏭️ [SSE-REALTIME] Skipping own update:', data.orderId)
            return
          }
          
          // ANTI-DUPLICATE: Check if already processed
          const duplicateKey = `${data.orderId}-${data.timestamp}`
          if (processedUpdateIds.current.has(duplicateKey)) {
            console.log('⏭️ [SSE-REALTIME] Skipping duplicate update:', duplicateKey)
            return
          }
          processedUpdateIds.current.add(duplicateKey)
          
          // ANTI-FLICKER: Batch the update
          batchUpdate({
            ...data,
            source: 'remote'
          })
          
        } catch (error) {
          console.error('❌ [SSE-REALTIME] Failed to parse update:', error)
        }
      })
      
      eventSourceRef.current.addEventListener('heartbeat', (event) => {
        // Heartbeat received - connection is alive
        console.log('💓 [SSE-REALTIME] Heartbeat received')
      })
      
      eventSourceRef.current.onerror = (error) => {
        console.error('❌ [SSE-REALTIME] Error:', error)
        setIsConnected(false)
        setConnectionStatus('error')
        
        // Auto-reconnect after delay (if enabled)
        if (enabled) {
          setTimeout(() => {
            console.log('🔄 [SSE-REALTIME] Attempting to reconnect...')
            connect()
          }, 5000)
        }
      }
      
    } catch (error) {
      console.error('❌ [SSE-REALTIME] Connection failed:', error)
      setConnectionStatus('error')
    }
    
  }, [tenant?.id, enabled, user?.id, batchUpdate])
  
  // Start connection when enabled
  useEffect(() => {
    if (enabled && tenant?.id) {
      connect()
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [enabled, tenant?.id, connect])
  
  return {
    isConnected,
    connectionStatus,
    updates,
    sendOptimisticUpdate,
    connect: () => connect(),
    disconnect: () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }
} 