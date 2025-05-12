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
          <q-date data-cy="datetime-component-date-picker" v-model="localDate" mask="YYYY-MM-DD"
            @update:model-value="updateDate">
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
          v-model="localTime"
          placeholder="h:mm AM"
          style="width: 110px; min-width: 110px"
          class="time-text-input"
          @update:model-value="onTimeInputChange"
          @blur="updateTime"
        />
        <q-icon data-cy="datetime-component-time" name="sym_r_access_time" class="cursor-pointer q-ml-sm">
          <q-popup-proxy cover transition-show="scale" transition-hide="scale">
            <q-time data-cy="datetime-component-time-picker" v-model="localTime" :format24h=false
              @update:model-value="updateTime">
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
              <q-btn flat label="Apply" color="primary" @click="changeTimezone" v-close-popup />
            </q-card-actions>
          </q-card>
        </q-dialog>
      </div>
    </template>
  </q-input>
</template>

<script lang="ts" setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { parse, isValid, format } from 'date-fns'
import { RecurrenceService } from '../../services/recurrenceService'

/**
 * DatetimeComponent
 *
 * This component manages a date and time input with timezone support.
 *
 * Key principles:
 * 1. Local inputs (localDate, localTime) are the source of truth for user inputs
 * 2. The internal UTC representation (isoDate) is derived from these local inputs
 * 3. When changing timezones, we preserve the wall clock time (local time appearance)
 */

// Define props
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

// Define emits
const emit = defineEmits(['update:model-value', 'update:timeZone', 'update:time-info'])

// State variables
const localDate = ref('')
const localTime = ref('')
const isoDate = ref(props.modelValue || '')
const showTimezonePicker = ref(false)
const timezoneOptions = ref(RecurrenceService.getTimezones())
const selectedTimezone = ref(props.timeZone || RecurrenceService.getUserTimezone())
const isEditing = ref(false)
const editableDate = ref('')

// Format timezone for display
const formatTimeZone = computed(() => {
  return RecurrenceService.getTimezoneDisplay(props.timeZone)
})

// Format date for display in input field
const formattedDate = computed(() => {
  if (!isoDate.value) return ''

  const dateObj = new Date(isoDate.value)
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
})

/**
 * Initialize local date and time from ISO string
 *
 * This extracts the date and time components from the ISO string
 * and sets the local input values, taking timezone into account.
 */
function initializeFromISO () {
  if (!isoDate.value) {
    // Default to today with 5:00 PM
    localDate.value = format(new Date(), 'yyyy-MM-dd')
    localTime.value = '5:00 PM'
    return
  }

  try {
    // Convert to the timezone if specified
    if (props.timeZone) {
      // Get date and time in the specified timezone
      const dateInTz = formatInTimeZone(new Date(isoDate.value), props.timeZone, 'yyyy-MM-dd')
      const timeInTz = formatInTimeZone(new Date(isoDate.value), props.timeZone, 'h:mm a')

      localDate.value = dateInTz
      localTime.value = timeInTz
    } else {
      // No timezone specified, use local browser time
      const dateObj = new Date(isoDate.value)
      localDate.value = format(dateObj, 'yyyy-MM-dd')
      localTime.value = format(dateObj, 'h:mm a')
    }
  } catch (e) {
    console.error('Error initializing from ISO:', e)
    localDate.value = format(new Date(), 'yyyy-MM-dd')
    localTime.value = '5:00 PM'
  }
}

/**
 * Convert local date and time to ISO string
 *
 * This takes the user-entered date and time and converts it to a UTC ISO string,
 * taking into account the selected timezone.
 */
