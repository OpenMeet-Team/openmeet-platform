import { api } from '../boot/axios'
import { useAuthStore } from '../stores/auth-store'

/**
 * Generate calendar download URL for user's personal calendar
 * @param startDate Optional start date for filtering (YYYY-MM-DD)
 * @param endDate Optional end date for filtering (YYYY-MM-DD)
 * @returns URL string for downloading user's calendar
 */
export function getUserCalendarDownloadUrl (startDate?: string, endDate?: string): string {
  const baseUrl = api.defaults.baseURL || ''
  let url = `${baseUrl}/api/calendar/my/calendar.ics`

  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)

  if (params.toString()) {
    url += `?${params.toString()}`
  }

  return url
}

/**
 * Generate calendar download URL for group calendar
 * @param groupSlug Group slug identifier
 * @param startDate Optional start date for filtering (YYYY-MM-DD)
 * @param endDate Optional end date for filtering (YYYY-MM-DD)
 * @returns URL string for downloading group's calendar
 */
export function getGroupCalendarDownloadUrl (groupSlug: string, startDate?: string, endDate?: string): string {
  const baseUrl = api.defaults.baseURL || ''
  let url = `${baseUrl}/api/calendar/groups/${groupSlug}/calendar.ics`

  const params = new URLSearchParams()
  if (startDate) params.append('start', startDate)
  if (endDate) params.append('end', endDate)

  if (params.toString()) {
    url += `?${params.toString()}`
  }

  return url
}

/**
 * Download user's personal calendar
 * @param startDate Optional start date for filtering (YYYY-MM-DD)
 * @param endDate Optional end date for filtering (YYYY-MM-DD)
 */
export async function downloadUserCalendar (startDate?: string, endDate?: string): Promise<void> {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated || !authStore.token) {
    throw new Error('User must be authenticated to download calendar')
  }

  const url = getUserCalendarDownloadUrl(startDate, endDate)

  // Create a temporary anchor element to trigger download
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'

  // Add authorization header by appending it as a custom download
  try {
    const response = await api.get('/api/calendar/my/calendar.ics', {
      params: { start: startDate, end: endDate },
      responseType: 'blob',
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    // Create blob URL and trigger download
    const blob = new Blob([response.data], { type: 'text/calendar' })
    const downloadUrl = window.URL.createObjectURL(blob)

    link.href = downloadUrl
    link.download = 'my-calendar.ics'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up blob URL
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Failed to download user calendar:', error)
    throw error
  }
}

/**
 * Download group calendar
 * @param groupSlug Group slug identifier
 * @param startDate Optional start date for filtering (YYYY-MM-DD)
 * @param endDate Optional end date for filtering (YYYY-MM-DD)
 */
export async function downloadGroupCalendar (groupSlug: string, startDate?: string, endDate?: string): Promise<void> {
  const authStore = useAuthStore()

  const url = getGroupCalendarDownloadUrl(groupSlug, startDate, endDate)

  // Create a temporary anchor element to trigger download
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'

  try {
    const headers: Record<string, string> = {}

    // Add authorization header if user is authenticated (for private groups)
    if (authStore.isAuthenticated && authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`
    }

    const response = await api.get(`/api/calendar/groups/${groupSlug}/calendar.ics`, {
      params: { start: startDate, end: endDate },
      responseType: 'blob',
      headers
    })

    // Create blob URL and trigger download
    const blob = new Blob([response.data], { type: 'text/calendar' })
    const downloadUrl = window.URL.createObjectURL(blob)

    link.href = downloadUrl
    link.download = `${groupSlug}-calendar.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    // Clean up blob URL
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error('Failed to download group calendar:', error)
    throw error
  }
}
