<template>
  <q-page class="c-event-series-page q-pa-md">
    <SpinnerComponent v-if="isLoading" class="full-height" />

    <div v-else-if="error" class="text-center q-pa-lg">
      <q-icon name="sym_r_error" size="3rem" color="negative" />
      <div class="text-h6 q-mt-md">Error Loading Event Series</div>
      <div class="q-mt-sm">{{ error }}</div>
      <q-btn color="primary" class="q-mt-md" to="/events" label="Back to Events" />
    </div>

    <div v-else-if="eventSeries">
      <!-- Header -->
      <div class="row items-center q-mb-md">
        <div class="col">
          <div class="text-h4">{{ eventSeries.name }}</div>
          <div class="text-subtitle1">
            <q-icon name="sym_r_event_repeat" class="q-mr-xs" />
            {{ eventSeries.recurrenceDescription || 'Recurring event series' }}
          </div>
        </div>

        <div class="col-auto">
          <q-btn color="primary" label="Create New Event" to="/event-series/create" />
        </div>
      </div>

      <!-- Description -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">About this series</div>
          <p v-if="eventSeries.description" v-html="formatDescription(eventSeries.description)"></p>
          <p v-else class="text-grey">No description available</p>

          <div class="row q-col-gutter-md q-mt-md">
            <!-- Timezone -->
            <div class="col-12 col-md-6">
              <div class="text-subtitle2">Timezone</div>
              <div>{{ formatTimezone(eventSeries.timeZone) }}</div>
            </div>

            <!-- Created by -->
            <div class="col-12 col-md-6" v-if="eventSeries.user">
              <div class="text-subtitle2">Created by</div>
              <div>{{ eventSeries.user.firstName }} {{ eventSeries.user.lastName }}</div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Template Event Details -->
      <q-card class="q-mb-md" v-if="templateEvent">
        <q-card-section>
          <div class="text-h6 q-mb-md">Template Event</div>

          <div class="row q-col-gutter-md">
            <!-- Event Type -->
            <div class="col-12 col-md-6">
              <div class="text-subtitle2">Event Type</div>
              <div class="text-capitalize">{{ templateEvent.type }}</div>
            </div>

            <!-- Location -->
            <div class="col-12 col-md-6" v-if="templateEvent.location">
              <div class="text-subtitle2">Location</div>
              <div>{{ templateEvent.location }}</div>
            </div>

            <!-- Online Location -->
            <div class="col-12 col-md-6" v-if="templateEvent.locationOnline">
              <div class="text-subtitle2">Online Location</div>
              <div>
                <a :href="templateEvent.locationOnline" target="_blank">{{ templateEvent.locationOnline }}</a>
              </div>
            </div>

            <!-- Max Attendees -->
            <div class="col-12 col-md-6">
              <div class="text-subtitle2">Maximum Attendees</div>
              <div>{{ templateEvent.maxAttendees || 'Unlimited' }}</div>
            </div>

            <!-- Registration Settings -->
            <div class="col-12 col-md-6">
              <div class="text-subtitle2">Registration Settings</div>
              <ul class="q-mt-sm">
                <li>{{ templateEvent.requireApproval ? 'Requires approval' : 'No approval required' }}</li>
                <li>{{ templateEvent.allowWaitlist ? 'Waitlist allowed' : 'No waitlist' }}</li>
              </ul>
            </div>
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat color="primary" label="Edit Template" @click="showEditTemplate = true" />
        </q-card-actions>
      </q-card>

      <!-- Upcoming Occurrences -->
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_event" class="q-mr-sm" />
            Upcoming Occurrences
          </div>

          <q-list separator>
            <q-item v-for="(occurrence, index) in occurrences" :key="index"
                    :to="occurrence.materialized && occurrence.event ? `/events/${occurrence.event.slug}` : null"
                    clickable>
              <q-item-section>
                <q-item-label>{{ formatDate(occurrence.date) }}</q-item-label>
                <q-item-label caption>
                  <q-badge v-if="occurrence.materialized" color="primary">Materialized</q-badge>
                  <q-badge v-else color="grey">Scheduled</q-badge>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-btn v-if="!occurrence.materialized" round flat icon="sym_r_visibility"
                       @click.stop="materializeOccurrence(occurrence.date)" />
              </q-item-section>
            </q-item>

            <q-item v-if="occurrences.length === 0">
              <q-item-section>
                <q-item-label>No upcoming occurrences found</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>

        <q-card-actions>
          <q-btn flat color="primary" @click="loadMoreOccurrences" :loading="loadingMore" label="Load More" />
          <q-space />
          <q-btn color="primary" @click="showUpdateFuture = true" label="Update Future Occurrences" />
        </q-card-actions>
      </q-card>
    </div>

    <!-- Update Future Occurrences Dialog -->
    <q-dialog v-model="showUpdateFuture">
      <UpdateFutureOccurrencesComponent
        :series-slug="seriesSlug"
        :time-zone="eventSeries?.timeZone"
        :event-type="templateEvent?.type"
        @updated="onFutureUpdated"
        @cancel="showUpdateFuture = false"
      />
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EventSeriesService } from '../services/eventSeriesService'
import { RecurrenceService } from '../services/recurrenceService'
import { format } from 'date-fns'
import { useQuasar } from 'quasar'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import UpdateFutureOccurrencesComponent from '../components/event-series/UpdateFutureOccurrencesComponent.vue'
import { EventSeriesEntity } from '../api/event-series'
import { EventEntity } from '../types'

