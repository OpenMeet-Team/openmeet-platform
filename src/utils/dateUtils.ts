import { date } from 'quasar'
import { EventEntity } from '../types'

export function getRoundedHumanReadableDateDifference (startDate: string | Date, endDate: string | Date): string {
  return getHumanReadableDateDifference(startDate, endDate).split(', ')[0]
}

export function getHumanReadableDateDifference (startDate: string | Date, endDate: string | Date): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const differenceMs = end.getTime() - start.getTime() // Use getTime() for a more accurate difference

  if (differenceMs < 0) {
    return 'Just seconds'
  }

  const seconds = Math.floor(differenceMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const formatted: string[] = [] // Specify the type for the formatted array
  if (days > 0) formatted.push(`${days} day${days > 1 ? 's' : ''}`)
  if (hours % 24 > 0) formatted.push(`${hours % 24} hour${(hours % 24) > 1 ? 's' : ''}`)
  if (minutes % 60 > 0) formatted.push(`${minutes % 60} minute${(minutes % 60) > 1 ? 's' : ''}`)
  if (seconds % 60 > 0) formatted.push(`${seconds % 60} second${(seconds % 60) > 1 ? 's' : ''}`)

  return formatted.join(', ')
}

export function formatDate (dateString: string, format?: string) {
  return date.formatDate(dateString, format || 'ddd, MMM D, YYYY, HH:mm')
}

export function formatRelativeTime (dateString: string | Date): string {
  const now = new Date()
  const target = new Date(dateString)
  const differenceMs = now.getTime() - target.getTime()

  if (differenceMs < 0) {
    return 'just now'
  }

  const seconds = Math.floor(differenceMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${years} year${years > 1 ? 's' : ''} ago`
}

export function addToGoogleCalendar (event: EventEntity) {
  // Prepare the event details
  const title = encodeURIComponent(event.name)
  const description = encodeURIComponent(event.description || '')
  const location = encodeURIComponent(event.location || '')
  const startTime = encodeURIComponent(formatDate(event.startDate, 'YYYYMMDDTHHMMSS')) // Format your date to YYYYMMDDTHHMMSS
  const endTime = event.endDate && encodeURIComponent(formatDate(event.endDate, 'YYYYMMDDTHHMMSS')) // Format your date to YYYYMMDDTHHMMSS

  // Create the Google Calendar URL
  const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${description}&location=${location}&sf=true&output=xml`

  // Open the URL in a new tab
  window.open(url, '_blank')
}

export function addToOutlookCalendar (event: EventEntity) {
  // Prepare the event details
  const title = encodeURIComponent(event.name)
  const description = encodeURIComponent(event.description || '')
  const location = encodeURIComponent(event.location || '')
  const startTime = formatDate(event.startDate, 'YYYYMMDDTHHMMSS') // Format your date to YYYYMMDDTHHMMSS
  const endTime = event.endDate && formatDate(event.endDate, 'YYYYMMDDTHHMMSS') // Format your date to YYYYMMDDTHHMMSS

  // Create the Outlook Calendar URL
  const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${description}&location=${location}&startdt=${startTime}&enddt=${endTime}`

  // Open the URL in a new tab
  window.open(url, '_blank')
}
