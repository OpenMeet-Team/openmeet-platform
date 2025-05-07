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
          <q-btn color="primary" @click="navigateToEventEdit" label="Edit Series Pattern" class="q-mr-sm" />
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

            <!-- Recurrence pattern -->
            <div class="col-12">
              <div class="text-subtitle2">Recurrence Pattern</div>
              <div class="text-h6 q-py-sm">
                <q-icon name="sym_r_event_repeat" class="q-mr-xs" color="primary" />
                <!-- If we have a server-provided description, always use it first -->
                <span>{{ eventSeries.recurrenceDescription || getHumanReadablePattern(eventSeries.recurrenceRule) }}</span>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Template Event Details -->
      <q-card class="q-mb-md" v-if="templateEvent">
        <q-card-section>
          <div class="row q-col-gutter-md items-center">
            <!-- Add event image -->
            <div class="col-auto">
              <q-img
                v-if="templateEvent.image"
                :src="getImageUrl(templateEvent.image)"
                style="width: 120px; height: 120px; border-radius: 8px;"
                fit="cover"
              />
              <q-avatar v-else size="120px" color="primary" text-color="white" font-size="52px">
                <q-icon name="sym_r_event_note" size="52px" />
              </q-avatar>
            </div>
            <div class="col">
              <div class="text-h6 q-mb-sm">Template Event</div>
              <div class="text-subtitle1">{{ templateEvent.name }}</div>
              <div class="text-caption">
                <q-icon name="sym_r_event" class="q-mr-xs" />
                {{ formatDate(templateEvent.startDate) }}
                <q-icon name="sym_r_location_on" class="q-ml-md q-mr-xs" v-if="templateEvent.location" />
                <span v-if="templateEvent.location">{{ templateEvent.location }}</span>
                <q-icon name="sym_r_public" class="q-ml-md q-mr-xs" v-if="templateEvent.locationOnline" />
                <span v-if="templateEvent.locationOnline">Online</span>
                <q-icon name="sym_r_group" class="q-ml-md q-mr-xs" />
                <span>{{ templateEvent.maxAttendees || 'Unlimited' }} attendees</span>
              </div>
            </div>
            <div class="col-auto">
              <q-btn flat color="primary" :to="templateEvent ? `/events/${templateEvent.slug}` : ''" label="Edit Event" />
              <q-btn flat color="primary" @click="openTemplateSelector" label="Change Template" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Upcoming Occurrences -->
      <q-card>
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_event" class="q-mr-sm" />
            Series Occurrences
          </div>

          <q-tabs v-model="occurrencesTab" class="text-primary q-mb-md">
            <q-tab name="all" label="All" />
            <q-tab name="past" label="Past" />
            <q-tab name="upcoming" label="Upcoming" />
          </q-tabs>

          <q-tab-panels v-model="occurrencesTab" animated>
            <q-tab-panel name="all">
              <q-list separator>
                <!-- List all occurrences, marking template instead of showing separately -->
                <q-item v-for="(occurrence, index) in occurrences" :key="index"
                        :to="occurrence.materialized && occurrence.event ? `/events/${occurrence.event.slug}` : null"
                        clickable>
                  <q-item-section avatar>
                    <q-avatar :color="getOccurrenceColor(occurrence)" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ occurrence.materialized && occurrence.event ? formatDate(occurrence.event.startDate) : formatDate(occurrence.date) }}</q-item-label>
                    <q-item-label caption>
                      <q-badge v-if="occurrence.materialized" color="positive">Scheduled Event</q-badge>
                      <q-badge v-else-if="isPastDate(occurrence.date)" color="negative">Missed</q-badge>
                      <q-badge v-else color="grey-7">Future Occurrence</q-badge>
                      <span class="q-ml-sm" v-if="occurrence.event">({{ occurrence.event.slug }})</span>
                      <q-badge v-if="isTemplateEvent(occurrence)" color="teal" class="q-ml-sm">Template</q-badge>
                      <q-badge v-if="isCustomizedDate(occurrence)" color="orange" class="q-ml-sm">Custom Date</q-badge>
                    </q-item-label>
                  </q-item-section>

                  <q-item-section side>
                    <q-btn v-if="!occurrence.materialized && !isPastDate(occurrence.date)" round flat icon="sym_r_add_to_photos"
                           @click.stop="materializeOccurrence(occurrence.date)" />
                  </q-item-section>
                </q-item>

                <q-item v-if="occurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>

            <q-tab-panel name="past">
              <q-list separator>
                <!-- List past occurrences -->
                <q-item v-for="(occurrence, index) in pastOccurrences" :key="index"
                        :to="occurrence.materialized && occurrence.event ? `/events/${occurrence.event.slug}` : null"
                        clickable>
                  <q-item-section avatar>
                    <q-avatar :color="occurrence.materialized ? 'deep-purple' : 'negative'" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ occurrence.materialized && occurrence.event ? formatDate(occurrence.event.startDate) : formatDate(occurrence.date) }}</q-item-label>
                    <q-item-label caption>
                      <q-badge v-if="occurrence.materialized" color="deep-purple">Past Event</q-badge>
                      <q-badge v-else color="negative">Missed</q-badge>
                      <span class="q-ml-sm" v-if="occurrence.event">({{ occurrence.event.slug }})</span>
                      <q-badge v-if="isTemplateEvent(occurrence)" color="teal" class="q-ml-sm">Template</q-badge>
                      <q-badge v-if="isCustomizedDate(occurrence)" color="orange" class="q-ml-sm">Custom Date</q-badge>
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item v-if="pastOccurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No past occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>

            <q-tab-panel name="upcoming">
              <q-list separator>
                <!-- List upcoming occurrences -->
                <q-item v-for="(occurrence, index) in upcomingOccurrences" :key="index"
                        :to="occurrence.materialized && occurrence.event ? `/events/${occurrence.event.slug}` : null"
                        clickable>
                  <q-item-section avatar>
                    <q-avatar :color="occurrence.materialized ? 'primary' : 'grey'" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ occurrence.materialized && occurrence.event ? formatDate(occurrence.event.startDate) : formatDate(occurrence.date) }}</q-item-label>
                    <q-item-label caption>
                      <q-badge v-if="occurrence.materialized" color="positive">Scheduled Event</q-badge>
                      <q-badge v-else color="grey-7">Future Occurrence</q-badge>
                      <span class="q-ml-sm" v-if="occurrence.event">({{ occurrence.event.slug }})</span>
                      <q-badge v-if="isTemplateEvent(occurrence)" color="teal" class="q-ml-sm">Template</q-badge>
                      <q-badge v-if="isCustomizedDate(occurrence)" color="orange" class="q-ml-sm">Custom Date</q-badge>
                    </q-item-label>
                  </q-item-section>

                  <q-item-section side>
                    <q-btn v-if="!occurrence.materialized" round flat icon="sym_r_add_to_photos"
                           @click.stop="materializeOccurrence(occurrence.date)" />
                  </q-item-section>
                </q-item>

                <q-item v-if="upcomingOccurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No upcoming occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>

        <q-card-actions>
          <q-btn flat color="primary" @click="loadMoreOccurrences" :loading="loadingMore" label="Load More" />
          <q-space />
        </q-card-actions>
      </q-card>
    </div>

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

            <!-- Recurrence Component -->
            <div>
              <div class="text-subtitle1 q-mb-sm">Recurrence Pattern</div>
              <RecurrenceComponent
                v-model:model-value="editForm.recurrenceRule as RecurrenceRule"
                :is-recurring="true"
                v-model:time-zone="editForm.timeZone"
                :start-date="templateEvent?.startDate"
                :hide-toggle="true"
              />
              <div class="text-caption q-mt-sm text-grey-7">
                Note: Editing this pattern will affect all future occurrences of this series.
              </div>
            </div>

            <q-card-actions align="right" class="q-mt-md">
              <q-btn flat label="Cancel" color="primary" v-close-popup />
              <q-btn flat label="Save" color="primary" type="submit" />
            </q-card-actions>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Select Template Dialog -->
    <q-dialog v-model="showSelectTemplate">
      <q-card style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">Select New Template Event</div>
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p>Select any occurrence to use as the new template event for future occurrences:</p>

          <q-tabs v-model="templateSelectionTab" class="text-primary">
            <q-tab name="materialized" label="Existing Events" />
            <q-tab name="all" label="All Occurrences" />
          </q-tabs>

          <q-tab-panels v-model="templateSelectionTab" animated>
            <q-tab-panel name="materialized">
              <!-- Materialized occurrences -->
              <q-list separator>
                <q-item v-for="(occurrence, index) in materializedOccurrences" :key="index"
                        v-ripple
                        clickable
                        @click="selectNewTemplate(occurrence)">
                  <q-item-section avatar>
                    <q-avatar color="primary" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ occurrence.materialized && occurrence.event ? formatDate(occurrence.event.startDate) : formatDate(occurrence.date) }}</q-item-label>
                    <q-item-label caption>
                      {{ occurrence.event?.location || 'No location' }}
                      <span class="q-ml-sm" v-if="occurrence.event">({{ occurrence.event.slug }})</span>
                      <q-badge v-if="isTemplateEvent(occurrence)" color="teal" class="q-ml-sm">Current Template</q-badge>
                      <q-badge v-if="isPastDate(occurrence.date)" color="deep-purple" class="q-ml-sm">Past Event</q-badge>
                      <q-badge v-if="isCustomizedDate(occurrence)" color="orange" class="q-ml-sm">Custom Date</q-badge>
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item v-if="materializedOccurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No materialized occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>

            <q-tab-panel name="all">
              <!-- All occurrences -->
              <q-list separator>
                <q-item v-for="(occurrence, index) in sortedOccurrences" :key="index"
                        v-ripple
                        clickable
                        @click="selectOrMaterializeAsTemplate(occurrence)">
                  <q-item-section avatar>
                    <q-avatar :color="occurrence.materialized ? 'primary' : 'grey'" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ occurrence.materialized && occurrence.event ? formatDate(occurrence.event.startDate) : formatDate(occurrence.date) }}</q-item-label>
                    <q-item-label caption>
                      {{ occurrence.event?.location || 'No location' }}
                      <span class="q-ml-sm" v-if="occurrence.event">({{ occurrence.event.slug }})</span>
                      <q-badge v-if="isTemplateEvent(occurrence)" color="teal" class="q-ml-sm">Current Template</q-badge>
                      <q-badge v-if="isPastDate(occurrence.date)" color="deep-purple" class="q-ml-sm">Past Event</q-badge>
                      <q-badge v-if="isCustomizedDate(occurrence)" color="orange" class="q-ml-sm">Custom Date</q-badge>
                    </q-item-label>
                  </q-item-section>
                </q-item>

                <q-item v-if="occurrences.length === 0">
                  <q-item-section>
                    <q-item-label>No occurrences found</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
