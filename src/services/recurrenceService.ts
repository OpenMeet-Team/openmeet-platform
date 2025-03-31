import { RRule } from 'rrule'
import { format, formatInTimeZone } from 'date-fns-tz'
import { parseISO } from 'date-fns'
import { EventEntity, RecurrenceRule } from '../types/event'

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
    // Validate that required freq property exists
    if (!rule.freq) {
      throw new Error('Recurrence rule must have a frequency')
    }
    
    // Get the RRule frequency constant (needs to be a number)
    let freq: number;
    if (typeof rule.freq === 'string') {
      switch (rule.freq) {
        case 'YEARLY': freq = RRule.YEARLY; break;
        case 'MONTHLY': freq = RRule.MONTHLY; break;
        case 'WEEKLY': freq = RRule.WEEKLY; break;
        case 'DAILY': freq = RRule.DAILY; break;
        case 'HOURLY': freq = RRule.HOURLY; break;
        case 'MINUTELY': freq = RRule.MINUTELY; break;
        case 'SECONDLY': freq = RRule.SECONDLY; break;
        default: 
          console.error('Unknown frequency:', rule.freq);
          throw new Error(`Unknown frequency: ${rule.freq}`);
      }
    } else {
      freq = rule.freq as number;
    }

    // Parse the start date correctly
    const dtstart = parseISO(startDate);

    // Create options object with the correct format for RRule
    const options: any = {
      freq,
      dtstart
    };

    // Add optional parameters
    if (rule.interval) options.interval = rule.interval;
    if (rule.count) options.count = rule.count;
    if (rule.until) options.until = new Date(rule.until);
    
    // Convert day names to RRule constants
    if (rule.byday && rule.byday.length > 0) {
      options.byweekday = rule.byday.map(day => {
        // Handle prefixed weekdays like "1MO" (first Monday)
        const match = String(day).match(/^([+-]?\d+)?([A-Z]{2})$/);
        if (match) {
          const [, prefix, weekday] = match;
          const dayConstant = RRule[weekday as keyof typeof RRule];
          
          if (prefix) {
            return dayConstant.nth(parseInt(prefix, 10));
          }
          return dayConstant;
        }
        return RRule[day as keyof typeof RRule]; // For simple "MO", "TU", etc.
      });
    }
    
    // Add other byXXX properties
    if (rule.bymonth) options.bymonth = rule.bymonth;
    if (rule.bymonthday) options.bymonthday = rule.bymonthday;
    if (rule.byhour) options.byhour = rule.byhour;
    if (rule.byminute) options.byminute = rule.byminute;
    if (rule.bysecond) options.bysecond = rule.bysecond;
    if (rule.bysetpos) options.bysetpos = rule.bysetpos;
    
    // Handle week start
    if (rule.wkst) {
      options.wkst = RRule[rule.wkst as keyof typeof RRule];
    }

    console.log('Creating RRule with options:', options);
    return new RRule(options);
  }

  // Convert RRule to RecurrenceRule for API usage
  static fromRRule (rrule: RRule): RecurrenceRule {
    const options = rrule.options
    const rule: RecurrenceRule = {
      freq: String(options.freq) as RecurrenceRule['freq']
    }

    if (options.interval && options.interval > 1) {
      rule.interval = options.interval
    }

    if (options.count) {
      rule.count = options.count
    }

    if (options.until) {
      rule.until = options.until.toISOString()
    }

    if (options.byweekday && options.byweekday.length > 0) {
      rule.byday = options.byweekday.map((day: unknown) => String(day))
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
    freq: string,
    interval: number = 1,
    options: {
      count?: number,
      until?: string,
      byday?: string[],
      bymonthday?: number[],
      bymonth?: number[]
    } = {}
  ): RecurrenceRule {
    return {
      freq: freq as RecurrenceRule['freq'],
      interval,
      ...options
    }
  }

  // Generate occurrence dates based on a recurrence rule
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
        event.startDate,
        event.timeZone
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

  // Get a human-readable description of the recurrence pattern
  static getHumanReadablePattern (event: EventEntity): string {
    if (!event.recurrenceRule) {
      return 'Does not repeat'
    }

    try {
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
  static formatWithTimezone (date: string | Date, format: string, timeZone?: string): string {
    if (!date) return ''

    const dateObj = typeof date === 'string' ? parseISO(date) : date

    if (timeZone) {
      return formatInTimeZone(dateObj, timeZone, format)
    } else {
      return formatInTimeZone(
        dateObj,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        format
      )
    }
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
