<template>
  <q-input
    data-cy="datetime-component"
    filled
    class="q-mb-md"
    :model-value="isEditing ? editableDate : formattedDate"
    @update:model-value="onInputChange"
    @focus="startEditing"
    @blur="finishEditing"
    :required="required"
    :label="label">
    <!-- Date picker -->
    <template v-slot:prepend>
      <q-icon data-cy="datetime-component-date" name="sym_r_event" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-date data-cy="datetime-component-date-picker" v-model="tempDate" mask="YYYY-MM-DD"
            @update:model-value="onDateUpdate">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>

    <!-- Time picker with editable input -->
    <template v-slot:append>
      <div class="row items-center time-input-container">
        <q-input
          dense
          filled
          v-model="editableTime"
          placeholder="h:mm AM"
          style="width: 110px; min-width: 110px"
          class="time-text-input"
          @focus="isEditingTime = true"
          @blur="processTimeInput"
        />
        <q-icon data-cy="datetime-component-time" name="sym_r_access_time" class="cursor-pointer q-ml-sm">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-time data-cy="datetime-component-time-picker" v-model="tempTime" :format24h=false
              @update:model-value="onTimeUpdate">
              <div class="row items-center justify-end">
                <q-btn v-close-popup label="Close" color="primary" flat />
              </div>
            </q-time>
          </q-popup-proxy>
        </q-icon>
      </div>
    </template>

    <!-- Handle after slot for other components -->
    <template v-if="$slots.after" v-slot:after>
      <slot name="after"></slot>
    </template>

    <!-- Display Timezone with option to change it below the input -->
    <template v-slot:hint>
      <div class="datetime-hint-wrapper">
        <template v-if="$slots.hint">
          <slot name="hint"></slot>
        </template>

        <div v-if="timeZone && showTimeZone" class="q-mt-sm timezone-wrapper">
        <q-item clickable dense class="timezone-selector rounded-borders q-px-sm" @click="showTimezonePicker = true">
          <q-item-section avatar>
            <q-icon name="sym_r_schedule" size="xs" />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-caption text-bold">
              {{ formatTimeZone }}
            </q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-icon name="sym_r_edit" size="xs" />
          </q-item-section>
        </q-item>
      </div>

      <!-- Timezone Selector Dialog -->
      <q-dialog v-model="showTimezonePicker">
        <q-card style="min-width: 350px">
          <q-card-section class="q-pb-none">
            <div class="text-h6">Select Timezone</div>
          </q-card-section>

          <q-card-section>
            <q-select
              v-model="selectedTimezone"
              :options="timezoneOptions"
              filled
              label="Event timezone"
              use-input
              hide-selected
              fill-input
              input-debounce="300"
              @filter="filterTimezones"
              hint="Choose the timezone where this event takes place"
            >
              <template v-slot:no-option>
                <q-item>
                  <q-item-section class="text-grey">
                    No results
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
            <q-btn flat label="Apply" color="primary" @click="applyTimezone" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
      </div>
    </template>
  </q-input>
</template>

<script lang="ts" setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { parse, isValid, format, parseISO } from 'date-fns'
import { RecurrenceService } from '../../services/recurrenceService'

// Define props and emit event
const props = defineProps({
  required: Boolean,
  label: {
    type: String,
    default: 'Date and time'
  },
  modelValue: {
    type: String,
    required: true
  },
  timeZone: {
    type: String,
    default: ''
  },
  showTimeZone: {
    type: Boolean,
    default: true
  }
})
// Updated emit definition to include time information in the payload
const emit = defineEmits(['update:model-value', 'update:timeZone', 'update:time-info'])

// State variables for the component
const tempDate = ref<string>('')
const tempTime = ref<string>('')
const date = ref<string>(props.modelValue)
const showTimezonePicker = ref(false)
const timezoneOptions = ref(RecurrenceService.getTimezones())
const selectedTimezone = ref(props.timeZone || RecurrenceService.getUserTimezone())
const isEditing = ref(false)
const isEditingTime = ref(false)
const editableDate = ref('')
const editableTime = ref('')

