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
          result.byweekday = selectedDays.value
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

          // CRITICAL DEBUG: Log everything about this monthly pattern for debugging
          console.log('MONTHLY PATTERN CREATED - CRITICAL VALUES CHECK:', {
            frequency: result.frequency,
            monthlyWeekday: monthlyWeekday.value,
            monthlyPosition: monthlyPosition.value,
            parsedPosition: position,
            byweekdayResult: result.byweekday,
            bysetposResult: result.bysetpos,
            fullObject: JSON.stringify(result)
          })

          // Validate the setup
          if (!result.bysetpos || !result.byweekday) {
            console.error('Missing required fields for monthly pattern:',
              'byweekday:', result.byweekday, 'bysetpos:', result.bysetpos)
          }

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

      return result
    } catch (e) {
      console.error('Error in rule computed property:', e)
      return { frequency: 'WEEKLY' }
    }
  })

  // Cache for pattern description to reduce recalculation
  const patternDescriptionCache = ref('')

  // Human readable pattern now uses the cache
  const humanReadablePattern = computed(() => {
    if (!props.isRecurring) return 'Does not repeat'
    if (isCalculatingPattern.value) return 'Calculating...'

    // For monthly day-of-week patterns, we can provide a more descriptive pattern directly
    if (frequency.value === 'MONTHLY' && monthlyRepeatType.value === 'dayOfWeek' &&
        monthlyPosition.value && monthlyWeekday.value) {
      const positionLabel = getPositionLabel(monthlyPosition.value)
      const weekdayLabel = getWeekdayLabel(monthlyWeekday.value)
      const intervalLabel = interval.value > 1 ? `every ${interval.value} months` : 'every month'

      return `${intervalLabel} on the ${positionLabel} ${weekdayLabel}`
    }

    return patternDescriptionCache.value || 'Please select a frequency type'
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

        // Try to get description from rrule library first
        try {
          const rrule = RecurrenceService.toRRule(completeRule, props.startDate)
          const description = rrule.toText()

          if (description) {
            patternDescriptionCache.value = description
            return
          }
        } catch (rruleError) {
          console.warn('Error in RRule.toText():', rruleError)
        }

        // Fallback to our service
        try {
          const backupDescription = RecurrenceService.getHumanReadablePattern({
            startDate: props.startDate,
            recurrenceRule: completeRule,
            timeZone: tzValue
          } as unknown as EventEntity)

          patternDescriptionCache.value = backupDescription || `Repeats ${completeRule.frequency?.toLowerCase() || 'regularly'}`
        } catch (fallbackError) {
          console.error('Error in fallback description:', fallbackError)
          patternDescriptionCache.value = `Custom recurrence pattern (${tzValue})`
        }
      } else {
        patternDescriptionCache.value = 'Please select a frequency type'
      }
    } catch (e) {
      console.error('Error generating pattern:', e)
      patternDescriptionCache.value = `Custom recurrence pattern (${tzValue})`
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

  // Logging functions for debugging monthly pattern changes
  const logMonthlyPositionChange = (position: string) => {
    console.log('Monthly position changed:', position, 'Weekday:', monthlyWeekday.value)
  }

  const logMonthlyWeekdayChange = (weekday: string) => {
    console.log('Monthly weekday changed:', weekday, 'Position:', monthlyPosition.value)
  }

  // Use a non-reactive method to toggle days to prevent excessive reactivity
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

    // We no longer update the start date based on selected weekdays
    // This allows users to select any combination of days without affecting the start date
    console.log('Selected days updated to:', selectedDays.value)

    // Wait until the next tick before allowing updates
    setTimeout(() => {
      // No op - just to ensure the UI renders before next update
    }, 50)
  }

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

  const formatDate = (date: Date) => {
    return format(date, 'EEE, MMM d, yyyy h:mm a')
  }

  // Track to prevent looping
  const isProcessingUpdate = ref(false)
  let debounceTimer: number | null = null
  let lastRuleUpdateHash = ''

  // Watch for changes in the recurrence rule and emit updates
  watch([rule, timezone], async ([newRule, newTimezone]) => {
    // Don't proceed if we're already processing an update
    if (isProcessingUpdate.value) return

    // Don't recalculate if rule hasn't substantially changed
    const ruleHash = JSON.stringify(newRule) + newTimezone
    if (ruleHash === lastRuleUpdateHash) return
    lastRuleUpdateHash = ruleHash

    try {
      // Set the processing flag to prevent recursive updates
      isProcessingUpdate.value = true

      // Log rule details for monthly patterns
      if (newRule?.frequency === 'MONTHLY' && newRule?.byweekday && newRule?.bysetpos) {
        console.log('RecurrenceComponent: Monthly pattern with bysetpos detected:', {
          frequency: newRule.frequency,
          byweekday: newRule.byweekday,
          bysetpos: newRule.bysetpos,
          interval: newRule.interval || 1
        })
      }

      // Emit updates to parent - clone the rule to avoid reactivity issues
      if (newRule) {
        emit('update:model-value', JSON.parse(JSON.stringify(newRule)))
      } else {
        emit('update:model-value', undefined)
      }
      emit('update:time-zone', newTimezone)

      // Clear any previous debounce
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer)
      }

      // Set loading states
      isCalculatingPattern.value = true
      isCalculatingOccurrences.value = true

      // Debounce to prevent excessive calculations - longer timeout for better UI experience
      debounceTimer = window.setTimeout(() => {
        // Use a separate function for the update to break the reactivity chain
        updateOccurrences(
          newRule ? JSON.parse(JSON.stringify(newRule)) : undefined,
          newTimezone
        )
      }, 700)
    } catch (err) {
      console.error('Error in rule watch handler:', err)
      isCalculatingPattern.value = false
      isCalculatingOccurrences.value = false
      isProcessingUpdate.value = false
    }
  }, { deep: true })

  // Separate function to calculate occurrences to reduce watch complexity
  const updateOccurrences = (newRule: Partial<RecurrenceRule> | undefined, newTimezone: string) => {
    isProcessingUpdate.value = true

    try {
      // First update the pattern description - this is fast and should be done first
      updatePatternDescription(newRule, newTimezone)

      // Update occurrences preview
      if (newRule && props.startDate && props.isRecurring) {
        // Create a copy to avoid modifying the reactive state
        const eventData = {
          startDate: props.startDate,
          recurrenceRule: JSON.parse(JSON.stringify(newRule)), // Copy to prevent reactive issues
          timeZone: newTimezone
        }

        // Make sure eventWithRule has a recurrenceRule with a frequency property
        if (eventData.recurrenceRule && 'frequency' in eventData.recurrenceRule) {
          try {
            // Generating occurrences can be expensive, especially for complex rules
            const result = RecurrenceService.getOccurrences(eventData as unknown as EventEntity, 5)
            occurrences.value = result
            console.log('Generated occurrences:', result.length)
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

      // Short delay before clearing processing flag to prevent immediate re-processing
      setTimeout(() => {
        isProcessingUpdate.value = false
      }, 100)
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

        // The proper format for monthly "nth weekday" is to use position-prefixed byweekday value
        // Like "2WE" for 2nd Wednesday. Try to handle various formats we might encounter

        if (props.modelValue.byweekday && props.modelValue.byweekday.length > 0) {
          const weekdayStr = props.modelValue.byweekday[0]

          // Check if it's already a position + weekday format
          const match = weekdayStr.match(/^([+-]?\d+)([A-Z]{2})$/)
          if (match) {
            // Set the position and weekday values
            monthlyPosition.value = match[1]
            monthlyWeekday.value = match[2]
            console.log('Parsed position+weekday format:',
              'Position:', monthlyPosition.value, 'Weekday:', monthlyWeekday.value)
          } else {
            // It's just a weekday without position
            monthlyWeekday.value = weekdayStr

            // Try to get position from bysetpos if available
            if (props.modelValue.bysetpos && props.modelValue.bysetpos.length > 0) {
              monthlyPosition.value = String(props.modelValue.bysetpos[0])
            } else {
              // Default to first occurrence
              monthlyPosition.value = '1'
            }

            console.log('Using separate weekday and position:',
              'Position:', monthlyPosition.value, 'Weekday:', monthlyWeekday.value)
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

            console.log('Using calculated position and weekday from start date:',
              'Position:', monthlyPosition.value, 'Weekday:', monthlyWeekday.value)
          }
        }

        console.log('Initialized monthly pattern:',
          'Position:', monthlyPosition.value, 'Weekday:', monthlyWeekday.value)
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

  // Initialize watchers for component properties
  const setupWatchers = () => {
    // Initialize timezone
    watch(() => props.timeZone, (newTimeZone) => {
      if (newTimeZone) {
        timezone.value = newTimeZone
      }
    }, { immediate: true })

    // We need to also make sure our watchers don't cause recursive updates
    let isUpdatingSelectedDays = false

    // Initialize weekday selection based on the start date and timezone
    watch([() => props.startDate, () => props.timeZone], ([newStartDate, newTimeZone], [oldStartDate, oldTimeZone]) => {
      // Skip if we're already updating
      if (isUpdatingSelectedDays) return

      // Check if the date or timezone has actually changed
      if (newStartDate &&
         (!oldStartDate ||
          new Date(newStartDate).toDateString() !== new Date(oldStartDate).toDateString() ||
          newTimeZone !== oldTimeZone)) {
        isUpdatingSelectedDays = true
        try {
          // Get the timezone to use for calculations
          const timeZoneToUse = newTimeZone || RecurrenceService.getUserTimezone()

          // IMPORTANT: For recurrence calculation, we need to use the exact date in the event's timezone
          // because dates can cross day boundaries in different timezones

          // Use date-fns-tz to get the proper day of week in the event's timezone
          const dateInTimezone = formatInTimeZone(
            new Date(newStartDate),
            timeZoneToUse,
            'EEEE' // Full weekday name
          )

          // Map day name to weekday code
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
          const weekdayValue = dayNameMap[dateInTimezone]

          // Log the timezone adjustment for debugging
          console.log('Timezone-aware day calculation:', {
            date: newStartDate,
            timezone: timeZoneToUse,
            dateInTimezone,
            weekdayValue
          })

          // For weekly frequency, only set selectedDays if it's empty or not set yet
          // For monthly frequency with dayOfWeek type, DO NOT update the monthlyWeekday if user has set it
          if (frequency.value === 'WEEKLY') {
            // Only set selectedDays on initial setup (when it's empty)
            if (selectedDays.value.length === 0) {
              selectedDays.value = [weekdayValue]
              console.log('Weekly frequency: initial selectedDays set to match start date:', weekdayValue)
            } else {
              console.log('Weekly frequency: preserving user-selected days:', selectedDays.value)
            }
          }

          // For monthly frequency, we need to be careful not to reset user selections
          if (frequency.value === 'MONTHLY' && monthlyRepeatType.value === 'dayOfWeek') {
            // Check if monthlyWeekday has been explicitly set by the user
            const isUserExplicitlySetWeekday = oldStartDate !== undefined &&
              monthlyWeekday.value !== undefined &&
              monthlyWeekday.value !== dayNameMap[formatInTimeZone(
                new Date(oldStartDate),
                timeZoneToUse,
                'EEEE'
              )]

            // Only update monthlyWeekday if this is initial setup (oldStartDate is undefined)
            // or if the user hasn't explicitly chosen a different weekday
            if (!oldStartDate || !isUserExplicitlySetWeekday) {
              console.log('Initializing monthlyWeekday to match start date:', weekdayValue,
                'oldStartDate:', oldStartDate ? 'exists' : 'undefined',
                'isUserExplicitlySetWeekday:', isUserExplicitlySetWeekday)
              monthlyWeekday.value = weekdayValue
            } else {
              console.log('Monthly frequency: preserving user-selected monthlyWeekday:',
                monthlyWeekday.value, 'instead of setting to', weekdayValue)
            }
          } else {
            // For other cases (initial setup, not monthly+dayOfWeek), set selectedDays accordingly
            if (!oldStartDate) {
              // This is the initial setup (component just mounted)
              selectedDays.value = [weekdayValue]

              // Only set monthlyWeekday on first initialization if it's not set yet
              if (!monthlyWeekday.value) {
                console.log('Initial setup: setting monthlyWeekday to', weekdayValue)
                monthlyWeekday.value = weekdayValue
              }
            }
          }

          // Get the day of month in the correct timezone
          const dayOfMonth = parseInt(formatInTimeZone(
            new Date(newStartDate),
            timeZoneToUse,
            'd' // Day of month
          ), 10)

          // Calculate the position of this weekday in the month (e.g., "2" for second Wednesday)
          const position = Math.ceil(dayOfMonth / 7)

          // Check if it's the last occurrence of this weekday in the month
          const [year, month] = formatInTimeZone(
            new Date(newStartDate),
            timeZoneToUse,
            'yyyy-M' // Year and month
          ).split('-').map(part => parseInt(part, 10))

          // Get last day of the month by creating a date for the first day of next month and going back one day
          const lastDayOfMonth = new Date(year, month, 0).getDate()
          const daysRemaining = lastDayOfMonth - dayOfMonth

          // If there are not enough days left for another occurrence of this weekday,
          // then this is the last occurrence in the month
          if (daysRemaining < 7) {
            monthlyPosition.value = '-1' // Last occurrence
          } else {
            monthlyPosition.value = String(Math.min(position, 4)) // 1st, 2nd, 3rd, 4th (max 4)
          }

          console.log('Date changed, reset selected days to:', weekdayValue,
            'Monthly pattern:', `${monthlyPosition.value}${monthlyWeekday.value}`)
        } catch (error) {
          console.error('Error updating day of week for recurrence:', error)

          // Fallback to simpler approach if there's an error
          const newDate = new Date(newStartDate)
          const dayOfWeek = newDate.getDay()
          const weekdayValue = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek]

          // Always reset selected days when date changes
          selectedDays.value = [weekdayValue]

          // Only set monthlyWeekday if it's not already set, allowing user to choose any day
          if (!monthlyWeekday.value) {
            console.warn('Using fallback day of week calculation for initial monthlyWeekday:', weekdayValue)
            monthlyWeekday.value = weekdayValue
          } else {
            console.warn('Preserving user-selected monthlyWeekday:', monthlyWeekday.value, 'using fallback calculation for selectedDays only')
          }
        } finally {
          // Use setTimeout to break the reactivity chain
          setTimeout(() => {
            isUpdatingSelectedDays = false
          }, 50)
        }
      }
    }, { immediate: true })

    // Initialize from model value
    watch(() => props.modelValue, () => {
      initFromModelValue()
    }, { immediate: true })

    // Watch for changes to frequency to ensure proper monthlyWeekday when switching to monthly
    watch(() => frequency.value, (newFrequency) => {
      if (newFrequency === 'MONTHLY' && props.startDate && props.timeZone) {
        // When switching to monthly frequency, ensure weekday is correctly set based on timezone
        try {
          const timeZoneToUse = props.timeZone || RecurrenceService.getUserTimezone()
          const dateInTimezone = formatInTimeZone(
            new Date(props.startDate),
            timeZoneToUse,
            'EEEE' // Full weekday name
          )

          // Map day name to weekday code
          const dayNameMap: Record<string, string> = {
            Sunday: 'SU',
            Monday: 'MO',
            Tuesday: 'TU',
            Wednesday: 'WE',
            Thursday: 'TH',
            Friday: 'FR',
            Saturday: 'SA'
          }

          // Set weekday based on timezone only if never set before
          const weekdayValue = dayNameMap[dateInTimezone]
          if (weekdayValue) {
            // Only initialize monthlyWeekday if it's empty
            if (!monthlyWeekday.value) {
              console.log(`Initializing monthlyWeekday to timezone-aware value: ${weekdayValue} when switching to MONTHLY frequency`)
              monthlyWeekday.value = weekdayValue
            } else {
              console.log('Preserving user-selected monthlyWeekday:', monthlyWeekday.value, 'when switching to MONTHLY frequency')
            }
          }
        } catch (error) {
          console.error('Error setting timezone-aware weekday when switching to MONTHLY:', error)
        }
      }
    })

    // Watch specifically for changes to monthlyRepeatType to handle mode switching
    watch(() => monthlyRepeatType.value, (newRepeatType) => {
      if (frequency.value === 'MONTHLY' && newRepeatType === 'dayOfWeek') {
        // When switching from dayOfMonth to dayOfWeek, initialize the weekday if not already set
        if (!monthlyWeekday.value && props.startDate && props.timeZone) {
          try {
            const timeZoneToUse = props.timeZone || RecurrenceService.getUserTimezone()
            const dateInTimezone = formatInTimeZone(
              new Date(props.startDate),
              timeZoneToUse,
              'EEEE' // Full weekday name
            )

            // Map day name to weekday code
            const dayNameMap: Record<string, string> = {
              Sunday: 'SU',
              Monday: 'MO',
              Tuesday: 'TU',
              Wednesday: 'WE',
              Thursday: 'TH',
              Friday: 'FR',
              Saturday: 'SA'
            }

            const weekdayValue = dayNameMap[dateInTimezone]
            if (weekdayValue) {
              console.log(`Initializing monthlyWeekday to ${weekdayValue} when switching to dayOfWeek mode (first time only)`)
              monthlyWeekday.value = weekdayValue
            }
          } catch (error) {
            console.error('Error calculating weekday when switching to dayOfWeek mode:', error)
          }
        } else if (monthlyWeekday.value) {
          // If monthlyWeekday already has a value, preserve it and log a message
          console.log('Preserving existing monthlyWeekday value:', monthlyWeekday.value, 'when switching to dayOfWeek mode')
        }
      }
    })

    // Watch for changes to the monthlyWeekday and monthlyPosition to update the preview
    watch([monthlyWeekday, monthlyPosition, monthlyRepeatType], () => {
      if (frequency.value === 'MONTHLY' && monthlyRepeatType.value === 'dayOfWeek') {
        // Log the change for debugging purposes
        console.log(`Monthly weekday/position updated: ${monthlyPosition.value}${monthlyWeekday.value}`)

        // Force refresh the preview by triggering a manual update of the rule
        if (!isProcessingUpdate.value) {
          // Use setTimeout to avoid reactivity issues
          setTimeout(() => {
            // Trigger rule recalculation and preview update by incrementing and then restoring the interval
            const currentInterval = interval.value
            interval.value += 1
            setTimeout(() => {
              interval.value = currentInterval
            }, 50)
          }, 50)
        }
      }

      // IMPORTANT: We removed the auto-reset of monthlyWeekday to match start date
      // This was causing the issue where users couldn't select a different day of week
    })
  }

  // Setup initialization to run on mount
  const setupInit = () => {
    // Initialize watchers
    setupWatchers()

    // Run initialization code
    onMounted(() => {
      // Set default timezone if not provided
      if (!timezone.value) {
        timezone.value = RecurrenceService.getUserTimezone()
        emit('update:time-zone', timezone.value)
      }

      // If start date is provided, set default monthly weekday values ONLY if not already set
      if (props.startDate) {
        // Only initialize monthlyWeekday and position if they haven't been explicitly set
        // This allows the user to choose any day regardless of the start date
        const startDate = new Date(props.startDate)

        // For day of week, ONLY set if not already set by the user
        if (!monthlyWeekday.value) {
          const dayOfWeek = startDate.getDay()
          monthlyWeekday.value = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek]
          console.log('Initial monthlyWeekday set to:', monthlyWeekday.value)
        } else {
          console.log('Keeping existing monthlyWeekday value:', monthlyWeekday.value)
        }

        // For position, only set if not already set
        if (!monthlyPosition.value) {
          const day = startDate.getDate()
          const position = Math.ceil(day / 7)
          monthlyPosition.value = String(Math.min(position, 4)) // Ensure it's at most 4
        }
      }

      // Initialize pattern description and occurrences if we already have rule data
      if (props.isRecurring && props.modelValue && props.startDate) {
        // Slight delay to ensure component is fully mounted
        setTimeout(() => {
          updatePatternDescription(props.modelValue, timezone.value)
          updateOccurrences(props.modelValue, timezone.value)
        }, 200)
      }
    })
  }

  // Set up component
  setupInit()

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
