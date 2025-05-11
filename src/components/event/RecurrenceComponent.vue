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
              @update:model-value="logMonthlyPositionChange"
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
              @update:model-value="logMonthlyWeekdayChange"
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

      <!-- Recurrence Preview -->
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

const emit = defineEmits(['update:model-value', 'update:is-recurring', 'update:time-zone', 'update:start-date'])

// Use the composable logic
const logic = useRecurrenceLogic(props, emit)

// Expose all returned values from the composable to the template
// and for testing via wrapper.vm
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
  rule,
  startDateObject,
  humanReadablePattern,
  intervalLabel,
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
} = logic

defineExpose({
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
  rule,
  startDateObject,
  humanReadablePattern,
  intervalLabel,
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
})
</script>

<style scoped>
/* Optional styling */
</style>
