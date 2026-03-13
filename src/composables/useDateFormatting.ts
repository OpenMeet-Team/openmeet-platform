/**
 * Date formatting composable with timezone support
 * Extracted from RecurrenceService to provide focused date formatting utilities
 */
import { formatInTimeZone } from 'date-fns-tz'
import { getTimeZones } from '@vvo/tzdb'

// US state aliases for major timezone zones
const stateAliases: Record<string, string[]> = {
  'America/New_York': ['Connecticut', 'Delaware', 'Florida', 'Georgia', 'Maine', 'Maryland', 'Massachusetts', 'New Hampshire', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'Vermont', 'Virginia', 'West Virginia', 'Washington DC'],
  'America/Chicago': ['Alabama', 'Arkansas', 'Illinois', 'Iowa', 'Kansas', 'Louisiana', 'Minnesota', 'Mississippi', 'Missouri', 'Nebraska', 'North Dakota', 'Oklahoma', 'South Dakota', 'Tennessee', 'Texas', 'Wisconsin'],
  'America/Denver': ['Colorado', 'Montana', 'New Mexico', 'Utah', 'Wyoming'],
  'America/Los_Angeles': ['California', 'Nevada', 'Oregon', 'Washington']
}

interface TimezoneAlias {
  iana: string
  searchableText: string
}

export interface TimezoneInfo {
  label: string
  alternativeName: string
  mainCities: string[]
}

// Lazy-initialized alias index and metadata map
let aliasIndex: TimezoneAlias[] | null = null
let metaMap: Map<string, TimezoneInfo> | null = null

function computeAbbreviation (iana: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      timeZoneName: 'short'
    })
    const parts = formatter.formatToParts(new Date())
    return parts.find(part => part.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

function buildAliasIndex (ianaZones: string[]): TimezoneAlias[] {
  // Build a map from every IANA name in every @vvo/tzdb group to that group's metadata
  const tzdbData = getTimeZones()
  const ianaToMeta = new Map<string, typeof tzdbData[number]>()

  for (const entry of tzdbData) {
    for (const alias of entry.group) {
      ianaToMeta.set(alias, entry)
    }
  }

  // Build metadata map for display (includes cached label)
  metaMap = new Map<string, TimezoneInfo>()

  const result = ianaZones.map(iana => {
    const meta = ianaToMeta.get(iana)
    const parts: string[] = [iana]
    const abbr = computeAbbreviation(iana)

    if (meta) {
      if (meta.abbreviation) parts.push(meta.abbreviation)
      if (abbr && abbr !== meta.abbreviation) parts.push(abbr)
      if (meta.alternativeName) parts.push(meta.alternativeName)
      if (meta.mainCities) parts.push(...meta.mainCities)
      if (meta.countryName) parts.push(meta.countryName)
      metaMap!.set(iana, {
        label: abbr ? `${iana} (${abbr})` : iana,
        alternativeName: meta.alternativeName || '',
        mainCities: meta.mainCities || []
      })
    } else {
      metaMap!.set(iana, {
        label: abbr ? `${iana} (${abbr})` : iana,
        alternativeName: '',
        mainCities: []
      })
    }

    // Add US state aliases if applicable
    const states = stateAliases[iana]
    if (states) {
      parts.push(...states)
    }

    return {
      iana,
      searchableText: parts.join(' ').toLowerCase()
    }
  })

  return result
}

function getAliasIndex (ianaZones: string[]): TimezoneAlias[] {
  if (!aliasIndex) {
    aliasIndex = buildAliasIndex(ianaZones)
  }
  return aliasIndex
}

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
    const zones = getTimezones()
    if (!search) {
      return zones
    }

    const searchLower = search.toLowerCase()
    const index = getAliasIndex(zones)
    return index
      .filter(entry => entry.searchableText.includes(searchLower))
      .map(entry => entry.iana)
  }

  /**
   * Get a display label for a timezone: "America/Los_Angeles (PDT)"
   * Uses cached abbreviation computed at index build time.
   */
  const getTimezoneLabel = (iana: string): string => {
    getAliasIndex(getTimezones())
    return metaMap?.get(iana)?.label || iana
  }

  /**
   * Get display metadata for a timezone (alternative name + cities)
   */
  const getTimezoneInfo = (iana: string): TimezoneInfo | undefined => {
    // Ensure the index (and metaMap) is built
    getAliasIndex(getTimezones())
    return metaMap?.get(iana)
  }

  /**
   * Build a pre-computed option object for a timezone (for use in q-select)
   */
  const buildTimezoneOption = (iana: string): { value: string, label: string, caption: string } => {
    const info = getTimezoneInfo(iana)
    let caption = ''
    if (info) {
      const parts: string[] = []
      if (info.alternativeName) parts.push(info.alternativeName)
      if (info.mainCities.length) parts.push(info.mainCities.join(', '))
      caption = parts.join(' \u00b7 ')
    }
    return { value: iana, label: info?.label || iana, caption }
  }

  /**
   * Get all timezones as pre-computed option objects
   */
  const getTimezoneOptions = () => {
    return getTimezones().map(buildTimezoneOption)
  }

  /**
   * Search timezones and return pre-computed option objects
   */
  const searchTimezoneOptions = (search: string) => {
    return searchTimezones(search).map(buildTimezoneOption)
  }

  return {
    formatWithTimezone,
    formatWithPattern,
    getUserTimezone,
    getTimezoneDisplay,
    getTimezoneLabel,
    getTimezoneInfo,
    getTimezones,
    getTimezoneOptions,
    searchTimezones,
    searchTimezoneOptions
  }
}

// Create a singleton instance for direct import
const dateFormatting = useDateFormatting()
export default dateFormatting
