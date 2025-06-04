<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import {
  checkAvailability,
  getCalendarSources,
  type AvailabilityRequest,
  type AvailabilityResponse,
  type CalendarSource,
  type ConflictEvent
} from '../../api/calendar'

interface Props {
  startTime?: string
  endTime?: string
  autoCheck?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoCheck: false
})

const emit = defineEmits<{
  'availability-checked': [result: AvailabilityResponse]
  'conflict-detected': [conflicts: ConflictEvent[]]
}>()

const $q = useQuasar()
const loading = ref(false)
const calendarSources = ref<CalendarSource[]>([])
const selectedCalendarSourceIds = ref<string[]>([])
const startTime = ref(props.startTime || '')
const endTime = ref(props.endTime || '')
const availabilityResult = ref<AvailabilityResponse | null>(null)

const isTimeRangeValid = computed(() => {
  if (!startTime.value || !endTime.value) return false
  return new Date(endTime.value) > new Date(startTime.value)
})

// Remove unused variable
// const hasConflicts = computed(() => {
//   return availabilityResult.value && !availabilityResult.value.available
// })

const conflictGroups = computed(() => {
  if (!availabilityResult.value?.conflictingEvents) return []

  const groups = new Map<string, ConflictEvent[]>()

  availabilityResult.value.conflictingEvents.forEach(event => {
    const sourceId = event.calendarSourceUlid
    if (!groups.has(sourceId)) {
      groups.set(sourceId, [])
    }
    groups.get(sourceId)!.push(event)
  })

  return Array.from(groups.entries()).map(([sourceId, events]) => {
    const source = calendarSources.value.find(s => s.ulid === sourceId)
    return {
      source: source?.name || 'Unknown Calendar',
      events: events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }
  })
})

// Load calendar sources on mount
const loadCalendarSources = async () => {
  try {
    const response = await getCalendarSources()
    calendarSources.value = response.data.filter(source => source.isActive)
    selectedCalendarSourceIds.value = calendarSources.value.map(source => source.ulid)
  } catch (error) {
    console.error('Failed to load calendar sources:', error)
  }
}

// Auto-check availability when inputs change (with debounce to prevent rapid re-checking)
let autoCheckTimeout: ReturnType<typeof setTimeout> | null = null
watch([startTime, endTime, selectedCalendarSourceIds], () => {
  if (props.autoCheck && isTimeRangeValid.value) {
    // Clear previous timeout
    if (autoCheckTimeout) {
      clearTimeout(autoCheckTimeout)
    }
    // Debounce auto-checks by 500ms
    autoCheckTimeout = setTimeout(() => {
      checkAvailabilityNow(false) // Don't show notifications for auto-checks
    }, 500)
  }
}, { deep: true })

// Initialize
loadCalendarSources()

const checkAvailabilityNow = async (showNotification = true) => {
  if (!isTimeRangeValid.value) {
    if (showNotification) {
      $q.notify({
        type: 'negative',
        message: 'Please select a valid time range'
      })
    }
    return
  }

  try {
    loading.value = true

    const request: AvailabilityRequest = {
      startTime: startTime.value,
      endTime: endTime.value,
      calendarSourceIds: selectedCalendarSourceIds.value
    }

    const response = await checkAvailability(request)
    availabilityResult.value = response.data

    emit('availability-checked', response.data)

    if (!response.data.available) {
      emit('conflict-detected', response.data.conflictingEvents)
    }

    if (showNotification) {
      $q.notify({
        type: response.data.available ? 'positive' : 'warning',
        message: response.data.message,
        timeout: 3000
      })
    }
  } catch (error) {
    console.error('Failed to check availability:', error)
    if (showNotification) {
      $q.notify({
        type: 'negative',
        message: 'Failed to check availability'
      })
    }
    availabilityResult.value = null
  } finally {
    loading.value = false
  }
}

const formatEventTime = (startTime: string, endTime: string) => {
  const start = new Date(startTime)
  const end = new Date(endTime)

  const startStr = start.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const endStr = end.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return `${startStr} - ${endStr}`
}