function createISOString () {
  try {
    // Parse date components
    const [year, month, day] = localDate.value.split('-').map(Number)

    // Parse time
    let hours = 17 // Default to 5 PM
    let minutes = 0

    if (localTime.value) {
      try {
        // Try parsing with date-fns first (handles various formats)
        const parsedTime = parse(localTime.value, 'h:mm a', new Date())
        if (isValid(parsedTime)) {
          hours = parsedTime.getHours()
          minutes = parsedTime.getMinutes()
        } else {
          // Fallback to regex matching for common formats with more flexibility
          // Matches formats like: 3, 3p, 3pm, 3:00, 3:00pm, 15, 15:00, etc.
          const timeMatch = localTime.value.match(/(\d{1,2})(?::?(\d{1,2})?)?\s*([APap]\.?[Mm]?\.?)?/)
          if (timeMatch) {
            const inputHours = parseInt(timeMatch[1], 10)
            minutes = parseInt(timeMatch[2] || '0', 10)
            const period = timeMatch[3]

            // Default to AM for 1-11, PM for 12
            let isPM = inputHours === 12

            // If period is specified, use that instead
            if (period) {
              isPM = period.toLowerCase().startsWith('p')
            } else if (inputHours >= 13 && inputHours <= 23) {
              // 13-23 is clearly 24-hour format
              isPM = true
            }

            // Convert to 24-hour format
            if (isPM && inputHours < 12) {
              hours = inputHours + 12
            } else if (!isPM && inputHours === 12) {
              hours = 0
            } else {
              hours = inputHours
            }
          }
        }
      } catch (e) {
        console.error('Error parsing time:', e)
        // Use defaults if parsing fails
      }
    }

    // Now create date with timezone awareness
    if (props.timeZone) {
      // The correct approach based on our testing:
      // 1. Format the local date and time components into a standard ISO string
      // 2. Append the timezone offset for the specific target timezone
      // 3. Let JavaScript parse this string into a Date that automatically converts to UTC

      // Format date components into ISO format
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
      const localDateTimeStr = `${dateStr}T${timeStr}`

      // Important: We need to get the timezone offset for this specific date
      // Using a reference date with the same date components to calculate the offset
      const referenceDate = new Date(year, month - 1, day, hours, minutes)

      // Get the timezone offset from UTC for this date in the target timezone
      const offsetStr = formatInTimeZone(referenceDate, props.timeZone, 'xxx')

      // Construct a date string with timezone information
      // Format: '2025-05-29T16:15:00+07:00' for Asia/Novosibirsk at 4:15 PM
      const zonedDateTimeStr = `${localDateTimeStr}${offsetStr}`

      // Parse this into a Date object - JavaScript will handle the conversion to UTC
      const date = new Date(zonedDateTimeStr)

      return date.toISOString()
    } else {
      // No timezone specified - use browser's local timezone
      const localDateTime = new Date(year, month - 1, day, hours, minutes)
      return localDateTime.toISOString()
    }
  } catch (e) {
    console.error('Error creating ISO string:', e)
    return new Date().toISOString() // Fallback
  }
}

/**
 * Update the date when changed via picker
 */
function updateDate () {
  updateModelValue()
}

/**
 * Update the time when changed via input or picker
 * Also canonicalizes the time format on blur
 */
function updateTime () {
  // Parse the current time input to canonicalize it
  try {
    // Try to parse with date-fns
    const parsedTime = parse(localTime.value, 'h:mm a', new Date())

    if (isValid(parsedTime)) {
      // Format to canonical form: h:mm AM/PM
      localTime.value = format(parsedTime, 'h:mm a')
    } else {
      // Fallback to regex matching for common formats with more flexibility
      // Matches formats like: 3, 3p, 3pm, 3:00, 3:00pm, 15, 15:00, etc.
      const timeMatch = localTime.value.match(/(\d{1,2})(?::?(\d{1,2})?)?\s*([APap]\.?[Mm]?\.?)?/)
      if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10)
        const minutes = parseInt(timeMatch[2] || '0', 10)
        const period = timeMatch[3]

        // Determine AM/PM
        let isPM = false
        if (period) {
          isPM = period.toUpperCase().startsWith('P')
        } else {
          // If no AM/PM specified, use 12-hour format convention
          isPM = hours >= 12
        }

        // Convert to 12-hour format
        let hour12 = hours % 12
        if (hour12 === 0) hour12 = 12

        // Format the time canonically
        localTime.value = `${hour12}:${String(minutes).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`
      }
    }
  } catch (e) {
    console.error('Error canonicalizing time:', e)
    // Don't change the time if parsing fails
  }

  // Update the model value with the canonicalized time
  updateModelValue()
}

/**
 * Change to a new timezone, preserving wall clock time
 */
function changeTimezone () {
  if (selectedTimezone.value === props.timeZone) return

  // Since we're preserving wall clock time, we don't need to
  // adjust the local date and time inputs - just emit timezone
  // change and update the ISO value
  emit('update:timeZone', selectedTimezone.value)

  // Now recalculate ISO date with new timezone
  updateModelValue()
}

/**
 * Update the model value based on local inputs
 */
