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

        <div class="col-auto" v-if="isOwnerOrAdmin">
          <q-btn color="negative" label="Delete Series" @click="showDeleteDialog = true" class="q-mr-sm" />
          <q-btn color="primary" label="Edit Series" @click="showEditDialog = true" class="q-mr-sm" />
          <q-btn color="primary" label="Create New Event" @click="openEventFormDialog" />
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
            <div class="col-12 col-md-6" v-if="eventSeries?.user">
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
            <!-- Add template event if available -->
            <q-item v-if="templateEvent"
                    :key="'template'"
                    :to="`/events/${templateEvent.slug}`"
                    clickable>
              <q-item-section avatar>
                <q-avatar color="teal" text-color="white" icon="sym_r_event_note" />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ formatDate(templateEvent.startDate) }}</q-item-label>
                <q-item-label caption>
                  <q-badge color="teal">Template Event</q-badge>
                </q-item-label>
              </q-item-section>
            </q-item>

            <!-- List all occurrences -->
            <q-item v-for="(occurrence, index) in occurrences" :key="index"
                    :to="occurrence.materialized && occurrence.event ? `/events/${occurrence.event.slug}` : null"
                    clickable>
              <q-item-section avatar>
                <q-avatar :color="occurrence.materialized ? 'primary' : 'grey'" text-color="white">
                  {{ index + 1 }}
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ formatDate(occurrence.date) }}</q-item-label>
                <q-item-label caption>
                  <q-badge v-if="occurrence.materialized" color="positive">Scheduled Event</q-badge>
                  <q-badge v-else color="grey-7">Future Occurrence</q-badge>
                </q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-btn v-if="!occurrence.materialized" round flat icon="sym_r_add_to_photos"
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

    <!-- Delete Series Dialog -->
    <q-dialog v-model="showDeleteDialog">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Delete Event Series</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p>What would you like to do with the existing events?</p>
          <q-radio v-model="deleteOption" val="keep" label="Keep existing events" />
          <q-radio v-model="deleteOption" val="delete" label="Delete all events" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Delete" color="negative" @click="deleteSeries" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Edit Series Dialog -->
    <q-dialog v-model="showEditDialog">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Edit Event Series</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-form @submit="updateSeries">
            <q-input
              v-model="editForm.name"
              label="Series Name"
              :rules="[val => !!val || 'Name is required']"
              class="q-mb-md"
              filled
            />

            <q-input
              v-model="editForm.description"
              label="Description"
              type="textarea"
              class="q-mb-md"
              filled
            />

            <!-- Template Event Details -->
            <div v-if="templateEvent" class="q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Template Event Details</div>
              <q-card flat bordered>
                <q-card-section>
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
              </q-card>
            </div>

            <div class="text-subtitle2 q-mb-sm">Series Pattern</div>

            <!-- Frequency -->
            <q-select
              v-model="editForm.recurrenceRule.frequency"
              :options="frequencyOptions"
              filled
              label="Repeats"
              option-value="value"
              option-label="label"
              emit-value
              map-options
              class="q-mb-md"
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
            <div class="row q-col-gutter-md q-mb-md">
              <div class="col-12 col-sm-6">
                <q-input
                  v-model.number="editForm.recurrenceRule.interval"
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

            <!-- Timezone -->
            <div class="q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Timezone</div>
              <q-select
                v-model="editForm.timeZone"
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
            <div class="q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Ends</div>

              <q-radio v-model="endType" val="never" label="Never" />

              <div class="row items-center">
                <q-radio v-model="endType" val="count" label="After" class="col-auto" />
                <q-input
                  v-if="endType === 'count'"
                  v-model.number="editForm.recurrenceRule.count"
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
                  occurrence{{ editForm.recurrenceRule.count === 1 ? '' : 's' }}
                </div>
              </div>

              <div class="row items-center">
                <q-radio v-model="endType" val="until" label="On date" class="col-auto" />
                <q-input
                  v-if="endType === 'until'"
                  v-model="editForm.recurrenceRule.until"
                  filled
                  dense
                  class="col-auto q-ml-sm"
                  style="width: 150px;"
                >
                  <template v-slot:append>
                    <q-icon name="sym_r_event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="editForm.recurrenceRule.until" mask="YYYY-MM-DD">
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

            <!-- Pattern Summary -->
            <q-separator class="q-my-md" />
            <div class="text-subtitle2">Pattern Summary</div>
            <div class="text-body2 q-my-md">
              <q-skeleton v-if="isCalculatingPattern" type="text" />
              <template v-else>{{ humanReadablePattern }}</template>
            </div>

            <!-- Next Occurrences -->
            <div class="text-subtitle2 q-mt-md">Next occurrences</div>
            <div v-if="isCalculatingOccurrences" class="q-my-sm">
              <q-skeleton type="text" class="q-mb-sm" />
              <q-skeleton type="text" class="q-mb-sm" />
              <q-skeleton type="text" class="q-mb-sm" />
            </div>
            <q-list v-else-if="occurrences.length > 0" class="q-my-sm">
              <q-item v-for="(occurrence, index) in occurrences" :key="index" dense>
                <q-item-section>
                  <q-item-label>{{ formatDate(occurrence.date) }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
            <div v-else class="text-body2 q-my-md text-grey-7">
              <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
              No occurrences could be calculated. Please check your recurrence settings.
            </div>
          </q-form>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Save" color="primary" type="submit" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EventSeriesService } from '../services/eventSeriesService'
import { RecurrenceService } from '../services/recurrenceService'
import { format } from 'date-fns'
import { useQuasar, QNotifyCreateOptions } from 'quasar'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import UpdateFutureOccurrencesComponent from '../components/event-series/UpdateFutureOccurrencesComponent.vue'
import { EventEntity, GroupPermission } from '../types'
import { EventSeriesEntity } from '../types/event-series'
import { eventsApi } from '../api/events'
import { useEventDialog } from '../composables/useEventDialog'
import { useNotification } from '../composables/useNotification'
import { useEventSeriesStore } from '../stores/event-series-store'
import { useAuthStore } from '../stores/auth-store'
import { useEventStore } from '../stores/event-store'

// Define types for the component's data
interface EditFormData {
  name: string
  description: string
  recurrenceRule: {
    frequency: string
    interval: number
    count: number | null
    until: string | null
  }
  timeZone: string
}

interface EventOccurrence {
  date: string
  materialized: boolean
  event?: EventEntity
}

// Component setup
const route = useRoute()
const router = useRouter()
const $q = useQuasar()
const eventDialog = useEventDialog()
const { success, error: notifyError } = useNotification()
const eventSeriesStore = useEventSeriesStore()
const authStore = useAuthStore()
const eventStore = useEventStore()

// Component state
const isLoading = ref<boolean>(true)
const loadingMore = ref<boolean>(false)
const error = ref<string>('')
const seriesSlug = ref<string>(route.params.slug as string)
const eventSeries = ref<EventSeriesEntity | null>(null)
const templateEvent = ref<EventEntity | null>(null)
const occurrences = ref<EventOccurrence[]>([])
const occurrenceCount = ref<number>(5)
const showUpdateFuture = ref<boolean>(false)
const showEditTemplate = ref<boolean>(false)
const showDeleteDialog = ref<boolean>(false)
const showEditDialog = ref<boolean>(false)
const deleteOption = ref<'keep' | 'delete'>('keep')
const editForm = ref<EditFormData>({
  name: '',
  description: '',
  recurrenceRule: {
    frequency: '',
    interval: 1,
    count: null,
    until: null
  },
  timeZone: ''
})

const frequencyOptions = RecurrenceService.frequencyOptions
const timezoneOptions = ref<string[]>([])
const endType = ref<'never' | 'count' | 'until'>('never')
const isCalculatingPattern = ref(false)
const isCalculatingOccurrences = ref(false)

const intervalLabel = computed(() => {
  const frequency = editForm.value.recurrenceRule.frequency
  const interval = editForm.value.recurrenceRule.interval
  const unit = frequency.toLowerCase()
  return `${interval} ${unit}${interval === 1 ? '' : 's'}`
})

const humanReadablePattern = computed(() => {
  if (!editForm.value.recurrenceRule.frequency) return ''
  // Create a temporary event object with just the recurrence rule
  const tempEvent = {
    recurrenceRule: editForm.value.recurrenceRule
  } as EventEntity
  return RecurrenceService.getHumanReadablePattern(tempEvent)
})

const filterTimezones = (val: string, update: (callback: () => void) => void) => {
  update(() => {
    const needle = val.toLowerCase()
    timezoneOptions.value = Intl.supportedValuesOf('timeZone').filter(
      v => v.toLowerCase().indexOf(needle) > -1
    )
  })
}

const isOwnerOrAdmin = computed(() => {
  if (!eventSeries.value?.user) return false

  // Check if user is owner
  const isOwner = eventSeries.value.user.id === authStore.getUserId

  // Check if user is admin (has manage events permission)
  const isAdmin = eventStore.getterGroupMemberHasPermission(GroupPermission.ManageEvents)

  return isOwner || isAdmin
})

// Functions
const loadEventSeries = async () => {
  try {
    isLoading.value = true
    error.value = ''

    // Load event series
    const series = await EventSeriesService.getBySlug(seriesSlug.value)

    // Use type assertion to handle the recurrenceRule type
    eventSeries.value = series as EventSeriesEntity

    // Populate edit form with current values
    editForm.value = {
      name: series.name,
      description: series.description || '',
      timeZone: series.timeZone || '',
      recurrenceRule: {
        frequency: series.recurrenceRule.frequency,
        interval: series.recurrenceRule.interval || 1,
        count: series.recurrenceRule.count || null,
        until: series.recurrenceRule.until || null
      }
    }

    // Set end type based on current values
    if (series.recurrenceRule.count) {
      endType.value = 'count'
    } else if (series.recurrenceRule.until) {
      endType.value = 'until'
    } else {
      endType.value = 'never'
    }

    // Load template event if available
    if (series.templateEventSlug) {
      // If template event is already included in the response, use it
      if (series.templateEvent) {
        templateEvent.value = series.templateEvent
      } else {
        // Otherwise load it directly using events API instead of trying to use
        // getOccurrence which expects a date, not a slug
        try {
          const templateResponse = await eventsApi.getBySlug(series.templateEventSlug)
          templateEvent.value = templateResponse.data
        } catch (templateErr) {
          console.error('Error loading template event:', templateErr)
          // Continue even if template event loading fails
        }
      }
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
    isLoading.value = true
    // Use the centralized materialization function from the event store
    const { useEventStore } = await import('../stores/event-store')
    const eventStore = useEventStore()

    // Pass false for navigation as we'll handle it manually if needed
    const materializedEvent = await eventStore.actionMaterializeOccurrence(
      seriesSlug.value,
      date,
      false // Don't auto-navigate
    )

    // Handle successful materialization
    $q.notify({
      type: 'positive',
      message: 'Event was successfully scheduled'
    })

    // Manually navigate to the event page
    if (materializedEvent && materializedEvent.slug) {
      window.location.href = `/events/${materializedEvent.slug}`
    } else {
      // If we don't have a slug for some reason, reload occurrences instead
      await loadOccurrences()
    }
  } catch (err) {
    console.error('Error materializing occurrence:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to materialize occurrence: ' + (err.message || 'Unknown error')
    })
    // Reload occurrences to refresh the list
    await loadOccurrences()
  } finally {
    isLoading.value = false
  }
}

const onFutureUpdated = async (result: { message: string, count: number }) => {
  showUpdateFuture.value = false

  $q.notify({
    type: 'positive',
    message: result.message || `Updated ${result.count} future occurrences`
  } as QNotifyCreateOptions)

  // Reload occurrences to see updates
  await loadOccurrences()
}

const openEventFormDialog = () => {
  // Open the standard event creation form dialog
  console.log('Opening event form dialog to create a new event in series:', seriesSlug.value)

  eventDialog.openCreateEventDialog()
    .onOk((newEvent) => {
      // If a new event was successfully created, link it to the series
      if (newEvent && newEvent.slug && seriesSlug.value) {
        console.log('New event created:', newEvent)
        console.log('Current series:', eventSeries.value)

        // Prepare update data
        const updateData = {
          seriesSlug: seriesSlug.value,
          seriesId: eventSeries.value?.id,
          isRecurring: true,
          // Add materialized flag to indicate this is a one-off event in the series
          // This may be called "occurrence" or similar in your backend model
          materialized: true
        }

        console.log('Sending update to link event to series:', updateData)

        // Update the event to add it to the series
        eventsApi.update(newEvent.slug, updateData)
          .then((response) => {
            console.log('Event successfully linked to series, response:', response.data)
            success('Event added to series successfully')
            // Reload occurrences to show the new event
            loadOccurrences()
            // Navigate to the new event
            router.push(`/events/${newEvent.slug}`)
          })
          .catch((err) => {
            console.error('Error linking event to series:', err)
            // Check for specific error response
            if (err.response) {
              console.error('Server response:', err.response.data)
            }
            notifyError('Failed to add event to series')
          })
      }
    })
}

const deleteSeries = async () => {
  try {
    await eventSeriesStore.deleteSeries(seriesSlug.value, deleteOption.value === 'delete')
    success('Event series deleted successfully')
    router.push('/events')
  } catch (err) {
    notifyError('Failed to delete event series')
    console.error('Error deleting series:', err)
  }
}

const updateSeries = async () => {
  try {
    if (!eventSeries.value) return

    const updateData = {
      name: editForm.value.name,
      description: editForm.value.description,
      timeZone: editForm.value.timeZone,
      recurrenceRule: {
        ...editForm.value.recurrenceRule,
        // Convert empty values to undefined
        count: endType.value === 'count' ? editForm.value.recurrenceRule.count : undefined,
        until: endType.value === 'until' ? editForm.value.recurrenceRule.until : undefined
      }
    }

    await EventSeriesService.update(seriesSlug.value, updateData)
    success('Event series updated successfully')
    showEditDialog.value = false
    // Reload the series to show updated data
    await loadEventSeries()
  } catch (err) {
    notifyError('Failed to update event series')
    console.error('Error updating series:', err)
  }
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
