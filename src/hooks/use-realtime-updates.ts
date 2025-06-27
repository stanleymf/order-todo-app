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
  const {
    enabled = true,
    pollInterval = 1500, // Reduced from 3000ms to 1.5s for faster bulk updates
    onUpdate
  } = options
  const { tenant } = useAuth()

  // Create unique client ID for this session
  const clientId = useRef(`${typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}-${Date.now()}`)
  
  // CROSS-DEVICE FIX: Add session timestamp to make each session independent
  const sessionStartTime = useRef(Date.now())
  const lastProcessedTimestamps = useRef<Map<string, string>>(new Map())
  const knownOrderIds = useRef<Set<string>>(new Set())

  console.log('🔄 [REALTIME-HOOK] Initializing/re-initializing hook', {
    clientId: clientId.current,
    tenantId: tenant?.id,
    tenantName: tenant?.name,
    enabled,
    hasCallback: !!onUpdate,
    pollInterval
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

  // Enhanced polling-based real-time updates (no SSE)
  const checkForUpdates = useCallback(async () => {
    if (!tenant?.id || !enabled) {
      console.log(`❌ [${clientId.current}] POLLING Stopped - missing tenant or disabled:`, { 
        tenantId: tenant?.id, 
        tenantName: tenant?.name,
        enabled 
      })
      return
    }

    console.log(`🔄 [${clientId.current}] POLLING Checking updates...`, new Date().toLocaleTimeString())

    try {
      const url = `${API_BASE_URL}/api/tenants/${tenant.id}/order-card-states/realtime-check`
      
      // Start timing the request
      const startTime = performance.now()
      
      // Debug auth token with detailed info
      const authToken = localStorage.getItem('auth_token')
      if (!authToken) {
        console.error(`❌ [${clientId.current}] POLLING No auth token found!`, {
          localStorage_keys: Object.keys(localStorage),
          tenantId: tenant?.id,
          tenantName: tenant?.name
        })
        setIsConnected(false)
        return
      }
      
      // Log token info (first/last few chars for security)
      console.log(`🔑 [${clientId.current}] POLLING Auth token:`, {
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

      console.log(`📡 [${clientId.current}] POLLING Response:`, response.status, response.statusText, `(${requestDuration}ms)`)

      if (response.ok) {
        const data = await response.json()
        console.log(`📊 [${clientId.current}] POLLING Changes found:`, data.changes?.length || 0)
        
        // ENHANCED: Reset failure tracking on success
        consecutiveFailures.current = 0
        lastSuccessTime.current = Date.now()
        
        // ENHANCED: Log the actual server response for debugging
        console.log(`🔍 [${clientId.current}] POLLING Server response:`, {
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
            
            // CROSS-DEVICE FIX: Only process changes that happened after this session started
            const changeTime = new Date(change.updatedAt).getTime()
            const sessionStarted = sessionStartTime.current
            const isAfterSessionStart = changeTime >= sessionStarted
            
            // ENHANCED: Detailed timestamp comparison debugging with error handling
            let changeTimeMs = 0
            let lastProcessedMs = 0
            let timeDiffMs = 0
            let changeTimeDate = 'invalid'
            let lastProcessedDate = 'none'
            let comparisonResult = false
            
            try {
              changeTimeMs = new Date(change.updatedAt).getTime()
              lastProcessedMs = lastProcessedTimestamp ? new Date(lastProcessedTimestamp).getTime() : 0
              timeDiffMs = changeTimeMs - lastProcessedMs
              changeTimeDate = new Date(change.updatedAt).toISOString()
              lastProcessedDate = lastProcessedTimestamp ? new Date(lastProcessedTimestamp).toISOString() : 'none'
              comparisonResult = lastProcessedTimestamp ? (new Date(change.updatedAt) > new Date(lastProcessedTimestamp)) : true
            } catch (dateError) {
              console.error(`[${clientId.current}] POLLING Date parsing error:`, {
                error: dateError,
                changeUpdatedAt: change.updatedAt,
                lastProcessedTimestamp,
                changeUpdatedAtType: typeof change.updatedAt
              })
              // For invalid dates, treat as newer to prevent permanent skipping
              comparisonResult = true
            }
            
            // CROSS-DEVICE FIX: Only process if it's after session start AND (new or newer timestamp)
            const hasNewerTimestamp = !lastProcessedTimestamp || comparisonResult
            const shouldProcess = isAfterSessionStart && (isNewOrder || hasNewerTimestamp)
            
            console.log(`🔍 [${clientId.current}] POLLING Order ${change.cardId}:`, {
              isNewOrder,
              hasNewerTimestamp,
              isAfterSessionStart,
              shouldProcess,
              changeTime: change.updatedAt,
              lastProcessed: lastProcessedTimestamp,
              sessionStartTime: new Date(sessionStarted).toISOString(),
              willUpdate: shouldProcess,
              timestampDebug: {
                changeTimeMs,
                lastProcessedMs,
                timeDiffMs,
                changeTimeDate,
                lastProcessedDate,
                comparisonResult
              }
            })
            
            // CROSS-DEVICE FIX: Use shouldProcess instead of original logic
            if (shouldProcess) {
              console.log(`🔥 [${clientId.current}] POLLING DETECTED ${isNewOrder ? 'NEW ORDER' : 'CHANGE'} for ${change.cardId}`)
              
              // ENHANCED: Log before state update
              console.log(`📝 [${clientId.current}] POLLING BEFORE STATE UPDATE:`, {
                orderId: change.cardId,
                oldTimestamp: lastProcessedTimestamp,
                newTimestamp: change.updatedAt,
                currentKnownOrders: knownOrderIds.current.size,
                currentTimestamps: Object.fromEntries(lastProcessedTimestamps.current)
              })
              
              // DON'T update tracking here - wait until after successful processing!
              
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
              console.log(`⏭️ [${clientId.current}] POLLING SKIPPING ORDER ${change.cardId}:`, {
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
            console.log(`🎯 [${clientId.current}] POLLING Triggering`, newUpdates.length, 'updates')
            setUpdates(prev => [...prev, ...newUpdates])
            setIsConnected(true)
            
            // ENHANCED: Rate analysis
            const now = Date.now()
            const timeSinceLastUpdate = now - lastUpdateTime.current
            updateCount.current += newUpdates.length
            lastUpdateTime.current = now
            
            console.log(`⏱️ [${clientId.current}] POLLING RATE ANALYSIS:`, {
              updatesInBatch: newUpdates.length,
              timeSinceLastBatch: timeSinceLastUpdate,
              totalUpdatesProcessed: updateCount.current,
              averageTimeBetweenBatches: updateCount.current > 1 ? (now - lastSuccessTime.current) / (updateCount.current - 1) : 'first batch'
            })
            
            // Call the onUpdate callback for each update
            newUpdates.forEach(update => {
              console.log(`🚀 [${clientId.current}] POLLING Callback for:`, update.orderId, 'by', update.updatedBy)
              onUpdate?.(update)
            })

            // NOW UPDATE TRACKING - only after successful processing!
            newUpdates.forEach(update => {
              lastProcessedTimestamps.current.set(update.orderId, update.timestamp)
              knownOrderIds.current.add(update.orderId)
              
              console.log(`✅ [${clientId.current}] POLLING MARKED AS PROCESSED:`, {
                orderId: update.orderId,
                timestamp: update.timestamp,
                totalTracked: lastProcessedTimestamps.current.size
              })
            })

            // ENHANCED: Check for rapid changes
            const rapidChanges = newUpdates.filter(change => {
              const changeTime = new Date(change.timestamp).getTime()
              const now = Date.now()
              return (now - changeTime) < 5000 // Changes within last 5 seconds
            })
            
            // ENHANCED: Detect bulk operations (multiple orders updated rapidly)
            const bulkChanges = newUpdates.filter(change => {
              const changeTime = new Date(change.timestamp).getTime()
              const now = Date.now()
              return (now - changeTime) < 10000 // Changes within last 10 seconds
            })
            
            if (bulkChanges.length >= 3) {
              console.log(`📦 [${clientId.current}] POLLING DETECTED BULK OPERATION:`, {
                totalChanges: newUpdates.length,
                bulkChanges: bulkChanges.length,
                timeSpan: '10 seconds',
                affectedOrders: bulkChanges.map(c => c.orderId),
                updatedBy: [...new Set(bulkChanges.map(c => c.updatedBy))],
                statusChanges: bulkChanges.map(c => `${c.orderId}: ${c.status}`)
              })
              
              // Trigger immediate notification for bulk operations
              if (onUpdate) {
                setTimeout(() => {
                  console.log(`🚨 [${clientId.current}] BULK OPERATION: Triggering immediate UI refresh`)
                  // Could trigger a special bulk update event here
                }, 100)
              }
            }
            
            if (rapidChanges.length > 1) {
              console.log(`⚡ [${clientId.current}] POLLING DETECTED RAPID CHANGES:`, {
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
            console.log(`⏸️ [${clientId.current}] POLLING No new updates to process`)
          }
        } else {
          console.log(`✅ [${clientId.current}] POLLING No changes found`)
          setIsConnected(true) // Still connected, just no changes
        }
      } else {
        // ENHANCED: Track failures
        consecutiveFailures.current += 1
        console.error(`🚨 [${clientId.current}] POLLING Failed:`, response.status, await response.text())
        console.error(`📊 [${clientId.current}] POLLING Failure count:`, consecutiveFailures.current)
        setIsConnected(false)
        
        // ENHANCED: Check if it's an auth error specifically
        if (response.status === 401 || response.status === 403) {
          console.error(`🔒 [${clientId.current}] POLLING Authentication failed - token may be expired`)
        }
      }
    } catch (error) {
      // ENHANCED: Track failures
      consecutiveFailures.current += 1
      console.error(`🚨 [${clientId.current}] POLLING Error:`, error)
      console.error(`📊 [${clientId.current}] POLLING Failure count:`, consecutiveFailures.current)
      setIsConnected(false)
      
      // ENHANCED: Log network error details
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error(`🌐 [${clientId.current}] POLLING Network error - check connectivity`)
      }
    }
    
    // ENHANCED: Log health status
    const timeSinceLastSuccess = Date.now() - lastSuccessTime.current
    if (timeSinceLastSuccess > 30000) { // 30 seconds
      console.warn(`⚠️ [${clientId.current}] POLLING Health warning: No successful poll in ${Math.round(timeSinceLastSuccess/1000)}s`)
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

  // Start/stop polling
  useEffect(() => {
    if (enabled && tenant?.id) {
      console.log(`🎬 [${clientId.current}] POLLING Starting interval polling for tenant:`, tenant.id, tenant.name)
      
      // CROSS-DEVICE FIX: Clear stale timestamps older than 30 minutes to prevent cross-device issues
      const now = Date.now()
      const thirtyMinutesAgo = now - (30 * 60 * 1000)
      let clearedCount = 0
      
      for (const [orderId, timestamp] of lastProcessedTimestamps.current.entries()) {
        const timestampMs = new Date(timestamp).getTime()
        if (timestampMs < thirtyMinutesAgo) {
          lastProcessedTimestamps.current.delete(orderId)
          knownOrderIds.current.delete(orderId)
          clearedCount++
        }
      }
      
      console.log(`🧹 [${clientId.current}] POLLING Cleared ${clearedCount} stale timestamps older than 30 minutes`)
      
      // CONNECTIVITY TEST: Test if we can reach the server immediately
      const testConnectivity = async () => {
        try {
          const authToken = localStorage.getItem('auth_token')
          if (!authToken) {
            console.error(`❌ [${clientId.current}] CONNECTIVITY TEST: No auth token!`)
            return
          }
          
          console.log(`🧪 [${clientId.current}] CONNECTIVITY TEST: Testing server connection...`)
          const testResponse = await fetch(`${API_BASE_URL}/api/tenants/${tenant.id}/order-card-states/realtime-check`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          })
          
          console.log(`🧪 [${clientId.current}] CONNECTIVITY TEST: Response:`, testResponse.status, testResponse.statusText)
          
          if (testResponse.ok) {
            const testData = await testResponse.json()
            console.log(`✅ [${clientId.current}] CONNECTIVITY TEST: SUCCESS - Server reachable, got ${testData.changes?.length || 0} changes`)
          } else {
            console.error(`❌ [${clientId.current}] CONNECTIVITY TEST: FAILED -`, testResponse.status, await testResponse.text())
          }
        } catch (error) {
          console.error(`❌ [${clientId.current}] CONNECTIVITY TEST: ERROR -`, error)
        }
      }
      
      // Run connectivity test immediately
      testConnectivity()
      
      // Initial check
      checkForUpdates()
      
      // Start interval
      const interval = setInterval(() => {
        console.log(`⏰ [${clientId.current}] POLLING Interval tick at`, new Date().toLocaleTimeString())
        checkForUpdates()
      }, pollInterval)
      
      console.log(`✅ [${clientId.current}] POLLING Interval ID:`, interval, 'every', pollInterval, 'ms')

      return () => {
        console.log(`🛑 [${clientId.current}] POLLING Clearing interval:`, interval)
        clearInterval(interval)
      }
    } else {
      console.log(`⭕ [${clientId.current}] POLLING Not starting - enabled:`, enabled, 'tenant:', tenant?.id)
    }
  }, [enabled, tenant?.id, checkForUpdates, pollInterval])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log(`🧹 [${clientId.current}] REALTIME-HOOK Component unmounting - cleaning up`)
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