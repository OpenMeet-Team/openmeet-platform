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
        dtstart = typeof startDate === 'string'
          ? parseISO(startDate)
          : new Date(startDate)

        // Use the provided timezone or the one in the rule
        const tz = timeZone || rule.timeZone

        // Apply timezone adjustment if timezone is specified
        if (tz) {
          console.log('Adjusting dtstart for timezone:', tz)

          // CRITICAL: For weekly recurrences, we need to handle day selection based on the originating timezone
          // This implements the principle: "Day selection refers to days in the originating timezone"
          if (rule.frequency === 'WEEKLY') {
            // Get the day of week in the target timezone using our helper method
            const { dayName: dayNameInTimezone, dayCode: dayCodeInTimezone } =
              this.getDayOfWeekInTimezone(dtstart, tz);

            // Always log the day information for debugging
            console.log('Day in timezone:', {
              timezone: tz,
              date: dtstart.toISOString(),
              localDay: dayNameInTimezone,
              dayCode: dayCodeInTimezone
            });

            // Consider any supplied byweekday as explicit user selection, unless we
            // have a special _systemGenerated flag (used only for testing the old behavior)
            const hasUserDaySelection = rule.byweekday && rule.byweekday.length > 0;
            const hasMultipleDaySelection = rule.byweekday && rule.byweekday.length > 1;
            // const hasExplicitFlag = rule._userExplicitSelection === true; // Property '_userExplicitSelection' does not exist on type 'RecurrenceRule'. 'hasExplicitFlag' is assigned a value but never used.
            // const isSystemGenerated = rule._systemGenerated === true; // Property '_systemGenerated' does not exist on type 'RecurrenceRule'.

            if (hasMultipleDaySelection) {
              // Multiple day selection is ALWAYS a clear user choice, don't modify
              console.log('Multiple day selection detected, preserving user choices:', rule.byweekday);
              // We always respect multiple day selection as it must be explicit
            } else if (hasUserDaySelection /* && !isSystemGenerated */) {
              // Single day explicitly selected - this follows the principle that
              // day selection refers to days in the originating timezone
              console.log('Respecting user day selection:', rule.byweekday[0]);
              // Keep the user's selection intact - critical for preserving user intent
            } else if (/* isSystemGenerated && */ false && hasUserDaySelection) { // Condition effectively false due to commented out isSystemGenerated
              // Special case for testing - simulate the old behavior where we might
              // need to adjust for timezone day boundaries
              console.log('System-generated day selection, considering timezone adjustment');
              if (dayCodeInTimezone && dayCodeInTimezone !== rule.byweekday[0]) {
                console.log('Adjusting system-generated day for timezone boundary:', {
                  origDay: rule.byweekday[0],
                  tzDay: dayCodeInTimezone
                });
                rule = { ...rule, byweekday: [dayCodeInTimezone] };
              }
            } else if (!rule.byweekday || rule.byweekday.length === 0) {
              // If byweekday not specified, add it based on the day in target timezone
              console.log('Adding missing byweekday for weekly recurrence:', dayCodeInTimezone);
              rule = { ...rule, byweekday: [dayCodeInTimezone] };
            }
          }

          // Use our helper method to create a date that preserves wall-clock time
          // This implements the principle: "Preserve wall-clock time in the originating timezone"
          const adjustedDate = this.createDateInTimezone(dtstart, tz);

          // Log the timezone adjustment with before/after comparison
          console.log('Timezone adjustment for wall-clock time preservation:', {
            original: dtstart.toISOString(),
            adjusted: adjustedDate.toISOString(),
            timeZone: tz,
            originalLocalTime: formatInTimeZone(dtstart, tz, 'HH:mm:ss'),
            adjustedLocalTime: formatInTimeZone(adjustedDate, tz, 'HH:mm:ss')
          });

          dtstart = adjustedDate;
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
            // Clean any position prefix to get just the day code
            const dayMatch = day.match(/^(?:[+-]?\d+)?([A-Z]{2})$/)
            const cleanDay = dayMatch ? dayMatch[1] : day;

            // Use the .nth() method on the weekday constant for better text formatting
            const weekdayConst = RRule[cleanDay as keyof typeof RRule]

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
      // Store the original date for time preservation
      const originalDate = new Date(event.startDate);

      // Log detailed recurrence info for debugging
      console.log('RecurrenceService.getOccurrences for event:', {
        name: event.name,
        startDate: event.startDate,
        timezone: event.timeZone,
        recurrenceRule: {
          frequency: event.recurrenceRule.frequency,
          interval: event.recurrenceRule.interval,
          byweekday: event.recurrenceRule.byweekday,
          bymonthday: event.recurrenceRule.bymonthday,
          bysetpos: event.recurrenceRule.bysetpos,
          timeZone: event.recurrenceRule.timeZone
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

      // Get timezone from event or rule
      const timeZone = event.timeZone || event.recurrenceRule.timeZone;

      // Always create a copy of the rule with the timezone explicitly included
      const ruleWithTimezone = {
        ...event.recurrenceRule,
        timeZone
      };

      // Store original time components in the event's timezone for wall-clock time preservation
      // This is aligned with our first principle: preserve wall-clock time in originating timezone
      let originalWallClockTime;

      if (timeZone) {
        // Get the wall-clock time (local time) in the event's timezone
        const localHours = formatInTimeZone(originalDate, timeZone, 'HH');
        const localMinutes = formatInTimeZone(originalDate, timeZone, 'mm');
        const localSeconds = formatInTimeZone(originalDate, timeZone, 'ss');
        const localMs = formatInTimeZone(originalDate, timeZone, 'SSS');

        originalWallClockTime = {
          hours: parseInt(localHours, 10),
          minutes: parseInt(localMinutes, 10),
          seconds: parseInt(localSeconds, 10),
          milliseconds: parseInt(localMs, 10)
        };

        console.log('Original wall-clock time in timezone:', {
          timezone: timeZone,
          wallClockTime: `${localHours}:${localMinutes}:${localSeconds}.${localMs}`
        });
      }

      // Store the original UTC time components as fallback
      const originalTimeInfo = {
        hours: originalDate.getUTCHours(),
        minutes: originalDate.getUTCMinutes(),
        seconds: originalDate.getUTCSeconds(),
        milliseconds: originalDate.getUTCMilliseconds()
      };

      // For weekly recurrences, ensure we're using the correct day in target timezone
      if (ruleWithTimezone.frequency === 'WEEKLY') {
        const dateInUTC = new Date(event.startDate);

        // Get the day in the target timezone
        const { dayName, dayCode } = this.getDayOfWeekInTimezone(dateInUTC, timeZone);

        console.log('Weekly recurrence - day in timezone check:', {
          date: dateInUTC.toISOString(),
          timezone: timeZone,
          dayName: dayName,
          dayCode: dayCode,
          currentRule: ruleWithTimezone.byweekday,
          // isUserSelection: ruleWithTimezone._userExplicitSelection === true // Property '_userExplicitSelection' does not exist
          isUserSelection: false // Assuming false as property does not exist
        });

        // For explicit user selection, we should always respect their choice
        // Aligned with our second principle: day selection refers to days in originating timezone
        const isUserSelection = /* ruleWithTimezone._userExplicitSelection === true || */ // Property '_userExplicitSelection' does not exist
                               (ruleWithTimezone.byweekday && ruleWithTimezone.byweekday.length > 0);

        // Multiple day selection is always explicit
        const hasMultipleDaySelection = ruleWithTimezone.byweekday && ruleWithTimezone.byweekday.length > 1;

        if (hasMultipleDaySelection) {
          console.log('Multiple day selection detected, preserving user choices:', ruleWithTimezone.byweekday);
          // Multiple days selected - always respect this as user choice
        }
        else if (isUserSelection) {
          console.log('Respecting user day selection:', ruleWithTimezone.byweekday);
          // Single day explicitly selected - respect this
        }
        else if (!ruleWithTimezone.byweekday || ruleWithTimezone.byweekday.length === 0) {
          // No day selected, use the day in target timezone
          console.log('No day selected, using day in originating timezone:', dayCode);
          ruleWithTimezone.byweekday = [dayCode];
        }
      }

      // Pass the timezone explicitly to toRRule to ensure proper handling
      const rrule = this.toRRule(
        ruleWithTimezone,
        event.startDate,
        timeZone
      )

      console.log('RRule string with timezone:', rrule.toString())

      // Generate occurrences
      let occurrences = rrule.all((_, i) => i < count)

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

        occurrences = occurrences.filter(occurrence =>
          !exceptions.includes(format(occurrence, 'yyyy-MM-dd'))
        )
      }

      // UNIFIED TIME PRESERVATION APPROACH
      // This applies the same wall-clock time preservation logic to all recurrence types,
      // which is more maintainable and consistent with our first principle
      if (timeZone) {
        return occurrences.map((date, index) => {
          try {
            // First, check if this occurrence falls on the expected day (for weekly recurrences)
            let dateToAdjust = date;

            if (ruleWithTimezone.frequency === 'WEEKLY' &&
                ruleWithTimezone.byweekday &&
                ruleWithTimezone.byweekday.length > 0) {

              // For multiple day selection, check if this date is on one of the selected days
              if (ruleWithTimezone.byweekday.length > 1) {
                const { dayCode } = this.getDayOfWeekInTimezone(date, timeZone);
                const isDaySelected = ruleWithTimezone.byweekday.includes(dayCode);

                if (!isDaySelected) {
                  // Find the nearest date that falls on one of the selected days
                  for (const targetDay of ruleWithTimezone.byweekday) {
                    const correctedDate = this.findClosestDateWithDay(date, targetDay, timeZone);
                    if (correctedDate) {
                      console.log(`Adjusted occurrence ${index + 1} to match selected day ${targetDay}`);
                      dateToAdjust = correctedDate;
                      break;
                    }
                  }
                }
              }
              // For single day selection, ensure it's on the expected day
              else {
                const expectedDay = ruleWithTimezone.byweekday[0];

                // Ensure we have a clean day code without any position prefix
                const dayCodeRegex = /^([+-]?\d+)?([A-Z]{2})$/;
                const match = expectedDay.match(dayCodeRegex);
                const cleanDayCode = match ? match[2] : expectedDay;

                console.log(`Checking if date is on user-selected day ${cleanDayCode} in timezone ${timeZone}`);

                if (!this.isOnExpectedDay(date, cleanDayCode, timeZone)) {
                  const correctedDate = this.findClosestDateWithDay(date, cleanDayCode, timeZone);
                  if (correctedDate) {
                    console.log(`Adjusted occurrence ${index + 1} to match day ${cleanDayCode}`);
                    dateToAdjust = correctedDate;
                  }
                }
              }
            }

            // Now apply the original wall-clock time
            // This is crucial for preserving the exact time in the originating timezone
            // even through DST transitions
            const datePart = formatInTimeZone(dateToAdjust, timeZone, 'yyyy-MM-dd');

            // Use the wall-clock time from the original event
            let adjustedDate;

            if (originalWallClockTime) {
              // Create a date string with the date part and original wall-clock time
              const { hours, minutes, seconds } = originalWallClockTime;
              const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              const localDateTimeStr = `${datePart}T${timeStr}`;

              // Convert this local datetime to a UTC date that preserves wall-clock time
              adjustedDate = this.createDateInTimezone(new Date(localDateTimeStr), timeZone);

              // Also preserve milliseconds which aren't handled by formatInTimeZone
              adjustedDate.setUTCMilliseconds(originalWallClockTime.milliseconds);
            } else {
              // Fallback to UTC time preservation if we couldn't get wall-clock time
              adjustedDate = new Date(dateToAdjust);
              adjustedDate.setUTCHours(
                originalTimeInfo.hours,
                originalTimeInfo.minutes,
                originalTimeInfo.seconds,
                originalTimeInfo.milliseconds
              );
            }

            console.log(`Preserving time for occurrence ${index + 1}:`, {
              original: dateToAdjust.toISOString(),
              adjusted: adjustedDate.toISOString(),
              dateInTz: formatInTimeZone(adjustedDate, timeZone, 'yyyy-MM-dd HH:mm:ss')
            });

            return adjustedDate;
          } catch (e) {
            console.error(`Error adjusting time for occurrence ${index + 1}:`, e);
            // Fallback to basic time preservation
            const newDate = new Date(date);
            newDate.setUTCHours(
              originalTimeInfo.hours,
              originalTimeInfo.minutes,
              originalTimeInfo.seconds,
              originalTimeInfo.milliseconds
            );
            return newDate;
          }
        });
      }

      // If no timezone specified, just return the occurrences as-is
      return occurrences;
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
      const timeZone = event.timeZone;
      const ruleWithTimezone = {
        ...event.recurrenceRule,
        timeZone
      };

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
        console.warn('No timezone provided to createDateInTimezone, using original date');
        return typeof date === 'string' ? new Date(date) : new Date(date);
      }

      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Format the date components in the target timezone
      // This is the key to handling DST transitions correctly - we extract the wall-clock time
      // as seen in the target timezone, then create a new date with those components
      const localDate = formatInTimeZone(dateObj, timezone, 'yyyy-MM-dd');
      const localTime = formatInTimeZone(dateObj, timezone, 'HH:mm:ss.SSS');

      // Log for debugging
      console.log('Creating date with preserved wall-clock time:', {
        original: dateObj.toISOString(),
        timezone: timezone,
        localDate: localDate,
        localTime: localTime,
        isDST: this.isDateInDST(dateObj, timezone)
      });

      // Parse the components
      const [year, month, day] = localDate.split('-').map(Number);
      const [hour, minute, secondWithMs] = localTime.split(':');
      const [second, millisecond] = secondWithMs.split('.').map(Number);

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
      ));

      // Verify that we've preserved the wall-clock time correctly
      const originalLocalTime = formatInTimeZone(dateObj, timezone, 'HH:mm:ss');
      const newLocalTime = formatInTimeZone(newDate, timezone, 'HH:mm:ss');

      console.log('Wall-clock time preservation check:', {
        originalDate: dateObj.toISOString(),
        newDate: newDate.toISOString(),
        originalLocalTime: originalLocalTime,
        newLocalTime: newLocalTime,
        preservedCorrectly: originalLocalTime === newLocalTime
      });

      // If the times don't match, we need to adjust for DST transition edge cases
      if (originalLocalTime !== newLocalTime) {
        console.warn('Wall-clock time not preserved correctly, applying DST correction');

        // Calculate the time difference and adjust
        const originalTimeMinutes = parseInt(originalLocalTime.split(':')[0], 10) * 60 +
                                  parseInt(originalLocalTime.split(':')[1], 10);
        const newTimeMinutes = parseInt(newLocalTime.split(':')[0], 10) * 60 +
                              parseInt(newLocalTime.split(':')[1], 10);
        const diffMinutes = originalTimeMinutes - newTimeMinutes;

        // Adjust the date by the difference in minutes
        newDate.setUTCMinutes(newDate.getUTCMinutes() + diffMinutes);

        // Verify again
        const correctedLocalTime = formatInTimeZone(newDate, timezone, 'HH:mm:ss');
        console.log('DST correction applied:', {
          diffMinutes: diffMinutes,
          correctedDate: newDate.toISOString(),
          correctedLocalTime: correctedLocalTime,
          preservedCorrectly: originalLocalTime === correctedLocalTime
        });
      }

      return newDate;
    } catch (e) {
      console.error('Error creating date in timezone:', e);
      return typeof date === 'string' ? new Date(date) : new Date(date);
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
  static isDateInDST(date: Date, timezone: string): boolean {
    try {
      // Get the UTC offset for the date in this timezone
      const offsetString = formatInTimeZone(date, timezone, 'XXX');

      // Create a date 6 months away (to be in the opposite DST season)
      const sixMonthsAway = new Date(date);
      sixMonthsAway.setMonth(date.getMonth() + 6);

      // Get the UTC offset for the date 6 months away
      const offsetSixMonthsAway = formatInTimeZone(sixMonthsAway, timezone, 'XXX');

      // If the offsets are different, at least one of the dates is in DST
      // The one with the larger UTC offset (smaller negative value) is in DST
      if (offsetString !== offsetSixMonthsAway) {
        // Parse the offsets (they're in the format +HH:MM or -HH:MM)
        // For proper comparison, convert to total minutes
        const getOffsetMinutes = (offset: string): number => {
          const sign = offset.charAt(0) === '-' ? -1 : 1;
          const [hours, minutes] = offset.substring(1).split(':').map(Number);
          return sign * (hours * 60 + minutes);
        };

        const currentOffset = getOffsetMinutes(offsetString);
        const otherOffset = getOffsetMinutes(offsetSixMonthsAway);

        // The date with the larger offset is in DST
        // Usually DST adds one hour, so the DST offset is greater
        return currentOffset > otherOffset;
      }

      // If offsets are the same, either both dates are in DST or neither is
      // In this case, we need to use a different approach

      // For simplicity, assume no DST in this case
      return false;
    } catch (e) {
      console.error('Error checking if date is in DST:', e);
      return false;
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
        throw new Error('No timezone provided to getDayOfWeekInTimezone');
      }

      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Format explicitly using date-fns-tz for reliable timezone handling
      const dayName = formatInTimeZone(dateObj, timezone, 'EEEE'); // Full day name (e.g., "Monday")
      const dayOfWeek = formatInTimeZone(dateObj, timezone, 'i'); // ISO day of week (1-7, where 1 is Monday)
      const dayOfMonth = formatInTimeZone(dateObj, timezone, 'd'); // Day of month

      // Map day names to RRule day codes
      const dayNameMap: Record<string, string> = {
        Sunday: 'SU',
        Monday: 'MO',
        Tuesday: 'TU',
        Wednesday: 'WE',
        Thursday: 'TH',
        Friday: 'FR',
        Saturday: 'SA'
      };

      // Get the weekday code
      const dayCode = dayNameMap[dayName];

      // Log for debugging
      console.log('Day of week in timezone:', {
        date: dateObj.toISOString(),
        timezone: timezone,
        dayName: dayName,
        dayCode: dayCode,
        isoDay: dayOfWeek,
        dayOfMonth: dayOfMonth
      });

      if (!dayCode) {
        throw new Error(`Could not map day name "${dayName}" to RRule day code`);
      }

      return { dayName, dayCode };
    } catch (e) {
      console.error('Error getting day of week in timezone:', e);

      // Fallback to a more direct approach if there's an error
      try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;

        // Use a more direct approach with the Intl API
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          weekday: 'long'
        });

        const dayName = formatter.format(dateObj);

        // Map to RRule codes
        const dayCodeMap: Record<string, string> = {
          'Sunday': 'SU',
          'Monday': 'MO',
          'Tuesday': 'TU',
          'Wednesday': 'WE',
          'Thursday': 'TH',
          'Friday': 'FR',
          'Saturday': 'SA'
        };

        return {
          dayName: dayName,
          dayCode: dayCodeMap[dayName] || ''
        };
      } catch (fallbackError) {
        // Last resort fallback to UTC
        console.error('Fallback error getting day of week, using UTC:', fallbackError);
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const utcDayIndex = dateObj.getUTCDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

        return {
          dayName: dayNames[utcDayIndex],
          dayCode: dayCodes[utcDayIndex]
        };
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
      console.warn('Missing parameters for isOnExpectedDay check:', { expectedDayCode, timezone });
      return false;
    }

    // Clean the expected day code in case it has a position prefix like "1MO"
    const dayCodeRegex = /^([+-]?\d+)?([A-Z]{2})$/;
    const match = expectedDayCode.match(dayCodeRegex);
    const cleanExpectedDay = match ? match[2] : expectedDayCode;

    // Get the actual day in the timezone
    const { dayCode } = this.getDayOfWeekInTimezone(date, timezone);

    // Log for debugging
    console.log('Checking if date is on expected day:', {
      date: date.toISOString(),
      timezone: timezone,
      expectedDay: cleanExpectedDay,
      actualDay: dayCode,
      isMatch: dayCode === cleanExpectedDay
    });

    return dayCode === cleanExpectedDay;
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
      return date;
    }

    console.log(`Finding closest date with day ${expectedDayCode} from ${date.toISOString()} in ${timezone}`);

    // Create an array with the order: +1, -1, +2, -2, +3, -3, etc.
    // This prioritizes dates closer to the original
    const offsets = [];
    for (let i = 1; i <= searchRange; i++) {
      offsets.push(i);
      offsets.push(-i);
    }

    // Try each offset to find a date with the expected day
    for (const offset of offsets) {
      try {
        // Create a new date with the offset
        const adjustedDate = new Date(date);
        adjustedDate.setUTCDate(date.getUTCDate() + offset);

        if (this.isOnExpectedDay(adjustedDate, expectedDayCode, timezone)) {
          console.log(`Found match at offset ${offset}: ${adjustedDate.toISOString()}`);
          return adjustedDate;
        }
      } catch (e) {
        console.error(`Error checking date at offset ${offset}:`, e);
      }
    }

    // For timezone boundaries like Sydney case where +/-1-3 days might not find a match,
    // try a wider range in case we're dealing with a significant timezone difference
    if (searchRange < 7) {
      console.log(`Expanding search range for ${expectedDayCode} to 7 days`);
      return this.findClosestDateWithDay(date, expectedDayCode, timezone, 7);
    }

    // If no match found, return the original date
    console.warn(`Could not find date with day ${expectedDayCode} within ${searchRange} days of ${date.toISOString()}`);
    return date;
  }
}

export default new RecurrenceService()
