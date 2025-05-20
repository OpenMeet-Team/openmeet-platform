import { ref, computed, watch, onMounted } from 'vue'
import { RecurrenceService } from '../../services/recurrenceService'
import { RecurrenceRule } from '../../types/event'
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

  // Since we don't generate occurrences anymore, no need for loading states
  let lastRuleUpdateHash = ''

  // Options for nth position in month
  const monthlyPositionOptions = [
    { value: '1', label: 'First' },
    { value: '2', label: 'Second' },
    { value: '3', label: 'Third' },
    { value: '4', label: 'Fourth' },
    { value: '-1', label: 'Last' }
  ]

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

      // Mark weekly rules with byweekday as having user-explicit day selection
      if (frequency.value === 'WEEKLY' && props.startDate && result.byweekday && result.byweekday.length > 0) {
        result._userExplicitSelection = true
      }

      return result
    } catch (e) {
      console.error('Error in rule computed property:', e)
      return {
        frequency: 'WEEKLY',
        timeZone: timezone.value || RecurrenceService.getUserTimezone()
      }
    }
  })

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

  // Function to toggle recurrence
  const toggleRecurrence = (value: boolean) => {
    emit('update:is-recurring', value)
    if (value && !timezone.value) {
      timezone.value = RecurrenceService.getUserTimezone()
      emit('update:time-zone', timezone.value)
    }
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

  // Simplified process rule changes function
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
        return match ? match[1] : day
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

        // Use RecurrenceService's helper method to get the correct day of week
        // This ensures consistent timezone handling across the application
        const { dayCode } = RecurrenceService.getDayOfWeekInTimezone(
          new Date(props.startDate),
          timeZoneToUse
        )

        // Only set days if they aren't already set
        if (selectedDays.value.length === 0 && dayCode) {
          selectedDays.value = [dayCode]
        }

        // Only set monthly weekday if it's not already set
        if (!monthlyWeekday.value && dayCode) {
          monthlyWeekday.value = dayCode
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

  // Setup function for all watchers
  const setupWatchers = () => {
    // Watch rule and timezone changes to emit updates
    watch([rule, timezone], () => {
      processRuleChanges()
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
        monthlyPosition.value = String(Math.min(NthOccurrence, 4))

        console.log(`Monthly repeat type set to 'dayOfWeek'. Derived from startDate (${props.startDate}): monthlyWeekday=${monthlyWeekday.value}, monthlyPosition=${monthlyPosition.value}`)
      }
    }, { immediate: false })
  }

  // Initialize component
  onMounted(() => {
    // Initialize from props
    initFromModelValue()
    initializeTimezoneAndDay()

    // Setup watchers
    setupWatchers()

    // Force initial calculation of rule
    if (props.startDate && props.isRecurring) {
      processRuleChanges(true)
    }
  })

  // Return all state and methods needed by the component
  return {
    // State
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
    // Options and lookups
    frequencyOptions,
    weekdayOptions,
    monthlyPositionOptions,
    // Computed properties
    rule,
    startDateObject,
    intervalLabel,
    // Methods
    getPositionLabel,
    getWeekdayLabel,
    toggleRecurrence,
    toggleDay,
    filterTimezones
  }
}
