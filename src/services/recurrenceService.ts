import { RRule, Options, Weekday, Frequency } from 'rrule'
import { format, formatInTimeZone } from 'date-fns-tz'
import { parseISO, addMilliseconds } from 'date-fns'
import { EventEntity, RecurrenceRule } from '../types/event'
import { eventsApi, OccurrencesQueryParams, EventOccurrence, ExpandedEventOccurrence, SplitSeriesParams } from '../api/events'

interface FrequencyOption {
  label: string;
  value: string;
  description: string;
}

interface WeekdayOption {
  label: string;
  value: string;
  shortLabel: string;
}

export class RecurrenceService {
  // Frequency options for the UI
  static readonly frequencyOptions: FrequencyOption[] = [
    { value: 'DAILY', label: 'Daily', description: 'Repeat every day' },
    { value: 'WEEKLY', label: 'Weekly', description: 'Repeat every week' },
    { value: 'MONTHLY', label: 'Monthly', description: 'Repeat every month' },
    { value: 'YEARLY', label: 'Yearly', description: 'Repeat every year' }
  ]

  // Weekday options for the UI
  static readonly weekdayOptions: WeekdayOption[] = [
    { value: 'SU', label: 'Sunday', shortLabel: 'S' },
    { value: 'MO', label: 'Monday', shortLabel: 'M' },
    { value: 'TU', label: 'Tuesday', shortLabel: 'T' },
    { value: 'WE', label: 'Wednesday', shortLabel: 'W' },
    { value: 'TH', label: 'Thursday', shortLabel: 'T' },
    { value: 'FR', label: 'Friday', shortLabel: 'F' },
    { value: 'SA', label: 'Saturday', shortLabel: 'S' }
  ]

  // Convert RecurrenceRule to RRule for use with the rrule library
  static toRRule (rule: RecurrenceRule, startDate: string): RRule {
    try {
      if (!rule || !rule.frequency) {
        throw new Error('Invalid recurrence rule: missing frequency')
      }

      // Parse the start date
      let dtstart
      try {
        dtstart = typeof startDate === 'string'
          ? parseISO(startDate)
          : new Date(startDate)
      } catch (e) {
        console.error('Error parsing start date:', e)
        dtstart = new Date()
      }

      // Create RRule options with proper typing
      const options: Partial<Options> = {
        freq: RRule[rule.frequency as keyof typeof RRule] as unknown as Frequency,
        interval: rule.interval || 1,
        dtstart
      }

      // Add count or until if present
      if (rule.count) {
        options.count = rule.count
      } else if (rule.until) {
        try {
          options.until = typeof rule.until === 'string'
            ? parseISO(rule.until)
            : new Date(rule.until)
        } catch (e) {
          console.error('Error parsing until date:', e)
        }
      }

      // Add byweekday if present (RRule requires special handling)
      if (rule.byweekday && rule.byweekday.length > 0) {
        options.byweekday = rule.byweekday.map(day => {
          // Check if day has a position prefix like "1MO" for first Monday
          const match = day.match(/^([+-]?\d+)([A-Z]{2})$/)
          if (match) {
            const pos = parseInt(match[1], 10)
            const weekday = match[2]
            return new Weekday(RRule[weekday as keyof typeof RRule] as unknown as number, pos)
          }
          // Regular weekday without position
          return RRule[day as keyof typeof RRule] as unknown as number
        })
      }

      // Add other byX rules as needed
      if (rule.bymonth && rule.bymonth.length > 0) {
        options.bymonth = rule.bymonth
      }

      if (rule.bymonthday && rule.bymonthday.length > 0) {
        options.bymonthday = rule.bymonthday
      }

      if (rule.wkst) {
        options.wkst = RRule[rule.wkst as keyof typeof RRule] as Weekday
      }

      // Create and return the RRule
      return new RRule(options)
    } catch (error) {
      console.error('Error creating RRule:', error)
      throw error
    }
  }

