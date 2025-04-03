<template>
  <div class="q-mt-md">
    <div class="text-subtitle2 q-mb-sm">{{ hideToggle ? 'Series Pattern' : 'Recurrence' }}</div>

    <!-- Recurrence Toggle -->
    <q-checkbox data-cy="event-recurring-toggle" :model-value="isRecurring"
      @update:model-value="toggleRecurrence"
      label="Make this a recurring event" v-if="!hideToggle" />

    <div v-if="isRecurring" class="q-mt-md q-gutter-y-md">
      <!-- Information about event series if not hidden -->
      <div class="text-body2 q-mb-md" v-if="!hideToggle">
        <q-icon name="sym_r_info" size="sm" class="q-mr-xs" color="info" />
        This pattern will be used to create an event series.
      </div>

      <!-- Frequency -->
      <q-select
        data-cy="recurrence-frequency"
        v-model="frequency"
        :options="frequencyOptions"
        filled
        label="Repeats"
        option-value="value"
        option-label="label"
        emit-value
        map-options
      >
        <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
          <q-item v-bind="itemProps" :class="{ 'text-primary': selected }" @click="toggleOption(opt)">
            <q-item-section>
              <q-item-label>{{ opt.label }}</q-item-label>
              <q-item-label caption>{{ opt.description }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>

      <!-- Interval -->
      <div class="row q-col-gutter-md">
        <div class="col-12 col-sm-6">
          <q-input
            data-cy="recurrence-interval"
            v-model.number="interval"
            type="number"
            min="1"
            max="999"
            filled
            label="Repeat every"
            :rules="[(val) => val >= 1 || 'Must be at least 1']"
          />
        </div>
        <div class="col-12 col-sm-6 self-center">
          {{ intervalLabel }}
        </div>
      </div>

      <!-- Weekly Options -->
      <div v-if="frequency === 'WEEKLY'" class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Repeat on</div>
        <div class="row q-gutter-x-sm">
          <q-btn
            v-for="day in weekdayOptions"
            :key="day.value"
            :outline="!selectedDays.includes(day.value)"
            color="primary"
            :label="day.shortLabel"
            size="sm"
            rounded
            @click="toggleDay(day.value)"
          />
        </div>
      </div>

      <!-- Monthly Options -->
      <div v-if="frequency === 'MONTHLY'" class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Repeat on</div>
        <q-radio
          v-model="monthlyRepeatType"
          val="dayOfMonth"
          label="Day of month"
          :disable="!startDate"
        />
        <q-radio
          v-model="monthlyRepeatType"
          val="dayOfWeek"
          label="Day of week"
          :disable="!startDate"
        />
      </div>

      <!-- Timezone -->
      <div class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Timezone</div>
        <q-select
          data-cy="event-timezone"
          v-model="timezone"
          :options="timezoneOptions"
          filled
          label="Event timezone"
          use-input
          hide-selected
          fill-input
          input-debounce="300"
          @filter="filterTimezones"
        >
          <template v-slot:no-option>
            <q-item>
              <q-item-section class="text-grey">
                No results
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>

      <!-- End Options -->
      <div class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Ends</div>

        <q-radio v-model="endType" val="never" label="Never" />

        <div class="row items-center">
          <q-radio v-model="endType" val="count" label="After" class="col-auto" />
          <q-input
            v-if="endType === 'count'"
            data-cy="recurrence-count"
            v-model.number="count"
            type="number"
            min="1"
            max="999"
            filled
            dense
            class="col-auto q-ml-sm"
            style="width: 70px;"
            :rules="[(val) => val >= 1 || 'Must be at least 1']"
          />
          <div v-if="endType === 'count'" class="col-auto q-ml-sm">
            occurrence{{ count === 1 ? '' : 's' }}
          </div>
        </div>

        <div class="row items-center">
          <q-radio v-model="endType" val="until" label="On date" class="col-auto" />
          <q-input
            v-if="endType === 'until'"
            data-cy="recurrence-until"
            v-model="until"
            filled
            dense
            class="col-auto q-ml-sm"
            style="width: 150px;"
          >
            <template v-slot:append>
              <q-icon name="sym_r_event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="until" mask="YYYY-MM-DD">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
      </div>

      <!-- Recurrence Preview -->
      <div v-if="props.isRecurring" class="q-mt-lg">
        <q-separator class="q-my-md" />

        <!-- Pattern Summary Section -->
        <div class="text-subtitle2">Pattern Summary</div>
        <div class="text-body2 q-my-md">
          <q-skeleton v-if="isCalculatingPattern" type="text" />
          <template v-else>{{ humanReadablePattern }}</template>
        </div>

        <!-- Next Occurrences Section with Divider -->
        <div class="text-subtitle2 q-mt-md">Next occurrences</div>
        <div v-if="isCalculatingOccurrences" class="q-my-sm">
          <q-skeleton type="text" class="q-mb-sm" />
          <q-skeleton type="text" class="q-mb-sm" />
          <q-skeleton type="text" class="q-mb-sm" />
        </div>
        <q-list v-else-if="occurrences.length > 0" class="q-my-sm">
          <q-item v-for="(date, index) in occurrences" :key="index" dense>
            <q-item-section>
              <q-item-label>{{ formatDate(date) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
        <div v-else class="text-body2 q-my-md text-grey-7">
          <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
          No occurrences could be calculated. Please check your recurrence settings.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps, defineEmits, onMounted } from 'vue'
import { RecurrenceService } from '../../services/recurrenceService'
import { RecurrenceRule, EventEntity } from '../../types/event'
import { format } from 'date-fns'

// Loading state indicators
const isCalculatingPattern = ref(false)
const isCalculatingOccurrences = ref(false)

const props = defineProps({
  modelValue: {
    type: Object as () => RecurrenceRule | undefined,
    default: undefined
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  startDate: {
    type: String,
    default: ''
  },
  timeZone: {
    type: String,
    default: ''
  },
  hideToggle: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:model-value', 'update:is-recurring', 'update:time-zone'])

// Recurrence options
const frequencyOptions = RecurrenceService.frequencyOptions
const weekdayOptions = RecurrenceService.weekdayOptions

// Form state
const frequency = ref<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY'>('WEEKLY')
const interval = ref(1)
const selectedDays = ref<string[]>([])
const monthlyRepeatType = ref('dayOfMonth')
const timezone = ref('')
const endType = ref('never')
const count = ref(10)
const until = ref('')
const timezoneOptions = ref(RecurrenceService.getTimezones())
const occurrences = ref<Date[]>([])

// Track rule generation to prevent recursion
const isGeneratingRule = false
const lastRuleString = ''

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

    // Add weekdays if daily or weekly frequency
    if ((frequency.value === 'DAILY' || frequency.value === 'WEEKLY') && selectedDays.value.length > 0) {
      result.byweekday = selectedDays.value
    }

    // Add count or until based on end type
    if (endType.value === 'count' && count.value) {
      result.count = count.value
    } else if (endType.value === 'until' && until.value) {
      result.until = new Date(until.value).toISOString()
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

  return patternDescriptionCache.value || 'Please select a frequency type'
})

// Function to update the pattern description (will be called from updateOccurrences)
const updatePatternDescription = (ruleObj: Partial<RecurrenceRule> | undefined, tzValue: string) => {
  if (!ruleObj || !props.startDate || !props.isRecurring) {
    patternDescriptionCache.value = 'Does not repeat'
    return
  }

  try {
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
        } as EventEntity)

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

// Functions
const toggleRecurrence = (value: boolean) => {
  emit('update:is-recurring', value)
  if (value && !timezone.value) {
    timezone.value = RecurrenceService.getUserTimezone()
    emit('update:time-zone', timezone.value)
  }
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
          const result = RecurrenceService.getOccurrences(eventData as EventEntity, 5)
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

  // Set selected days (byweekday in RecurrenceRule)
  if (props.modelValue.byweekday && props.modelValue.byweekday.length > 0) {
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

// Initialize timezone
watch(() => props.timeZone, (newTimeZone) => {
  if (newTimeZone) {
    timezone.value = newTimeZone
  }
}, { immediate: true })

// We need to also make sure our watchers don't cause recursive updates
let isUpdatingSelectedDays = false

// Initialize weekday selection based on the start date
watch(() => props.startDate, (newStartDate) => {
  // Skip if we're already updating or if days are already selected
  if (isUpdatingSelectedDays || selectedDays.value.length > 0) return

  if (newStartDate) {
    isUpdatingSelectedDays = true
    try {
      const dayOfWeek = new Date(newStartDate).getDay()
      const weekdayValue = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][dayOfWeek]

      // Create a new array instead of modifying in place
      selectedDays.value = [weekdayValue]
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

onMounted(() => {
  // Set default timezone if not provided
  if (!timezone.value) {
    timezone.value = RecurrenceService.getUserTimezone()
    emit('update:time-zone', timezone.value)
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
</script>

<style scoped>
/* Optional styling */
</style>
