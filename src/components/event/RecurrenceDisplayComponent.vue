<template>
  <div v-if="event?.isRecurring && event?.recurrenceRule" class="q-my-md">
    <!-- Recurrence Pattern -->
    <q-item dense>
      <q-item-section side>
        <q-icon name="sym_r_repeat" color="primary" />
      </q-item-section>
      <q-item-section>
        <q-item-label>{{ humanReadablePattern }}</q-item-label>
        <q-item-label caption v-if="event.timeZone">
          {{ timezoneDisplay }}
        </q-item-label>
      </q-item-section>
    </q-item>

    <!-- Occurrence Navigation -->
    <div v-if="event.isRecurring && occurrences.length > 0" class="q-mt-md">
      <q-expansion-item
        label="Upcoming occurrences"
        icon="sym_r_calendar_month"
        header-class="text-primary"
      >
        <q-list>
          <q-item
            v-for="(date, index) in occurrences"
            :key="index"
            clickable
            v-close-popup
          >
            <q-item-section avatar>
              <q-avatar size="28px" color="primary" text-color="white">
                {{ index + 1 }}
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ formatDateTime(date) }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </div>

    <!-- Export Calendar Options -->
    <div class="q-mt-md">
      <q-expansion-item
        label="Add to calendar"
        icon="sym_r_event_available"
        header-class="text-primary"
      >
        <q-list>
          <q-item clickable @click="downloadICalFile">
            <q-item-section avatar>
              <q-icon name="sym_r_download" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Download iCalendar file (.ics)</q-item-label>
              <q-item-label caption>
                Import into your calendar application
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-item clickable @click="copyGoogleCalendarLink">
            <q-item-section avatar>
              <q-icon name="fa-brands fa-google" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Google Calendar</q-item-label>
              <q-item-label caption>
                Open in Google Calendar
              </q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-expansion-item>
    </div>

    <!-- Calendar View -->
    <div class="q-mt-md">
      <q-expansion-item
        label="View calendar"
        icon="sym_r_calendar_month"
        header-class="text-primary"
      >
        <RecurrenceCalendarComponent :event="event" />
      </q-expansion-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { EventEntity } from '../../types/event'
import { RecurrenceService } from '../../services/recurrenceService'
import { format } from 'date-fns'
import { useNotification } from '../../composables/useNotification'
import { eventsApi } from '../../api/events'
import RecurrenceCalendarComponent from './RecurrenceCalendarComponent.vue'

const props = defineProps({
  event: {
    type: Object as () => EventEntity,
    required: true
  }
})

const { success } = useNotification()
const occurrences = ref<Date[]>([])

// Get a human-readable description of the recurrence pattern
const humanReadablePattern = computed(() => {
  // Log the event to see what's coming from the API
  console.log('Event recurrence info:', {
    recurrenceDescription: props.event?.recurrenceDescription,
    isRecurring: props.event?.isRecurring,
    recurrenceRule: props.event?.recurrenceRule,
    timeZone: props.event?.timeZone
  })

  // Use the server-provided description if available
  if (props.event?.recurrenceDescription) {
    return props.event.recurrenceDescription
  }

  // Fall back to client-side generation
  if (!props.event?.recurrenceRule) return 'Does not repeat'
  return RecurrenceService.getHumanReadablePattern(props.event)
})

// Get the timezone display
const timezoneDisplay = computed(() => {
  if (!props.event?.timeZone) return ''
  return RecurrenceService.getTimezoneDisplay(props.event.timeZone)
})

// Format date for display
const formatDateTime = (date: Date) => {
  if (props.event?.timeZone) {
    return RecurrenceService.formatWithTimezone(
      date,
      'EEE, MMM d, yyyy h:mm a',
      props.event.timeZone
    )
  } else {
    return format(date, 'EEE, MMM d, yyyy h:mm a')
  }
}

// Download iCalendar file
const downloadICalFile = async () => {
  try {
    const response = await eventsApi.getICalendar(props.event.slug)
    // Create a Blob from the response data
    const blob = new Blob([response.data], { type: 'text/calendar' })
    const url = window.URL.createObjectURL(blob)

    // Create a link and click it to trigger download
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url
    a.download = `${props.event.slug}.ics`
    document.body.appendChild(a)
    a.click()

    // Clean up
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    success('Calendar file downloaded successfully')
  } catch (error) {
    console.error('Error downloading iCalendar file:', error)
  }
}

// Generate and copy Google Calendar link
const copyGoogleCalendarLink = () => {
  const baseUrl = 'https://calendar.google.com/calendar/r/eventedit'

  // Format the start and end dates for Google Calendar
  const formatForGCal = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toISOString().replace(/-|:|\.\d+/g, '')
  }

  const params = new URLSearchParams()
  params.append('text', props.event.name)
  params.append('details', props.event.description || '')
  params.append('location', props.event.location || props.event.locationOnline || '')
  params.append('dates', `${formatForGCal(props.event.startDate)}/${formatForGCal(props.event.endDate || props.event.startDate)}`)

  // If recurring, add basic recurrence information
  if (props.event.isRecurring && props.event.recurrenceRule) {
    const rule = props.event.recurrenceRule
    let recur = `RRULE:FREQ=${rule.frequency}`

    if (rule.interval && rule.interval > 1) {
      recur += `;INTERVAL=${rule.interval}`
    }

    if (rule.count) {
      recur += `;COUNT=${rule.count}`
    }

    if (rule.until) {
      recur += `;UNTIL=${formatForGCal(rule.until)}`
    }

    params.append('recur', recur)
  }

  const gcalUrl = `${baseUrl}?${params.toString()}`

  // Open the Google Calendar link in a new tab
  window.open(gcalUrl, '_blank')
}

// Load occurrences on mount
onMounted(() => {
  if (props.event?.isRecurring && props.event?.recurrenceRule) {
    occurrences.value = RecurrenceService.getOccurrences(props.event, 5)
  }
})
</script>

<style scoped>
/* Optional styling */
</style>
