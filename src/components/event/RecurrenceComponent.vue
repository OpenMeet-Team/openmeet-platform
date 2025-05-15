<template>
  <div class="c-recurrence-component">
    <div class="text-subtitle2 q-mb-sm">{{ hideToggle ? 'Series Pattern' : 'Recurrence' }}</div>

    <!-- Toggle for recurrence -->
    <div v-if="!hideToggle" class="q-mb-md">
      <q-checkbox
        data-cy="recurrence-toggle"
        :model-value="isRecurring"
        label="Make this a recurring event"
        @update:model-value="toggleRecurrence"
      />
    </div>

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
        label="Frequency"
        filled
        emit-value
        map-options
      />

      <!-- Interval -->
      <q-input
        data-cy="recurrence-interval"
        v-model.number="interval"
        type="number"
        label="Repeat every"
        filled
        :suffix="intervalLabel"
        :rules="[val => val > 0 || 'Interval must be greater than 0']"
      />

      <!-- Day selection for weekly frequency -->
      <div v-if="frequency === 'WEEKLY'" class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Repeat on</div>
        <div class="row q-gutter-sm">
          <q-btn
            v-for="day in weekdayOptions"
            :key="day.value"
            :label="day.shortLabel"
            :color="selectedDays.includes(day.value) ? 'primary' : 'grey-3'"
            :text-color="selectedDays.includes(day.value) ? 'white' : 'grey-8'"
            @click="toggleDay(day.value)"
            class="col"
          />
        </div>
      </div>

      <!-- Monthly options -->
      <div v-if="frequency === 'MONTHLY'" class="q-mt-md">
        <q-radio
          v-model="monthlyRepeatType"
          val="dayOfMonth"
          label="Day of month"
        />
        <q-radio
          v-model="monthlyRepeatType"
          val="dayOfWeek"
          label="Day of week"
        />

        <!-- Day of week options -->
        <div v-if="monthlyRepeatType === 'dayOfWeek'" class="q-mt-sm">
          <div class="row q-gutter-md">
            <q-select
              v-model="monthlyPosition"
              :options="monthlyPositionOptions"
              label="Position"
              filled
              class="col"
              @update:model-value="logMonthlyPositionChange"
            />
            <q-select
              v-model="monthlyWeekday"
              :options="weekdayOptions"
              label="Day"
              filled
              class="col"
              @update:model-value="logMonthlyWeekdayChange"
            />
          </div>
        </div>
      </div>

      <!-- End options -->
      <div class="q-mt-md">
        <div class="text-subtitle2 q-mb-sm">Ends</div>
        <q-radio v-model="endType" val="never" label="Never" />
        <q-radio v-model="endType" val="count" label="After" />
        <q-input
          v-if="endType === 'count'"
          v-model.number="count"
          type="number"
          label="Number of occurrences"
          filled
          class="q-mt-sm"
          :rules="[val => val > 0 || 'Count must be greater than 0']"
        />
        <q-radio v-model="endType" val="until" label="On date" />
        <q-input
          v-if="endType === 'until'"
          v-model="until"
          type="date"
          filled
          class="q-mt-sm"
          :rules="[val => !!val || 'End date is required']"
        />
      </div>

      <!-- Timezone selection -->
      <div class="q-mt-md">
        <q-select
          data-cy="event-timezone"
          v-model="timezone"
          :options="timezoneOptions"
          label="Timezone"
          filled
          use-input
          @filter="filterTimezones"
          @update:model-value="$emit('update:time-zone', $event)"
        />
      </div>

      <div v-if="props.isRecurring" class="q-mt-lg">
        <q-separator class="q-my-md" />

        <!-- Pattern Summary Section -->
        <div class="text-subtitle2">Pattern Summary</div>
        <div class="text-body2 q-my-md">
          <q-skeleton v-if="isCalculatingPattern" type="text" />
          <template v-else>
            <div class="text-weight-medium">{{ humanReadablePattern }}</div>
          </template>
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
// Import the logic from external file to avoid VLS type conflicts
import { useRecurrenceLogic } from './recurrence-component-logic'
import { RecurrenceRule } from '../../types/event'

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
  }
})

// Define emits
const emit = defineEmits<{(e: 'update:model-value', value: RecurrenceRule | undefined): void
  (e: 'update:is-recurring', value: boolean): void
  (e: 'update:time-zone', value: string): void
  (e: 'update:start-date', value: string): void
}>()

// Use the logic from the external file
const {
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
  frequencyOptions,
  weekdayOptions,
  monthlyPositionOptions,
  humanReadablePattern,
  intervalLabel,
  toggleRecurrence,
  logMonthlyPositionChange,
  logMonthlyWeekdayChange,
  toggleDay,
  filterTimezones,
  formatDate,
  initFromModelValue
} = useRecurrenceLogic(props, emit)

// Initialize from model value
initFromModelValue()
</script>

<style scoped lang="scss">
.c-recurrence-component {
  max-width: 600px;
}
</style>