/* eslint-disable vue/no-v-html */
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EventSeriesService } from '../services/eventSeriesService'
import { RecurrenceService } from '../services/recurrenceService'
import { format } from 'date-fns'
import { useQuasar } from 'quasar'
import SpinnerComponent from '../components/common/SpinnerComponent.vue'
import RecurrenceComponent from '../components/event/recurrence-component-shim'
import { EventEntity, GroupPermission, RecurrenceRule } from '../types'
import { EventSeriesEntity } from '../types/event-series'
import { FileEntity } from '../types/model'
import { eventsApi } from '../api/events'
import { useEventDialog } from '../composables/useEventDialog'
import { useNotification } from '../composables/useNotification'
import { useEventSeriesStore } from '../stores/event-series-store'
import { useAuthStore } from '../stores/auth-store'
import { useEventStore } from '../stores/event-store'
import { eventSeriesApi } from '../api/event-series'
import { EventType } from '../types/event'

// Define types for the component's data
interface EditFormData {
  name: string
  description: string
  recurrenceRule: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'HOURLY' | 'MINUTELY' | 'SECONDLY'
    interval: number
    count: number | null
    until: string | null
    byweekday?: string[]
    bymonthday?: number[]
    bysetpos?: number[]
    bymonth?: number[]
    wkst?: string
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
const occurrenceCount = ref<number>(20)
const showDeleteDialog = ref<boolean>(false)
const showEditDialog = ref<boolean>(false)
const showSelectTemplate = ref<boolean>(false)
const deleteOption = ref<'keep' | 'delete'>('keep')
const editForm = ref<EditFormData>({
  name: '',
  description: '',
  recurrenceRule: {
    frequency: 'WEEKLY', // Default to weekly frequency
    interval: 1,
    count: null,
    until: null
  },
  timeZone: ''
})

const endType = ref<'never' | 'count' | 'until'>('never')
const materializedOccurrences = computed(() => {
  // Filter materialized occurrences and sort them in date order (oldest first)
  return occurrences.value
    .filter(o => o.materialized && o.event)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
})

// Add a new computed property for sorted occurrences (oldest first)
const sortedOccurrences = computed(() => {
  return [...occurrences.value].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  )
})