  // Convert RRule to RecurrenceRule for API usage
  static fromRRule (rrule: RRule): RecurrenceRule {
    const options = rrule.options

    // Map the frequency from RRule's numeric constant to our string format
    let frequency: RecurrenceRule['frequency'] = 'WEEKLY' // Default

    if (options.freq === RRule.YEARLY) frequency = 'YEARLY'
    else if (options.freq === RRule.MONTHLY) frequency = 'MONTHLY'
    else if (options.freq === RRule.WEEKLY) frequency = 'WEEKLY'
    else if (options.freq === RRule.DAILY) frequency = 'DAILY'
    else if (options.freq === RRule.HOURLY) frequency = 'HOURLY'
    else if (options.freq === RRule.MINUTELY) frequency = 'MINUTELY'
    else if (options.freq === RRule.SECONDLY) frequency = 'SECONDLY'

    // Create the base rule
    const rule: RecurrenceRule = {
      frequency
    }

    // Add optional properties
    if (options.interval) {
      rule.interval = options.interval
    }

    if (options.count) {
      rule.count = options.count
    }

    if (options.until) {
      rule.until = options.until.toISOString()
    }

    if (options.byweekday && options.byweekday.length > 0) {
      rule.byweekday = options.byweekday.map((day: unknown) => String(day))
    }

    if (options.bymonth && options.bymonth.length > 0) {
      rule.bymonth = options.bymonth
    }

    if (options.bymonthday && options.bymonthday.length > 0) {
      rule.bymonthday = options.bymonthday
    }

    if (options.byhour && options.byhour.length > 0) {
      rule.byhour = options.byhour
    }

    if (options.byminute && options.byminute.length > 0) {
      rule.byminute = options.byminute
    }

    if (options.bysecond && options.bysecond.length > 0) {
      rule.bysecond = options.bysecond
    }

    return rule
  }

  // Create a new recurrence rule
  static createRule (
    frequency: string,
    interval: number = 1,
    options: {
      count?: number,
      until?: string,
      byweekday?: string[],
      bymonthday?: number[],
      bymonth?: number[]
    } = {}
  ): RecurrenceRule {
    return {
      frequency: frequency as RecurrenceRule['frequency'],
      interval,
      ...options
    }
  }

  // Generate occurrence dates based on a recurrence rule (client-side)
  static getOccurrences (
    event: EventEntity,
    count: number = 10
  ): Date[] {
    if (!event.recurrenceRule || !event.startDate) {
      return []
    }

    try {
      const rrule = this.toRRule(
        event.recurrenceRule,
        event.startDate
      )

      // Generate occurrences
      const occurrences = rrule.all((_, i) => i < count)

      // Filter out exceptions
      if (event.recurrenceExceptions && event.recurrenceExceptions.length > 0) {
        const exceptions = event.recurrenceExceptions.map(ex =>
          format(parseISO(ex), 'yyyy-MM-dd')
        )

        return occurrences.filter(occurrence =>
          !exceptions.includes(format(occurrence, 'yyyy-MM-dd'))
        )
      }

      return occurrences
    } catch (error) {
      console.error('Error generating occurrences:', error)
      return []
    }
  }

