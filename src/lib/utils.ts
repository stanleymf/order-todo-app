import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Singapore Timezone Utilities
export const SINGAPORE_TIMEZONE = 'Asia/Singapore'

/**
 * Convert UTC timestamp to Singapore time for display
 * @param utcTimestamp - UTC timestamp string (ISO format)
 * @returns Formatted Singapore time string
 */
export function formatSingaporeTime(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return 'Not set'
  
  try {
    const date = new Date(utcTimestamp)
    if (isNaN(date.getTime())) return 'Invalid date'
    
    // Format the UTC date to Singapore timezone
    return date.toLocaleString('en-SG', {
      timeZone: SINGAPORE_TIMEZONE,
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('Error formatting Singapore time:', error)
    return 'Invalid date'
  }
}

/**
 * Convert UTC timestamp to Singapore date for display
 * @param utcTimestamp - UTC timestamp string (ISO format)
 * @returns Formatted Singapore date string (dd/mm/yyyy)
 */
export function formatSingaporeDate(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return 'Not set'
  
  try {
    const date = new Date(utcTimestamp)
    if (isNaN(date.getTime())) return 'Invalid date'
    
    return date.toLocaleDateString('en-SG', {
      timeZone: SINGAPORE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch (error) {
    console.error('Error formatting Singapore date:', error)
    return 'Invalid date'
  }
}

/**
 * Get current Singapore time as ISO string
 * @returns Current time in Singapore timezone as ISO string
 */
export function getCurrentSingaporeTime(): string {
  // Get current time and just return it as ISO - this will be UTC
  // The formatting functions will handle the Singapore timezone conversion
  return new Date().toISOString()
}

/**
 * Convert UTC time to Singapore time for relative display (e.g., "2 minutes ago")
 * @param utcTimestamp - UTC timestamp string
 * @returns Relative time string in Singapore context
 */
export function formatSingaporeRelativeTime(utcTimestamp: string | null | undefined): string {
  if (!utcTimestamp) return 'Unknown'
  
  try {
    const date = new Date(utcTimestamp)
    const now = new Date()
    
    // Convert both to Singapore time for accurate relative calculation
    const sgDate = new Date(date.toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }))
    const sgNow = new Date(now.toLocaleString('en-US', { timeZone: SINGAPORE_TIMEZONE }))
    
    const diffMs = sgNow.getTime() - sgDate.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
    
    // For longer periods, show the actual Singapore date
    return formatSingaporeDate(utcTimestamp)
  } catch (error) {
    console.error('Error formatting relative time:', error)
    return 'Unknown'
  }
}

/**
 * Get Singapore business hours date range for analytics
 * @param days - Number of days to go back
 * @returns Start and end dates in Singapore timezone
 */
export function getSingaporeDateRange(days: number = 7): {
  startDate: string
  endDate: string
  startDateSG: string
  endDateSG: string
} {
  const now = new Date()
  
  // Get current date in Singapore timezone
  const endDateSG = now.toLocaleDateString('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  })
  
  // Get date N days ago in Singapore timezone
  const startDateObj = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000))
  const startDateSG = startDateObj.toLocaleDateString('en-SG', {
    timeZone: SINGAPORE_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  
  // Convert to ISO format for API (use UTC dates)
  const endDate = now.toISOString().split('T')[0]
  const startDate = startDateObj.toISOString().split('T')[0]
  
  return {
    startDate, // ISO format for API
    endDate,   // ISO format for API
    startDateSG, // Display format
    endDateSG    // Display format
  }
}
