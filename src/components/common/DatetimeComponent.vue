<template>
  <div data-cy="datetime-component">
    <div class="datetime-fields-row">
      <!-- Date input -->
      <q-input
        data-cy="datetime-component-date-input"
        filled
        class="q-mb-md date-input"
        v-model="editableDate"
        :required="required"
        label="Date"
        @blur="finishDateEditing"
        @keyup.enter="finishDateEditing"
        placeholder="e.g. 5/20/2025 or Sept 20"
      >
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
      </q-input>

      <!-- Time input -->
      <q-input
        data-cy="datetime-component-time-input"
        filled
        class="q-mb-md time-input"
        v-model="localTime"
        label="Time"
        placeholder="e.g. 5:00 AM or 17:00"
        @update:model-value="onTimeInputChange"
        @blur="updateTime"
        @keyup.enter="updateTime"
      >
        <template v-slot:append>
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
        </template>
      </q-input>
    </div>

    <!-- Timezone and hint (now on a separate line) -->
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
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, defineProps, defineEmits, defineExpose } from 'vue'
import { toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { parse, isValid, format } from 'date-fns'
import dateFormatting from '../../composables/useDateFormatting'
import { logger } from '../../utils/logger'

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

/**
 * @testing
 * - Use `wrapper.vm.testHelpers.setDateTime('2025-01-01', '5:00 PM')` to set date/time in tests.
 * - Use `wrapper.vm.updateModelValue()` to trigger emission.
 * - Use data-cy selectors for all user-facing inputs.
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
const timezoneOptions = ref(dateFormatting.getTimezones())
const selectedTimezone = ref(props.timeZone || dateFormatting.getUserTimezone())
const editableDate = ref('')

// Format timezone for display
const formatTimeZone = computed(() => {
  return dateFormatting.getTimezoneDisplay(props.timeZone)
})

/**
 * Initialize local date and time from ISO string
 *
 * This extracts the date and time components from the ISO string
 * and sets the local input values, taking timezone into account.
 */
function initializeFromISO () {
  logger.debug(`[DatetimeComponent] initializeFromISO CALLED for label: "${props.label}"]`)
  logger.debug(`[DatetimeComponent]   props.modelValue (isoDate.value initially): "${isoDate.value}"]`)
  logger.debug(`[DatetimeComponent]   props.timeZone: "${props.timeZone}"]`)

  if (!isoDate.value) {
    localDate.value = format(new Date(), 'yyyy-MM-dd')
    localTime.value = '5:00 PM'
    editableDate.value = format(new Date(), 'EEE, MMM d, yyyy')
    logger.debug(`[DatetimeComponent]   No isoDate, defaulted localDate: "${localDate.value}", localTime: "${localTime.value}"]`)
    return
  }

  try {
    const dateObjForConversion = new Date(isoDate.value)
    logger.debug(`[DatetimeComponent]   dateObjForConversion (from isoDate): ${dateObjForConversion.toISOString()} (isValid: ${!isNaN(dateObjForConversion.getTime())})`)

    if (props.timeZone) {
      const dateInTz = formatInTimeZone(dateObjForConversion, props.timeZone, 'yyyy-MM-dd')
      const timeInTz = formatInTimeZone(dateObjForConversion, props.timeZone, 'h:mm a')
      logger.debug(`[DatetimeComponent]   Calculated for TZ "${props.timeZone}": dateInTz: "${dateInTz}", timeInTz: "${timeInTz}"]`)

      localDate.value = dateInTz
      localTime.value = timeInTz
      const dateObj = parse(dateInTz, 'yyyy-MM-dd', new Date())
      if (isValid(dateObj)) {
        editableDate.value = format(dateObj, 'EEE, MMM d, yyyy')
      } else {
        editableDate.value = ''
      }
    } else {
      localDate.value = format(dateObjForConversion, 'yyyy-MM-dd')
      localTime.value = format(dateObjForConversion, 'h:mm a')
      const dateObj = parse(localDate.value, 'yyyy-MM-dd', new Date())
      if (isValid(dateObj)) {
        editableDate.value = format(dateObj, 'EEE, MMM d, yyyy')
      } else {
        editableDate.value = ''
      }
      logger.debug(`[DatetimeComponent]   No props.timeZone, used browser local. localDate: "${localDate.value}", localTime: "${localTime.value}"]`)
    }
  } catch (e) {
    console.error('[DatetimeComponent] Error initializing from ISO:', e)
    localDate.value = format(new Date(), 'yyyy-MM-dd')
    localTime.value = '5:00 PM'
    editableDate.value = format(new Date(), 'EEE, MMM d, yyyy')
  }
  logger.debug(`[DatetimeComponent]   END initializeFromISO. Final localDate: "${localDate.value}", localTime: "${localTime.value}"]`)
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

    // Default to 5:00 PM if no time
    let hours = 17
    let minutes = 0

    if (localTime.value) {
      let parsed = null
      const timeFormats = [
        'h:mm a', 'h:mma', 'h:mm', 'h a', 'ha', 'HH:mm', 'H:mm', 'h', 'hmm', 'hmm a', 'h.mma', 'h.mm a', 'h.mm', 'h.m', 'hmm', 'hmm', 'h:mmA', 'hA', 'ha', 'h a'
      ]
      for (const fmt of timeFormats) {
        const result = parse(localTime.value.trim(), fmt, new Date(year, month - 1, day))
        if (isValid(result)) {
          parsed = result
          break
        }
      }
      if (parsed) {
        hours = parsed.getHours()
        minutes = parsed.getMinutes()
      } else {
        // Fallback: try to parse as 24-hour time (e.g. 14:12)
        const input = localTime.value.trim()
        const match = input.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
        if (match) {
          hours = parseInt(match[1], 10)
          minutes = parseInt(match[2], 10)
        } else if (/^\d{1,2}$/.test(input)) {
          hours = parseInt(input, 10)
          minutes = 0
        } else if (/^\d{3,4}$/.test(input)) {
          hours = parseInt(input.slice(0, input.length - 2), 10)
          minutes = parseInt(input.slice(-2), 10)
        }
      }
    }

    if (props.timeZone) {
      // Create a string that represents the local wall time.
      const wallTimeString = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`

      // Debug logs for tracing
      logger.debug('[createISOString] localDate:', localDate.value)
      logger.debug('[createISOString] localTime:', localTime.value)
      logger.debug('[createISOString] wallTimeString:', wallTimeString)
      logger.debug('[createISOString] props.timeZone:', props.timeZone)

      // Interpret this wall time string as being in props.timeZone and get the UTC Date object.
      const utcDate = fromZonedTime(wallTimeString, props.timeZone)
      logger.debug('[createISOString] utcDate:', utcDate.toISOString())
      return utcDate.toISOString()
    } else {
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
  // Canonicalize the time input for display
  try {
    let input = localTime.value.trim()
    logger.debug('[DatetimeComponent] Raw input:', input)
    // Preprocess shorthand and 24-hour forms (case-insensitive)
    input = input.replace(/^([1-9]|1[0-2])([ap])m?$/i, (_, h, ap) => `${h}:00 ${ap.toUpperCase()}M`)
    input = input.replace(/^([1-9]|1[0-2]):([0-5][0-9])([ap])m?$/i, (_, h, m, ap) => `${h}:${m} ${ap.toUpperCase()}M`)
    input = input.replace(/^([1-9]|1[0-2])([ap])$/i, (_, h, ap) => `${h}:00 ${ap.toUpperCase()}M`)
    if (/^([01]?\d|2[0-3])$/.test(input)) {
      input = input + ':00'
    }
    logger.debug('[DatetimeComponent] Preprocessed input:', input)
    const [year, month, day] = localDate.value.split('-').map(Number)
    let parsed = null
    const timeFormats = [
      'h:mm a', 'h:mma', 'h:mm', 'h a', 'ha', 'HH:mm', 'H:mm', 'h', 'hmm', 'hmm a', 'h.mma', 'h.mm a', 'h.mm', 'h.m', 'hmm', 'hmm', 'h:mmA', 'hA', 'ha', 'h a'
    ]
    for (const fmt of timeFormats) {
      const result = parse(input, fmt, new Date(year, month - 1, day))
      if (isValid(result)) {
        parsed = result
        break
      }
    }
    if (parsed) {
      let formatted = format(parsed, 'h:mm a').replace(/am/i, 'AM').replace(/pm/i, 'PM')
      // If input is exactly '12' or '12:00' (no AM/PM), force PM
      if (/^12(:00)?$/.test(input) && !/am|pm/i.test(input)) {
        formatted = '12:00 PM'
      } else if (/^([1-9]|1[0-1])(:\d{2})?$/.test(input) && !/am|pm/i.test(input)) {
        // For ambiguous times 1-11 (with or without minutes), default to PM
        formatted = formatted.replace('AM', 'PM')
      }
      localTime.value = formatted
      logger.debug('[DatetimeComponent] Canonicalized (parsed):', localTime.value)
    } else {
      // Fallback: try to parse as 24-hour time (e.g. 14:12)
      const match = input.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
      if (match) {
        let h = parseInt(match[1], 10)
        const m = parseInt(match[2], 10)
        if (h === 0) h = 12
        const fallbackDate = new Date(year, month - 1, day, h, m)
        let formatted = format(fallbackDate, 'h:mm a').replace(/am/i, 'AM').replace(/pm/i, 'PM')
        if (h === 12 && !/am|pm/i.test(input)) {
          formatted = '12:00 PM'
        } else if ((h >= 1 && h <= 11) && !/am|pm/i.test(input)) {
          formatted = formatted.replace('AM', 'PM')
        }
        localTime.value = formatted
        logger.debug('[DatetimeComponent] Canonicalized (24h fallback):', localTime.value)
      } else if (/^\d{1,2}$/.test(input)) {
        let h = parseInt(input, 10)
        if (h === 0) h = 12
        const fallbackDate = new Date(year, month - 1, day, h, 0)
        let formatted = format(fallbackDate, 'h:mm a').replace(/am/i, 'AM').replace(/pm/i, 'PM')
        if (h === 12 && !/am|pm/i.test(input)) {
          formatted = '12:00 PM'
        } else if ((h >= 1 && h <= 11) && !/am|pm/i.test(input)) {
          formatted = formatted.replace('AM', 'PM')
        }
        localTime.value = formatted
        logger.debug('[DatetimeComponent] Canonicalized (hour fallback):', localTime.value)
      } else if (/^\d{3,4}$/.test(input)) {
        const h = parseInt(input.slice(0, input.length - 2), 10)
        const m = parseInt(input.slice(-2), 10)
        const fallbackDate = new Date(year, month - 1, day, h, m)
        localTime.value = format(fallbackDate, 'h:mm a').replace(/am/i, 'AM').replace(/pm/i, 'PM')
        logger.debug('[DatetimeComponent] Canonicalized (compact fallback):', localTime.value)
      } else {
        // If all else fails, set to default
        localTime.value = '5:00 PM'
        logger.debug('[DatetimeComponent] Canonicalized (default):', localTime.value)
      }
    }
  } catch (e) {
    console.error('Error canonicalizing time:', e)
    // Set to default if parsing fails
    localTime.value = '5:00 PM'
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
      ? dateFormatting.searchTimezones(val)
      : dateFormatting.getTimezones()
  })
}

/**
 * Track raw time input changes
 */
function onTimeInputChange (value) {
  localTime.value = value
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== isoDate.value) {
    isoDate.value = newValue
    initializeFromISO()
  }
})

watch(() => props.timeZone, (newTimezone) => {
  selectedTimezone.value = newTimezone || dateFormatting.getUserTimezone()

  // When timezone changes, we keep localDate and localTime the same
  // but recalculate the ISO string with the new timezone
  updateModelValue()
})

// Define test-only variables and methods using eslint-disable to suppress unused var warnings
/* eslint-disable @typescript-eslint/no-unused-vars */
// These methods and variables are used directly in tests via component.vm.method()
// but the linter can't detect that usage pattern
function onDateUpdate (newDate) {
  logger.debug(`onDateUpdate called with: ${newDate}`)
  localDate.value = newDate
  updateDate()
}

function onTimeUpdate (newTime) {
  logger.debug(`onTimeUpdate called with: ${newTime}`)
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

// Add a new finishDateEditing function for the date input
function finishDateEditing () {
  // Canonicalize/parse the date input (editableDate) and update localDate
  if (!editableDate.value) return
  try {
    const input = editableDate.value.trim()
    logger.debug('[DatetimeComponent] finishDateEditing - Raw input:', input)
    let parsedDate = null
    const dateFormats = [
      'yyyy-MM-dd', 'MM/dd/yyyy', 'MMM d, yyyy', 'MMMM d, yyyy', 'MMM d', 'MMMM d', 'M/d/yyyy', 'M/d', 'd MMM yyyy', 'd MMM', 'MM/dd', 'M/d', 'MMM d', 'MMMM d'
    ]
    for (const formatString of dateFormats) {
      try {
        const result = parse(input, formatString, new Date())
        if (isValid(result)) {
          // Force the parsed date to be local (ignore timezone offset)
          parsedDate = new Date(result.getFullYear(), result.getMonth(), result.getDate())
          logger.debug('[DatetimeComponent] finishDateEditing - Parsed as:', parsedDate)
          break
        }
      } catch {}
    }
    // Try native Date if all else fails
    if (!parsedDate) {
      const nativeDate = new Date(input)
      if (!isNaN(nativeDate.getTime())) {
        parsedDate = new Date(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate())
        logger.debug('[DatetimeComponent] finishDateEditing - Native parsed as:', parsedDate)
      }
    }
    if (parsedDate) {
      localDate.value = format(parsedDate, 'yyyy-MM-dd')
      editableDate.value = format(parsedDate, 'EEE, MMM d, yyyy')
      updateModelValue()
    }
  } catch (e) {
    console.error('Error parsing date:', e)
  }
}

// In onMounted or watch, keep editableDate in sync with localDate
watch(localDate, (newVal) => {
  if (newVal) {
    const dateObj = parse(newVal, 'yyyy-MM-dd', new Date())
    if (isValid(dateObj)) {
      editableDate.value = format(dateObj, 'EEE, MMM d, yyyy')
    }
  }
})

defineExpose({
  localDate,
  localTime,
  editableDate,
  updateModelValue,
  finishDateEditing,
  // For tests: set date/time and emit
  testHelpers: {
    setDateTime: (date, time) => {
      localDate.value = date
      localTime.value = time
      updateModelValue()
    },
    setEditableDate: (date) => {
      editableDate.value = date
      finishDateEditing()
    }
  },
  // Expose for testing purposes
  isoDate,
  onDateUpdate,
  onTimeUpdate,
  onTimeZoneUpdate,
  tempDate,
  tempTime,
  updateTime // also expose updateTime for canonicalization test
})
</script>

<style scoped>
.datetime-fields-row {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.date-input {
  flex: 2 1 220px;
  min-width: 180px;
}
.time-input {
  flex: 1 1 120px;
  min-width: 100px;
  max-width: 160px;
}

/* Mobile: stack date and time vertically */
@media (max-width: 480px) {
  .datetime-fields-row {
    flex-direction: column;
    align-items: stretch;
  }
  .date-input,
  .time-input {
    flex: 1 1 auto;
    min-width: 100%;
    max-width: 100%;
  }
}
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
