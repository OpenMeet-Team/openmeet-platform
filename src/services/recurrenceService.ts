import { RRule, Options, Weekday, Frequency } from 'rrule'
import { format, formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { parseISO } from 'date-fns'
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

      // Determine the effective timezone
      const tz = timeZone || rule.timeZone

      // --- START MODIFICATION: Intelligent parsing of startDate ---
      let startDateObj: Date
      // Regex to check for Z or +/- offset in a full ISO-like datetime string
      const isoWithOffsetRegex = /T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?(Z|[+-]\d{2}:?\d{2})$/
      // Regex to check if startDate string contains a time component (T HH:MM:SS)
      const hasTimeComponentRegex = /T\d{2}:\d{2}:\d{2}/

      if (isoWithOffsetRegex.test(startDate)) {
        // If startDate is a full ISO string with UTC ('Z') or an offset, parse it directly.
        startDateObj = parseISO(startDate)
        console.log('RecurrenceService.toRRule: Parsed startDate with explicit offset/Z:', startDate, '->', startDateObj.toISOString())
      } else if (tz && hasTimeComponentRegex.test(startDate)) {
        // If startDate has a time component but no Z/offset, AND event timezone `tz` is known,
        // interpret startDate as wall-clock time in `tz`.
        try {
          // First parse as UTC
          startDateObj = parseISO(startDate)
          // Then convert to the target timezone
          startDateObj = toZonedTime(startDateObj, tz)
          console.log('RecurrenceService.toRRule: Parsed startDate as wall-clock in tz:', startDate, ' (tz:', tz, ') ->', startDateObj.toISOString())
        } catch (e) {
          console.error(`RecurrenceService.toRRule: Failed to parse "${startDate}" with tz "${tz}". Falling back to parseISO.`, e)
          startDateObj = parseISO(startDate) // Fallback to original behavior if conversion fails
          console.log('RecurrenceService.toRRule: Fallback parseISO for startDate (after conversion error):', startDate, '->', startDateObj.toISOString())
        }
      } else {
        // Fallback for other formats (e.g., YYYY-MM-DD only, or missing tz when time component is present but no offset)
        startDateObj = parseISO(startDate)
        console.log('RecurrenceService.toRRule: Fallback parseISO for startDate (other cases):', startDate, '->', startDateObj.toISOString())
        if (!tz && hasTimeComponentRegex.test(startDate) && !isoWithOffsetRegex.test(startDate)) {
          console.warn('RecurrenceService.toRRule: startDate string looks like local time but no event timezone (tz) was provided. Time interpretation may be ambiguous as it will be based on system local time.')
        }
      }
      // --- END MODIFICATION ---

      // Base options
      const options: Partial<Options> = {
        freq: RRule[rule.frequency as keyof typeof RRule] as unknown as Frequency,
        interval: rule.interval || 1
      }

      // Handle dtstart and tzid for RRule
      // RRule expects dtstart to be local to tzid if tzid is provided.
      // The Date components (Y,M,D,H,m,s) of dtstart will be interpreted in tzid.
      if (tz) {
        // const startDateObj = parseISO(startDate) // Original start date as UTC instant // MOVED UP AND MODIFIED
        // Get wall-clock components of startDateObj (which is now correctly UTC) in the effective timezone
        const year = parseInt(formatInTimeZone(startDateObj, tz, 'yyyy'), 10)
        const month = parseInt(formatInTimeZone(startDateObj, tz, 'MM'), 10) - 1 // JS Date month is 0-indexed
        const day = parseInt(formatInTimeZone(startDateObj, tz, 'dd'), 10)
        const hour = parseInt(formatInTimeZone(startDateObj, tz, 'HH'), 10)
        const minute = parseInt(formatInTimeZone(startDateObj, tz, 'mm'), 10)
        const second = parseInt(formatInTimeZone(startDateObj, tz, 'ss'), 10)

        // Create a new Date object using these wall-clock components.
        // When this Date object is passed to RRule with the tzid, RRule
        // will interpret these components as being in that tzid.
        options.dtstart = new Date(year, month, day, hour, minute, second)
        options.tzid = tz
        console.log('RRule dtstart (local components for tzid):', options.dtstart, 'tzid:', tz)
      } else {
        // No timezone provided, treat startDate as UTC for RRule
        // options.dtstart = parseISO(startDate) // MOVED UP AND MODIFIED
        options.dtstart = startDateObj // Use the processed startDateObj
        console.log('RRule dtstart (UTC):', options.dtstart)
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

      // byweekday and bysetpos handling
      if (rule.byweekday && rule.byweekday.length > 0) {
        if ((rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') &&
            rule.bysetpos &&
            (Array.isArray(rule.bysetpos) ? rule.bysetpos.length > 0 : rule.bysetpos !== undefined)) {
          const position = Array.isArray(rule.bysetpos) ? rule.bysetpos[0] : rule.bysetpos
          const byweekdayArray: Weekday[] = []
          for (const day of rule.byweekday) {
            const dayMatch = day.match(/^(?:[+-]?\d+)?([A-Z]{2})$/)
            const cleanDay = dayMatch ? dayMatch[1] : day
            const weekdayConst = RRule[cleanDay as keyof typeof RRule]

            if (typeof weekdayConst === 'object' && weekdayConst !== null && 'nth' in weekdayConst &&
                typeof (weekdayConst as { nth: (n: number) => Weekday }).nth === 'function') {
              byweekdayArray.push((weekdayConst as { nth: (n: number) => Weekday }).nth(position))
            } else if (weekdayConst instanceof Weekday) {
              // This case might need review: if weekdayConst is already a Weekday (e.g. from RRule.WE)
              // and we have a position, should we apply it? The original code didn't here.
              // For safety, we'll assume if it's already a Weekday instance, it might be pre-formed.
              byweekdayArray.push(weekdayConst)
            } else {
              // Fallback if it's not an object with nth or a Weekday instance (e.g. raw number for RRule constants)
              // This path should ideally not be hit if rule.byweekday contains string codes like 'MO', 'TU'
              console.warn('Unexpected weekday format for .nth() method:', day, weekdayConst)
              // Attempt to create a simple Weekday if possible, though this won't have position
              if (typeof weekdayConst === 'number') { // RRule day constants are numbers
                byweekdayArray.push(new Weekday(weekdayConst))
              }
            }
          }
          options.byweekday = byweekdayArray
          console.log('Using .nth() method for byweekday with position:', position, options.byweekday)
        } else {
          // Standard handling for other frequencies (like WEEKLY) or if bysetpos isn't used for MONTHLY/YEARLY
          options.byweekday = rule.byweekday.map(day => {
            const match = day.match(/^([+-]?\d+)([A-Z]{2})$/)
            if (match) {
              const pos = parseInt(match[1], 10)
              const weekday = match[2]
              return new Weekday(RRule[weekday as keyof typeof RRule] as unknown as number, pos)
            }
            return RRule[day as keyof typeof RRule] as unknown as number
          })
        }
      } else if (rule.frequency === 'WEEKLY' && tz) {
        // IMPORTANT FIX: Handle both cases - with and without byweekday
        if (rule.byweekday && rule.byweekday.length > 0) {
          // CRITICAL FIX: For 10 PM events, we need to adjust the occurrence generation
          // so it falls consistently on the correct day in the timezone

          // Extract the day codes (MO, TU, etc.) from the byweekday strings
          const weekdayCodes = rule.byweekday.map(day => {
            // Extract the day code part (MO, TU, etc.) ignoring any position prefix like -1MO
            const dayMatch = day.match(/^(?:[+-]?\d+)?([A-Z]{2})$/)
            const dayCode = dayMatch ? dayMatch[1] : day

            // For debugging
            console.log(`Extracting weekday code from "${day}" -> "${dayCode}"`)

            return RRule[dayCode as keyof typeof RRule] as unknown as number
          })

          options.byweekday = weekdayCodes
          console.log('Using explicitly specified byweekday for WEEKLY:', rule.byweekday, ' -> ', options.byweekday)
        } else {
          // If no byweekday specified for a weekly rule, default to the start date's day in the event's timezone
          const { dayCode: dayCodeInTimezone } = this.getDayOfWeekInTimezone(options.dtstart, tz)
          console.log('No byweekday for WEEKLY, defaulting to day in originating timezone:', dayCodeInTimezone)
          options.byweekday = [RRule[dayCodeInTimezone as keyof typeof RRule] as unknown as number]
        }
      }

      // Set bysetpos if it's provided and not already handled by the .nth() logic for MONTHLY/YEARLY
      let byweekdayHasPosition = false
      if (Array.isArray(options.byweekday)) {
        byweekdayHasPosition = options.byweekday.some(wd => wd instanceof Weekday && typeof wd.n === 'number' && wd.n !== 0)
      } else if (options.byweekday instanceof Weekday) {
        byweekdayHasPosition = typeof options.byweekday.n === 'number' && options.byweekday.n !== 0
      }

      if (rule.bysetpos &&
          (Array.isArray(rule.bysetpos) ? rule.bysetpos.length > 0 : rule.bysetpos !== undefined) &&
          !((rule.frequency === 'MONTHLY' || rule.frequency === 'YEARLY') && byweekdayHasPosition)) {
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
      const eventTimeZone = event.timeZone || event.recurrenceRule.timeZone

      console.log('RecurrenceService.getOccurrences for event:', {
        name: event.name,
        startDate: event.startDate,
        timezone: eventTimeZone,
        recurrenceRule: event.recurrenceRule
      })

      // IMPORTANT FIX: Ensure we're using the correct byweekday for late night events
      const ruleWithTimeZone = { ...event.recurrenceRule, timeZone: eventTimeZone }

      // For weekly events, verify the day codes match actual days in the timezone
      if (ruleWithTimeZone.frequency === 'WEEKLY' &&
          ruleWithTimeZone.byweekday &&
          ruleWithTimeZone.byweekday.length > 0) {
        // Get the actual day of week in the event's timezone
        const { dayCode: actualDayCode } = this.getDayOfWeekInTimezone(
          new Date(event.startDate),
          eventTimeZone
        )

        // If the event is happening near midnight, verify the correct day is selected
        const time = formatInTimeZone(new Date(event.startDate), eventTimeZone, 'HH:mm')
        const hour = parseInt(time.split(':')[0], 10)
        const isLateNight = hour >= 20 // After 8 PM
        const isEarlyMorning = hour < 4 // Before 4 AM
        const isNearDayBoundary = isLateNight || isEarlyMorning

        if (isNearDayBoundary) {
          console.log(`Event near day boundary at ${time} in ${eventTimeZone}. Ensuring correct day of week:`, {
            actualDayInTimezone: actualDayCode,
            selectedDays: ruleWithTimeZone.byweekday,
            isActualDaySelected: ruleWithTimeZone.byweekday.includes(actualDayCode),
            isLateNight,
            isEarlyMorning
          })

          // CRITICAL FIX: If the selected day doesn't include the actual day in the timezone,
          // modify the rule to use the actual day
          if (!ruleWithTimeZone.byweekday.includes(actualDayCode)) {
            console.warn(`Selected day ${ruleWithTimeZone.byweekday.join(',')} doesn't match actual day ${actualDayCode} in timezone. This will cause incorrect occurrences.`)

            // Force the correct day for the timezone to avoid issues with day boundaries
            // We use the actual day in the event's timezone to ensure consistency
            if (ruleWithTimeZone._userExplicitSelection) {
              console.log('User explicitly selected days, maintaining their selection but adding warning')
            } else {
              // If not explicitly set by user, we'll correct it automatically
              console.log(`Automatically fixing byweekday to use the correct day: ${actualDayCode}`)
              ruleWithTimeZone.byweekday = [actualDayCode]
            }
          }
        }
      }

      // toRRule is now timezone-aware using tzid
      const rrule = this.toRRule(
        ruleWithTimeZone, // Pass tz to rule for toRRule
        event.startDate,
        eventTimeZone // Pass tz to toRRule for tzid option and dtstart construction
      )

      console.log('RRule string used for occurrence generation:', rrule.toString())
      console.log('RRule options used:', rrule.options)

      // rrule.all() will return UTC Date objects that are correct considering tzid
      let occurrencesUtc = rrule.all((_, i) => i < count)

      if (occurrencesUtc.length > 0) {
        console.log('Raw UTC occurrences from rrule.all() with tzid handling:', occurrencesUtc.slice(0, 3).map(d => d.toISOString()))

        // CRITICAL FIX: Verify that generated occurrences actually fall on the expected day of week
        // This is especially important for late night events that cross day boundaries
        if (event.recurrenceRule.frequency === 'WEEKLY' &&
            event.recurrenceRule.byweekday &&
            event.recurrenceRule.byweekday.length > 0 &&
            eventTimeZone) {
          // Get the expected day(s) of week from the rule
          const expectedDays = event.recurrenceRule.byweekday.map(day => {
            // Extract just the day code part (MO, TU, etc.)
            const dayMatch = day.match(/^(?:[+-]?\d+)?([A-Z]{2})$/)
            return dayMatch ? dayMatch[1] : day
          })

          // Check each occurrence
          let allOccurrencesOnCorrectDay = true

          // Log the expected day information for debugging
          console.log('Verifying occurrences match expected days:', {
            expectedDays,
            eventStartDate: new Date(event.startDate).toISOString(),
            timezone: eventTimeZone
          })

          occurrencesUtc.forEach(occ => {
            // Get the day of this occurrence in the target timezone
            const occDay = formatInTimeZone(occ, eventTimeZone, 'EEEE')
            const occDayCode = this.getDayOfWeekInTimezone(occ, eventTimeZone).dayCode

            // Map day codes to full day names for comparison
            const dayCodeMap: Record<string, string> = {
              SU: 'Sunday',
              MO: 'Monday',
              TU: 'Tuesday',
              WE: 'Wednesday',
              TH: 'Thursday',
              FR: 'Friday',
              SA: 'Saturday'
            }

            // Check if this occurrence falls on one of the expected days
            const expectedDayNames = expectedDays.map(code => dayCodeMap[code] || code)
            const isOnExpectedDay = expectedDayNames.includes(occDay)

            // Log occurrence details
            console.log(`Occurrence ${occ.toISOString()} in ${eventTimeZone}: ${formatInTimeZone(occ, eventTimeZone, 'yyyy-MM-dd HH:mm:ss EEEE XXX')} - ${isOnExpectedDay ? 'CORRECT' : 'WRONG'} DAY`)

            if (!isOnExpectedDay) {
              allOccurrencesOnCorrectDay = false
              console.warn(`Occurrence falls on ${occDay} (${occDayCode}) but expected one of: ${expectedDayNames.join(', ')} (${expectedDays.join(', ')})`)
            }
          })

          // CRITICAL FIX: If any occurrences are on the wrong day, fix them by shifting to correct day
          // This is essential for 10 PM events where RRule often generates wrong days
          if (!allOccurrencesOnCorrectDay) {
            console.warn('Some occurrences don\'t fall on the expected day(s) of week. This is likely due to a timezone boundary issue.')

            // First, create a mapping from day codes to numeric days of week (0-6)
            const dayCodeToNumeric: Record<string, number> = {
              SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6
            }

            // Convert expected days to numeric for easier math
            const expectedNumericDays = expectedDays.map(code => dayCodeToNumeric[code] ?? -1)

            // Create corrected occurrences by shifting each date to the correct day
            const fixedOccurrences: Date[] = []

            occurrencesUtc.forEach(occ => {
              // Get current numeric day of week in the timezone (0-6)
              const currentDayNum = parseInt(formatInTimeZone(occ, eventTimeZone, 'i'), 10) % 7

              // Find the closest expected day - this is the one we want to shift to
              // Default to first expected day if we can't determine
              const targetDayNum = expectedNumericDays.length > 0
                ? expectedNumericDays[0] : dayCodeToNumeric.MO

              // CRITICAL FIX: Calculate days to shift to get to the correct day
              // This is the core of fixing 10:00 PM Monday events appearing on Sunday
              let daysToShift = targetDayNum - currentDayNum

              // Handle week wrapping properly:
              // If shifting backwards by more than 3 days, it's shorter to go forward
              if (daysToShift < -3) daysToShift += 7

              // If shifting forward by more than 3 days, it's shorter to go backward
              if (daysToShift > 3) daysToShift -= 7

              console.log('Day shifting calculation:', {
                currentDay: formatInTimeZone(occ, eventTimeZone, 'EEEE'),
                targetDay: expectedDays.length > 0 ? expectedDays[0] : 'Monday',
                currentDayNum,
                targetDayNum,
                daysToShift
              })

              // Actually create a shifted date that falls on the expected day
              if (daysToShift !== 0) {
                // Create a new date shifted by the required days
                const fixedDate = new Date(occ)
                fixedDate.setDate(fixedDate.getDate() + daysToShift)

                // Log what we're doing
                console.log(`Fixing occurrence: Shifting ${occ.toISOString()} by ${daysToShift} days to ${fixedDate.toISOString()}`)
                console.log(`- Original day in ${eventTimeZone}: ${formatInTimeZone(occ, eventTimeZone, 'EEEE')}`)
                console.log(`- Fixed day in ${eventTimeZone}: ${formatInTimeZone(fixedDate, eventTimeZone, 'EEEE')}`)

                fixedOccurrences.push(fixedDate)
              } else {
                // No shift needed, date is already correct
                fixedOccurrences.push(occ)
              }
            })

            // Replace the original occurrences with the fixed ones
            if (fixedOccurrences.length > 0) {
              console.log('Using corrected occurrences that fall on the expected day of week')
              occurrencesUtc = fixedOccurrences
            }
          }
        } else {
          // Standard logging for non-weekly patterns
          occurrencesUtc.slice(0, 3).forEach(occ => {
            if (eventTimeZone) {
              console.log(`Occurrence ${occ.toISOString()} in ${eventTimeZone}: ${formatInTimeZone(occ, eventTimeZone, 'yyyy-MM-dd HH:mm:ss EEEE XXX')}`)
            } else {
              console.log(`Occurrence ${occ.toISOString()} (UTC): ${format(occ, 'yyyy-MM-dd HH:mm:ss EEEE XXX')}`)
            }
          })
        }
      }

      // Filter exceptions
      if (event.recurrenceExceptions && event.recurrenceExceptions.length > 0) {
        const exceptionsDateStrings = event.recurrenceExceptions.map(ex => {
          // Assuming exceptions are date strings like 'YYYY-MM-DD'
          // Normalize them to ensure consistent comparison
          try {
            return format(parseISO(ex), 'yyyy-MM-dd')
          } catch {
            console.warn('Invalid date format in recurrenceExceptions:', ex)
            return null // Or handle error appropriately
          }
        }).filter(Boolean) as string[]

        occurrencesUtc = occurrencesUtc.filter(occurrence => {
          // Get the date part of the occurrence in the event's timezone for comparison
          const occurrenceDateString = eventTimeZone
            ? formatInTimeZone(occurrence, eventTimeZone, 'yyyy-MM-dd')
            : format(occurrence, 'yyyy-MM-dd')
          return !exceptionsDateStrings.includes(occurrenceDateString)
        })
        console.log('Occurrences after filtering exceptions:', occurrencesUtc.length)
      }
      return occurrencesUtc
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

      // For all other patterns, use the standard approach with timezone
      const timeZone = event.timeZone
      const ruleWithTimezone = {
        ...event.recurrenceRule,
        timeZone
      }

      const rrule = this.toRRule(
        ruleWithTimezone,
        event.startDate,
        timeZone
      )

      return rrule.toText()
    } catch (error) {
      console.error('Error generating human readable pattern:', error)
      return 'Custom recurrence pattern'
    }
  }

  /**
   * Creates a UTC Date object that preserves wall-clock time in the target timezone.
   * This is crucial for implementing the principle "Preserve wall-clock time in the originating timezone".
   *
   * For example, if the user sets an event for 2pm in their timezone, this method ensures
   * it stays at 2pm regardless of timezone or DST changes. This means the actual UTC time
   * will shift when DST transitions occur.
   *
   * @param date The original date
   * @param timezone The target timezone to use
   * @returns A new Date object that represents the wall-clock time in UTC context
   */
  static createDateInTimezone (date: Date | string, timezone: string): Date {
    try {
      if (!timezone) {
        console.warn('No timezone provided to createDateInTimezone, using original date')
        return typeof date === 'string' ? new Date(date) : new Date(date)
      }

      const dateObj = typeof date === 'string' ? new Date(date) : date

      // Format the date components in the target timezone
      // This is the key to handling DST transitions correctly - we extract the wall-clock time
      // as seen in the target timezone, then create a new date with those components
      const localDate = formatInTimeZone(dateObj, timezone, 'yyyy-MM-dd')
      const localTime = formatInTimeZone(dateObj, timezone, 'HH:mm:ss.SSS')

      // Log for debugging
      console.log('Creating date with preserved wall-clock time:', {
        original: dateObj.toISOString(),
        timezone,
        localDate,
        localTime,
        isDST: this.isDateInDST(dateObj, timezone)
      })

      // Parse the components
      const [year, month, day] = localDate.split('-').map(Number)
      const [hour, minute, secondWithMs] = localTime.split(':')
      const [second, millisecond] = secondWithMs.split('.').map(Number)

      // Create a new Date in UTC that represents the local time
      // Using Date.UTC ensures consistent behavior across browsers
      const newDate = new Date(Date.UTC(
        year,
        month - 1,
        day,
        parseInt(hour, 10),
        parseInt(minute, 10),
        second || 0,
        millisecond || 0
      ))

      // Verify that we've preserved the wall-clock time correctly
      const originalLocalTime = formatInTimeZone(dateObj, timezone, 'HH:mm:ss')
      const newLocalTime = formatInTimeZone(newDate, timezone, 'HH:mm:ss')

      console.log('Wall-clock time preservation check:', {
        originalDate: dateObj.toISOString(),
        newDate: newDate.toISOString(),
        originalLocalTime,
        newLocalTime,
        preservedCorrectly: originalLocalTime === newLocalTime
      })

      // If the times don't match, we need to adjust for DST transition edge cases
      if (originalLocalTime !== newLocalTime) {
        console.warn('Wall-clock time not preserved correctly, applying DST correction')

        // Calculate the time difference and adjust
        const originalTimeMinutes = parseInt(originalLocalTime.split(':')[0], 10) * 60 +
                                  parseInt(originalLocalTime.split(':')[1], 10)
        const newTimeMinutes = parseInt(newLocalTime.split(':')[0], 10) * 60 +
                              parseInt(newLocalTime.split(':')[1], 10)
        const diffMinutes = originalTimeMinutes - newTimeMinutes

        // Adjust the date by the difference in minutes
        newDate.setUTCMinutes(newDate.getUTCMinutes() + diffMinutes)

        // Verify again
        const correctedLocalTime = formatInTimeZone(newDate, timezone, 'HH:mm:ss')
        console.log('DST correction applied:', {
          diffMinutes,
          correctedDate: newDate.toISOString(),
          correctedLocalTime,
          preservedCorrectly: originalLocalTime === correctedLocalTime
        })
      }

      return newDate
    } catch (e) {
      console.error('Error creating date in timezone:', e)
      return typeof date === 'string' ? new Date(date) : new Date(date)
    }
  }

  /**
   * Checks if a date is during Daylight Saving Time in the specified timezone.
   * This is useful for handling DST transitions correctly when preserving wall-clock time.
   *
   * @param date The date to check
   * @param timezone The timezone to check in
   * @returns True if the date is in DST, false otherwise
   */
  static isDateInDST (date: Date, timezone: string): boolean {
    try {
      // Get the UTC offset for the date in this timezone
      const offsetString = formatInTimeZone(date, timezone, 'XXX')

      // Create a date 6 months away (to be in the opposite DST season)
      const sixMonthsAway = new Date(date)
      sixMonthsAway.setMonth(date.getMonth() + 6)

      // Get the UTC offset for the date 6 months away
      const offsetSixMonthsAway = formatInTimeZone(sixMonthsAway, timezone, 'XXX')

      // If the offsets are different, at least one of the dates is in DST
      // The one with the larger UTC offset (smaller negative value) is in DST
      if (offsetString !== offsetSixMonthsAway) {
        // Parse the offsets (they're in the format +HH:MM or -HH:MM)
        // For proper comparison, convert to total minutes
        const getOffsetMinutes = (offset: string): number => {
          const sign = offset.charAt(0) === '-' ? -1 : 1
          const [hours, minutes] = offset.substring(1).split(':').map(Number)
          return sign * (hours * 60 + minutes)
        }

        const currentOffset = getOffsetMinutes(offsetString)
        const otherOffset = getOffsetMinutes(offsetSixMonthsAway)

        // The date with the larger offset is in DST
        // Usually DST adds one hour, so the DST offset is greater
        return currentOffset > otherOffset
      }

      // If offsets are the same, either both dates are in DST or neither is
      // In this case, we need to use a different approach

      // For simplicity, assume no DST in this case
      return false
    } catch (e) {
      console.error('Error checking if date is in DST:', e)
      return false
    }
  }

  /**
   * Gets the day of week for a date in a specific timezone.
   * This is critical for handling day boundaries correctly in different timezones.
   *
   * @param date The date to check
   * @param timezone The target timezone
   * @returns Object containing the day name and RRule day code
   */
  static getDayOfWeekInTimezone (
    date: Date | string,
    timezone: string
  ): { dayName: string, dayCode: string } {
    try {
      if (!timezone) {
        throw new Error('No timezone provided to getDayOfWeekInTimezone')
      }

      const dateObj = typeof date === 'string' ? new Date(date) : date

      // Format explicitly using date-fns-tz for reliable timezone handling
      const dayName = formatInTimeZone(dateObj, timezone, 'EEEE') // Full day name (e.g., "Monday")

      // Map day names to RRule day codes
      const dayNameMap: Record<string, string> = {
        Sunday: 'SU',
        Monday: 'MO',
        Tuesday: 'TU',
        Wednesday: 'WE',
        Thursday: 'TH',
        Friday: 'FR',
        Saturday: 'SA'
      }

      // Get the weekday code
      const dayCode = dayNameMap[dayName]

      // Only log if there's an issue with the day code
      if (!dayCode) {
        console.warn('Could not determine day code for date:', {
          date: dateObj.toISOString(),
          timezone,
          dayName
        })
      }

      if (!dayCode) {
        throw new Error(`Could not map day name "${dayName}" to RRule day code`)
      }

      return { dayName, dayCode }
    } catch (e) {
      console.error('Error getting day of week in timezone:', e)

      // Fallback to a more direct approach if there's an error
      try {
        const dateObj = typeof date === 'string' ? new Date(date) : date

        // Use a more direct approach with the Intl API
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long'
        })

        const dayName = formatter.format(dateObj)

        // Map to RRule codes
        const dayCodeMap: Record<string, string> = {
          Sunday: 'SU',
          Monday: 'MO',
          Tuesday: 'TU',
          Wednesday: 'WE',
          Thursday: 'TH',
          Friday: 'FR',
          Saturday: 'SA'
        }

        return {
          dayName,
          dayCode: dayCodeMap[dayName] || ''
        }
      } catch (fallbackError) {
        // Last resort fallback to UTC
        console.error('Fallback error getting day of week, using UTC:', fallbackError)
        const dateObj = typeof date === 'string' ? new Date(date) : date
        const utcDayIndex = dateObj.getUTCDay()
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

        return {
          dayName: dayNames[utcDayIndex],
          dayCode: dayCodes[utcDayIndex]
        }
      }
    }
  }

  /**
   * Checks if a date falls on the expected day of week in a timezone.
   * This is used to verify that recurrence occurrences have the correct day.
   *
   * @param date The date to check
   * @param expectedDayCode The expected day code (SU, MO, TU, etc.)
   * @param timezone The timezone to check in
   * @returns True if the date is on the expected day, false otherwise
   */
  static isOnExpectedDay (
    date: Date,
    expectedDayCode: string,
    timezone: string
  ): boolean {
    if (!expectedDayCode || !timezone) {
      console.warn('Missing parameters for isOnExpectedDay check:', { expectedDayCode, timezone })
      return false
    }

    // Clean the expected day code in case it has a position prefix like "1MO"
    const dayCodeRegex = /^([+-]?\d+)?([A-Z]{2})$/
    const match = expectedDayCode.match(dayCodeRegex)
    const cleanExpectedDay = match ? match[2] : expectedDayCode

    // Get the actual day in the timezone
    const { dayCode } = this.getDayOfWeekInTimezone(date, timezone)

    // Log for debugging
    console.log('Checking if date is on expected day:', {
      date: date.toISOString(),
      timezone,
      expectedDay: cleanExpectedDay,
      actualDay: dayCode,
      isMatch: dayCode === cleanExpectedDay
    })

    return dayCode === cleanExpectedDay
  }

  /**
   * Finds the closest date to the input that falls on the expected day of week.
   * This is crucial for fixing occurrences that have shifted to the wrong day due to timezone issues.
   *
   * @param date The original date
   * @param expectedDayCode The day code we want (SU, MO, TU, etc.)
   * @param timezone The timezone to use
   * @param searchRange How many days to search in each direction
   * @returns A date on the expected day of week
   */
  static findClosestDateWithDay (
    date: Date,
    expectedDayCode: string,
    timezone: string,
    searchRange: number = 3
  ): Date {
    // First check if the date is already on the expected day
    if (this.isOnExpectedDay(date, expectedDayCode, timezone)) {
      return date
    }

    console.log(`Finding closest date with day ${expectedDayCode} from ${date.toISOString()} in ${timezone}`)

    // Create an array with the order: +1, -1, +2, -2, +3, -3, etc.
    // This prioritizes dates closer to the original
    const offsets = []
    for (let i = 1; i <= searchRange; i++) {
      offsets.push(i)
      offsets.push(-i)
    }

    // Try each offset to find a date with the expected day
    for (const offset of offsets) {
      try {
        // Create a new date with the offset
        const adjustedDate = new Date(date)
        adjustedDate.setUTCDate(date.getUTCDate() + offset)

        if (this.isOnExpectedDay(adjustedDate, expectedDayCode, timezone)) {
          console.log(`Found match at offset ${offset}: ${adjustedDate.toISOString()}`)
          return adjustedDate
        }
      } catch (e) {
        console.error(`Error checking date at offset ${offset}:`, e)
      }
    }

    // For timezone boundaries like Sydney case where +/-1-3 days might not find a match,
    // try a wider range in case we're dealing with a significant timezone difference
    if (searchRange < 7) {
      console.log(`Expanding search range for ${expectedDayCode} to 7 days`)
      return this.findClosestDateWithDay(date, expectedDayCode, timezone, 7)
    }

    // If no match found, return the original date
    console.warn(`Could not find date with day ${expectedDayCode} within ${searchRange} days of ${date.toISOString()}`)
    return date
  }
}

export default new RecurrenceService()
