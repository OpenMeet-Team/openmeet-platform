import { date } from 'quasar'

export function getHumanReadableDateDifference (startDate: string | Date, endDate: string | Date): string {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const differenceMs = end.getTime() - start.getTime() // Use getTime() for a more accurate difference

  if (differenceMs < 0) {
    return 'End date must be later than start date.'
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
  return date.formatDate(dateString, format || 'MMMM D, YYYY')
}
