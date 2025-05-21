<template>
  <div>
    <q-card v-if="event?.seriesSlug" flat bordered class="q-mb-md">
      <q-card-section>
        <div class="text-h6">Manage Recurring Event</div>
        <div class="text-subtitle2 q-mb-md">
          {{ humanReadablePattern }}
        </div>

        <!-- Migration notice -->
        <q-banner rounded class="bg-yellow-1 q-mb-md" v-if="event.isRecurring && !event.seriesSlug">
          <template v-slot:avatar>
            <q-icon name="sym_r_info" color="warning" />
          </template>
          <div>
            <div class="text-weight-medium">Event series migration in progress</div>
            <p class="q-mt-sm q-mb-none">
              Recurring event functionality is being migrated to the new event series platform.
              For best results, please use the "Make recurring series" option from the events menu
              to create a new event series from this event.
            </p>
            <q-btn
              flat
              color="primary"
              label="Convert to Event Series"
              class="q-mt-sm"
              @click="openPromoteDialog"
              :disable="!!event.seriesSlug"
            />
          </div>
        </q-banner>

        <!-- Warning if the event is already part of a series -->
        <q-banner rounded class="bg-blue-1 q-mb-md" v-if="event.seriesSlug">
          <template v-slot:avatar>
            <q-icon name="sym_r_info" color="info" />
          </template>
          <div>
            <div class="text-weight-medium">This event is part of a series</div>
            <p class="q-mt-sm q-mb-none">
              This event is already part of an event series. It cannot be converted to a new series.
              You can manage this event series from this interface.
            </p>
          </div>
        </q-banner>

        <!-- Tabs for management options -->
        <q-tabs
          v-model="activeTab"
          dense
          class="text-primary"
          active-color="primary"
          indicator-color="primary"
          align="justify"
          narrow-indicator
        >
          <q-tab name="occurrences" icon="sym_r_event" label="Occurrences" />
          <q-tab name="exclusions" icon="sym_r_event_busy" label="Exclusions" />
          <q-tab name="split" icon="sym_r_event_repeat" label="Split" />
        </q-tabs>

        <q-separator />

        <q-tab-panels v-model="activeTab" animated>
          <!-- Occurrences Tab -->
          <q-tab-panel name="occurrences">
            <div class="text-subtitle2 q-mb-sm">Upcoming Occurrences</div>

            <div v-if="isLoadingOccurrences" class="q-my-md text-center">
              <q-spinner-dots color="primary" size="24px" />
              <div class="q-mt-sm text-body2">Loading occurrences...</div>
            </div>

            <div v-else-if="occurrences.length > 0">
              <q-list separator>
                <q-item v-for="(occurrence, index) in occurrences" :key="index"
                        :class="{ 'bg-grey-2': occurrence.isExcluded }">
                  <q-item-section avatar>
                    <q-avatar size="28px" color="primary" text-color="white">
                      {{ index + 1 }}
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>
                      {{ formatDate(occurrence.date) }}
                      <q-badge v-if="occurrence.isExcluded" color="negative" text-color="white" class="q-ml-sm">
                        Excluded
                      </q-badge>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-btn v-if="!occurrence.isExcluded" flat round color="negative" icon="sym_r_event_busy"
                          @click="excludeOccurrence(occurrence.date)">
                      <q-tooltip>Exclude this occurrence</q-tooltip>
                    </q-btn>
                    <q-btn v-else flat round color="positive" icon="sym_r_event_available"
                          @click="includeOccurrence(occurrence.date)">
                      <q-tooltip>Include this occurrence</q-tooltip>
                    </q-btn>
                  </q-item-section>
                </q-item>
              </q-list>

              <div class="q-mt-md">
                <q-btn flat color="primary" label="Load more" @click="loadMoreOccurrences"
                      :disable="isLoadingOccurrences" />
              </div>
            </div>

            <div v-else-if="hasError" class="q-my-md text-negative">
              <q-icon name="sym_r_error" size="sm" class="q-mr-xs" />
              Error loading occurrences. Please try again.
              <q-btn flat size="sm" color="primary" label="Retry" @click="loadOccurrences()" class="q-ml-md" />
            </div>

            <div v-else class="q-my-md text-grey-7">
              <q-icon name="sym_r_info" size="sm" class="q-mr-xs" />
              No upcoming occurrences found.
              <div class="text-caption q-mt-sm">
                If you believe this is an error, try generating instances with the button below.
              </div>
              <q-btn
                flat
                color="primary"
                label="Generate from pattern"
                @click="generateClientSideOccurrences()"
                class="q-mt-sm"
              />
            </div>
          </q-tab-panel>

          <!-- Exclusions Tab -->
          <q-tab-panel name="exclusions">
            <div class="text-subtitle2 q-mb-sm">Manage Date Exclusions</div>

            <!-- Add exclusion date form -->
            <div class="row q-col-gutter-md q-mb-lg">
              <div class="col-xs-12 col-sm-6">
                <q-input
                  v-model="newExclusionDate"
                  filled
                  label="Exclude date"
                  hint="Select a date to exclude"
                >
                  <template v-slot:append>
                    <q-icon name="sym_r_event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="newExclusionDate" mask="YYYY-MM-DD">
                          <div class="row items-center justify-end">
                            <q-btn v-close-popup label="Close" color="primary" flat />
                          </div>
                        </q-date>
                      </q-popup-proxy>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="col-xs-12 col-sm-6 self-center">
                <q-btn
                  color="primary"
                  label="Add Exclusion"
                  :disable="!newExclusionDate || isAddingExclusion"
                  @click="addExclusionDate"
                >
                  <q-spinner-dots v-if="isAddingExclusion" />
                </q-btn>
              </div>
            </div>

            <!-- Existing exclusions list -->
            <div class="text-subtitle2 q-mb-sm">Current Exclusions</div>

            <div v-if="!event.recurrenceExceptions?.length" class="q-my-md text-grey-7">
              No exclusions set for this recurring event.
            </div>

            <q-list v-else separator>
              <q-item v-for="(date, index) in event.recurrenceExceptions" :key="index">
                <q-item-section>
                  <q-item-label>{{ formatExclusionDate(date) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn flat round color="negative" icon="sym_r_delete"
                        @click="confirmRemoveExclusion(date)">
                    <q-tooltip>Remove exclusion</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </q-list>
          </q-tab-panel>

          <!-- Split Series Tab -->
          <q-tab-panel name="split">
            <div class="text-subtitle2 q-mb-sm">Split This Recurring Series</div>
            <p class="text-body2 q-mb-md">
              Splitting a series will create two separate series - one before the split date and one from the split date forward.
              You can optionally modify details of future occurrences.
            </p>

            <!-- Split date selection -->
            <div class="row q-col-gutter-md q-mb-lg">
              <div class="col-xs-12 col-sm-6">
                <q-input
                  v-model="splitDate"
                  filled
                  label="Split from date"
                  hint="Select a date to split the series"
                >
                  <template v-slot:append>
                    <q-icon name="sym_r_event" class="cursor-pointer">
                      <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                        <q-date v-model="splitDate" mask="YYYY-MM-DD">
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

            <!-- Modification options -->
            <div class="q-mb-md">
              <q-checkbox v-model="modifyFutureEvents" label="Modify future events" />
            </div>

            <div v-if="modifyFutureEvents" class="q-pa-md bg-grey-1 rounded-borders q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Modifications for Future Events</div>

              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-xs-12 col-sm-6">
                  <q-input v-model="futureModifications.name" filled label="Event Name" />
                </div>
                <div class="col-xs-12 col-sm-6">
                  <q-select
                    v-model="futureModifications.type"
                    :options="eventTypeOptions"
                    filled
                    label="Event Type"
                    emit-value
                    map-options
                  />
                </div>
              </div>

              <div class="row q-col-gutter-md q-mb-md">
                <div class="col-xs-12">
                  <q-input
                    v-model="futureModifications.description"
                    filled
                    type="textarea"
                    label="Description"
                    rows="3"
                  />
                </div>
              </div>

              <!-- Add more modification fields as needed -->
            </div>

            <div class="q-mt-lg">
              <q-btn
                color="primary"
                label="Split Series"
                :disable="!splitDate || isSplittingSeries"
                @click="confirmSplitSeries"
              >
                <q-spinner-dots v-if="isSplittingSeries" />
              </q-btn>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>

    <!-- Confirmation Dialog for Exclusion Removal -->
    <q-dialog v-model="confirmExclusionRemoval.show" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="sym_r_warning" text-color="negative" />
          <span class="q-ml-sm">Remove Exclusion</span>
        </q-card-section>

        <q-card-section>
          Are you sure you want to remove the exclusion for
          <strong>{{ formatExclusionDate(confirmExclusionRemoval.date) }}</strong>?
          This will restore the occurrence.
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Remove" color="negative" @click="removeExclusion" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- Confirmation Dialog for Series Split -->
    <q-dialog v-model="confirmSplit.show" persistent>
      <q-card>
        <q-card-section class="row items-center">
          <q-avatar icon="sym_r_warning" text-color="warning" />
          <span class="q-ml-sm">Split Recurring Series</span>
        </q-card-section>

        <q-card-section>
          <p>
            Are you sure you want to split this series at <strong>{{ formatExclusionDate(splitDate) }}</strong>?
          </p>
          <p class="text-body2">
            This action cannot be undone. It will create two separate series:
          </p>
          <ul class="text-body2">
            <li>The original series will end before {{ formatExclusionDate(splitDate) }}</li>
            <li>A new series will start on {{ formatExclusionDate(splitDate) }} with the changes you specified</li>
          </ul>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Split Series" color="warning" @click="splitSeries" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { format } from 'date-fns'
import { useRouter } from 'vue-router'
import { useNotification } from '../../composables/useNotification'
import { RecurrenceService } from '../../services/recurrenceService'
import { EventEntity, EventType } from '../../types/event'
import { EventOccurrence, eventsApi } from '../../api/events'
import dateFormatting from '../../composables/useDateFormatting'

const props = defineProps<{
  event: EventEntity
}>()

const emit = defineEmits(['update:event', 'open-promote-dialog'])

const router = useRouter()
const { success, error, warning } = useNotification()

// UI state
const activeTab = ref('occurrences')
const isLoadingOccurrences = ref(false)
const isAddingExclusion = ref(false)
const isSplittingSeries = ref(false)
const hasError = ref(false)

// Data state
const occurrences = ref<EventOccurrence[]>([])
const occurrencesPage = ref(1)
const occurrencesCount = ref(10)

// Exclusion form
const newExclusionDate = ref('')

// Split form
const splitDate = ref('')
const modifyFutureEvents = ref(false)
const futureModifications = ref<Partial<EventEntity>>({})

// Confirmation dialogs
const confirmExclusionRemoval = ref({
  show: false,
  date: ''
})

const confirmSplit = ref({
  show: false
})

// Event type options for the split form
const eventTypeOptions = [
  { label: 'In Person', value: EventType.InPerson },
  { label: 'Online', value: EventType.Online },
  { label: 'Hybrid', value: EventType.Hybrid }
]

// Computed properties
const humanReadablePattern = computed(() => {
  if (!props.event?.recurrenceRule) {
    return 'Does not repeat'
  }
  return RecurrenceService.getHumanReadablePattern(props.event)
})

// Methods
const formatDate = (dateStr: string): string => {
  try {
    const dateObj = new Date(dateStr)
    return dateFormatting.formatWithTimezone(
      dateObj,
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
  } catch (err) {
    console.warn('Error formatting date in RecurrenceManagement:', dateStr, err)
    return dateStr // Fallback to original string if formatting fails
  }
}

const formatExclusionDate = (date: string) => {
  try {
    if (!date) return 'N/A'

    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid exclusion date:', date)
      return 'Invalid date'
    }

    return format(dateObj, 'EEE, MMM d, yyyy')
  } catch (e) {
    console.error('Error formatting exclusion date:', e)
    return String(date)
  }
}

const loadOccurrences = async (reset = true) => {
  if (isLoadingOccurrences.value) return

  isLoadingOccurrences.value = true
  hasError.value = false
  console.log(`Loading occurrences for event slug: ${props.event.slug}`)

  try {
    // Reset the array if loading the first page
    if (reset) {
      occurrences.value = []
      occurrencesPage.value = 1
    }

    const query = {
      startDate: new Date().toISOString(),
      count: occurrencesCount.value,
      includeExcluded: true
    }

    console.log('Query parameters:', query)
    console.log('Using RecurrenceService for event slug:', props.event.slug)

    // First try with the RecurrenceService
    try {
      console.log('Fetching occurrences using RecurrenceService')
      const newOccurrences = await RecurrenceService.fetchOccurrences(props.event.slug, query)
      console.log('RecurrenceService returned occurrences:', newOccurrences)

      if (reset) {
        occurrences.value = newOccurrences
      } else {
        // Append new occurrences
        occurrences.value = [...occurrences.value, ...newOccurrences]
      }
    } catch (apiError) {
      console.error('API fetch failed, falling back to client-side generation:', apiError)
      console.error('Error details:', apiError.message, apiError.response?.status, apiError.response?.data)

      // We don't generate client-side occurrences anymore
      console.warn('API call failed and client-side generation is no longer supported')
      hasError.value = true
      // Set a more helpful error message
      error('Unable to load occurrences. Please try again or contact support.')
    }

    occurrencesPage.value++
    console.log('Final occurrences state:', occurrences.value)
  } catch (err) {
    console.error('Error loading occurrences:', err)
    error('Failed to load event occurrences')
    hasError.value = true
  } finally {
    isLoadingOccurrences.value = false
  }
}

const loadMoreOccurrences = () => {
  loadOccurrences(false)
}

const generateClientSideOccurrences = async () => {
  if (!props.event.recurrenceRule && !props.event.seriesSlug) {
    warning('No recurrence pattern found')
    return
  }

  isLoadingOccurrences.value = true
  hasError.value = false

  try {
    console.log('Attempting to generate occurrences for event:', {
      slug: props.event.slug,
      seriesSlug: props.event.seriesSlug,
      recurrenceRule: props.event.recurrenceRule
    })

    let apiOccurrences = []

    // Use series API first if available
    if (props.event.seriesSlug) {
      try {
        console.log('Using event series API to fetch occurrences')
        const response = await import('../../api/event-series').then(module => {
          const eventSeriesApi = module.eventSeriesApi
          return eventSeriesApi.getOccurrences(
            props.event.seriesSlug,
            occurrencesCount.value,
            false // Don't include past occurrences
          )
        })

        // Map API response to expected format
        apiOccurrences = response.data.map(occ => ({
          date: occ.date,
          isExcluded: !occ.materialized // Assume non-materialized means excluded
        }))

        console.log('Series API returned occurrences:', apiOccurrences)
      } catch (apiError) {
        console.error('Error fetching from series API:', apiError)
        // Let error bubble up
        throw apiError
      }
    } else if (props.event.slug) {
      try {
        console.log('Using RecurrenceService.fetchOccurrences as fallback')
        const response = await RecurrenceService.fetchOccurrences(props.event.slug, {
          count: occurrencesCount.value,
          startDate: new Date().toISOString(),
          includeExcluded: true
        })

        apiOccurrences = response
        console.log('fetchOccurrences returned:', apiOccurrences)
      } catch (fetchError) {
        console.error('Error using fetchOccurrences:', fetchError)
        // Let error bubble up
        throw fetchError
      }
    } else {
      throw new Error('Event has no slug or series slug, cannot fetch occurrences')
    }

    // If we have occurrences, use them
    if (apiOccurrences.length > 0) {
      occurrences.value = apiOccurrences
      success('Generated occurrences from pattern')
    } else {
      throw new Error('No occurrences could be generated from available APIs')
    }
  } catch (err) {
    console.error('Error generating occurrences:', err)
    error('Failed to generate occurrences: ' + (err.message || 'Unknown error'))
    hasError.value = true
  } finally {
    isLoadingOccurrences.value = false
  }
}

const addExclusionDate = async () => {
  if (!newExclusionDate.value || isAddingExclusion.value) return

  isAddingExclusion.value = true

  try {
    // Format date with time from event start
    const eventStartTime = new Date(props.event.startDate).toISOString().substr(11, 8)
    const fullExclusionDate = `${newExclusionDate.value}T${eventStartTime}`

    console.log('Adding exclusion date:', fullExclusionDate, 'for event:', props.event.slug)

    try {
      // Direct API call
      await eventsApi.addExclusionDate(props.event.slug, fullExclusionDate)
      console.log('Exclusion added successfully via API')

      success('Date excluded successfully')

      // Update the local event data with the new exclusion
      const updatedEvent = { ...props.event }
      updatedEvent.recurrenceExceptions = updatedEvent.recurrenceExceptions || []
      updatedEvent.recurrenceExceptions.push(fullExclusionDate)

      emit('update:event', updatedEvent)

      // Reset the form and refresh occurrences
      newExclusionDate.value = ''
      await loadOccurrences()
    } catch (apiError) {
      console.error('API error when adding exclusion:', apiError)
      console.error('Error details:', apiError.message, apiError.response?.status, apiError.response?.data)
      error('Failed to exclude date: ' + (apiError.response?.data?.message || apiError.message || ''))
    }
  } catch (err) {
    console.error('Error in exclusion handler:', err)
    error('Failed to exclude date')
  } finally {
    isAddingExclusion.value = false
  }
}

const confirmRemoveExclusion = (date: string) => {
  confirmExclusionRemoval.value = {
    show: true,
    date
  }
}

const removeExclusion = async () => {
  const date = confirmExclusionRemoval.value.date
  if (!date) return

  try {
    console.log('Removing exclusion date:', date, 'for event:', props.event.slug)

    try {
      // Direct API call
      await eventsApi.removeExclusionDate(props.event.slug, date)
      console.log('Exclusion removed successfully via API')

      success('Exclusion removed successfully')

      // Update the local event data
      const updatedEvent = { ...props.event }
      updatedEvent.recurrenceExceptions = updatedEvent.recurrenceExceptions?.filter(d => d !== date) || []

      emit('update:event', updatedEvent)

      // Refresh occurrences
      await loadOccurrences()
    } catch (apiError) {
      console.error('API error when removing exclusion:', apiError)
      console.error('Error details:', apiError.message, apiError.response?.status, apiError.response?.data)
      error('Failed to remove exclusion: ' + (apiError.response?.data?.message || apiError.message || ''))
    }
  } catch (err) {
    console.error('Error in removing exclusion handler:', err)
    error('Failed to remove exclusion')
  } finally {
    confirmExclusionRemoval.value.show = false
  }
}

const excludeOccurrence = async (date: string) => {
  try {
    console.log('Excluding occurrence for date:', date)
    const result = await RecurrenceService.addExclusionDate(props.event.slug, date)

    if (result) {
      success('Occurrence excluded successfully')

      // Update the local event data
      const updatedEvent = { ...props.event }
      updatedEvent.recurrenceExceptions = updatedEvent.recurrenceExceptions || []
      updatedEvent.recurrenceExceptions.push(date)

      emit('update:event', updatedEvent)

      // Update the local occurrence list
      const updatedOccurrences = [...occurrences.value]
      const index = updatedOccurrences.findIndex(o => o.date === date)
      if (index >= 0) {
        updatedOccurrences[index] = { ...updatedOccurrences[index], isExcluded: true }
        occurrences.value = updatedOccurrences
      }
    } else {
      error('Failed to exclude occurrence')
    }
  } catch (err) {
    console.error('Error excluding occurrence:', err)
    error('Failed to exclude occurrence: ' + (err.response?.data?.message || err.message || ''))
  }
}

const includeOccurrence = async (date: string) => {
  try {
    console.log('Including/restoring occurrence for date:', date)
    const result = await RecurrenceService.removeExclusionDate(props.event.slug, date)

    if (result) {
      success('Occurrence restored successfully')

      // Update the local event data
      const updatedEvent = { ...props.event }
      updatedEvent.recurrenceExceptions = updatedEvent.recurrenceExceptions?.filter(d => d !== date) || []

      emit('update:event', updatedEvent)

      // Update the local occurrence list
      const updatedOccurrences = [...occurrences.value]
      const index = updatedOccurrences.findIndex(o => o.date === date)
      if (index >= 0) {
        updatedOccurrences[index] = { ...updatedOccurrences[index], isExcluded: false }
        occurrences.value = updatedOccurrences
      }
    } else {
      error('Failed to restore occurrence')
    }
  } catch (err) {
    console.error('Error restoring occurrence:', err)
    error('Failed to restore occurrence: ' + (err.response?.data?.message || err.message || ''))
  }
}

const confirmSplitSeries = () => {
  if (!splitDate.value) {
    warning('Please select a date to split the series')
    return
  }

  confirmSplit.value.show = true
}

const splitSeries = async () => {
  if (isSplittingSeries.value) return

  isSplittingSeries.value = true

  try {
    // Format date with time from event start
    const eventStartTime = new Date(props.event.startDate).toISOString().substr(11, 8)
    const fullSplitDate = `${splitDate.value}T${eventStartTime}`

    // Only send modifications if they are enabled
    const modifications = modifyFutureEvents.value ? futureModifications.value : {}

    console.log('Attempting to split series at:', fullSplitDate)
    console.log('With modifications:', modifications)

    try {
      // Use RecurrenceService for consistent approach
      const result = await RecurrenceService.splitSeriesAt(
        props.event.slug,
        fullSplitDate,
        modifications
      )

      if (result) {
        console.log('Series split successful, new series:', result.slug)
        success('Series split successfully')

        // Navigate to the new series
        router.push({ name: 'EventPage', params: { slug: result.slug } })
      } else {
        throw new Error('No result returned from split operation')
      }
    } catch (apiError) {
      console.error('API error when splitting series:', apiError)
      error('Failed to split series. ' + (apiError.response?.data?.message || apiError.message || ''))
    }
  } catch (err) {
    console.error('Error in split series handler:', err)
    error('Failed to split series')
  } finally {
    isSplittingSeries.value = false
    confirmSplit.value.show = false
  }
}

// Function to open promote to series dialog
const openPromoteDialog = () => {
  // Check if the event is already part of a series
  if (props.event.seriesSlug) {
    error('This event is already part of a series and cannot be promoted to a new series.')
    return
  }

  emit('open-promote-dialog')
}

// Initialization
onMounted(async () => {
  if (props.event?.seriesSlug) {
    console.log('Loading occurrences for event:', props.event.slug)
    await loadOccurrences()
  }
})

// Watch for changes in the event
watch(() => props.event, async (newEvent) => {
  if (newEvent?.seriesSlug) {
    await loadOccurrences()
  }
}, { deep: true })
</script>

<style scoped>
/* Custom styling if needed */
</style>
