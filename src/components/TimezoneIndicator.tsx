import React, { useState, useEffect } from 'react'
import { Badge } from './ui/badge'
import { Clock } from 'lucide-react'

interface TimezoneIndicatorProps {
  showLabel?: boolean
  className?: string
}

export const TimezoneIndicator: React.FC<TimezoneIndicatorProps> = ({ 
  showLabel = true, 
  className = "" 
}) => {
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    const updateTime = () => {
      // Get current Singapore time directly using the browser's timezone conversion
      const sgTime = new Date().toLocaleString('en-SG', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
      setCurrentTime(sgTime)
    }

    // Update immediately
    updateTime()
    
    // Update every second
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Clock className="h-4 w-4 text-emerald-600" />
      <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">
        {showLabel && "Singapore: "}{currentTime}
      </Badge>
    </div>
  )
}

export const TimezoneNotice: React.FC = () => {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <div className="text-sm text-emerald-800">
          <strong>Singapore Timezone:</strong> All system timestamps and analytics are now displayed in Singapore time for better local context.
        </div>
      </div>
    </div>
  )
} 