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
  const { enabled = true, pollInterval = 3000, onUpdate } = options
  const { tenant } = useAuth()

  // Create unique client identifier for debugging
  const clientId = useRef(`${navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'}-${Date.now()}`).current

  console.log('🔄 [REALTIME-HOOK] Initializing/re-initializing hook', {
    clientId,
    tenantId: tenant?.id,
    tenantName: tenant?.name,
    enabled,
    hasCallback: !!onUpdate,
    userAgent: navigator.userAgent.substring(0, 100),
    timestamp: new Date().toISOString(),
    // Mobile-specific environment debugging
    environment: {
      isMobile: navigator.userAgent.includes('Mobile'),
      isTouch: 'ontouchstart' in window,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink
      } : 'unknown'
    }
  })

  const [isConnected, setIsConnected] = useState(false)
  const [updates, setUpdates] = useState<RealtimeUpdate[]>([])
  const lastUpdate = updates[updates.length - 1]

  // ENHANCED: Add failure tracking and rate monitoring
  const consecutiveFailures = useRef(0)
  const lastSuccessTime = useRef<number>(Date.now())
  const lastUpdateTime = useRef<number>(0)
  const updateCount = useRef<number>(0)

  const pollIntervalRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const lastKnownStates = useRef<Map<string, string>>(new Map()) // Track last known states per order
  const lastProcessedTimestamps = useRef<Map<string, string>>(new Map()) // Track when we last processed each order
  const knownOrderIds = useRef<Set<string>>(new Set()) // Track last known states

  // Enhanced polling-based real-time updates (no SSE)
  const checkForUpdates = useCallback(async () => {
    if (!tenant?.id || !enabled) {
      console.log(`❌ [${clientId}] POLLING Stopped - missing tenant or disabled:`, { 
        tenantId: tenant?.id, 
        tenantName: tenant?.name,
        enabled 
      })
      return
    }

    console.log(`🔄 [${clientId}] POLLING Checking updates...`, new Date().toLocaleTimeString())

    try {
      const url = `${API_BASE_URL}/api/tenants/${tenant.id}/order-card-states/realtime-check`
      
      // Start timing the request
      const startTime = performance.now()
      
      // Debug auth token with detailed info
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        console.error(`❌ [${clientId}] POLLING No auth token found!`, {
          localStorage_keys: Object.keys(localStorage),
          tenantId: tenant?.id,
          tenantName: tenant?.name
        })
        setIsConnected(false)
        return
      }
      
      // Log token info (first/last few chars for security)
      console.log(`🔑 [${clientId}] POLLING Auth token:`, {
        tokenStart: authToken.substring(0, 10),
        tokenEnd: authToken.substring(authToken.length - 10),
        tokenLength: authToken.length,
        tenantId: tenant.id,
        tenantName: tenant?.name
      })
      
      // Check for changes in order_card_states table directly with auth
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const endTime = performance.now()
      const requestDuration = Math.round(endTime - startTime)

      console.log(`📡 [${clientId}] POLLING Response:`, response.status, response.statusText, `(${requestDuration}ms)`)

      if (response.ok) {
        const data = await response.json()
        console.log(`📊 [${clientId}] POLLING Changes found:`, data.changes?.length || 0)
        
        // ENHANCED: Reset failure tracking on success
        consecutiveFailures.current = 0
        lastSuccessTime.current = Date.now()
        
        // ENHANCED: Log the actual server response for debugging
        console.log(`🔍 [${clientId}] POLLING Server response:`, {
          changesCount: data.changes?.length || 0,
          timestamp: data.timestamp,
          debug: data.debug,
          queryWindow: data.queryWindow
        })
        
        if (data.changes && data.changes.length > 0) {
          const newUpdates: RealtimeUpdate[] = []
          
          for (const change of data.changes) {
            const lastProcessedTimestamp = lastProcessedTimestamps.current.get(change.cardId)
            
            // Check if this is a new order (not seen before) or an updated order
            const isNewOrder = !knownOrderIds.current.has(change.cardId)
            const hasNewerTimestamp = !lastProcessedTimestamp || change.updatedAt > lastProcessedTimestamp
            
            console.log(`🔍 [${clientId}] POLLING Order ${change.cardId}:`, {
              isNewOrder,
              hasNewerTimestamp,
              changeTime: change.updatedAt,
              lastProcessed: lastProcessedTimestamp,
              willUpdate: isNewOrder || hasNewerTimestamp,
              assignedBy: change.assignedBy
            })
            
            // FIXED: Use timestamp comparison for cross-device detection
            if (isNewOrder || hasNewerTimestamp) {
              console.log(`🔥 [${clientId}] POLLING DETECTED ${isNewOrder ? 'NEW ORDER' : 'CHANGE'} for ${change.cardId}`)
              
              // ENHANCED: Log before state update
              console.log(`📝 [${clientId}] POLLING BEFORE STATE UPDATE:`, {
                orderId: change.cardId,
                oldTimestamp: lastProcessedTimestamp,
                newTimestamp: change.updatedAt,
                currentKnownOrders: knownOrderIds.current.size,
                currentTimestamps: Object.fromEntries(lastProcessedTimestamps.current)
              })
              
              // Update tracking
              lastProcessedTimestamps.current.set(change.cardId, change.updatedAt)
              knownOrderIds.current.add(change.cardId)
              
              // ENHANCED: Log after state update
              console.log(`✅ [${clientId}] POLLING AFTER STATE UPDATE:`, {
                orderId: change.cardId,
                newStoredTimestamp: lastProcessedTimestamps.current.get(change.cardId),
                totalKnownOrders: knownOrderIds.current.size,
                allStoredTimestamps: Object.fromEntries(lastProcessedTimestamps.current)
              })
              
              const update: RealtimeUpdate = {
                type: isNewOrder ? 'order_created' : 'order_updated',
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
              // ENHANCED: Log why update was skipped
              console.log(`⏭️ [${clientId}] POLLING SKIPPING ORDER ${change.cardId}:`, {
                reason: isNewOrder ? 'not new' : 'timestamp not newer',
                isNewOrder,
                hasNewerTimestamp,
                changeTime: change.updatedAt,
                lastProcessed: lastProcessedTimestamp,
                timeDiff: lastProcessedTimestamp ? new Date(change.updatedAt).getTime() - new Date(lastProcessedTimestamp).getTime() : 'no previous time'
              })
            }
          }
          
          if (newUpdates.length > 0) {
            console.log(`🎯 [${clientId}] POLLING Triggering`, newUpdates.length, 'updates')
            setUpdates(prev => [...prev, ...newUpdates])
            setIsConnected(true)
            
            // ENHANCED: Rate analysis
            const now = Date.now()
            const timeSinceLastUpdate = now - lastUpdateTime.current
            updateCount.current += newUpdates.length
            lastUpdateTime.current = now
            
            console.log(`⏱️ [${clientId}] POLLING RATE ANALYSIS:`, {
              updatesInBatch: newUpdates.length,
              timeSinceLastBatch: timeSinceLastUpdate,
              totalUpdatesProcessed: updateCount.current,
              averageTimeBetweenBatches: updateCount.current > 1 ? (now - lastSuccessTime.current) / (updateCount.current - 1) : 'first batch'
            })
            
            // Call the onUpdate callback for each update
            newUpdates.forEach(update => {
              console.log(`🚀 [${clientId}] POLLING Callback for:`, update.orderId, 'by', update.updatedBy)
              onUpdate?.(update)
            })

            // ENHANCED: Check for rapid changes
            const rapidChanges = newUpdates.filter(change => {
              const changeTime = new Date(change.timestamp).getTime()
              const now = Date.now()
              return (now - changeTime) < 5000 // Changes within last 5 seconds
            })
            
            if (rapidChanges.length > 1) {
              console.log(`⚡ [${clientId}] POLLING DETECTED RAPID CHANGES:`, {
                totalChanges: newUpdates.length,
                rapidChanges: rapidChanges.length,
                rapidChangeDetails: rapidChanges.map(c => ({
                  orderId: c.orderId,
                  timestamp: c.timestamp,
                  ageMs: Date.now() - new Date(c.timestamp).getTime()
                }))
              })
            }
          } else {
            console.log(`⏸️ [${clientId}] POLLING No new updates to process`)
          }
        } else {
          console.log(`✅ [${clientId}] POLLING No changes found`)
          setIsConnected(true) // Still connected, just no changes
        }
      } else {
        // ENHANCED: Track failures
        consecutiveFailures.current += 1
        console.error(`🚨 [${clientId}] POLLING Failed:`, response.status, await response.text())
        console.error(`📊 [${clientId}] POLLING Failure count:`, consecutiveFailures.current)
        setIsConnected(false)
        
        // ENHANCED: Check if it's an auth error specifically
        if (response.status === 401 || response.status === 403) {
          console.error(`🔒 [${clientId}] POLLING Authentication failed - token may be expired`)
        }
      }
    } catch (error) {
      // ENHANCED: Track failures
      consecutiveFailures.current += 1
      console.error(`🚨 [${clientId}] POLLING Error:`, error)
      console.error(`📊 [${clientId}] POLLING Failure count:`, consecutiveFailures.current)
      setIsConnected(false)
      
      // ENHANCED: Log network error details
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`🌐 [${clientId}] POLLING Network error - check connectivity`)
      }
    }
    
    // ENHANCED: Log health status
    const timeSinceLastSuccess = Date.now() - lastSuccessTime.current
    if (timeSinceLastSuccess > 30000) { // 30 seconds
      console.warn(`⚠️ [${clientId}] POLLING Health warning: No successful poll in ${Math.round(timeSinceLastSuccess/1000)}s`)
    }
  }, [tenant?.id, enabled, onUpdate, clientId])

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

  // Start/stop polling
  useEffect(() => {
    if (enabled && tenant?.id) {
      console.log(`🎬 [${clientId}] POLLING Starting interval polling for tenant:`, tenant.id, tenant.name)
      
      // CONNECTIVITY TEST: Test if we can reach the server immediately
      const testConnectivity = async () => {
        try {
          const authToken = localStorage.getItem('auth_token')
          if (!authToken) {
            console.error(`❌ [${clientId}] CONNECTIVITY TEST: No auth token!`)
            return
          }
          
          console.log(`🧪 [${clientId}] CONNECTIVITY TEST: Testing server connection...`)
          const testResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenant.id}/order-card-states/realtime-check`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
          
          console.log(`🧪 [${clientId}] CONNECTIVITY TEST: Response:`, testResponse.status, testResponse.statusText)
          
          if (testResponse.ok) {
            const testData = await testResponse.json()
            console.log(`✅ [${clientId}] CONNECTIVITY TEST: SUCCESS - Server reachable, got ${testData.changes?.length || 0} changes`)
          } else {
            console.error(`❌ [${clientId}] CONNECTIVITY TEST: FAILED -`, testResponse.status, await testResponse.text())
          }
        } catch (error) {
          console.error(`❌ [${clientId}] CONNECTIVITY TEST: ERROR -`, error)
        }
      }
      
      // Run connectivity test immediately
      testConnectivity()
      
      // Initial check
      checkForUpdates()
      
      // Start interval
      const interval = setInterval(() => {
        console.log(`⏰ [${clientId}] POLLING Interval tick at`, new Date().toLocaleTimeString())
        checkForUpdates()
      }, pollInterval)
      
      console.log(`✅ [${clientId}] POLLING Interval ID:`, interval, 'every', pollInterval, 'ms')

      return () => {
        console.log(`🛑 [${clientId}] POLLING Clearing interval:`, interval)
        clearInterval(interval)
      }
    } else {
      console.log(`⭕ [${clientId}] POLLING Not starting - enabled:`, enabled, 'tenant:', tenant?.id)
    }
  }, [enabled, tenant?.id, checkForUpdates, pollInterval, clientId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`🧹 [${clientId}] REALTIME-HOOK Component unmounting - cleaning up`)
    }
  }, [])

  return {
    isConnected,
    updates,
    lastUpdate,
    checkForUpdates,
    disconnect
  }
} 