const formatEventDate = (dateTime: string) => {
  return new Date(dateTime).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

defineExpose({
  checkAvailability: checkAvailabilityNow,
  clearResults: () => { availabilityResult.value = null }
})
</script>

<template>
  <div class="availability-checker">
    <div class="row q-gutter-md q-mb-md">
      <div class="col">
        <q-input
          v-model="startTime"
          type="datetime-local"
          label="Start Time"
          outlined
          dense
        />
      </div>
      <div class="col">
        <q-input
          v-model="endTime"
          type="datetime-local"
          label="End Time"
          outlined
          dense
        />
      </div>
    </div>

    <div v-if="calendarSources.length > 0" class="q-mb-md">
      <div class="text-subtitle2 q-mb-sm">Check against calendars:</div>
      <div class="row q-gutter-sm">
        <q-chip
          v-for="source in calendarSources"
          :key="source.ulid"
          :selected="selectedCalendarSourceIds.includes(source.ulid)"
          @update:selected="(selected) => {
            if (selected) {
              selectedCalendarSourceIds.push(source.ulid)
            } else {
              const index = selectedCalendarSourceIds.indexOf(source.ulid)
              if (index > -1) selectedCalendarSourceIds.splice(index, 1)
            }
          }"
          clickable
          color="primary"
          text-color="white"
          :icon="source.type === 'google' ? 'fab fa-google' :
                source.type === 'outlook' ? 'fab fa-microsoft' :
                source.type === 'apple' ? 'fab fa-apple' : 'sym_r_calendar_month'"
        >
          {{ source.name }}
        </q-chip>
      </div>
    </div>

    <div class="row justify-between items-center">
      <q-btn
        color="primary"
        :loading="loading"
        :disable="!isTimeRangeValid"
        @click="() => checkAvailabilityNow()"
      >
        <q-icon name="sym_r_search" class="q-mr-sm" />
        Check Availability
      </q-btn>

      <div v-if="availabilityResult" class="text-right">
        <q-chip
          :color="availabilityResult.available ? 'positive' : 'negative'"
          text-color="white"
          :icon="availabilityResult.available ? 'sym_r_check_circle' : 'sym_r_warning'"
        >
          {{ availabilityResult.available ? 'Available' : `${availabilityResult.conflicts.length} Conflict(s)` }}
        </q-chip>
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="availabilityResult" class="q-mt-lg">
      <q-separator class="q-mb-md" />

      <!-- Available -->
      <div v-if="availabilityResult.available" class="text-center q-py-md">
        <q-icon name="sym_r_check_circle" size="3em" color="positive" />
        <div class="text-h6 text-positive q-mt-sm">Time Slot Available!</div>
        <div class="text-body2 text-grey-6">No conflicts found in your connected calendars.</div>
      </div>

      <!-- Conflicts -->
      <div v-else>
        <div class="text-h6 text-negative q-mb-md">
          <q-icon name="sym_r_warning" class="q-mr-sm" />
          Schedule Conflicts Found
        </div>

        <q-list separator>
          <div v-for="group in conflictGroups" :key="group.source">
            <q-item-label header class="text-weight-bold">
              {{ group.source }}
            </q-item-label>

            <q-item
              v-for="event in group.events"
              :key="event.eventId"
              class="q-pl-lg"
            >
              <q-item-section avatar>
                <q-icon name="sym_r_event" color="negative" />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-medium">
                  {{ event.title }}
                </q-item-label>
                <q-item-label caption>
                  {{ formatEventDate(event.startTime) }} • {{ formatEventTime(event.startTime, event.endTime) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </div>
        </q-list>

        <q-banner class="bg-orange-1 text-orange-9 q-mt-md" rounded>
          <template v-slot:avatar>
            <q-icon name="sym_r_lightbulb" />
          </template>
          Consider adjusting your event time to avoid these conflicts, or proceed if these are flexible commitments.
        </q-banner>
      </div>
    </div>

    <!-- No Calendar Sources Warning -->
    <div v-if="calendarSources.length === 0" class="q-mt-md">
      <q-banner class="bg-info text-white" rounded>
        <template v-slot:avatar>
          <q-icon name="sym_r_info" />
        </template>
        <div>
          <div class="text-weight-bold">No Calendar Connections</div>
          Connect your external calendars to check for scheduling conflicts.
        </div>
        <template v-slot:action>
          <q-btn flat label="Connect Calendars" to="/dashboard/profile" />
        </template>
      </q-banner>
    </div>
  </div>
</template>

<style scoped lang="scss">
.availability-checker {
  .q-chip {
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
    }
  }

  .q-item {
    border-radius: 4px;
    margin-bottom: 2px;
  }
}
</style>
