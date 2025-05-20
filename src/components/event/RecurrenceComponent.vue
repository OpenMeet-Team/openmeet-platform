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
        <div v-if="monthlyRepeatType === 'dayOfMonth' && startDate" class="q-pl-md q-mt-sm">
          <span>Will repeat on day {{ startDateObject?.getDate() }} of each month</span>
        </div>
        <q-radio
          v-model="monthlyRepeatType"
          val="dayOfWeek"
          label="Day of week"
          :disable="!startDate"
        />
        <div v-if="monthlyRepeatType === 'dayOfWeek' && startDate" class="q-pl-md q-mt-sm">
          <div class="row items-center q-gutter-x-md">
            <q-select
              v-model="monthlyPosition"
              :options="monthlyPositionOptions"
              dense
              filled
              style="width: 100px;"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              data-cy="monthly-position"
            />
            <q-select
              v-model="monthlyWeekday"
              :options="weekdayOptions"
              dense
              filled
              style="width: 120px;"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              data-cy="monthly-weekday"
            />
            <span>of the month</span>
          </div>
          <div class="text-grey-8 q-mt-xs">
            Will repeat on the {{ getPositionLabel(monthlyPosition) }} {{ getWeekdayLabel(monthlyWeekday) }} of each month
          </div>
        </div>
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

      <!-- Preview of upcoming occurrences -->
      <div class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">
          <div class="row items-center justify-between">
            <span>Upcoming Occurrences Preview</span>
            <q-btn flat dense size="sm" icon="sym_r_refresh" color="primary" @click="refreshOccurrencesPreview" />
          </div>
        </div>

        <div v-if="isLoadingOccurrences" class="text-center q-py-md">
          <q-spinner color="primary" size="2em" />
          <div class="q-mt-sm text-caption">Loading upcoming occurrences...</div>
        </div>

        <div v-else-if="occurrencePreviewError" class="text-negative q-pa-sm rounded-borders">
          <q-icon name="sym_r_warning" class="q-mr-xs" />
          {{ occurrencePreviewError }}
        </div>

        <div v-else-if="upcomingOccurrences.length === 0" class="text-grey-7 q-pa-sm">
          <q-icon name="sym_r_event_busy" class="q-mr-xs" />
          No upcoming occurrences found with the current pattern. Try adjusting your recurrence settings.
        </div>

        <div v-else>
          <q-list bordered separator class="rounded-borders">
            <q-item v-for="(occurrence, index) in upcomingOccurrences" :key="index">
              <q-item-section avatar>
                <q-avatar size="28px" color="primary" text-color="white">
                  {{ index + 1 }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>
                  {{ formatOccurrenceDate(occurrence.date) }}
                </q-item-label>
                <q-item-label caption class="text-grey-8">
                  {{ formatWeekday(occurrence.date) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div class="text-body2 q-mt-md q-pa-sm rounded-borders recurrence-info">
            <q-icon name="sym_r_info" class="q-mr-xs" color="info" />
            Your event will repeat according to this pattern. You'll be able to manage all occurrences after the event is created.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Import the logic from external file to avoid VLS type conflicts
import { useRecurrenceLogic } from './recurrence-component-logic'
import { RecurrenceRule } from '../../types/event'
import { EventOccurrence } from '../../types/event-series'
import { RecurrenceService } from '../../services/recurrenceService'
import { EventSeriesService } from '../../services/eventSeriesService'
import { eventSeriesApi } from '../../api/event-series'
import { ref } from 'vue'

// Define props in a standard way
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
  },
  seriesSlug: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:model-value', 'update:is-recurring', 'update:time-zone', 'update:start-date'])

// Use the extracted logic
const {
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
  // Options
  frequencyOptions,
  weekdayOptions,
  monthlyPositionOptions,
  // Computed
  startDateObject,
  intervalLabel,
  rule,
  // Methods
  getPositionLabel,
  getWeekdayLabel,
  toggleRecurrence,
  toggleDay,
  filterTimezones
} = useRecurrenceLogic(props, emit)

// State for occurrences preview
const upcomingOccurrences = ref<EventOccurrence[]>([])
const isLoadingOccurrences = ref<boolean>(false)
const occurrencePreviewError = ref<string | null>(null)

// Format occurrence date for display
const formatOccurrenceDate = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return RecurrenceService.formatWithTimezone(
      dateObj,
      { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' },
      timezone.value
    )
  } catch (error) {
    console.error('Error formatting occurrence date:', error)
    return String(date)
  }
}

// Format weekday for display
const formatWeekday = (date: Date | string): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return RecurrenceService.formatWithTimezone(
      dateObj,
      { weekday: 'long' },
      timezone.value
    )
  } catch (error) {
    console.error('Error formatting weekday:', error)
    return ''
  }
}

