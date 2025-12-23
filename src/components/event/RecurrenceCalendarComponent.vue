<template>
  <div class="q-mt-md">
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">Event Calendar</div>
        <p class="text-subtitle2">
          {{ humanReadablePattern }}
        </p>

        <!-- Month navigation -->
        <div class="row items-center justify-between q-mb-md">
          <q-btn icon="sym_r_chevron_left" flat dense round @click="previousMonth" :aria-label="`Previous month, ${currentMonthName} ${currentYear}`" />
          <span class="text-subtitle1" aria-label="Current month and year">{{ currentMonthName }} {{ currentYear }}</span>
          <q-btn icon="sym_r_chevron_right" flat dense round @click="nextMonth" :aria-label="`Next month, ${currentMonthName} ${currentYear}`" />
        </div>

        <!-- Calendar grid -->
        <div class="calendar-grid">
          <!-- Day names -->
          <div
            v-for="(dayName, index) in dayNames"
            :key="`day-name-${index}`"
            class="calendar-header q-pa-xs"
          >
            {{ dayName }}
          </div>

          <!-- Day cells -->
          <div
            v-for="(day, index) in calendarDays"
            :key="`day-${index}`"
            class="calendar-day q-pa-xs"
            :class="{
              'outside-month': !day.inCurrentMonth,
              'has-event': day.hasEvent,
              'excluded-event': day.isExcluded,
              'today': day.isToday
            }"
          >
            <div class="day-header">
              {{ day.day }}
            </div>
            <div v-if="day.hasEvent" class="day-content">
              <q-badge color="primary" v-if="day.hasEvent && !day.isExcluded" text-color="white">
                <q-icon name="sym_r_event" size="xs" class="q-mr-xs" />
                Event
              </q-badge>
              <q-badge color="negative" v-if="day.isExcluded" text-color="white">
                <q-icon name="sym_r_event_busy" size="xs" class="q-mr-xs" />
                Excluded
              </q-badge>
            </div>
          </div>
        </div>
      </q-card-section>

      <q-card-section>
        <div class="text-body2 q-mt-md">
          <q-icon name="sym_r_info" size="sm" class="q-mr-xs text-grey-7" />
          <span class="text-grey-7">
            This calendar shows all occurrences for the current month. Use the navigation
            buttons to view other months.
          </span>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameMonth, parseISO } from 'date-fns'
import { RecurrenceService } from '../../services/recurrenceService'
import { EventEntity } from '../../types/event'
import { EventOccurrence } from '../../api/events'

const props = defineProps<{
  event: EventEntity
}>()

// Calendar state
const currentDate = ref(new Date())
const occurrences = ref<EventOccurrence[]>([])
const isLoading = ref(false)

// Month navigation
const previousMonth = () => {
  currentDate.value = subMonths(currentDate.value, 1)
}

const nextMonth = () => {
  currentDate.value = addMonths(currentDate.value, 1)
}

// Computed properties
const currentYear = computed(() => format(currentDate.value, 'yyyy'))
const currentMonthName = computed(() => format(currentDate.value, 'MMMM'))
const dayNames = computed(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])

const calendarDays = computed(() => {
  // Get the date range for the calendar
  const monthStart = startOfMonth(currentDate.value)
  const monthEnd = endOfMonth(currentDate.value)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  // Generate all days in the range
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Map to day objects with event status
  return days.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd')

    // Check if there's an event occurrence on this day
    const eventOnDay = occurrences.value.find(occ => {
      const occDate = parseISO(occ.date)
      return format(occDate, 'yyyy-MM-dd') === dayStr
    })

    return {
      date: day,
      day: format(day, 'd'),
      inCurrentMonth: isSameMonth(day, currentDate.value),
      isToday: isToday(day),
      hasEvent: !!eventOnDay,
      isExcluded: eventOnDay?.isExcluded || false
    }
  })
})

const humanReadablePattern = computed(() => {
  if (!props.event?.recurrenceRule) {
    return 'Does not repeat'
  }

  return RecurrenceService.getHumanReadablePattern(props.event)
})

// Fetch event occurrences for the current month
const fetchOccurrences = async () => {
  if (!props.event || !props.event.isRecurring) return

  isLoading.value = true

  try {
    const startDate = startOfMonth(currentDate.value).toISOString()
    const endDate = endOfMonth(currentDate.value).toISOString()

    const query = {
      startDate,
      endDate,
      includeExcluded: true
    }

    console.log('Fetching calendar occurrences for:', props.event.slug, 'with query:', query)

    try {
      // Use RecurrenceService for consistent approach
      const results = await RecurrenceService.fetchOccurrences(props.event.slug, query)
      console.log('RecurrenceService returned occurrences:', results)
      occurrences.value = results
    } catch (apiError) {
      console.error('API call failed for calendar occurrences, falling back to client-side:', apiError)

      // Fall back to client-side generation if the API fails
      if (props.event.recurrenceRule) {
        console.log('Generating client-side occurrences')
        // Parse dates once outside of the callbacks
        const startDateObj = parseISO(startDate)
        const endDateObj = parseISO(endDate)

        // Pre-process exclusion dates
        const exclusionDates = props.event.recurrenceExceptions?.map(ex =>
          format(parseISO(ex), 'yyyy-MM-dd')
        ) || []

        // Generate client-side occurrences for the entire month
        const clientOccurrences = RecurrenceService.getOccurrences(props.event, 50)
          .filter(date => {
            // Filter to only include dates within the current month view
            return date >= startDateObj && date <= endDateObj
          })
          .map(date => ({
            date: date.toISOString(),
            isExcluded: exclusionDates.includes(format(date, 'yyyy-MM-dd'))
          }))

        console.log('Generated client-side occurrences for calendar:', clientOccurrences.length)
        occurrences.value = clientOccurrences
      }
    }
  } catch (error) {
    console.error('Error in calendar occurrence handling:', error)
    occurrences.value = []
  } finally {
    isLoading.value = false
  }
}

// Watch for month changes to update occurrences
watch(currentDate, () => {
  fetchOccurrences()
})

// Watch for event changes
watch(() => props.event, () => {
  fetchOccurrences()
}, { deep: true })

// Initialize
onMounted(() => {
  fetchOccurrences()
})
</script>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: var(--q-separator-color, #f2f2f2);
  border: 1px solid var(--q-separator-color, #f2f2f2);
  border-radius: 4px;
  overflow: hidden;
}

.calendar-header {
  background-color: var(--q-primary, #1976d2);
  color: white;
  font-weight: 500;
  text-align: center;
  padding: 8px;
}

.calendar-day {
  background-color: white;
  min-height: 60px;
  position: relative;
}

.day-header {
  text-align: right;
  font-weight: 500;
  margin-bottom: 4px;
}

.day-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.outside-month {
  color: var(--q-grey-5, #9e9e9e);
  background-color: var(--q-grey-2, #f5f5f5);
}

.has-event {
  font-weight: bold;
}

.excluded-event {
  text-decoration: line-through;
}

.today {
  border: 2px solid var(--q-primary, #1976d2);
}

.dark .calendar-day {
  background-color: var(--q-dark, #1d1d1d);
}

.dark .outside-month {
  background-color: var(--q-dark-page, #121212);
}
</style>
