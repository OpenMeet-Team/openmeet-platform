<template>
  <q-input data-cy="datetime-component" filled :model-value="formattedDate" @update:model-value="onDateInput"
    :required="required" :label="label">
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

    <!-- Time picker -->
    <template v-slot:append>
      <div class="text-h6">{{ tempTime }}</div>
      <q-icon data-cy="datetime-component-time" name="sym_r_access_time" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-time data-cy="datetime-component-time-picker" v-model="tempTime" :format24h=false
            @update:model-value="onTimeUpdate">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>

    <!-- Display Timezone with option to change it -->
    <template v-if="timeZone && showTimeZone" v-slot:after>
      <div class="text-caption text-bold cursor-pointer" @click="showTimezonePicker = true">
        {{ formatTimeZone }} <q-icon name="sym_r_edit" size="xs" />
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
    </template>

    <!-- If no timezone is provided, show slot:after if available -->
    <template v-else-if="$slots.after" v-slot:after>
      <slot name="after"></slot>
    </template>

    <template v-if="$slots.hint" v-slot:hint>
      <slot name="hint"></slot>
    </template>
  </q-input>
</template>

<script lang="ts" setup>
import { ref, computed, watch, defineProps, defineEmits } from 'vue'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
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
const emit = defineEmits(['update:model-value', 'update:timeZone'])

// State variables for the component
const tempDate = ref<string>('')
const tempTime = ref<string>('')
const date = ref<string>(props.modelValue)
const showTimezonePicker = ref(false)
const timezoneOptions = ref(RecurrenceService.getTimezones())
const selectedTimezone = ref(props.timeZone || RecurrenceService.getUserTimezone())

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

// Apply the selected timezone
const applyTimezone = () => {
  if (selectedTimezone.value !== props.timeZone) {
    // Emit the new timezone to the parent
    emit('update:timeZone', selectedTimezone.value)

    // Update the date with the new timezone
    if (date.value) {
      updateDateTime()
    }
  }
}

// Watch the parent modelValue and update date and time
watch(() => props.modelValue, (newVal) => {
  date.value = newVal
  updateTempValuesFromISO()
})

// Extract date and time from ISO string for q-date and q-time
const updateTempValuesFromISO = () => {
  if (date.value) {
    const dateObj = new Date(date.value)
    let datePart, timePart

    if (props.timeZone) {
      datePart = formatInTimeZone(dateObj, props.timeZone, 'yyyy-MM-dd')
      timePart = formatInTimeZone(dateObj, props.timeZone, 'HH:mm')
    } else {
      datePart = dateObj.toLocaleDateString('en-CA')
      timePart = dateObj.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    tempDate.value = datePart
    tempTime.value = timePart
  }
}

// Format the selected date and time into a readable format for the input
const formattedDate = computed(() => {
  if (!date.value) return ''

  const dateObj = new Date(date.value)

  if (props.timeZone) {
    return formatInTimeZone(dateObj, props.timeZone, 'EEE, MMM d, yyyy')
  } else {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
})

// Update the date portion when a new date is selected
const onDateUpdate = (newDate: string) => {
  tempDate.value = newDate
  updateDateTime()
}

const onDateInput = (newDate: string | number | null) => {
  if (newDate && !isNaN(new Date(String(newDate)).getTime())) {
    date.value = String(newDate)
    updateTempValuesFromISO()
    emit('update:model-value', date.value)
  }
}

// Update the time portion when a new time is selected
const onTimeUpdate = (newTime: string | null) => {
  if (newTime) tempTime.value = newTime
  updateDateTime()
}

// Combine the selected date and time into an ISO string and emit to parent
const updateDateTime = () => {
  if (tempDate.value && tempTime.value) {
    const dateTimeString = `${tempDate.value}T${tempTime.value}:00`
    // Parse the input string as a date in the specified timezone
    if (props.timeZone) {
      // Use toZonedTime to properly handle timezone conversion
      const zonedDate = toZonedTime(new Date(dateTimeString), props.timeZone)
      emit('update:model-value', zonedDate.toISOString())
    } else {
      // If no timezone specified, use local timezone
      const dateObj = new Date(dateTimeString)
      emit('update:model-value', dateObj.toISOString())
    }
  } else {
    const currentDate = tempDate.value || new Date().toISOString().split('T')[0]
    const currentTime = tempTime.value || '17:00'
    const dateTimeString = `${currentDate}T${currentTime}:00`
    if (props.timeZone) {
      // Use date-fns-tz for consistent timezone handling
      const zonedDate = toZonedTime(new Date(dateTimeString), props.timeZone)
      emit('update:model-value', zonedDate.toISOString())
    } else {
      emit('update:model-value', new Date(dateTimeString).toISOString())
    }
  }
}

// Initialize the date and time on component mount
updateTempValuesFromISO()
</script>

<style scoped>
/* Optional styling */
</style>