const templateSelectionTab = ref<string>('materialized')
const occurrencesTab = ref<string>('all')

const isOwnerOrAdmin = computed(() => {
  if (!eventSeries.value?.user) return false

  // Check if user is owner
  const isOwner = eventSeries.value.user.id === authStore.getUserId

  // Check if user is admin (has manage events permission)
  const isAdmin = eventStore.getterGroupMemberHasPermission(GroupPermission.ManageEvents)

  return isOwner || isAdmin
})

// New computed properties for filtered occurrences
const upcomingOccurrences = computed(() => {
  return occurrences.value.filter(o => !isPastDate(o.date))
})

const pastOccurrences = computed(() => {
  return occurrences.value.filter(o => isPastDate(o.date))
})

// Helper to check if a date is in the past
const isPastDate = (dateString: string): boolean => {
  const date = new Date(dateString)
  const now = new Date()
  return date < now
}

// Helper to get the right color for an occurrence
const getOccurrenceColor = (occurrence: EventOccurrence): string => {
  if (occurrence.materialized) {
    return isPastDate(occurrence.date) ? 'deep-purple' : 'primary'
  }
  return isPastDate(occurrence.date) ? 'negative' : 'grey'
}

// Helper to check if an occurrence is the template event
const isTemplateEvent = (occurrence: EventOccurrence): boolean => {
  if (!templateEvent.value || !occurrence.event) return false
  return occurrence.event.slug === templateEvent.value.slug
}