  // Fetch occurrences from API (server-side)
  static async fetchOccurrences (
    eventSlug: string,
    query: OccurrencesQueryParams = {}
  ): Promise<EventOccurrence[]> {
    console.log('RecurrenceService.fetchOccurrences called with slug:', eventSlug, 'query:', query)

    try {
      console.log('Making API request to /api/recurrence/' + eventSlug + '/occurrences')
      const response = await eventsApi.getEventOccurrences(eventSlug, query)
      console.log('API response successful:', response.status, response.statusText)
      console.log('Occurrences returned:', response.data?.length || 0)
      console.log('Occurrences data type:', typeof response.data)
      console.log('First occurrence type:', response.data && response.data.length > 0 ? typeof response.data[0] : 'N/A')

      if (response.data && Array.isArray(response.data)) {
        if (response.data.length > 0 && typeof response.data[0] === 'string') {
          console.error('API ERROR: Expected objects with date and isExcluded properties, but received array of strings')
          console.error('This indicates a backend issue that needs to be fixed')
        }
      }

      return response.data
    } catch (error) {
      console.error('Error fetching occurrences from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Fetch expanded occurrences with event objects from API
  static async fetchExpandedOccurrences (
    eventSlug: string,
    query: OccurrencesQueryParams = {}
  ): Promise<ExpandedEventOccurrence[]> {
    console.log('RecurrenceService.fetchExpandedOccurrences called with slug:', eventSlug, 'query:', query)

    try {
      console.log('Making API request to /api/recurrence/' + eventSlug + '/expanded-occurrences')
      const response = await eventsApi.getExpandedEventOccurrences(eventSlug, query)
      console.log('API response successful:', response.status, response.statusText)
      console.log('Expanded occurrences returned:', response.data?.length || 0)
      return response.data
    } catch (error) {
      console.error('Error fetching expanded occurrences from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Get the effective event for a specific date
  static async getEffectiveEventForDate (
    eventSlug: string,
    date: string
  ): Promise<EventEntity | null> {
    console.log('RecurrenceService.getEffectiveEventForDate called with slug:', eventSlug, 'date:', date)

    try {
      console.log('Making API request to /api/recurrence/' + eventSlug + '/effective')
      const response = await eventsApi.getEffectiveEventForDate(eventSlug, date)
      console.log('API response successful:', response.status, response.statusText)
      return response.data
    } catch (error) {
      console.error('Error fetching effective event from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Split a recurring series at a specific date
  static async splitSeriesAt (
    eventSlug: string,
    splitDate: string,
    modifications: Partial<EventEntity>
  ): Promise<EventEntity | null> {
    console.log('RecurrenceService.splitSeriesAt called with slug:', eventSlug, 'splitDate:', splitDate)
    console.log('Modifications:', modifications)

    try {
      const params: SplitSeriesParams = {
        splitDate,
        modifications
      }
      console.log('Making API request to /api/recurrence/' + eventSlug + '/split')
      const response = await eventsApi.splitSeriesAt(eventSlug, params)
      console.log('API response successful:', response.status, response.statusText)
      console.log('New event from split:', response.data?.slug)
      return response.data
    } catch (error) {
      console.error('Error splitting series from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Add an exclusion date to a recurring event
  static async addExclusionDate (
    eventSlug: string,
    exclusionDate: string
  ): Promise<boolean> {
    console.log('RecurrenceService.addExclusionDate called with slug:', eventSlug, 'exclusionDate:', exclusionDate)

    try {
      console.log('Making API request to /api/recurrence/' + eventSlug + '/exclusions')
      await eventsApi.addExclusionDate(eventSlug, exclusionDate)
      console.log('Exclusion date added successfully')
      return true
    } catch (error) {
      console.error('Error adding exclusion date from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Remove an exclusion date from a recurring event
  static async removeExclusionDate (
    eventSlug: string,
    date: string
  ): Promise<boolean> {
    console.log('RecurrenceService.removeExclusionDate called with slug:', eventSlug, 'date:', date)

    try {
      console.log('Making API request to /api/recurrence/' + eventSlug + '/inclusions')
      await eventsApi.removeExclusionDate(eventSlug, date)
      console.log('Exclusion date removed successfully')
      return true
    } catch (error) {
      console.error('Error removing exclusion date from API:', error)
      if (error.response) {
        console.error('Response error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
      throw error // Throw error to allow components to handle fallback
    }
  }

  // Get a human-readable description of the recurrence pattern
  static getHumanReadablePattern (event: EventEntity): string {
    // Use the server-provided description if available
    if (event.recurrenceDescription) {
      return event.recurrenceDescription
    }

    if (!event.recurrenceRule) {
      return 'Does not repeat'
    }

    try {
      const rrule = this.toRRule(
        event.recurrenceRule,
        event.startDate
      )

      return rrule.toText()
    } catch (error) {
      console.error('Error generating human readable pattern:', error)
      return 'Custom recurrence pattern'
    }
  }

  // Format date with timezone
  static formatWithTimezone (date: string | Date, formatStr: string, timeZone?: string): string {
    if (!date) return ''

    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (timeZone) {
      return formatInTimeZone(dateObj, timeZone, formatStr)
    } else {
      return formatInTimeZone(
        dateObj,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        formatStr
      )
    }
  }

  // Adjust date for timezone by adding the timezone offset
  static adjustDateForTimezone (date: string | Date, timeZone?: string): Date {
    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (!timeZone) return dateObj

    // Calculate the timezone offset
    const targetTzOffset = new Date(dateObj).getTimezoneOffset() * 60000
    const localTzOffset = new Date().getTimezoneOffset() * 60000

    // Adjust the date for timezone difference
    return addMilliseconds(dateObj, targetTzOffset - localTzOffset)
  }

  // Get the timezone display name
  static getTimezoneDisplay (timeZone?: string): string {
    if (!timeZone) {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    try {
      // Format the timezone for display (e.g., "America/New_York (EDT)")
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'short'
      })

      const parts = formatter.formatToParts(now)
      const tzName = parts.find(part => part.type === 'timeZoneName')?.value

      return `${timeZone} (${tzName})`
    } catch (error) {
      console.error('Error getting timezone display:', error)
      return timeZone
    }
  }

  // Get all IANA timezones
  static getTimezones (): string[] {
    // This is a simplified list - a complete list would be too long
    return [
      'Africa/Cairo',
      'Africa/Johannesburg',
      'Africa/Lagos',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/New_York',
      'America/Sao_Paulo',
      'America/Toronto',
      'Asia/Dubai',
      'Asia/Hong_Kong',
      'Asia/Jerusalem',
      'Asia/Seoul',
      'Asia/Shanghai',
      'Asia/Singapore',
      'Asia/Tokyo',
      'Australia/Melbourne',
      'Australia/Sydney',
      'Europe/Berlin',
      'Europe/London',
      'Europe/Moscow',
      'Europe/Paris',
      'Pacific/Auckland',
      'Pacific/Honolulu',
      'UTC'
    ]
  }

  // Get filtered timezone list matching search term
  static searchTimezones (search: string): string[] {
    if (!search) {
      return this.getTimezones()
    }

    const searchLower = search.toLowerCase()
    return this.getTimezones().filter(
      tz => tz.toLowerCase().includes(searchLower)
    )
  }

  // Get the user's timezone
  static getUserTimezone (): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

export default new RecurrenceService()
