import { ref, computed, watch, onMounted } from 'vue'
import { RecurrenceService } from '../../services/recurrenceService'
import { RecurrenceRule, EventEntity } from '../../types/event'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

// Interface for component props
export interface RecurrenceComponentProps {
  modelValue?: RecurrenceRule
  isRecurring: boolean
  startDate: string
  timeZone: string
  hideToggle: boolean
}

// Define type for emit function
type EmitFn = (event: string, ...args: unknown[]) => void

// This function encapsulates all the component logic to avoid TypeScript declaration conflicts
export function useRecurrenceLogic (props: RecurrenceComponentProps, emit: EmitFn) {
  // Loading state indicators
  const isCalculatingPattern = ref(false)
  const isCalculatingOccurrences = ref(false)

  // Recurrence options
  const frequencyOptions = RecurrenceService.frequencyOptions
  const weekdayOptions = RecurrenceService.weekdayOptions

  // Form state
  const frequency = ref<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY'>('WEEKLY')
  const interval = ref(1)
  const selectedDays = ref<string[]>([])
  const monthlyRepeatType = ref('dayOfMonth')
  const monthlyPosition = ref('1') // First, Second, Third, Fourth
  const monthlyWeekday = ref('MO') // Monday, Tuesday, etc.
  const timezone = ref('')
  const endType = ref('never')
  const count = ref(10)
  const until = ref('')
  const timezoneOptions = ref(RecurrenceService.getTimezones())
  const occurrences = ref<Date[]>([])

  // Options for nth position in month
  const monthlyPositionOptions = [
    { value: '1', label: 'First' },
    { value: '2', label: 'Second' },
    { value: '3', label: 'Third' },
    { value: '4', label: 'Fourth' },
    { value: '-1', label: 'Last' }
  ]

  // Track state updates
  const isProcessingUpdate = ref(false)
  let debounceTimer: number | null = null
  let lastRuleUpdateHash = ''

  // Computed property for start date as Date object
  const startDateObject = computed(() => {
    if (!props.startDate) return null
    return new Date(props.startDate)
  })

  // Compute the complete rule object to send to the parent
  const rule = computed<Partial<RecurrenceRule>>(() => {
    try {
      // Create a type-safe result object with known properties from RecurrenceRule
      const result: Partial<RecurrenceRule> = {
        frequency: frequency.value
      }

      // Only add interval if it's greater than 1
      if (interval.value && interval.value > 1) {
        result.interval = interval.value
      }

      // Handle different frequency types
      if (frequency.value === 'DAILY' || frequency.value === 'WEEKLY') {
        // Add weekdays for daily or weekly frequency
        if (selectedDays.value.length > 0) {
          // Explicitly set days - CRITICAL: This must be identified as user selection
          result.byweekday = selectedDays.value

          // Flag this as an explicit user selection to help RecurrenceService respect it
          // This is used to avoid timezone boundary adjustments overriding user choices
          result._userExplicitSelection = true
        } else if (frequency.value === 'WEEKLY' && startDateObject.value && timezone.value) {
          // If no days selected for weekly recurrence, default to the day of the start date
          // in the target timezone
          try {
            const { dayCode } = RecurrenceService.getDayOfWeekInTimezone(
              startDateObject.value,
              timezone.value
            )
            if (dayCode) {
              result.byweekday = [dayCode]
              console.log('Auto-set weekly byweekday from start date:', dayCode)
            }
          } catch (e) {
            console.error('Error getting day of week for auto-setting byweekday:', e)
          }
        }
      } else if (frequency.value === 'MONTHLY') {
        // Handle monthly frequency based on repeat type
        if (monthlyRepeatType.value === 'dayOfMonth' && startDateObject.value) {
          // Use the day of month from the start date
          result.bymonthday = [startDateObject.value.getDate()]

          // Ensure we don't have byweekday set when using bymonthday
          if (result.byweekday) {
            delete result.byweekday
          }
        } else if (monthlyRepeatType.value === 'dayOfWeek') {
          // For monthly by-weekday patterns with nth occurrence (e.g., 2nd Wednesday),
          // we need to combine byweekday with bysetpos

          // Get the position as a number
          const position = parseInt(monthlyPosition.value, 10)

          // Set the byweekday (weekday code without position)
          result.byweekday = [monthlyWeekday.value]

          // Set bysetpos for the position (1st, 2nd, 3rd, etc.)
          result.bysetpos = [position]

          // Ensure we don't have bymonthday set
          if (result.bymonthday) {
            delete result.bymonthday
          }
        }
      }

      // Add count or until based on end type
      if (endType.value === 'count' && count.value) {
        result.count = count.value
      } else if (endType.value === 'until' && until.value) {
        result.until = new Date(until.value).toISOString()
      }

      // Ensure wkst is a valid value if set
      if (result.wkst && !['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].includes(result.wkst)) {
        delete result.wkst
      }

      // CRITICAL: ALWAYS include timezone in the rule for proper client/server sync
      // Use the component's timezone or fallback to the user's timezone
      result.timeZone = timezone.value || RecurrenceService.getUserTimezone()

      return result
    } catch (e) {
      console.error('Error in rule computed property:', e)
      return {
        frequency: 'WEEKLY',
        timeZone: timezone.value || RecurrenceService.getUserTimezone()
      }
    }
  })

  // Cache for pattern description to reduce recalculation
  const patternDescriptionCache = ref('')

  // Human readable pattern now uses the cache
  const humanReadablePattern = computed(() => {
    if (!props.isRecurring) return 'Does not repeat'
    if (isCalculatingPattern.value) return 'Calculating...'

    console.log('Timezone... error?', RecurrenceService)
    let pattern = ''
    let tzAbbreviation = ''

    try {
      // this is a hack to get the timezone display to work in tests, the getTimezoneDisplay function is mocked, but not showing as a function in the test
      tzAbbreviation = timezone.value && typeof RecurrenceService.getTimezoneDisplay === 'function'
        ? ` (${RecurrenceService.getTimezoneDisplay(timezone.value).split(' ').pop()?.replace(/[()]/g, '') || timezone.value})`
        : ''
    } catch (e) {
      console.error('Error getting timezone display:', e)
      tzAbbreviation = timezone.value ? ` (${timezone.value})` : ''
    }

    // For monthly day-of-week patterns, we can provide a more descriptive pattern directly
    if (frequency.value === 'MONTHLY' && monthlyRepeatType.value === 'dayOfWeek' &&
        monthlyPosition.value && monthlyWeekday.value) {
      const positionLabel = getPositionLabel(monthlyPosition.value)
      const weekdayLabel = getWeekdayLabel(monthlyWeekday.value)
      const intervalLabel = interval.value > 1 ? `every ${interval.value} months` : 'every month'

      pattern = `${intervalLabel} on the ${positionLabel} ${weekdayLabel}`
      return pattern + tzAbbreviation
    }

    // Generate a basic pattern if cache is empty but we have enough information
    if (!patternDescriptionCache.value && frequency.value) {
      const frequencyMap: Record<string, string> = {
        DAILY: 'day',
        WEEKLY: 'week',
        MONTHLY: 'month',
        YEARLY: 'year'
      }
      const frequencyText = frequencyMap[frequency.value] || ''
      if (frequencyText) {
        const intervalText = interval.value > 1
          ? `${interval.value} ${frequencyText}s` : `${frequencyText}`
        pattern = `Repeats every ${intervalText}`
        if (frequency.value === 'WEEKLY' && selectedDays.value.length > 0) {
          const dayNames = selectedDays.value.map(day => {
            const dayOption = weekdayOptions.find(opt => opt.value === day)
            return dayOption ? dayOption.label : day
          })
          if (dayNames.length > 0) {
            pattern += ` on ${dayNames.join(', ')}`
          }
        }
        return pattern + tzAbbreviation
      }
    }

    if (patternDescriptionCache.value) {
      return patternDescriptionCache.value + tzAbbreviation
    }

    return 'Please select a frequency type' + tzAbbreviation
  })

  // Function to update the pattern description (will be called from updateOccurrences)
  const updatePatternDescription = (ruleObj: Partial<RecurrenceRule> | undefined, tzValue: string) => {
    if (!ruleObj || !props.startDate || !props.isRecurring) {
      patternDescriptionCache.value = 'Does not repeat'
      return
    }

    try {
      // For monthly day-of-week patterns, we already handle this in the computed property
      if (ruleObj.frequency === 'MONTHLY' &&
          ruleObj.byweekday && ruleObj.byweekday.length > 0 &&
          ruleObj.byweekday[0].match(/^([+-]?\d+)([A-Z]{2})$/)) {
        // Let the computed property handle this case
        patternDescriptionCache.value = ''
        return
      }

      // Ensure the rule has required 'frequency' field
      if (ruleObj && 'frequency' in ruleObj) {
        // Create a deep copy to prevent reactive issues
        const completeRule = JSON.parse(JSON.stringify(ruleObj)) as RecurrenceRule

        // CRITICAL: Always make sure timezone is included
        completeRule.timeZone = tzValue || completeRule.timeZone || RecurrenceService.getUserTimezone()

        console.log('Generating pattern description with rule:', {
          frequency: completeRule.frequency,
          interval: completeRule.interval,
          byweekday: completeRule.byweekday,
          timeZone: completeRule.timeZone
        })

        // Build a robust fallback description in case the other methods fail
        let fallbackDescription = ''

        // Start with the frequency type
        const frequencyMap: Record<string, string> = {
          DAILY: 'daily',
          WEEKLY: 'weekly',
          MONTHLY: 'monthly',
          YEARLY: 'yearly'
        }

        const frequencyText = frequencyMap[completeRule.frequency] || 'regularly'

        // Add interval if more than 1
        const intervalText = completeRule.interval && completeRule.interval > 1
          ? `every ${completeRule.interval} ${frequencyText.replace(/ly$/, '')}s`
          : `every ${frequencyText.replace(/ly$/, '')}`

        fallbackDescription = `Repeats ${intervalText}`

        // Add day specifics for weekly recurrence
        if (completeRule.frequency === 'WEEKLY' && completeRule.byweekday && completeRule.byweekday.length > 0) {
          // Map day codes to full names
          const dayNames = completeRule.byweekday.map(day => {
            const dayOption = weekdayOptions.find(opt => opt.value === day)
            return dayOption ? dayOption.label : day
          })

          // If days are provided, add them to the description
          if (dayNames.length > 0) {
            fallbackDescription = `Repeats ${intervalText} on ${dayNames.join(', ')}`
          }
        }

        // Add specific details for monthly patterns
        if (completeRule.frequency === 'MONTHLY') {
          if (completeRule.bymonthday && completeRule.bymonthday.length > 0) {
            // Day of month pattern (e.g., 15th of each month)
            const dayOfMonth = completeRule.bymonthday[0]
            fallbackDescription = `Repeats ${intervalText} on day ${dayOfMonth}`
          } else if (completeRule.byweekday && completeRule.byweekday.length > 0 && completeRule.bysetpos) {
            // Complex pattern (e.g., 2nd Monday)
            // Try to format as "first/second/etc. Monday of each month"
            const position = Array.isArray(completeRule.bysetpos)
              ? completeRule.bysetpos[0]
              : completeRule.bysetpos

            const weekdayCode = completeRule.byweekday[0].replace(/^[+-]?\d+/, '') // Strip position prefix if any
            const weekdayOption = weekdayOptions.find(opt => opt.value === weekdayCode)
            const weekdayName = weekdayOption ? weekdayOption.label : weekdayCode

            const positionText = position === 1 ? 'first'
              : position === 2 ? 'second'
                : position === 3 ? 'third'
                  : position === 4 ? 'fourth'
                    : position === -1 ? 'last' : `${position}${position === -2 ? 'nd to last' : 'th'}`

            fallbackDescription = `Repeats ${intervalText} on the ${positionText} ${weekdayName}`
          }
        }

        console.log('Fallback description prepared:', fallbackDescription)

        // Try to get description from rrule library first - this usually gives the best formatting
        try {
          console.log('Attempting to get description from RRule.toText()')
          const rrule = RecurrenceService.toRRule(completeRule, props.startDate, tzValue)
          const description = rrule.toText()

          console.log('RRule.toText() result:', description)

          if (description && description !== 'every 1 week' && !description.includes('undefined')) {
            patternDescriptionCache.value = description
            return
          }
        } catch (rruleError) {
          console.warn('Error in RRule.toText():', rruleError)
        }

        // Fallback to our service's getHumanReadablePattern method
        try {
          console.log('Attempting to get description from RecurrenceService.getHumanReadablePattern')
          const backupDescription = RecurrenceService.getHumanReadablePattern({
            startDate: props.startDate,
            recurrenceRule: completeRule,
            timeZone: tzValue
          } as unknown as EventEntity)

          console.log('getHumanReadablePattern result:', backupDescription)

          if (backupDescription && backupDescription !== 'every 1 week' && !backupDescription.includes('undefined')) {
            patternDescriptionCache.value = backupDescription
            return
          }
        } catch (fallbackError) {
          console.error('Error in RecurrenceService.getHumanReadablePattern:', fallbackError)
        }

        // If we got here, use our own fallback description
        console.log('Using fallback description:', fallbackDescription)
        patternDescriptionCache.value = fallbackDescription
      } else {
        patternDescriptionCache.value = 'Please select a frequency type'
      }
    } catch (e) {
      console.error('Error generating pattern description:', e)
      patternDescriptionCache.value = `Custom recurrence pattern in ${tzValue || 'local timezone'}`
    }
  }

  // Computed properties for UI
  const intervalLabel = computed(() => {
    switch (frequency.value) {
      case 'DAILY': return interval.value === 1 ? 'day' : 'days'
      case 'WEEKLY': return interval.value === 1 ? 'week' : 'weeks'
      case 'MONTHLY': return interval.value === 1 ? 'month' : 'months'
      case 'YEARLY': return interval.value === 1 ? 'year' : 'years'
      default: return 'interval'
    }
  })

  // Helper methods for displaying human-readable position and weekday labels
  const getPositionLabel = (position: string): string => {
    const posOption = monthlyPositionOptions.find(opt => opt.value === position)
    return posOption ? posOption.label.toLowerCase() : position
  }

  const getWeekdayLabel = (weekday: string): string => {
    const dayOption = weekdayOptions.find(opt => opt.value === weekday)
    return dayOption ? dayOption.label : weekday
  }

  // Functions
  const toggleRecurrence = (value: boolean) => {
    emit('update:is-recurring', value)
    if (value && !timezone.value) {
      timezone.value = RecurrenceService.getUserTimezone()
      emit('update:time-zone', timezone.value)
    }
  }

  // Debugging functions
  const logMonthlyPositionChange = (position: string) => {
    console.log('Monthly position changed:', position, 'Weekday:', monthlyWeekday.value)
  }

  const logMonthlyWeekdayChange = (weekday: string) => {
    console.log('Monthly weekday changed:', weekday, 'Position:', monthlyPosition.value)
  }

  // Toggle day selection
  const toggleDay = (day: string) => {
    // Create a new array instead of modifying in place
    const currentDays = [...selectedDays.value]

    if (currentDays.includes(day)) {
      // Filter out the day
      selectedDays.value = currentDays.filter(d => d !== day)
    } else {
      // Add the day to a new array
      selectedDays.value = [...currentDays, day]
    }
  }

  // Filter timezone options
  const filterTimezones = (val: string, update: (callback: () => void) => void) => {
    if (val === '') {
      update(() => {
        timezoneOptions.value = RecurrenceService.getTimezones()
      })
      return
    }

    update(() => {
      timezoneOptions.value = RecurrenceService.searchTimezones(val)
    })
  }

  // Format date for UI display
  const formatDate = (date: Date) => {
    if (!date) return ''
    const tz = props.timeZone || RecurrenceService.getUserTimezone()
    try {
      // E.g., "EEE, MMM d, yyyy h:mm a zzz"
      return formatInTimeZone(date, tz, 'EEE, MMM d, yyyy h:mm a zzz')
    } catch (e) {
      console.error(`Error formatting date in timezone ${tz}:`, e)
      // Fallback to simple formatting if timezone formatting fails, append tz manually if possible
      const fallback = format(date, 'EEE, MMM d, yyyy h:mm a')
      const tzAbbreviation = RecurrenceService.getTimezoneDisplay(tz).split(' ').pop()?.replace(/[()]/g, '') || tz
      return tzAbbreviation ? `${fallback} (${tzAbbreviation})` : fallback
    }
  }

  // SIMPLIFIED: Process rule changes and emit updates
  const processRuleChanges = (force = false) => {
    const newRule = rule.value
    const newTimezone = timezone.value

    // Don't recalculate if rule hasn't substantially changed, unless forced
    const ruleHash = JSON.stringify(newRule) + newTimezone
    if (!force && ruleHash === lastRuleUpdateHash) return
    lastRuleUpdateHash = ruleHash

    // Emit updates to parent - clone the rule to avoid reactivity issues
    if (newRule) {
      emit('update:model-value', JSON.parse(JSON.stringify(newRule)))
    } else {
      emit('update:model-value', undefined)
    }
    emit('update:time-zone', newTimezone)

    // Update occurrences with a debounce
    updateOccurrencesDebounced(newRule, newTimezone)
  }

  // Debounced update of occurrences to prevent excessive calculations
  const updateOccurrencesDebounced = (newRule: Partial<RecurrenceRule> | undefined, newTimezone: string) => {
    // Clear any previous debounce
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }

    // Set loading states
    isCalculatingPattern.value = true
    isCalculatingOccurrences.value = true

    // Debounce to prevent excessive calculations
    debounceTimer = window.setTimeout(() => {
      // Use a separate function for the update to break the reactivity chain
      updateOccurrences(
        newRule ? JSON.parse(JSON.stringify(newRule)) : undefined,
        newTimezone
      )
    }, 500)
  }

  // Update occurrences based on rule
  const updateOccurrences = (newRule: Partial<RecurrenceRule> | undefined, newTimezone: string) => {
    try {
      // First update the pattern description - this is fast and should be done first
      updatePatternDescription(newRule, newTimezone)

      // Update occurrences preview
      if (newRule && props.startDate && props.isRecurring) {
        // Create a copy to avoid modifying the reactive state and ensure timezone is included
        const ruleWithTimezone = {
          ...JSON.parse(JSON.stringify(newRule)), // Copy to prevent reactive issues
          timeZone: newTimezone // Ensure timezone is included in the rule itself
        }

        const eventData = {
          startDate: props.startDate,
          recurrenceRule: ruleWithTimezone,
          timeZone: newTimezone // Also set on the event for RecurrenceService to use
        }

        // Make sure eventWithRule has a recurrenceRule with a frequency property
        if (eventData.recurrenceRule && 'frequency' in eventData.recurrenceRule) {
          try {
            // Log the timezone information before generating occurrences for debugging
            console.log('Generating occurrences with timezone info:', {
              ruleTimezone: eventData.recurrenceRule.timeZone,
              eventTimezone: eventData.timeZone,
              startDate: eventData.startDate
            })

            // Generating occurrences can be expensive, especially for complex rules
            const result = RecurrenceService.getOccurrences(eventData as unknown as EventEntity, 5)

            // Log the first few occurrences with their timezone context
            if (result.length > 0 && newTimezone) {
              console.log('Generated occurrences in timezone context:', {
                timezone: newTimezone,
                occurrences: result.slice(0, 3).map(date => ({
                  utc: date.toISOString(),
                  local: formatInTimeZone(date, newTimezone, 'yyyy-MM-dd HH:mm:ss'),
                  dayOfWeek: formatInTimeZone(date, newTimezone, 'EEEE')
                }))
              })
            }

            occurrences.value = result
          } catch (e) {
            console.error('Error in getOccurrences:', e)
            occurrences.value = []
          }
        } else {
          occurrences.value = []
        }
      } else {
        occurrences.value = []
      }
    } catch (e) {
      console.error('Error updating occurrences:', e)
      occurrences.value = []
    } finally {
      // Update loading states when done
      isCalculatingPattern.value = false
      isCalculatingOccurrences.value = false
    }
  }

  // Initialize form from model value if provided
  const initFromModelValue = () => {
    if (!props.modelValue) return

    // Set frequency from modelValue
    frequency.value = props.modelValue.frequency

    // Set interval (default to 1 if not provided)
    interval.value = props.modelValue.interval || 1

    // Handle monthly frequency patterns
    if (props.modelValue.frequency === 'MONTHLY') {
      // Check if it's using bymonthday or byweekday to determine the repeat type
      if (props.modelValue.bymonthday && props.modelValue.bymonthday.length > 0) {
        monthlyRepeatType.value = 'dayOfMonth'
        // No need to set anything else, as we'll use the start date's day
      } else if (props.modelValue.byweekday && props.modelValue.byweekday.length > 0) {
        // Handle nth weekday of month pattern
        monthlyRepeatType.value = 'dayOfWeek'

        if (props.modelValue.byweekday && props.modelValue.byweekday.length > 0) {
          const weekdayStr = props.modelValue.byweekday[0]

          // Check if it's already a position + weekday format
          const match = weekdayStr.match(/^([+-]?\d+)([A-Z]{2})$/)
          if (match) {
            // Set the position and weekday values
            monthlyPosition.value = match[1]
            monthlyWeekday.value = match[2]
          } else {
            // It's just a weekday without position
            monthlyWeekday.value = weekdayStr

            // Try to get position from bysetpos if available
            if (Array.isArray(props.modelValue.bysetpos) && props.modelValue.bysetpos.length > 0) {
              monthlyPosition.value = String(props.modelValue.bysetpos[0])
            } else if (typeof props.modelValue.bysetpos === 'number') {
              monthlyPosition.value = String(props.modelValue.bysetpos)
            } else {
              // Default to first occurrence if bysetpos is not usable
              console.warn('MONTHLY dayOfWeek pattern missing or invalid bysetpos, defaulting monthlyPosition to 1')
              monthlyPosition.value = '1'
            }
          }
        } else {
          // No byweekday found - set defaults based on start date
          if (startDateObject.value) {
            const dayOfWeek = startDateObject.value.getDay()
            monthlyWeekday.value = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek]

            // Calculate the position of this weekday in the month
            const day = startDateObject.value.getDate()
            const position = Math.ceil(day / 7)
            monthlyPosition.value = String(Math.min(position, 4)) // Ensure it's at most 4
          }
        }
      }
    } else if ((props.modelValue.frequency === 'DAILY' || props.modelValue.frequency === 'WEEKLY') &&
                props.modelValue.byweekday && props.modelValue.byweekday.length > 0) {
      // Set selected days (byweekday in RecurrenceRule)
      // Extract simple weekdays (without position prefixes)
      selectedDays.value = props.modelValue.byweekday.map(day => {
        const match = day.match(/(?:\d+)?([A-Z]{2})$/)
        const dayCode = match ? match[1] : day
        console.log(`Mapped day code from ${day} to ${dayCode}`)
        return dayCode
      })
    }

    // Set end type and related fields
    if (props.modelValue.count) {
      endType.value = 'count'
      count.value = props.modelValue.count
    } else if (props.modelValue.until) {
      endType.value = 'until'
      until.value = new Date(props.modelValue.until).toISOString().substring(0, 10)
    } else {
      endType.value = 'never'
    }
  }

  // Initialize timezone and weekday selection
  const initializeTimezoneAndDay = () => {
    // Initialize timezone from props or default
    if (props.timeZone) {
      timezone.value = props.timeZone
    } else {
      timezone.value = RecurrenceService.getUserTimezone()
      emit('update:time-zone', timezone.value)
    }

    // Initialize weekday selection based on start date
    if (props.startDate) {
      try {
        // Get the timezone to use for calculations
        const timeZoneToUse = props.timeZone || RecurrenceService.getUserTimezone()

        console.log('Initializing weekday selection with timezone:', {
          startDate: props.startDate,
          timezone: timeZoneToUse
        })

        // Use RecurrenceService's helper method to get the correct day of week
        // This ensures consistent timezone handling across the application
        const { dayName, dayCode } = RecurrenceService.getDayOfWeekInTimezone(
          new Date(props.startDate),
          timeZoneToUse
        )

        console.log('Day in timezone for initialization:', {
          dayName,
          dayCode,
          timestamp: new Date(props.startDate).toISOString(),
          timezone: timeZoneToUse
        })

        // Only set days if they aren't already set
        if (selectedDays.value.length === 0 && dayCode) {
          selectedDays.value = [dayCode]
          console.log('Set selected days to:', dayCode)
        }

        // Only set monthly weekday if it's not already set
        if (!monthlyWeekday.value && dayCode) {
          monthlyWeekday.value = dayCode
          console.log('Set monthly weekday to:', dayCode)
        }

        // Get the day of month in the correct timezone
        const dayOfMonth = parseInt(formatInTimeZone(
          new Date(props.startDate),
          timeZoneToUse,
          'd' // Day of month
        ), 10)

        // Calculate the position of this weekday in the month
        const position = Math.ceil(dayOfMonth / 7)

        // Only set position if it's not already set
        if (!monthlyPosition.value) {
          const positionValue = String(Math.min(position, 4)) // Ensure it's at most 4
          monthlyPosition.value = positionValue
          console.log('Set monthly position to:', positionValue)
        }
      } catch (error) {
        console.error('Error initializing day of week for recurrence:', error)

        // Use a more robust fallback approach
        try {
          const timeZoneToUse = props.timeZone || RecurrenceService.getUserTimezone()
          const startDate = new Date(props.startDate)

          // Use the Intl API as a fallback for getting the day
          const dayFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZoneToUse,
            weekday: 'long'
          })

          const dayName = dayFormatter.format(startDate)

          // Map day name to RRule code
          const dayNameMap: Record<string, string> = {
            Sunday: 'SU',
            Monday: 'MO',
            Tuesday: 'TU',
            Wednesday: 'WE',
            Thursday: 'TH',
            Friday: 'FR',
            Saturday: 'SA'
          }

          const weekdayValue = dayNameMap[dayName]
          console.log('Fallback day calculation result:', {
            dayName,
            dayCode: weekdayValue
          })

          if (selectedDays.value.length === 0 && weekdayValue) {
            selectedDays.value = [weekdayValue]
          }

          if (!monthlyWeekday.value && weekdayValue) {
            monthlyWeekday.value = weekdayValue
          }
        } catch (fallbackError) {
          console.error('Fallback day calculation also failed:', fallbackError)

          // Ultimate fallback - use UTC day as last resort
          const newDate = new Date(props.startDate)
          const dayOfWeek = newDate.getUTCDay()
          const weekdayValue = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek]

          console.log('Using UTC fallback day:', weekdayValue)

          if (selectedDays.value.length === 0) {
            selectedDays.value = [weekdayValue]
          }

          if (!monthlyWeekday.value) {
            monthlyWeekday.value = weekdayValue
          }
        }
      }
    }
  }

  // SIMPLIFIED: Setup function for all watchers
  const setupWatchers = () => {
    // Watch rule and timezone changes to emit updates
    watch([rule, timezone], () => {
      if (!isProcessingUpdate.value) {
        isProcessingUpdate.value = true
        processRuleChanges()
        isProcessingUpdate.value = false
      }
    }, { deep: true })

    // Watch for changes to the component props
    watch(() => props.modelValue, () => {
      initFromModelValue()
    }, { immediate: true })

    // Watch for changes to timezone from props
    watch(() => props.timeZone, (newTimeZone) => {
      if (newTimeZone && newTimeZone !== timezone.value) {
        timezone.value = newTimeZone
      }
    })

    // Watch for changes to startDate and initialize weekday if needed
    watch(() => props.startDate, () => {
      if (props.startDate) {
        initializeTimezoneAndDay()
      }
    })

    // Watch for monthlyRepeatType changes to derive position/weekday from startDate
    watch(monthlyRepeatType, (newType) => {
      // If switching to monthly 'dayOfWeek' recurrence, and a start date is present,
      // automatically derive the weekday and its position (e.g., "2nd Wednesday") from the start date.
      // This ensures the UI reflects the correct Nth weekday based on the event's start date.
      if (newType === 'dayOfWeek' && props.startDate && frequency.value === 'MONTHLY') {
        const timeZoneToUse = timezone.value || RecurrenceService.getUserTimezone()
        const startDateDate = new Date(props.startDate)

        // Get the day code (e.g., 'WE' for Wednesday)
        const { dayCode } = RecurrenceService.getDayOfWeekInTimezone(startDateDate, timeZoneToUse)
        if (dayCode) {
          monthlyWeekday.value = dayCode
        }

        // Get the day of the month (e.g., 14 for the 14th)
        const dayOfMonth = parseInt(formatInTimeZone(startDateDate, timeZoneToUse, 'd'), 10)
        // Calculate Nth occurrence (e.g., 14th day / 7 days/week = 2nd week)
        const NthOccurrence = Math.ceil(dayOfMonth / 7)
        // RRule bysetpos uses 1, 2, 3, 4. Capping at 4.
        // (-1 for "last" would require more complex logic to determine if it's truly the last of its kind).
        // For this context, aligning with the existing initialization logic is sufficient.
        monthlyPosition.value = String(Math.min(NthOccurrence, 4))

        console.log(`Monthly repeat type set to 'dayOfWeek'. Derived from startDate (${props.startDate}): monthlyWeekday=${monthlyWeekday.value}, monthlyPosition=${monthlyPosition.value}`)
      }
    }, { immediate: false }) // Run only on changes, not immediately (initial setup is handled by onMounted)
  }

  // Initialize component
  onMounted(() => {
    // Initialize from props
    initFromModelValue()
    initializeTimezoneAndDay()

    // Setup watchers
    setupWatchers()

    // Force initial calculation of rule and occurrences
    if (props.startDate) {
      if (props.isRecurring && props.modelValue) {
        // If we have a model value, use that
        updateOccurrencesDebounced(props.modelValue, timezone.value)
      } else if (props.isRecurring) {
        // Otherwise force process the computed rule
        processRuleChanges(true)
      }
    }
  })

  // Return all state and methods needed by the component
  return {
    // State
    isCalculatingPattern,
    isCalculatingOccurrences,
    frequency,
    interval,
    selectedDays,
    monthlyRepeatType,
    monthlyPosition,
    monthlyWeekday,
    timezone,
    endType,
    count,
    until,
    timezoneOptions,
    occurrences,
    // Options and lookups
    frequencyOptions,
    weekdayOptions,
    monthlyPositionOptions,
    // Computed properties
    rule,
    startDateObject,
    humanReadablePattern,
    intervalLabel,
    // Methods
    getPositionLabel,
    getWeekdayLabel,
    toggleRecurrence,
    logMonthlyPositionChange,
    logMonthlyWeekdayChange,
    toggleDay,
    filterTimezones,
    formatDate,
    updateOccurrences,
    initFromModelValue
  }
}