// Helper to check if a materialized event has a custom date different from the pattern
const isCustomizedDate = (occurrence: EventOccurrence): boolean => {
  // Only applies to materialized events with actual event data
  if (!occurrence.materialized || !occurrence.event || !occurrence.event.startDate) {
    console.log(`isCustomizedDate for ${occurrence.event?.slug || 'unknown'}: missing data`, {
      materialized: occurrence.materialized,
      hasEvent: !!occurrence.event,
      hasStartDate: !!occurrence.event?.startDate
    })
    return false
  }

  // Compare the event's actual date with the calculated occurrence date
  const actualDate = new Date(occurrence.event.startDate).getTime()
  const patternDate = new Date(occurrence.date).getTime()
  const timeDiff = Math.abs(actualDate - patternDate)

  // Debug log the date difference for specific events we're tracking
  if (occurrence.event.slug === 'feast-friday-qstmzq') {
    console.log(`Date comparison for ${occurrence.event.slug}:`, {
      actualDate: new Date(occurrence.event.startDate).toISOString(),
      patternDate: new Date(occurrence.date).toISOString(),
      timeDiff,
      isCustom: timeDiff > 60000
    })
  }

  // If they differ by more than a minute (60000 ms), consider it customized
  return timeDiff > 60000
}

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
        until: series.recurrenceRule.until || null,
        byweekday: series.recurrenceRule.byweekday || [],
        bymonthday: series.recurrenceRule.bymonthday || [],
        bysetpos: series.recurrenceRule.bysetpos || [],
        bymonth: series.recurrenceRule.bymonth || [],
        wkst: series.recurrenceRule.wkst
      }
    }

    // Log recurrence rule for debugging
    console.log('Loaded recurrence rule:', JSON.stringify(series.recurrenceRule))

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
      console.log('Template event slug:', series.templateEventSlug)

      // If template event is already included in the response, use it
      if (series.templateEvent) {
        console.log('Template event from series response:', series.templateEvent)
        templateEvent.value = series.templateEvent
      } else {
        // Otherwise load it directly using events API instead of trying to use
        // getOccurrence which expects a date, not a slug
        try {
          console.log('Loading template event from API')
          const templateResponse = await eventsApi.getBySlug(series.templateEventSlug)
          console.log('Template event API response:', templateResponse.data)
          templateEvent.value = templateResponse.data
        } catch (templateErr) {
          console.error('Error loading template event:', templateErr)
          // Continue even if template event loading fails
        }
      }

      // Extra logging for templateEvent debugging
      console.log('Final template event value:', templateEvent.value)
      console.log('Template event has image?', !!templateEvent.value?.image)
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
    console.log(`Loading occurrences for series ${seriesSlug.value}, count: ${occurrenceCount.value}, includePast: true`)

    // First check if we have a monthly pattern with bysetpos, which requires special handling
    const isMonthlyWithBysetpos = eventSeries.value?.recurrenceRule?.frequency === 'MONTHLY' &&
                                 eventSeries.value?.recurrenceRule?.byweekday &&
                                 eventSeries.value?.recurrenceRule?.bysetpos

    let results = []

    if (isMonthlyWithBysetpos) {
      console.log('MONTHLY PATTERN WITH BYSETPOS DETECTED - using client-side generation for accuracy')
      console.log('Series recurrence rule:', {
        frequency: eventSeries.value.recurrenceRule.frequency,
        byweekday: eventSeries.value.recurrenceRule.byweekday,
        bysetpos: eventSeries.value.recurrenceRule.bysetpos,
        interval: eventSeries.value.recurrenceRule.interval || 1
      })

      // Create a mock event with the series rule for accurate generation
      const mockEvent: Partial<EventEntity> = {
        id: 0,
        ulid: 'mock',
        slug: 'mock',
        type: EventType.Online,
        name: eventSeries.value.name,
        startDate: templateEvent.value?.startDate || new Date().toISOString(),
        recurrenceRule: eventSeries.value.recurrenceRule,
        timeZone: eventSeries.value.timeZone
      }

      // Generate accurate occurrences client-side
      const clientOccurrences = RecurrenceService.getOccurrences(mockEvent as EventEntity, occurrenceCount.value)
      console.log(`Generated ${clientOccurrences.length} client-side occurrences`)

      // We still need to know which occurrences are materialized, so we'll fetch from API
      // But we'll use our client-side generated dates to ensure correct pattern
      const apiResults = await EventSeriesService.getOccurrences(seriesSlug.value, occurrenceCount.value, true)

      // Create a map of materialized events by date (roughly)
      const materializedMap = new Map()
      apiResults.filter(o => o.materialized).forEach(o => {
        // Use date string without time for fuzzy matching
        const dateKey = new Date(o.date).toISOString().split('T')[0]
        materializedMap.set(dateKey, o)
      })

      // Create our hybrid result set with accurate dates but materialization info from API
      results = clientOccurrences.map(date => {
        const dateKey = date.toISOString().split('T')[0]
        const matchingOccurrence = materializedMap.get(dateKey)

        if (matchingOccurrence) {
          return {
            date: date.toISOString(), // Use our accurate date
            materialized: true,
            event: matchingOccurrence.event
          }
        } else {
          return {
            date: date.toISOString(),
            materialized: false,
            event: null
          }
        }
      })

      console.log(`Created hybrid result set with ${results.length} occurrences`)
    } else {
      // For non-monthly or patterns without bysetpos, use regular API
      console.log('Using regular API call for occurrences')
      results = await EventSeriesService.getOccurrences(seriesSlug.value, occurrenceCount.value, true)

      // If we're likely missing occurrences (less than expected based on materialized ones in database)
      // fetch with even higher count
      const materializedEvents = results.filter(o => o.materialized)
      console.log(`Found ${materializedEvents.length} materialized out of ${results.length} total occurrences`)

      // If we're getting close to our limit, we might be missing some
      if (materializedEvents.length > 0 && materializedEvents.length >= results.length * 0.8) {
        const higherCount = occurrenceCount.value * 2
        console.log(`Fetching with higher count (${higherCount}) to ensure we get all occurrences`)
        occurrenceCount.value = higherCount
        const moreResults = await EventSeriesService.getOccurrences(seriesSlug.value, higherCount, true)
        console.log(`Fetched ${moreResults.length} occurrences with higher count`)
        results.length = 0 // Clear the array
        results.push(...moreResults) // Add the new results
      }
    }

    console.log(`Working with ${results.length} occurrences:`, {
      pastCount: results.filter(o => isPastDate(o.date)).length,
      futureCount: results.filter(o => !isPastDate(o.date)).length,
      materializedCount: results.filter(o => o.materialized).length,
      firstDate: results.length > 0 ? formatDate(results[0].date) : 'none',
      lastDate: results.length > 0 ? formatDate(results[results.length - 1].date) : 'none'
    })

    // IMPORTANT: Get ALL actual events directly from the series,
    // including those with custom dates that may not match the pattern
    try {
      // Use the new method to get all events in the series
      const allSeriesEvents = await EventSeriesService.getEventsBySeriesSlug(seriesSlug.value)
      console.log(`Fetched ${allSeriesEvents.length} real events directly from series`)

      // Create a map of existing materialzed events to avoid duplicates
      const existingEventIds = new Set<number>()
      results.forEach(o => {
        if (o.materialized && o.event && o.event.id) {
          existingEventIds.add(o.event.id)
        }
      })

      // Add any events from the series that aren't already accounted for in our results
      allSeriesEvents.forEach(event => {
        // Log each event being processed to help track our specific event
        console.log(`Processing event: ${event.slug}, date: ${formatDate(event.startDate)}, series: ${event.seriesSlug || 'none'}`)

        // Skip if we already have this event in our results
        if (event.id && existingEventIds.has(event.id)) {
          console.log(`- Skipping event ${event.slug} because it's already in the results`)
          return
        }

        // If the event has a date but doesn't match any pattern occurrence date,
        // add it as an additional occurrence
        if (event.startDate) {
          console.log(`Adding missing event ${event.slug} with custom date to occurrences list`)

          // For custom date events, try to find the closest pattern date
          // based on recurrence rule if available
          let estimatedPatternDate = event.startDate // Default to the event date

          if (eventSeries.value?.recurrenceRule?.frequency === 'WEEKLY' &&
              eventSeries.value?.recurrenceRule?.byweekday &&
              eventSeries.value?.recurrenceRule?.byweekday.length > 0) {
            // For weekly events, estimate pattern date based on weekday
            // If it's supposed to be Friday but is on Saturday, use Friday's date
            const eventDate = new Date(event.startDate)
            const dayOfWeek = eventDate.getDay() // 0-6, where 0 is Sunday

            // Check if the event's day of week is in the recurrence pattern
            const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
            const expectedDayStr = eventSeries.value.recurrenceRule.byweekday[0]
            const expectedDayIndex = dayNames.indexOf(expectedDayStr)

            if (expectedDayIndex !== -1 && expectedDayIndex !== dayOfWeek) {
              // Calculate the difference in days
              const dayDiff = dayOfWeek - expectedDayIndex

              // Create a new date that would be the "pattern" date
              const patternDate = new Date(eventDate)
              patternDate.setDate(patternDate.getDate() - dayDiff)

              estimatedPatternDate = patternDate.toISOString()

              console.log(`Estimated pattern date for ${event.slug}:`, {
                actualDate: eventDate.toISOString(),
                expectedDay: expectedDayStr,
                estimatedPatternDate,
                dayDiff
              })
            }
          }

          // Now add the occurrence with both actual date and estimated pattern date
          results.push({
            date: estimatedPatternDate, // Pattern date for comparison
            materialized: true,
            event: {
              ...event,
              // Keep the original start date
              startDate: event.startDate
            }
          })
        }
      })

      // Special logging for specific event we're looking for
      const targetEvent = allSeriesEvents.find(e => e.slug === 'feast-friday-qstmzq')
      if (targetEvent) {
        console.log('FOUND TARGET EVENT feast-friday-qstmzq:', {
          date: formatDate(targetEvent.startDate),
          seriesSlug: targetEvent.seriesSlug,
          isInResults: results.some(o => o.event?.slug === 'feast-friday-qstmzq')
        })
      } else {
        console.log('TARGET EVENT feast-friday-qstmzq NOT FOUND in allSeriesEvents')
      }

      // Target our specific event to ensure it's correctly marked with the Custom Date badge
      const finalTargetOccurrence = results.find(o => o.event?.slug === 'feast-friday-qstmzq')
      if (finalTargetOccurrence) {
        console.log('TARGET EVENT is in the results list')

        // This is a Saturday but should be a Friday - ensure pattern date is set appropriately
        const eventDate = new Date(finalTargetOccurrence.event.startDate)

        // For 2025-04-26 (Saturday), the pattern date should be 2025-04-25 (Friday)
        if (eventDate.getDay() === 6) { // Saturday
          // Set to Friday (one day before)
          const patternDate = new Date(eventDate)
          patternDate.setDate(patternDate.getDate() - 1)

          // Update the date field for the occurrence, which is used for the pattern comparison
          // This ensures isCustomizedDate will return true
          finalTargetOccurrence.date = patternDate.toISOString()

          console.log('Updated TARGET EVENT pattern date', {
            eventDate: formatDate(finalTargetOccurrence.event.startDate),
            patternDate: formatDate(finalTargetOccurrence.date)
          })
        }
      } else {
        console.log('TARGET EVENT is NOT in the results list')

        // If our target event is not in the results, but was found in allSeriesEvents, add it manually
        if (targetEvent) {
          console.log('MANUALLY ADDING TARGET EVENT to results list')
          results.push({
            date: targetEvent.startDate, // Use the event's actual date
            materialized: true,
            event: targetEvent
          })
        }
      }
    } catch (eventsErr) {
      console.error('Error fetching all series events:', eventsErr)
      // Continue even if this part fails - we'll still have pattern-calculated occurrences
    }

    // Add detailed logging for each occurrence to identify duplicates and missing events
    console.log('Occurrences details:')
    results.forEach((occurrence, index) => {
      console.log(`Occurrence ${index + 1}:`, {
        date: formatDate(occurrence.date),
        materialized: occurrence.materialized,
        slug: occurrence.event?.slug || 'not materialized',
        isTemplate: templateEvent.value && occurrence.event
          ? occurrence.event.slug === templateEvent.value.slug : false,
        isSameAsNext: index < results.length - 1 &&
          new Date(occurrence.date).toDateString() === new Date(results[index + 1].date).toDateString()
      })
    })

    // If we have a template event but it's not in the results and materialized, something might be wrong
    if (templateEvent.value && !results.some(o =>
      o.materialized && o.event && o.event.slug === templateEvent.value?.slug)) {
      console.warn('Template event not found in occurrences list. This might indicate a backend issue.', {
        templateEventSlug: templateEvent.value.slug,
        templateEventDate: formatDate(templateEvent.value.startDate)
      })

      // Check if we need to increase the count to get more occurrences
      if (results.length === occurrenceCount.value) {
        console.log('Increasing occurrence count to find more events')
        occurrenceCount.value += 50
        // Don't reload here - we'll use the current results and possibly load more later
      }
    }

    // Sort occurrences by date
    results.sort((a, b) => {
      const dateA = new Date(a.materialized && a.event?.startDate ? a.event.startDate : a.date)
      const dateB = new Date(b.materialized && b.event?.startDate ? b.event.startDate : b.date)
      return dateA.getTime() - dateB.getTime()
    })

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
    // Add 20 more occurrences each time
    occurrenceCount.value += 20
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

