/**
 * Date formatting composable with timezone support
 * Extracted from RecurrenceService to provide focused date formatting utilities
 */
import { formatInTimeZone } from 'date-fns-tz'

export function useDateFormatting () {
  /**
   * Format a date in a specific timezone using Intl.DateTimeFormat
   * @param date The date to format
   * @param formatOptions The Intl.DateTimeFormatOptions for formatting
   * @param timezone The timezone to use (e.g. 'America/New_York')
   * @param locale The locale to use (default: 'en-US')
   * @returns Formatted date string
   */
  const formatWithTimezone = (
    date: Date | string,
    formatOptions: Intl.DateTimeFormatOptions = {},
    timezone?: string,
    locale: string = 'en-US'
  ): string => {
    if (!date) return 'N/A'

    const dateObj = typeof date === 'string' ? new Date(date) : date
    // If a specific timezone is provided, use it.
    // Otherwise, default to the user's local timezone.
    const effectiveTimezone = timezone || getUserTimezone()

    try {
      // Use Intl.DateTimeFormat for formatting with the provided options and timezone
      const dtf = new Intl.DateTimeFormat(locale, {
        ...formatOptions,
        timeZone: effectiveTimezone
      })
      return dtf.format(dateObj)
    } catch (e) {
      console.error(`Error formatting date with Intl.DateTimeFormat (tz: ${effectiveTimezone}, locale: ${locale}):`, e)
      // Fallback to date-fns-tz with a generic format, still respecting the timezone
      try {
        return formatInTimeZone(dateObj, effectiveTimezone, 'MMM d, yyyy, h:mm:ss a (zzz)')
      } catch (fallbackError) {
        console.error(`Error in date-fns-tz fallback formatting (tz: ${effectiveTimezone}):`, fallbackError)
        // Absolute fallback
        return dateObj.toISOString() + ` (Error in formatting, tz: ${effectiveTimezone})`
      }
    }
  }

  /**
   * Format a date using date-fns pattern in a specific timezone
   * @param date The date to format
   * @param formatPattern The date-fns format pattern
   * @param timezone The timezone to use
   * @returns Formatted date string
   */
  const formatWithPattern = (
    date: Date | string,
    formatPattern: string,
    timezone?: string
  ): string => {
    if (!date) return 'N/A'

    const dateObj = typeof date === 'string' ? new Date(date) : date
    const effectiveTimezone = timezone || getUserTimezone()

    try {
      return formatInTimeZone(dateObj, effectiveTimezone, formatPattern)
    } catch (e) {
      console.error(`Error formatting date with pattern in timezone (tz: ${effectiveTimezone}):`, e)
      return dateObj.toISOString()
    }
  }

  /**
   * Get the user's browser timezone
   * @returns The IANA timezone identifier
   */
  const getUserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch (e) {
      console.error('Error getting user timezone:', e)
      return 'UTC'
    }
  }

  /**
   * Get the timezone display name with abbreviation
   * @param timezone The IANA timezone identifier
   * @returns Formatted timezone name with abbreviation
   */
  const getTimezoneDisplay = (timezone?: string): string => {
    const tz = timezone || getUserTimezone()

    try {
      // Format the timezone for display (e.g., "America/New_York (EDT)")
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'short'
      })

      const parts = formatter.formatToParts(now)
      const tzName = parts.find(part => part.type === 'timeZoneName')?.value

      return `${tz} (${tzName})`
    } catch (error) {
      console.error('Error getting timezone display:', error)
      return tz
    }
  }

  /**
   * Get all available IANA timezones
   * @returns Array of timezone identifiers
   */
  const getTimezones = (): string[] => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch (e) {
      // Fallback for older browsers
      console.warn('Intl.supportedValuesOf not supported, falling back to limited timezone list')
      return [
        'UTC',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney',
        // Commonly used timezones
        'America/Anchorage',
        'America/Phoenix',
        'America/Toronto',
        'Europe/Berlin',
        'Europe/Moscow',
        'Asia/Shanghai',
        'Asia/Singapore',
        'Australia/Perth',
        'Pacific/Auckland'
      ]
    }
  }

  /**
   * Search timezones matching a search string
   * @param search The search string
   * @returns Filtered array of timezone identifiers
   */
  const searchTimezones = (search: string): string[] => {
    if (!search) {
      return getTimezones()
    }

    const searchLower = search.toLowerCase()
    return getTimezones().filter(
      tz => tz.toLowerCase().includes(searchLower)
    )
  }

  return {
    formatWithTimezone,
    formatWithPattern,
    getUserTimezone,
    getTimezoneDisplay,
    getTimezones,
    searchTimezones
  }
}

// Create a singleton instance for direct import
const dateFormatting = useDateFormatting()
export default dateFormatting