// Get timezone info for display
const formatTimeZone = computed(() => {
  return RecurrenceService.getTimezoneDisplay(props.timeZone)
})

// Filter timezones when searching
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

// Apply the selected timezone without changing the date/time
const applyTimezone = () => {
  if (selectedTimezone.value !== props.timeZone) {
    // Store the current display values to preserve them
    const currentDisplayDate = tempDate.value
    const currentDisplayTime = tempTime.value

    // Emit the timezone change to parent
    emit('update:timeZone', selectedTimezone.value)

    // Since we don't want to change the actual date/time:
    // 1. Keep the same ISO string
    // 2. Update the display format to reflect the new timezone
    // We want the exact same date/time to be shown in the new timezone

    // Force a display update while preserving original date/time value
    // Keep reference to current datetime value (unused but keeping for clarity)
    // const prevDateTime = date.value
    tempDate.value = currentDisplayDate
    tempTime.value = currentDisplayTime

    // No need to call updateDateTime() which would recalculate and potentially
    // shift the date - we're keeping the original date/time values
  }
}

// Watch the parent modelValue and update date and time
watch(() => props.modelValue, (newVal) => {
  date.value = newVal
  updateTempValuesFromISO()
})

// Extract date and time from ISO string for q-date and q-time
// This now preserves the date and time regardless of timezone
const updateTempValuesFromISO = () => {
  if (date.value) {
    console.log('updateTempValuesFromISO called - current values:', {
      tempTime: tempTime.value,
      editableTime: editableTime.value,
      isEditingTime: isEditingTime.value
    })

    const dateObj = new Date(date.value)
    let timePart

    // Always use local date formatting to avoid timezone shifting
    const datePart = dateObj.toISOString().split('T')[0] // Extract YYYY-MM-DD from ISO

    // Format time in 12-hour format with AM/PM
    // We need to check if we just updated the time - if so, don't override it
    if (tempTime.value && editableTime.value && /\d+:\d+ [AP]M/i.test(tempTime.value)) {
      console.log('Keeping existing time value:', tempTime.value)
      timePart = tempTime.value
    } else {
      console.log('Setting new time from date object')
      timePart = dateObj.toLocaleTimeString('en-US', {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    tempDate.value = datePart

    // Don't update time if we're actively editing it
    if (!isEditingTime.value) {
      console.log('Setting tempTime to:', timePart)
      tempTime.value = timePart
      editableTime.value = timePart
    } else {
      console.log('Not updating tempTime because isEditingTime is true')
    }
  }
}

// Format the selected date and time into a readable format for the input
const formattedDate = computed(() => {
  if (!date.value) return ''

  const dateObj = new Date(date.value)

  // Simply format the date without timezone conversion to avoid date shifting
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})

// Update the date portion when a new date is selected
const onDateUpdate = (newDate: string) => {
  tempDate.value = newDate
  updateDateTime()
}

const startEditing = () => {
  isEditing.value = true
  // Start with the formatted date during editing for better UX
  editableDate.value = formattedDate.value
}

const onInputChange = (value: string) => {
  // Just update the local editable value without validation or conversion
  editableDate.value = value
}

const finishEditing = () => {
  isEditing.value = false
  // Only process the date when user finishes editing (on blur)
  if (editableDate.value) {
    try {
      const input = editableDate.value.trim()
      // We'll use the current date for reference
      let parsedDate: Date | null = null

      // Try various date formats with date-fns
      const formats = [
        'yyyy-MM-dd', // 2025-01-15
        'MM/dd/yyyy', // 01/15/2025
        'MMM d, yyyy', // Jan 15, 2025
        'MMMM d, yyyy', // January 15, 2025
        'd MMM yyyy', // 15 Jan 2025
        'EEEE, MMMM d, yyyy', // Monday, January 15, 2025

        // Without year (will use current year)
        'MM/dd', // 01/15
        'MMM d', // Jan 15
        'MMMM d', // January 15
        'd MMM' // 15 Jan
      ]

      // Try each format until we find a valid date
      for (const formatString of formats) {
        try {
          const result = parse(input, formatString, new Date())
          if (isValid(result)) {
            parsedDate = result
            break
          }
        } catch (e) {
          // Skip failed formats and try next one
        }
      }

      // If all parsing attempts failed, try native Date
      if (!parsedDate) {
        const nativeDate = new Date(input)
        if (!isNaN(nativeDate.getTime())) {
          parsedDate = nativeDate
        }
      }

      // If we have a valid date, update the model
      if (parsedDate) {
        date.value = parsedDate.toISOString()
        updateTempValuesFromISO()
        emit('update:model-value', date.value)
      } else {
        // Invalid date, revert to previous value
        editableDate.value = formattedDate.value
      }
    } catch (e) {
      console.error('Error parsing date:', e)
      // If error, revert to the last valid date display
      editableDate.value = formattedDate.value
    }
  }
}

// Process the time input when text field loses focus
const processTimeInput = () => {
  // Store the value we're trying to process before changing any state
  const timeInputValue = editableTime.value
  console.log('Processing time input:', timeInputValue)

  // We need to set this to false *after* we're done processing
  // to prevent the watcher from overriding our changes

  // If there's no input, revert to the previous valid time
  if (!timeInputValue) {
    editableTime.value = tempTime.value
    isEditingTime.value = false
    return
  }

  // DEFENSIVE: Add try-catch wrapper for the entire function
  try {
  // Reference date for parsing (use today)
    const baseDate = new Date()
    baseDate.setHours(0, 0, 0, 0) // Reset to start of day

    // Try to parse the time input with date-fns using various formats
    const input = timeInputValue.trim()
    let parsedTime: Date | null = null

    // First, try a simple regex for common formats
    // Look for formats like "3:00pm", "3:00 pm", "3pm", "15:00"
    const timeRegex = /^(\d{1,2})(?::(\d{2}))?(?:\s*)([ap]\.?m\.?)?$/i
    const match = input.match(timeRegex)

    if (match) {
      const hours = parseInt(match[1], 10)
      const minutes = match[2] ? parseInt(match[2], 10) : 0
      let periodLower = match[3] ? match[3].toLowerCase() : null

      // Default to PM for hours 1-11 without AM/PM specified
      if (!periodLower && hours >= 1 && hours <= 11) {
        periodLower = 'pm'
      }

      // Handle 12-hour conversion
      let adjustedHours = hours
      if (periodLower && periodLower.startsWith('p') && hours < 12) {
        adjustedHours = hours + 12
      } else if (periodLower && periodLower.startsWith('a') && hours === 12) {
        adjustedHours = 0
      }

      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        baseDate.setHours(adjustedHours, minutes, 0, 0)
        parsedTime = new Date(baseDate)
        console.log('Parsed time with regex:', parsedTime.toLocaleTimeString())
      }
    }

    // If regex failed, try date-fns
    if (!parsedTime) {
    // Define formats to try (most specific to least specific)
      const timeFormats = [
        'h:mm a', // 8:30 AM
        'h:mm aa', // 8:30 am
        'h:mma', // 8:30am
        'h:mm', // 8:30
        'hmm', // 830
        'h a', // 8 AM
        'h aa', // 8 am
        'ha', // 8am
        'h' // 8
      ]

      // Try each format
      for (const timeFormat of timeFormats) {
        try {
          const result = parse(input, timeFormat, baseDate)
          if (isValid(result)) {
            parsedTime = result
            console.log('Parsed time with format', timeFormat, ':', result.toLocaleTimeString())
            break
          }
        } catch (e) {
        // Skip failed formats
        }
      }
    }

    // If date-fns parsing failed, try some special cases
    if (!parsedTime) {
    // Try processing without separators (like "1430" -> "14:30")
      if (/^\d{3,4}$/.test(input)) {
        const value = input.padStart(4, '0')
        const hours = parseInt(value.substring(0, 2), 10)
        const minutes = parseInt(value.substring(2), 10)

        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          baseDate.setHours(hours, minutes)
          parsedTime = new Date(baseDate)
          console.log('Parsed time with numeric format:', parsedTime.toLocaleTimeString())
        }
      } else if (/^\d{1,2}\.\d{2}$/.test(input)) { // Try with dot separator (like "14.30")
        const parts = input.split('.')
        const hours = parseInt(parts[0], 10)
        const minutes = parseInt(parts[1], 10)

        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          baseDate.setHours(hours, minutes)
          parsedTime = new Date(baseDate)
          console.log('Parsed time with dot format:', parsedTime.toLocaleTimeString())
        }
      }
    }

    // If we've got a valid time, format it nicely and update the component
    if (parsedTime) {
    // Format as 12-hour time with AM/PM
      const formattedTime = format(parsedTime, 'h:mm a')

      console.log('Successfully parsed time to:', formattedTime)

      // Get current date values or use today's date if no date is set yet
      const currentDate = date.value ? parseISO(date.value) : new Date()

      // Check if currentDate is valid before proceeding
      if (!isValid(currentDate)) {
        console.error('Invalid current date. Using today as fallback.')
        // Use today's date as fallback
        const today = new Date()
        today.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0)

        // Convert to the selected timezone
        const zonedDate = toZonedTime(today, props.timeZone || RecurrenceService.getUserTimezone())
        const tzDate = fromZonedTime(zonedDate, props.timeZone || RecurrenceService.getUserTimezone())
        date.value = tzDate.toISOString()
        tempDate.value = format(tzDate, 'yyyy-MM-dd')
      } else {
        // Create a new date with the parsed time
        const dateWithTime = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          parsedTime.getHours(),
          parsedTime.getMinutes(),
          0
        )

        // Convert to the selected timezone
        const zonedDate = toZonedTime(dateWithTime, props.timeZone || RecurrenceService.getUserTimezone())
        const tzDate = fromZonedTime(zonedDate, props.timeZone || RecurrenceService.getUserTimezone())

        // Update the date value
        date.value = tzDate.toISOString()
      }

      // Disable editing before updating tempTime to prevent watcher from overriding
      isEditingTime.value = false

      // Update all the display values
      tempTime.value = formattedTime
      editableTime.value = formattedTime

      // Store the expected time parts for verification
      const expectedHours = parsedTime.getHours()
      const expectedMinutes = parsedTime.getMinutes()

      console.log('CRITICAL: Time being set:', expectedHours + ':' + expectedMinutes,
        'AM/PM:', expectedHours >= 12 ? 'PM' : 'AM')
      console.log('Timezone-adjusted ISO:', date.value)

      // Emit the change to the parent with additional timezone info
      emit('update:model-value', date.value, {
        originalHours: expectedHours,
        originalMinutes: expectedMinutes,
        formattedTime,
        timezone: props.timeZone
      })

      // Also emit time-info separately to ensure parent gets it
      emit('update:time-info', {
        originalHours: expectedHours,
        originalMinutes: expectedMinutes,
        formattedTime,
        timezone: props.timeZone
      })

      // Double-check our values after the update
      setTimeout(() => {
        if (tempTime.value !== formattedTime) {
          console.warn('Time got reset! Forcing it back to:', formattedTime)
          tempTime.value = formattedTime
          editableTime.value = formattedTime
        }
        console.log('Final time values:', {
          tempTime: tempTime.value,
          editableTime: editableTime.value
        })
      }, 10)
    } else {
      console.log('Failed to parse time, reverting to:', tempTime.value)
      // Invalid time format, revert to previous valid time
      editableTime.value = tempTime.value
      isEditingTime.value = false
    }
  } catch (error) {
    console.error('Error in processTimeInput:', error)
    // Ensure we don't leave the time field in an editing state
    isEditingTime.value = false
    editableTime.value = tempTime.value || '5:00 PM'
  }
}

