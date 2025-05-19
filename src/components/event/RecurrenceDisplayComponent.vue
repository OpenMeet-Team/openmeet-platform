<template>
  <div v-if="event?.seriesSlug || (event?.isRecurring && event?.recurrenceRule)" class="q-my-md">
    <!-- Recurrence Pattern -->
    <q-item dense>
      <q-item-section side>
        <q-icon name="sym_r_repeat" color="primary" />
      </q-item-section>
      <q-item-section>
        <q-item-label class="text-weight-medium">{{ event.recurrenceDescription || humanReadablePattern }}</q-item-label>
        <q-item-label
          v-if="event.recurrenceRule?.frequency === 'MONTHLY' &&
                event.recurrenceRule?.byweekday &&
                event.recurrenceRule?.bysetpos"
          class="text-caption text-positive"
        >
          Monthly pattern: {{ monthlyPatternDetails }}
        </q-item-label>
        <q-item-label caption v-if="event.timeZone">
          {{ timezoneDisplay }}
        </q-item-label>
      </q-item-section>
    </q-item>

    <!-- Occurrence Navigation -->
    <div v-if="event.seriesSlug || (event.isRecurring && occurrences.length > 0)" class="q-mt-md">
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
    seriesSlug: props.event?.seriesSlug,
    isRecurring: props.event?.isRecurring, // Legacy support
    recurrenceRule: props.event?.recurrenceRule,
    timeZone: props.event?.timeZone
  })

  // Use the server-provided description if available
  if (props.event?.recurrenceDescription) {
    return props.event.recurrenceDescription
  }

  // Special handling for monthly patterns with bysetpos
  if (props.event?.recurrenceRule?.frequency === 'MONTHLY' &&
      props.event?.recurrenceRule?.byweekday &&
      props.event?.recurrenceRule?.bysetpos) {
    const weekdayOptions = RecurrenceService.weekdayOptions
    const weekday = props.event.recurrenceRule.byweekday[0]
    const position = props.event.recurrenceRule.bysetpos[0]

    // Create a position string (1st, 2nd, 3rd, etc.)
    let positionStr = String(position)
    if (position === -1) {
      positionStr = 'last'
    } else if (position === 1) {
      positionStr = '1st'
    } else if (position === 2) {
      positionStr = '2nd'
    } else if (position === 3) {
      positionStr = '3rd'
    } else {
      positionStr = `${position}th`
    }

    // Get weekday label
    const weekdayLabel = weekdayOptions.find(w => w.value === weekday)?.label || weekday

    // Create the full description
    return `Monthly on the ${positionStr} ${weekdayLabel}${
      props.event.recurrenceRule.interval > 1
      ? ` every ${props.event.recurrenceRule.interval} months`
      : ''
    }`
  }

  // Fall back to client-side generation
  if (!props.event?.recurrenceRule) return 'Does not repeat'
  return RecurrenceService.getHumanReadablePattern(props.event)
})

// Get the monthly pattern details for debugging
const monthlyPatternDetails = computed(() => {
  if (props.event?.recurrenceRule?.frequency !== 'MONTHLY' ||
      !props.event?.recurrenceRule?.byweekday ||
      !props.event?.recurrenceRule?.bysetpos) {
    return ''
  }

  const byweekday = props.event.recurrenceRule.byweekday
  const bysetpos = props.event.recurrenceRule.bysetpos

  return `using bysetpos=${bysetpos.join(',')} with byweekday=${byweekday.join(',')}`
})

// Get the timezone display
const timezoneDisplay = computed(() => {
  if (!props.event?.timeZone) return ''
  // Display the original event timezone information
  return RecurrenceService.getTimezoneDisplay(props.event.timeZone)
})

// Format date for display in the user's current timezone
const formatDateTime = (date: Date) => {
  if (props.event?.timeZone) {
    return RecurrenceService.formatWithTimezone(
      date,
      {
        weekday: 'short', // EEE
        month: 'short', // MMM
        day: 'numeric', // d
        year: 'numeric', // yyyy
        hour: 'numeric', // h
        minute: '2-digit', // mm
        hour12: true // a (AM/PM)
      },
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
  if ((props.event.seriesSlug || props.event.isRecurring) && props.event.recurrenceRule) {
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
  if (props.event?.seriesSlug || (props.event?.isRecurring && props.event?.recurrenceRule)) {
    console.log('RecurrenceDisplayComponent - Loading occurrences for event:', {
      name: props.event.name,
      slug: props.event.slug,
      recurrenceDescription: props.event.recurrenceDescription,
      recurrenceRule: props.event.recurrenceRule
    })

    // Check specifically for monthly patterns with bysetpos
    if (props.event.recurrenceRule?.frequency === 'MONTHLY' &&
        props.event.recurrenceRule?.byweekday &&
        props.event.recurrenceRule?.bysetpos) {
      console.log('RecurrenceDisplayComponent - MONTHLY PATTERN WITH BYSETPOS DETECTED:', {
        byweekday: props.event.recurrenceRule.byweekday,
        bysetpos: props.event.recurrenceRule.bysetpos
      })
    }

    // Get the occurrences and log them
    occurrences.value = RecurrenceService.getOccurrences(props.event, 5)

    // Log the generated occurrences
    console.log('RecurrenceDisplayComponent - Generated occurrences:',
      occurrences.value.map(date => ({
        date: date.toISOString(),
        formatted: formatDateTime(date)
      }))
    )
  }
})
</script>

<style scoped>
/* Optional styling */
</style>