// Refresh occurrences preview based on current recurrence rule and start date
const refreshOccurrencesPreview = async () => {
  occurrencePreviewError.value = null

  // Check that we have the necessary data to generate occurrences
  if (!props.startDate) {
    occurrencePreviewError.value = 'Please set a start date to preview occurrences'
    return
  }

  if (!rule.value || !rule.value.frequency) {
    occurrencePreviewError.value = 'Please set recurrence rule to preview occurrences'
    return
  }

  try {
    isLoadingOccurrences.value = true

    // If we're editing an existing series, use the getOccurrences API
    if (props.seriesSlug) {
      console.log('Using getOccurrences API for existing series:', props.seriesSlug)
      // Get occurrences from the API
      const response = await EventSeriesService.getOccurrences(props.seriesSlug, 5, false)
      upcomingOccurrences.value = response.map(occurrence => ({
        date: occurrence.date,
        eventSlug: occurrence.event?.slug || null,
        materialized: occurrence.materialized
      }))
    } else {
      // For new series, we need to handle this differently

      // Create a clean representation of the current rule
      console.log('Building recurrence rule structure based on current form values:', {
        frequency: frequency.value,
        monthlyRepeatType: monthlyRepeatType.value,
        selectedDays: selectedDays.value,
        monthlyWeekday: monthlyWeekday.value,
        monthlyPosition: monthlyPosition.value
      })

      // Use the computed rule value directly since it already combines all state
      console.log('Current computed rule value:', JSON.stringify(rule.value))

      // Create a clean serialized object for API using the computed rule which has
      // the current form state properly combined
      const staticData = JSON.parse(JSON.stringify({
        startDate: props.startDate,
        timeZone: timezone.value,
        count: 5,
        recurrenceRule: rule.value
      }))

      // Log the final data that will be sent
      console.log('Final serialized data to send:', staticData)

      // No need for separate plainPreviewDto variable
      const plainPreviewDto = staticData

      // Add debug logging to ensure recurrenceRule is being sent as an object
      console.log('Preview DTO prepared:', {
        startDate: plainPreviewDto.startDate,
        timeZone: plainPreviewDto.timeZone,
        count: plainPreviewDto.count,
        recurrenceRuleType: typeof plainPreviewDto.recurrenceRule,
        recurrenceRule: plainPreviewDto.recurrenceRule
      })

      const response = await eventSeriesApi.previewOccurrences(plainPreviewDto)

      // Map the response to EventOccurrence format
      upcomingOccurrences.value = response.data.map(occurrence => ({
        date: occurrence.date,
        eventSlug: null,
        materialized: false
      }))

      console.log('Received occurrences from temporary series API:', upcomingOccurrences.value)
    }

    // If no occurrences returned or generated, show a message
    if (upcomingOccurrences.value.length === 0) {
      console.warn('No upcoming occurrences found for the current recurrence settings')
      occurrencePreviewError.value = 'No occurrences found. Try adjusting your recurrence settings.'
    }
  } catch (error) {
    console.error('Error previewing occurrences:', error)
    occurrencePreviewError.value = 'Failed to generate occurrence preview: ' + error.message
  } finally {
    isLoadingOccurrences.value = false
  }
}

// Expose refreshOccurrencesPreview to the parent component
defineExpose({
  refreshOccurrencesPreview,
  upcomingOccurrences
})
</script>

<style scoped>
/* Recurrence info styles */
.recurrence-info {
  background-color: rgba(0, 100, 255, 0.08);
}

:deep(.q-dark) .recurrence-info,
.body--dark .recurrence-info {
  background-color: rgba(0, 100, 255, 0.15);
  color: white;
}
</style>