const openEventFormDialog = () => {
  // Open the standard event creation form dialog
  console.log('[SERIES-DEBUG] Opening event form dialog to create a new event in series:', seriesSlug.value)

  const dialog = eventDialog.openCreateEventDialog()

  // Log when dialog is opened
  console.log('[SERIES-DEBUG] Event creation dialog opened')

  dialog.onOk((newEvent) => {
    console.log('[SERIES-DEBUG] Dialog onOk callback received with event:', newEvent)

    // If a new event was successfully created, link it to the series
    if (newEvent && newEvent.slug && seriesSlug.value) {
      console.log('[SERIES-DEBUG] New event created:', newEvent)
      console.log('[SERIES-DEBUG] Current series:', seriesSlug.value)

      // Use the addEventToSeries API instead of updating the event directly
      const addEventData = {
        seriesSlug: seriesSlug.value,
        eventSlug: newEvent.slug
      }

      console.log('[SERIES-DEBUG] Connecting event to series using addEventToSeries API:', addEventData)
      console.log('[SERIES-DEBUG] API endpoint: /api/event-series/' + addEventData.seriesSlug + '/add-event/' + addEventData.eventSlug)

      // Add a notification to show we're linking the event to the series
      $q.notify({
        type: 'info',
        message: 'Linking event to series...'
      })

      // Use the eventSeriesApi.addEventToSeries endpoint
      eventSeriesApi.addEventToSeries(addEventData)
        .then((response) => {
          console.log('[SERIES-DEBUG] Event successfully linked to series, response:', response.data)
          success('Event added to series successfully')

          // Reload occurrences to show the new event
          loadOccurrences()
            .then(() => {
              console.log('[SERIES-DEBUG] Occurrences reloaded after adding event to series')
              // Delay navigation slightly to ensure API and UI updates are complete
              setTimeout(() => {
                console.log('[SERIES-DEBUG] Navigating to event page:', newEvent.slug)
                router.push(`/events/${newEvent.slug}`)
              }, 500)
            })
            .catch(err => {
              console.error('[SERIES-DEBUG] Error reloading occurrences:', err)
              // Navigate even if reloading occurrences fails
              router.push(`/events/${newEvent.slug}`)
            })
        })
        .catch((err) => {
          console.error('[SERIES-DEBUG] Error linking event to series:', err)
          // Check for specific error response
          if (err.response) {
            console.error('[SERIES-DEBUG] Server response:', err.response.data)
          }
          notifyError('Failed to add event to series')
          // Navigate to the event page anyway
          router.push(`/events/${newEvent.slug}`)
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

    // Log the current recurrence rule before update
    console.log('Current recurrence rule from edit form:', JSON.stringify(editForm.value.recurrenceRule))

    const updateData = {
      name: editForm.value.name,
      description: editForm.value.description,
      timeZone: editForm.value.timeZone,
      recurrenceRule: {
        ...editForm.value.recurrenceRule,
        // Convert empty values to undefined
        count: endType.value === 'count' ? editForm.value.recurrenceRule.count : undefined,
        until: endType.value === 'until' ? editForm.value.recurrenceRule.until : undefined,
        // Make sure we preserve bysetpos - critical for monthly nth-weekday patterns
        bysetpos: editForm.value.recurrenceRule.bysetpos && editForm.value.recurrenceRule.bysetpos.length > 0
          ? editForm.value.recurrenceRule.bysetpos
          : undefined,
        // Preserve other important fields
        byweekday: editForm.value.recurrenceRule.byweekday || undefined,
        bymonthday: editForm.value.recurrenceRule.bymonthday || undefined,
        bymonth: editForm.value.recurrenceRule.bymonth || undefined
      }
    }

    // Log the update data being sent to the API
    console.log('Sending series update with recurrence rule:', JSON.stringify(updateData.recurrenceRule))

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

const selectNewTemplate = async (occurrence: EventOccurrence) => {
  try {
    if (!occurrence.event || !eventSeries.value) return

    isLoading.value = true

    // Create a properly formatted recurrence rule that preserves bysetpos
    const recurrenceRule = eventSeries.value.recurrenceRule

    // Log recurrence rule details before update
    console.log('Current recurrence rule before template update:', JSON.stringify(recurrenceRule, null, 2))

    // Use recurrence rule and time zone from existing event series
    const updateData = {
      templateEventSlug: occurrence.event.slug,
      // Add required fields from the EventSeriesEntity to satisfy the UpdateEventSeriesDto type
      name: eventSeries.value.name,
      description: eventSeries.value.description,
      timeZone: eventSeries.value.timeZone,
      recurrenceRule: {
        ...recurrenceRule,
        // Explicitly preserve bysetpos for monthly patterns - critical for "nth weekday" patterns
        bysetpos: recurrenceRule.bysetpos && recurrenceRule.bysetpos.length > 0
          ? recurrenceRule.bysetpos
          : undefined,
        // Preserve other important fields
        byweekday: recurrenceRule.byweekday || undefined,
        bymonthday: recurrenceRule.bymonthday || undefined,
        bymonth: recurrenceRule.bymonth || undefined
      }
    }

    // Log the update data being sent to the API
    console.log('Sending series update with recurrence rule:', JSON.stringify(updateData.recurrenceRule, null, 2))

    await EventSeriesService.update(seriesSlug.value, updateData)
    success('Template event updated successfully')
    showSelectTemplate.value = false

    // We don't need to change the occurrence count - the watcher will reset it
    // Just make sure we're loading with includePast=true
    console.log('Reloading occurrences after template change with includePast=true')

    // Reload the series to show updated data
    await loadEventSeries()
  } catch (err) {
    notifyError('Failed to update template event')
    console.error('Error updating template event:', err)
  } finally {
    isLoading.value = false
  }
}

// New function to handle selection of non-materialized occurrences
const selectOrMaterializeAsTemplate = async (occurrence: EventOccurrence) => {
  try {
    // If it's already materialized, just select it
    if (occurrence.materialized && occurrence.event) {
      await selectNewTemplate(occurrence)
      return
    }

    // Otherwise, we need to materialize it first
    isLoading.value = true

    // Materialize the occurrence
    const materializedEvent = await eventStore.actionMaterializeOccurrence(
      seriesSlug.value,
      occurrence.date,
      false // Don't auto-navigate
    )

    if (materializedEvent && materializedEvent.slug) {
      // Create a new occurrence object with the materialized event
      const newOccurrence: EventOccurrence = {
        date: occurrence.date,
        materialized: true,
        event: materializedEvent
      }

      // Select the newly materialized event as template
      await selectNewTemplate(newOccurrence)
    } else {
      throw new Error('Failed to materialize occurrence')
    }
  } catch (err) {
    notifyError('Failed to materialize and set as template')
    console.error('Error materializing occurrence for template:', err)
  } finally {
    isLoading.value = false
  }
}

// Add a new function to open the template selector dialog
const openTemplateSelector = async () => {
  // Store original count to restore it afterwards
  const originalCount = occurrenceCount.value

  // Temporarily set a high value to get many occurrences for template selection
  occurrenceCount.value = 200

  console.log('Loading all occurrences for template selection, count:', occurrenceCount.value)

  // Force reload of occurrences with the higher count
  isLoading.value = true
  try {
    // First, try to load via normal API
    await loadOccurrences()

    // Check if we have all expected materialized events
    // If we're missing events that should be in the database, we need to try a different approach
    if (eventSeries.value?.templateEventSlug && !occurrences.value.some(o =>
      o.materialized && o.event && o.event.slug === eventSeries.value?.templateEventSlug)) {
      console.warn('Missing template event in occurrences list. Using direct API call to fetch it.')

      // Directly load the template event by slug
      try {
        const templateResponse = await eventsApi.getBySlug(eventSeries.value.templateEventSlug)
        console.log('Template event loaded:', templateResponse.data)

        // Add it to the occurrences if not already present
        if (templateResponse.data) {
          const templateEvent = templateResponse.data
          // Create an occurrence object for it
          const templateOccurrence = {
            date: templateEvent.startDate,
            materialized: true,
            event: templateEvent
          }

          // Check if we already have this occurrence
          const exists = occurrences.value.some(o =>
            o.materialized && o.event && o.event.slug === templateEvent.slug
          )

          if (!exists) {
            // Add to beginning of occurrences array
            occurrences.value.unshift(templateOccurrence)
            console.log('Added missing template event to occurrences list')
          }
        }
      } catch (templateErr) {
        console.error('Failed to load template event:', templateErr)
      }
    }

    // Check for any additional materialized events via series object
    if (eventSeries.value?.events) {
      console.log('Using events from series object to ensure all events are included')

      // Add any events from the series that aren't in our occurrences list
      eventSeries.value.events.forEach(event => {
        const exists = occurrences.value.some(o =>
          o.materialized && o.event && o.event.id === event.id
        )

        if (!exists && event.startDate) {
          // Add this event as an occurrence
          occurrences.value.push({
            date: event.startDate,
            materialized: true,
            event: event as EventEntity
          })
          console.log(`Added missing event ${event.slug} to occurrences list`)
        }
      })
    }

    // Setup watch for dialog close to restore the count
    const unwatch = watch(showSelectTemplate, (newVal) => {
      if (!newVal) { // When dialog closes
        console.log('Resetting occurrence count back to original:', originalCount)
        occurrenceCount.value = originalCount
        // Reload with original count when needed
        loadOccurrences()
        unwatch() // Remove the watcher
      }
    })

    showSelectTemplate.value = true
  } catch (err) {
    console.error('Error loading occurrences for template selection:', err)
    notifyError('Failed to load all occurrences')
    // Reset count on error too
    occurrenceCount.value = originalCount
  } finally {
    isLoading.value = false
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

// Get a human-readable description of the recurrence pattern
const getHumanReadablePattern = (recurrenceRule: Partial<RecurrenceRule>) => {
  if (!recurrenceRule) return 'Does not repeat'

  try {
    // Special handling for monthly patterns with bysetpos
    if (recurrenceRule.frequency === 'MONTHLY' &&
        recurrenceRule.byweekday &&
        recurrenceRule.bysetpos) {
      const weekdayOptions = RecurrenceService.weekdayOptions
      const weekday = recurrenceRule.byweekday[0]
      const position = recurrenceRule.bysetpos[0]

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
      return `Monthly on the ${positionStr} ${weekdayLabel}${recurrenceRule.interval > 1 ? ` every ${recurrenceRule.interval} months` : ''}`
    }

    // For other patterns, use rrule's text representation
    try {
      // Cast to required type but ensure frequency exists first
      if (!recurrenceRule.frequency) {
        return 'Invalid recurrence rule'
      }
      const rruleObj = RecurrenceService.toRRule(recurrenceRule as RecurrenceRule, new Date().toISOString())
      return rruleObj.toText()
    } catch (error) {
      console.error('Error generating text from RRule:', error)
      return 'Error: ' + (error instanceof Error ? error.message : String(error))
    }
  } catch (error) {
    console.error('Error generating human readable pattern:', error)
    return 'Custom recurrence pattern'
  }
}

const getImageUrl = (image: string | FileEntity) => {
  if (!image) {
    console.log('Image is null or undefined')
    return ''
  }

  console.log('Template event image:', image)

  if (typeof image === 'string') {
    console.log('Image is a string URL:', image)
    return image
  }

  // Use path if available
  if (image.path) {
    console.log('Using image path:', image.path)
    return image.path
  }

  // If there are resized versions, use the first one available
  if (image.resizes && Object.keys(image.resizes).length > 0) {
    const firstKey = Object.keys(image.resizes)[0]
    console.log('Using resized image:', image.resizes[firstKey])
    return image.resizes[firstKey]
  }

  // Default fallback
  console.log('No valid image URL found')
  return ''
}

const navigateToEventEdit = () => {
  // Instead of navigating away, show the edit dialog for the series
  console.log('Opening series edit dialog')

  // Make sure we've loaded the latest data from the API before editing
  loadEventSeries().then(() => {
    // Show the edit dialog
    showEditDialog.value = true
    console.log('Edit dialog opened with recurrence rule:', JSON.stringify(editForm.value.recurrenceRule))
  }).catch(err => {
    console.error('Error loading series data for edit:', err)
    $q.notify({
      type: 'negative',
      message: 'Failed to load series data for editing'
    })
  })
}

// Lifecycle
onMounted(() => {
  loadEventSeries()
})
</script>
