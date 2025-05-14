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
  static toRRule (rule: RecurrenceRule, startDate: string, timeZone?: string): RRule {
    try {
      if (!rule || !rule.frequency) {
        throw new Error('Invalid recurrence rule: missing frequency')
      }

      // Parse the start date
      let dtstart
      try {
        // Basic date parsing
        dtstart = typeof startDate === 'string'
          ? parseISO(startDate)
          : new Date(startDate)
        
        // TIMEZONE FIX: For weekly recurrences with specific days selected,
        // adjust the rule's start date to ensure days fall correctly in the user's timezone
        if (timeZone && rule.frequency === 'WEEKLY' && rule.byweekday && rule.byweekday.length > 0) {
          console.log('Creating timezone-aware RRule for', timeZone)
          
          // Get the day of week in UTC vs the timezone
          const dayInUtc = dtstart.getUTCDay(); // 0-6 (0 = Sunday)
          const dayInTz = parseInt(formatInTimeZone(dtstart, timeZone, 'i')) % 7; // Convert to 0-based (0 = Sunday)
          
          // Log timezone debugging information
          console.log('Day calculation:', {
            startDate,
            timezone: timeZone,
            utcDay: dayInUtc,
            tzDay: dayInTz,
            utcDayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayInUtc],
            tzDayName: formatInTimeZone(dtstart, timeZone, 'EEEE'),
            selectedDays: rule.byweekday
          });
          
          // If there's a discrepancy between UTC day and timezone day, we need to handle it
          if (dayInUtc !== dayInTz) {
            console.log('Day difference detected between UTC and timezone!');
            
            // Create a new date at the same time but in the user's timezone
            // This shifts the date to be on the correct day in the user's timezone
            const localMidnight = formatInTimeZone(dtstart, timeZone, "yyyy-MM-dd'T'00:00:00.000");
            const timeStr = formatInTimeZone(dtstart, timeZone, 'HH:mm:ss.SSS');
            const tzAdjustedDateStr = `${localMidnight.slice(0, 11)}${timeStr}`;
            
            // Parse the adjusted date
            const tzAdjustedDate = new Date(tzAdjustedDateStr);
            
            // Log the adjusted date for debugging
            console.log('Adjusted date for correct timezone day:', {
              originalDate: dtstart.toISOString(),
              adjustedDate: tzAdjustedDate.toISOString(),
              tzAdjustedDateStr,
              timeZone
            });
            
            // Use the timezone-adjusted date as the start date
            dtstart = tzAdjustedDate;
          }
        }
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

      // Add byweekday and handle bysetpos (RRule requires special handling)
      if (rule.byweekday && rule.byweekday.length > 0) {
        // Special case for MONTHLY/YEARLY with byweekday + bysetpos: use .nth() method for better toText() results
        if ((rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') &&
             rule.bysetpos &&
             // Handle bysetpos both as array or as a number (handle potential API inconsistency)
             (Array.isArray(rule.bysetpos) ? rule.bysetpos.length > 0 : rule.bysetpos !== undefined)) {
          // Get the position (e.g., 2 for "second", -1 for "last")
          // Handle both array and number formats
          const position = Array.isArray(rule.bysetpos) ? rule.bysetpos[0] : rule.bysetpos

          // Create properly typed array for byweekday
          const byweekdayArray: Weekday[] = []

          // Process each weekday with proper typing
          for (const day of rule.byweekday) {
            // Use the .nth() method on the weekday constant for better text formatting
            const weekdayConst = RRule[day as keyof typeof RRule]

            // Add the position to the weekday using nth()
            // This allows RRule.toText() to output "every month on the second Wednesday" correctly
            if (typeof weekdayConst === 'object' && 'nth' in weekdayConst &&
                typeof (weekdayConst as { nth: (n: number) => Weekday }).nth === 'function') {
              byweekdayArray.push((weekdayConst as { nth: (n: number) => Weekday }).nth(position))
            } else if (weekdayConst instanceof Weekday) {
              byweekdayArray.push(weekdayConst)
            }
          }

          options.byweekday = byweekdayArray

          console.log('Using .nth() method for byweekday with position:', position)
        } else {
          // Standard handling for regular weekdays without position or non-MONTHLY patterns
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
      }

      // Still add bysetpos for completeness (needed for some patterns)
      if (rule.bysetpos && rule.bysetpos.length > 0 &&
         !(rule.frequency === 'MONTHLY' && rule.byweekday && rule.byweekday.length > 0)) {
        // Only add bysetpos for non-MONTHLY + byweekday patterns (since we're using .nth() for those)
        options.bysetpos = rule.bysetpos
        console.log('Setting bysetpos in RRule:', rule.bysetpos)
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
      // Log detailed recurrence info for debugging monthly patterns
      console.log('RecurrenceService.getOccurrences for event:', {
        name: event.name,
        startDate: event.startDate,
        recurrenceRule: {
          frequency: event.recurrenceRule.frequency,
          interval: event.recurrenceRule.interval,
          byweekday: event.recurrenceRule.byweekday,
          bymonthday: event.recurrenceRule.bymonthday,
          bysetpos: event.recurrenceRule.bysetpos
        }
      })

      // Check specifically for monthly patterns with bysetpos
      if (event.recurrenceRule.frequency === 'MONTHLY' &&
          event.recurrenceRule.byweekday &&
          event.recurrenceRule.bysetpos) {
        console.log('MONTHLY DAY-OF-WEEK PATTERN DETECTED:', {
          byweekday: event.recurrenceRule.byweekday,
          bysetpos: event.recurrenceRule.bysetpos,
          description: `${event.recurrenceRule.bysetpos[0]}${event.recurrenceRule.byweekday[0]} of month`
        })

        // Ensure the bysetpos field is not empty - this is crucial for monthly patterns
        if (!event.recurrenceRule.bysetpos || event.recurrenceRule.bysetpos.length === 0) {
          console.warn('bysetpos is empty for monthly pattern! This will cause incorrect weekly pattern')
          // This is where failures can happen - when bysetpos is lost during translation
          console.warn('Inspect API and conversion functions for bysetpos handling')
        }
      }

      const rrule = this.toRRule(
        event.recurrenceRule,
        event.startDate,
        event.timeZone
      )

      console.log('RRule string:', rrule.toString())

      // Generate occurrences
      const occurrences = rrule.all((_, i) => i < count)

      // Log first few occurrences to verify pattern
      if (occurrences.length > 0) {
        console.log('First 3 occurrences:', occurrences.slice(0, 3).map(date => date.toISOString()))

        // Check if occurrences are weekly or monthly for debugging
        if (occurrences.length >= 2) {
          const diff = (occurrences[1].getTime() - occurrences[0].getTime()) / (1000 * 60 * 60 * 24)
          console.log(`Days between first two occurrences: ${diff}`)
          console.log(`Pattern appears to be: ${diff < 10 ? 'WEEKLY' : 'MONTHLY'}`)
        }
      }

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
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null

        // Log the recurrence rule that's being used to debug issues with bysetpos
        if (eventResponse.data.series && eventResponse.data.series.recurrenceRule) {
          console.log('Event series recurrence rule:', JSON.stringify(eventResponse.data.series.recurrenceRule))

          // Check specifically for monthly pattern with bysetpos
          const rule = eventResponse.data.series.recurrenceRule
          if (rule.frequency === 'MONTHLY' && rule.byweekday && rule.bysetpos) {
            console.log('Monthly pattern with byweekday and bysetpos detected:',
              'byweekday:', rule.byweekday, 'bysetpos:', rule.bysetpos)
          }
        }
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)

        // Use the new event series API
        const response = await import('../api/event-series').then(module => {
          const eventSeriesApi = module.eventSeriesApi
          return eventSeriesApi.getOccurrences(
            seriesSlug,
            query.count || 10,
            !!query.startDate // Use startDate existence as proxy for "includePast"
          )
        })

        console.log('API response successful:', response.status, response.statusText)
        console.log('Occurrences returned:', response.data?.length || 0)

        // Debug the occurrences returned
        if (response.data && response.data.length > 0) {
          console.log('First few occurrence dates:',
            response.data.slice(0, 3).map(o => o.date).join(', '))

          // Check for weekly pattern in monthly recurrence
          // Detect if we have consecutive weeks, which would indicate weekly pattern
          // when it should be monthly
          const dates = response.data
            .map(o => new Date(o.date))
            .sort((a, b) => a.getTime() - b.getTime())

          if (dates.length >= 2) {
            const daysDiff = (dates[1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24)
            console.log('Days between first two occurrences:', daysDiff)

            if (daysDiff <= 7) {
              console.warn('Potential issue: Days between occurrences is <= 7, which suggests a weekly pattern')
              console.warn('This may indicate bysetpos is not being properly applied in the API call')
            }
          }
        }

        // Map to expected format with isExcluded property
        const mappedOccurrences = response.data.map(occurrence => ({
          date: occurrence.date,
          isExcluded: occurrence.materialized === false // Assume non-materialized means excluded
        }))

        return mappedOccurrences
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/occurrences')
        const response = await eventsApi.getEventOccurrences(eventSlug, query)
        return response.data
      }
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
    try {
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)

        // Get occurrences and then fetch each event
        const occurrencesResponse = await import('../api/event-series').then(module => {
          const eventSeriesApi = module.eventSeriesApi
          return eventSeriesApi.getOccurrences(
            seriesSlug,
            query.count || 10,
            !!query.startDate // Use startDate existence as proxy for "includePast"
          )
        })

        // Manually build the expanded occurrences
        const expandedOccurrences: ExpandedEventOccurrence[] = []

        // Get each event for the occurrences
        for (const occurrence of occurrencesResponse.data) {
          try {
            // Get the event for this date
            const eventResponse = await import('../api/event-series').then(module => {
              const eventSeriesApi = module.eventSeriesApi
              return eventSeriesApi.getOccurrence(seriesSlug, occurrence.date)
            })

            expandedOccurrences.push({
              date: occurrence.date,
              event: eventResponse.data
            })
          } catch (error) {
            console.error(`Error fetching event for date ${occurrence.date}:`, error)
          }
        }

        return expandedOccurrences
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/expanded-occurrences')
        const response = await eventsApi.getExpandedEventOccurrences(eventSlug, query)
        return response.data
      }
    } catch (error) {
      console.error('Error fetching expanded occurrences from API:', error)
      return []
    }
  }

  // Get the effective event for a specific date
  static async getEffectiveEventForDate (
    eventSlug: string,
    date: string
  ): Promise<EventEntity | null> {
    try {
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)

        // Use the new event series API to get the occurrence for this date
        const response = await import('../api/event-series').then(module => {
          const eventSeriesApi = module.eventSeriesApi
          return eventSeriesApi.getOccurrence(seriesSlug, date)
        })

        return response.data
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/effective')
        const response = await eventsApi.getEffectiveEventForDate(eventSlug, date)
        return response.data
      }
    } catch (error) {
      console.error('Error fetching effective event for date:', error)
      return null
    }
  }

  // Split a recurring series at a specific date
  static async splitSeriesAt (
    eventSlug: string,
    splitDate: string,
    modifications: Partial<EventEntity>
  ): Promise<EventEntity | null> {
    try {
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)

        // Convert to the expected format for the new API
        const updates = {
          // Map fields from modifications to UpdateEventSeriesDto format
          name: modifications.name,
          description: modifications.description,
          propagateChanges: true // This is needed for the new API
        }

        // Use the new event series API
        const response = await import('../api/event-series').then(module => {
          const eventSeriesApi = module.eventSeriesApi
          return eventSeriesApi.updateFutureOccurrences(seriesSlug, splitDate, updates)
        })

        console.log('Update future occurrences response:', response.data)

        // The response is different in the new API; return the event for the split date
        try {
          const eventAtDateResponse = await import('../api/event-series').then(module => {
            const eventSeriesApi = module.eventSeriesApi
            return eventSeriesApi.getOccurrence(seriesSlug, splitDate)
          })

          return eventAtDateResponse.data
        } catch (error) {
          console.error('Error fetching event after split:', error)
          return null
        }
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/split')

        const params: SplitSeriesParams = {
          splitDate,
          modifications
        }

        const response = await eventsApi.splitSeriesAt(eventSlug, params)
        return response.data
      }
    } catch (error) {
      console.error('Error splitting series at date:', error)
      return null
    }
  }

  // Add an exclusion date to a recurring event
  static async addExclusionDate (
    eventSlug: string,
    exclusionDate: string
  ): Promise<boolean> {
    try {
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)
        console.log('Note: addExclusionDate is not directly supported in the new API')
        console.log('This needs a custom implementation in the backend')

        // Return false for now since this is not directly supported
        return false
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/exclusions')
        await eventsApi.addExclusionDate(eventSlug, exclusionDate)
        return true
      }
    } catch (error) {
      console.error('Error adding exclusion date:', error)
      return false
    }
  }

  // Remove an exclusion date from a recurring event
  static async removeExclusionDate (
    eventSlug: string,
    date: string
  ): Promise<boolean> {
    try {
      // First try to get the series slug for this event
      let seriesSlug: string | null = null

      try {
        const eventResponse = await eventsApi.getBySlug(eventSlug)
        seriesSlug = eventResponse.data.seriesSlug || null
      } catch (error) {
        console.error('Error fetching event for series slug:', error)
      }

      if (seriesSlug) {
        console.log(`Event ${eventSlug} belongs to series ${seriesSlug}, using event-series API`)
        console.log('Note: removeExclusionDate is not directly supported in the new API')
        console.log('This needs a custom implementation in the backend')

        // Return false for now since this is not directly supported
        return false
      } else {
        console.warn(`Event ${eventSlug} does not have a series slug, falling back to deprecated API`)
        // Fallback to old API for backward compatibility, though this will likely 404
        console.log('Making API request to /api/recurrence/' + eventSlug + '/inclusions')
        await eventsApi.removeExclusionDate(eventSlug, date)
        return true
      }
    } catch (error) {
      console.error('Error removing exclusion date:', error)
      return false
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
      const rule = event.recurrenceRule

      // Create a separate RRule instance just for text generation in the case of
      // monthly patterns with bysetpos, since the library's toText() method doesn't
      // handle bysetpos properly in the standard format
      if (rule.frequency === 'MONTHLY' &&
          rule.byweekday && rule.byweekday.length > 0 &&
          rule.bysetpos &&
          // Handle bysetpos both as array or as a number (handle potential API inconsistency)
          (Array.isArray(rule.bysetpos) ? rule.bysetpos.length > 0 : rule.bysetpos !== undefined)) {
        // Create a new RRule with nth() format for better text output
        // Handle both array and number formats
        const position = Array.isArray(rule.bysetpos) ? rule.bysetpos[0] : rule.bysetpos
        const weekdayCode = rule.byweekday[0]

        // Get the weekday constant from RRule
        const weekdayConst = RRule[weekdayCode as keyof typeof RRule]

        // Create options for text generation
        const textOptions: Partial<Options> = {
          freq: RRule.MONTHLY,
          interval: rule.interval || 1,
          dtstart: typeof event.startDate === 'string' ? parseISO(event.startDate) : new Date(event.startDate)
        }

        // Use nth() method to properly format the text
        if (typeof weekdayConst === 'object' && 'nth' in weekdayConst &&
            typeof (weekdayConst as { nth: (n: number) => Weekday }).nth === 'function') {
          // Create properly typed Weekday array
          const byweekdayArray: Weekday[] = [
            (weekdayConst as { nth: (n: number) => Weekday }).nth(position)
          ]
          textOptions.byweekday = byweekdayArray
        }

        // Create a special RRule just for text output
        const textRRule = new RRule(textOptions)

        // Get the human readable text
        const humanText = textRRule.toText()

        // Log for debugging
        console.log('Created specialized text RRule for monthly+bysetpos pattern:')
        console.log('- Original rule:', JSON.stringify(rule))
        console.log('- Text RRule string:', textRRule.toString())
        console.log('- Human readable text:', humanText)

        return humanText
      }

      // For all other patterns, use the standard approach
      const rrule = this.toRRule(
        event.recurrenceRule,
        event.startDate,
        event.timeZone
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
    // Use the full list of supported timezones
    return Intl.supportedValuesOf('timeZone')
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