// Update the time when selected via time picker
const onTimeUpdate = (newTime: string | null) => {
  if (newTime) {
    console.log('Time picker update:', newTime)

    // First store the new time values
    tempTime.value = newTime
    editableTime.value = newTime

    // Parse the time string from the picker
    try {
      // Create a date object for today
      const baseDate = new Date()
      baseDate.setHours(0, 0, 0, 0)

      // Since the time picker can return unusual formats, we'll parse it manually
      // Look for formats like "2:05" (especially WITHOUT AM/PM)
      let hours = 0
      let minutes = 0
      let formattedTime = newTime

      // Check for HH:MM format from picker
      const timeRegex = /^(\d{1,2}):(\d{2})$/
      const match = newTime.match(timeRegex)

      if (match) {
        console.log('Parsing time picker format:', newTime)
        hours = parseInt(match[1], 10)
        minutes = parseInt(match[2], 10)

        // Default to AM/PM based on hour
        const period = hours >= 12 ? 'PM' : 'AM'

        // Format for 12-hour display
        const displayHour = hours % 12 === 0 ? 12 : hours % 12
        formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`

        console.log('Converted picker time to:', formattedTime)
      } else { // If not a simple HH:MM format, try parsing with date-fns
        try {
          const parsedTime = parse(newTime, 'h:mm a', baseDate)
          if (isValid(parsedTime)) {
            hours = parsedTime.getHours()
            minutes = parsedTime.getMinutes()

            // Format consistently
            const period = hours >= 12 ? 'PM' : 'AM'
            const displayHour = hours % 12 === 0 ? 12 : hours % 12
            formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`

            console.log('Parsed picker time with date-fns:', formattedTime)
          }
        } catch (e) {
          console.log('Failed to parse with date-fns, using regex fallback')

          // Try a more flexible regex
          const flexRegex = /(\d{1,2})[:.]?(\d{2})?\s*([ap]\.?m\.?)?/i
          const flexMatch = newTime.match(flexRegex)

          if (flexMatch) {
            hours = parseInt(flexMatch[1], 10)
            minutes = flexMatch[2] ? parseInt(flexMatch[2], 10) : 0
            const periodHint = flexMatch[3] ? flexMatch[3].toLowerCase().startsWith('p') : null

            // Apply AM/PM logic
            if (periodHint === true && hours < 12) {
              hours += 12
            } else if (periodHint === false && hours === 12) {
              hours = 0
            }

            // Default period based on hour
            const period = hours >= 12 ? 'PM' : 'AM'
            const displayHour = hours % 12 === 0 ? 12 : hours % 12
            formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`

            console.log('Parsed time with flexible regex:', formattedTime)
          }
        }
      }

      console.log('Final parsed time:', hours, minutes, formattedTime)

      // Create a complete datetime with the parsed time
      try {
        // Check if date.value exists, if not use today's date
        let currentDate
        if (!date.value) {
          currentDate = new Date()
        } else {
          try {
            currentDate = parseISO(date.value)
            if (!isValid(currentDate)) {
              console.warn('Invalid current date, using today instead')
              currentDate = new Date()
            }
          } catch (err) {
            console.warn('Error creating date from current value, using today instead')
            currentDate = new Date()
          }
        }

        // Create a new date with the parsed time
        const dateWithTime = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          currentDate.getDate(),
          hours,
          minutes,
          0
        )

        // Convert to the selected timezone
        const zonedDate = toZonedTime(dateWithTime, props.timeZone || RecurrenceService.getUserTimezone())
        const tzDate = fromZonedTime(zonedDate, props.timeZone || RecurrenceService.getUserTimezone())

        console.log('Setting new timezone-adjusted ISO from picker:', tzDate.toISOString())

        // Update our internal value
        date.value = tzDate.toISOString()

        // Update tempTime and editableTime to the formatted version
        tempTime.value = formattedTime
        editableTime.value = formattedTime

        console.log('Emitting time values from picker:', hours, minutes, 'in timezone:', props.timeZone)

        // Emit the change with timezone info
        emit('update:model-value', date.value, {
          originalHours: hours,
          originalMinutes: minutes,
          formattedTime,
          timezone: props.timeZone
        })

        // Also emit time-info separately
        emit('update:time-info', {
          originalHours: hours,
          originalMinutes: minutes,
          formattedTime,
          timezone: props.timeZone
        })
      } catch (error) {
        console.error('Error parsing time from picker:', error)
        // Use a fallback date with the correct time
        const fallbackDate = new Date()
        fallbackDate.setHours(hours, minutes, 0, 0)

        // Convert to the selected timezone
        const zonedFallbackDate = toZonedTime(fallbackDate, props.timeZone || RecurrenceService.getUserTimezone())
        const tzFallbackDate = fromZonedTime(zonedFallbackDate, props.timeZone || RecurrenceService.getUserTimezone())
        const fallbackIso = tzFallbackDate.toISOString()

        console.log('Using fallback ISO from picker with timezone adjustment:', fallbackIso)
        date.value = fallbackIso

        // Include timezone info in fallback too
        emit('update:model-value', fallbackIso, {
          originalHours: hours,
          originalMinutes: minutes,
          formattedTime,
          timezone: props.timeZone
        })
      }

      // Double-check our values after the update to ensure they weren't reset
      setTimeout(() => {
        if (tempTime.value !== formattedTime) {
          console.warn('Time got reset by watcher! Forcing back to:', formattedTime)
          tempTime.value = formattedTime
          editableTime.value = formattedTime
        }
      }, 10)
    } catch (e) {
      console.error('Error parsing time from picker:', e)
      // Don't call updateDateTime - it might override our values
    }
  }
}

// Combine the selected date and time into an ISO string and emit to parent
const updateDateTime = () => {
  try {
    console.log('updateDateTime called, tempDate:', tempDate.value, 'tempTime:', tempTime.value)

    // SIMPLIFIED APPROACH: Separate date and time handling completely
    // 1. Parse date in YYYY-MM-DD format
    // 2. Parse time separately
    // 3. Create ISO string only at the end

    let parsedDate: Date | null = null
    let dateString = ''

    // Parse the date part first
    if (tempDate.value) {
      try {
        // Get the date components directly (YYYY-MM-DD)
        dateString = tempDate.value
        const [yearStr, monthStr, dayStr] = dateString.split('-')

        if (yearStr && monthStr && dayStr) {
          // Just validate date components - we'll use them directly later
          const year = parseInt(yearStr)
          const month = parseInt(monthStr) - 1 // JS months are 0-based
          const day = parseInt(dayStr)

          // Create a temp date just to validate (don't use this for final values)
          parsedDate = new Date(year, month, day, 0, 0, 0, 0)

          if (!isValid(parsedDate)) {
            console.error('Invalid date components:', year, month, day)
            parsedDate = null
          }
        }
      } catch (e) {
        console.error('Error parsing date:', e)
        parsedDate = null
        dateString = ''
      }
    }

    // If no valid date was found, use today's date
    if (!parsedDate) {
      const today = new Date()
      dateString = format(today, 'yyyy-MM-dd')
      console.log('Using today as fallback date:', dateString)
    }

    // Now handle time separately
    let hours = 17 // Default 5 PM
    let minutes = 0
    let formattedTime = '5:00 PM' // Default formatted time

    // Process time only if we have it
    if (tempTime.value) {
      console.log('Processing time from tempTime:', tempTime.value)

      // Try to parse the time using various methods
      let parsedHours = null, parsedMinutes = null

      // Method 1: Parse with date-fns (most reliable)
      try {
        const timeParts = parse(tempTime.value, 'h:mm a', new Date())
        if (isValid(timeParts)) {
          parsedHours = timeParts.getHours()
          parsedMinutes = timeParts.getMinutes()
          formattedTime = tempTime.value
          console.log('Parsed time with date-fns:', parsedHours, parsedMinutes)
        }
      } catch (e) {
        console.log('Error parsing with date-fns:', e)
      }

      // Method 2: Try regex if date-fns failed
      if (parsedHours === null) {
        try {
          const timeMatch = tempTime.value.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i)
          if (timeMatch) {
            let h = parseInt(timeMatch[1], 10)
            const m = parseInt(timeMatch[2], 10)
            const period = timeMatch[3].toLowerCase()

            // Convert to 24-hour
            if (period === 'p' && h < 12) h += 12
            if (period === 'a' && h === 12) h = 0

            parsedHours = h
            parsedMinutes = m
            formattedTime = tempTime.value
            console.log('Parsed time with regex:', parsedHours, parsedMinutes)
          }
        } catch (e) {
          console.log('Error parsing with regex:', e)
        }
      }

      // If we succeeded in parsing the time, use those values
      if (parsedHours !== null && parsedMinutes !== null) {
        hours = parsedHours
        minutes = parsedMinutes
      } else {
        console.warn('Failed to parse time, using default 5:00 PM')
        hours = 17
        minutes = 0
        formattedTime = '5:00 PM'

        // Update the UI to show the default time
        tempTime.value = '5:00 PM'
        editableTime.value = '5:00 PM'
      }
    } else {
      // No time specified - use default 5:00 PM
      console.log('No time value found, using default 5:00 PM')
      hours = 17
      minutes = 0
      formattedTime = '5:00 PM'

      // Update the UI to show the default time
      tempTime.value = '5:00 PM'
      editableTime.value = '5:00 PM'
    }

    // Now create a final ISO string by joining date and time
    // IMPORTANT: We create a real Date object here solely to generate a proper ISO string
    // but we pass the original parts to the parent to avoid timezone issues
    try {
      // Extract date components
      const [yearStr, monthStr, dayStr] = dateString.split('-')
      const year = parseInt(yearStr)
      const month = parseInt(monthStr) - 1 // JS months are 0-based
      const day = parseInt(dayStr)

      // Create date object with the explicit time values
      const finalDate = new Date(year, month, day, hours, minutes, 0, 0)

      // Generate ISO string
      const isoString = finalDate.toISOString()

      // Store internally
      date.value = isoString

      console.log('Final ISO string generated:', isoString)
      console.log('With explicit time values:', hours + ':' + minutes)

      // Emit to parent with additional metadata about the true time values
      emit('update:model-value', isoString, {
        // Include original time values to help parent handle timezone issues
        originalHours: hours,
        originalMinutes: minutes,
        formattedTime,
        // Also include date parts to allow full reconstruction
        dateParts: {
          year,
          month: month + 1, // Convert back to 1-based for clarity
          day
        }
      })

      // Also emit time info separately
      emit('update:time-info', {
        originalHours: hours,
        originalMinutes: minutes,
        formattedTime
      })
    } catch (e) {
      console.error('Error generating ISO string:', e)

      // Fallback to current date/time if everything fails
      const fallback = new Date()
      emit('update:model-value', fallback.toISOString())
    }
  } catch (e) {
    console.error('Error in updateDateTime:', e)
    // In case of error, keep existing date or use current date/time
    if (!date.value) {
      emit('update:model-value', new Date().toISOString())
    }
  }
}

// Initialize the date and time on component mount
updateTempValuesFromISO()
</script>

<style scoped>
.q-input {
  transition: all 0.3s ease;
}

.q-input:focus-within {
  /* Subtle highlight when editing */
  box-shadow: 0 0 0 2px rgba(0, 0, 255, 0.1);
}

.datetime-hint-wrapper {
  margin-bottom: 0;
  padding-bottom: 0;
}

.timezone-wrapper {
  margin-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 4px;
  margin-bottom: 4px; /* Reduced spacing */
}

.timezone-selector {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  transition: all 0.2s ease;
  max-width: fit-content;
  margin-bottom: 0;
}

.timezone-selector:hover {
  background: rgba(0, 0, 0, 0.03);
  cursor: pointer;
}

.q-dark .timezone-wrapper {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.q-dark .timezone-selector {
  border-color: rgba(255, 255, 255, 0.28);
}

.q-dark .timezone-selector:hover {
  background: rgba(255, 255, 255, 0.07);
}

/* Time input styling */
.time-input-container {
  min-width: 110px;
}

.time-text-input :deep(.q-field__control) {
  padding: 0 4px;
}

.time-text-input :deep(.q-field__native) {
  padding: 0;
  text-align: center;
  font-weight: 500;
}
</style>