const route = useRoute()
const router = useRouter()
const $q = useQuasar()

const isLoading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const seriesSlug = ref(route.params.slug as string)
const eventSeries = ref<EventSeriesEntity | null>(null)
const templateEvent = ref<EventEntity | null>(null)
const occurrences = ref([])
const occurrenceCount = ref(5)
const showUpdateFuture = ref(false)
const showEditTemplate = ref(false)

// Functions
const loadEventSeries = async () => {
  try {
    isLoading.value = true
    error.value = ''

    // Load event series
    const series = await EventSeriesService.getBySlug(seriesSlug.value)
    eventSeries.value = series

    // Load template event if available
    if (series.templateEventSlug) {
      templateEvent.value = series.templateEvent || await EventSeriesService.getOccurrence(series.slug, series.templateEventSlug)
    }

    // Load occurrences
    await loadOccurrences()
  } catch (err) {
    console.error('Error loading event series:', err)
    error.value = err.message || 'Failed to load event series'
  } finally {
    isLoading.value = false
  }
}

const loadOccurrences = async () => {
  try {
    const results = await EventSeriesService.getOccurrences(seriesSlug.value, occurrenceCount.value)
    occurrences.value = results
  } catch (err) {
    console.error('Error loading occurrences:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to load occurrences: ' + (err.message || 'Unknown error')
    })
  }
}

const loadMoreOccurrences = async () => {
  try {
    loadingMore.value = true
    occurrenceCount.value += 5
    await loadOccurrences()
  } catch (err) {
    console.error('Error loading more occurrences:', err)
  } finally {
    loadingMore.value = false
  }
}

const materializeOccurrence = async (date: string) => {
  try {
    // Extract just the date part (YYYY-MM-DD)
    const datePart = format(new Date(date), 'yyyy-MM-dd')

    isLoading.value = true
    const event = await EventSeriesService.getOccurrence(seriesSlug.value, datePart)

    // Navigate to the materialized event
    router.push(`/events/${event.slug}`)
  } catch (err) {
    console.error('Error materializing occurrence:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to materialize occurrence: ' + (err.message || 'Unknown error')
    })
  } finally {
    isLoading.value = false
  }
}

const onFutureUpdated = async (result: { message: string, count: number }) => {
  showUpdateFuture.value = false

  $q.notify({
    type: 'positive',
    message: result.message || `Updated ${result.count} future occurrences`
  })

  // Reload occurrences to see updates
  await loadOccurrences()
}

// Helper Functions
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return format(date, 'EEEE, MMMM d, yyyy h:mm a')
}

const formatDescription = (description: string) => {
  // Simple markdown-like formatting
  return description
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

const formatTimezone = (timezone: string) => {
  return RecurrenceService.getTimezoneDisplay(timezone)
}

// Lifecycle
onMounted(() => {
  loadEventSeries()
})
</script>

<style scoped>
.c-event-series-page {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