function updateModelValue () {
  // Calculate new ISO string from local values
  const newISOString = createISOString()
  isoDate.value = newISOString

  // Get hours and minutes in the chosen timezone for metadata
  let displayHours = 0
  let displayMinutes = 0
  let formattedTime = ''

  try {
    if (props.timeZone) {
      const tzDate = toZonedTime(new Date(newISOString), props.timeZone)
      displayHours = tzDate.getHours()
      displayMinutes = tzDate.getMinutes()
    } else {
      const date = new Date(newISOString)
      displayHours = date.getHours()
      displayMinutes = date.getMinutes()
    }

    // Format for display
    const hour12 = displayHours % 12 || 12
    const period = displayHours >= 12 ? 'PM' : 'AM'
    formattedTime = `${hour12}:${String(displayMinutes).padStart(2, '0')} ${period}`
  } catch (e) {
    console.error('Error formatting time:', e)
    formattedTime = localTime.value || '5:00 PM'
  }

  // Extract date components from localDate
  const [year, month, day] = localDate.value.split('-').map(Number)

  // Emit model value with metadata
  emit('update:model-value', newISOString, {
    originalHours: displayHours,
    originalMinutes: displayMinutes,
    formattedTime,
    timezone: props.timeZone,
    preserveLocalTime: true,
    dateParts: { year, month, day }
  })

  // Also emit time info separately
  emit('update:time-info', {
    originalHours: displayHours,
    originalMinutes: displayMinutes,
    formattedTime,
    timezone: props.timeZone
  })
}

/**
 * Filter timezones when searching
 */
function filterTimezones (val, update) {
  update(() => {
    timezoneOptions.value = val
      ? RecurrenceService.searchTimezones(val)
      : RecurrenceService.getTimezones()
  })
}

/**
 * Handle manual text editing of the date
 */
function startEditing () {
  isEditing.value = true
  editableDate.value = formattedDate.value
}

function onInputChange (value) {
  editableDate.value = value
}

/**
 * Track raw time input changes
 */
function onTimeInputChange (value) {
  localTime.value = value
}

function finishEditing () {
  isEditing.value = false
  if (!editableDate.value) return

  try {
    const input = editableDate.value.trim()
    let parsedDate = null

    // Try parsing with various formats
    const formats = [
      'yyyy-MM-dd',
      'MM/dd/yyyy',
      'MMM d, yyyy',
      'MMMM d, yyyy',
      'd MMM yyyy',
      'EEEE, MMMM d, yyyy',
      'MM/dd',
      'MMM d',
      'MMMM d',
      'd MMM'
    ]

    for (const formatString of formats) {
      try {
        const result = parse(input, formatString, new Date())
        if (isValid(result)) {
          parsedDate = result
          break
        }
      } catch {
        // Skip failed formats
      }
    }

    // Try native Date if all else fails
    if (!parsedDate) {
      const nativeDate = new Date(input)
      if (!isNaN(nativeDate.getTime())) {
        parsedDate = nativeDate
      }
    }

    // Update localDate if successful
    if (parsedDate) {
      localDate.value = format(parsedDate, 'yyyy-MM-dd')
      updateModelValue()
    }
  } catch (e) {
    console.error('Error parsing date:', e)
  }
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== isoDate.value) {
    isoDate.value = newValue
    initializeFromISO()
  }
})

watch(() => props.timeZone, (newTimezone) => {
  selectedTimezone.value = newTimezone || RecurrenceService.getUserTimezone()

  // When timezone changes, we keep localDate and localTime the same
  // but recalculate the ISO string with the new timezone
  updateModelValue()
})

// Define test-only variables and methods using eslint-disable to suppress unused var warnings
/* eslint-disable @typescript-eslint/no-unused-vars */
// These methods and variables are used directly in tests via component.vm.method()
// but the linter can't detect that usage pattern
function onDateUpdate (newDate) {
  console.log(`onDateUpdate called with: ${newDate}`)
  localDate.value = newDate
  updateDate()
}

function onTimeUpdate (newTime) {
  console.log(`onTimeUpdate called with: ${newTime}`)
  localTime.value = newTime
  updateTime()
}

function onTimeZoneUpdate (newTimeZone) {
  selectedTimezone.value = newTimeZone
  updateModelValue()
}

// These are explicitly exported for use in tests
const tempDate = localDate
const tempTime = localTime
/* eslint-enable @typescript-eslint/no-unused-vars */

// Initialize on component mount
initializeFromISO()
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
