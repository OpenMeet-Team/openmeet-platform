<template>
  <div class="c-event-form-basic-component">
    <SpinnerComponent v-if="isLoading" class="c-event-form-basic-component" />
    <q-form data-cy="event-form" ref="formRef" @submit="onSubmit" class="q-gutter-md" v-if="!isLoading">

      <!-- Basic Information Card -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_event" class="q-mr-sm" />
            Basic Information
          </div>

          <!-- Event Name -->
          <q-input data-cy="event-name-input" v-model="eventData.name" label="Event Title" filled maxlength="80" counter
            :rules="[(val: string) => !!val || 'Title is required']" class="q-mb-md" />

          <!-- Event Group -->
          <div v-if="groupsOptions && groupsOptions.length" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Group Association</div>
            <q-select data-cy="event-group" :readonly="!!eventData.id" v-model="eventData.group"
              :options="groupsOptions" filled option-value="id" option-label="name" map-options emit-value clearable
              label="Group" />
          </div>

          <!-- Event Date and Time -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Date and Time</div>

            <!-- Event Start Date -->
            <div>
              <DatetimeComponent data-cy="event-start-date" required label="Starting date and time"
                ref="startDateInputRef"
                v-model="eventData.startDate" :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
                @update:time-info="handleStartTimeInfo"
                reactive-rules :rules="[(val: string) => !!val || 'Date is required']" />
            </div>

            <!-- Event End Date -->
            <template v-if="eventData.startDate">
              <q-checkbox data-cy="event-set-end-time" class="q-mt-md" v-model="hasEndDate"
                @update:model-value="setEndDate" label="Set an end time..." />

              <div v-if="hasEndDate">
                <DatetimeComponent data-cy="event-end-date" label="Ending date and time"
                  v-model="eventData.endDate" :showTimeZone=false :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
                  @update:time-info="handleEndTimeInfo"
                  reactive-rules :rules="[(val: string) => !!val || 'Date is required']">
                  <template v-slot:hint>
                    <div class="text-bold">
                      {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
                    </div>
                  </template>
                </DatetimeComponent>
              </div>

            </template>

            <!-- Recurrence Component with Series Creation -->
            <div v-if="eventData.startDate" class="q-mt-md">
              <div class="text-subtitle2 q-mb-sm">Recurrence</div>

              <q-checkbox
                data-cy="event-recurring-toggle"
                v-model="isRecurring"
                label="Make this a recurring event"
                :disable="!!eventData.seriesSlug"
                @click="onRecurrenceToggleClick"
              />

              <!-- Add warning message when event is part of a series -->
              <div v-if="eventData.seriesSlug" class="text-caption text-negative q-mt-xs">
                <q-icon name="sym_r_warning" size="xs" class="q-mr-xs" />
                This event is already part of a series and cannot be made recurring again.
              </div>

              <!-- Series Options shown when recurrence is enabled -->
              <template v-if="isRecurring">
                <div class="q-pa-md q-mt-sm rounded-borders recurrence-container">
                  <!-- Info about event series -->
                  <div v-if="!eventData.seriesSlug" class="text-body2 q-mb-md q-pa-sm rounded-borders recurrence-info">
                    <q-icon name="sym_r_info" class="q-mr-xs" color="info" />
                    This will create an event series. All occurrences will share the same basic information.
                  </div>

                  <!-- Info about existing event series -->
                  <div v-else class="text-body2 q-mb-md q-pa-sm rounded-borders recurrence-info">
                    <q-icon name="sym_r_info" class="q-mr-xs" color="info" />
                    This event is part of an existing series. Editing the recurrence pattern will affect all future occurrences.
                  </div>

                  <!-- Series Name -->
                  <q-input
                    data-cy="series-name-input"
                    v-model="seriesFormData.name"
                    label="Series Title"
                    filled
                    maxlength="80"
                    counter
                    class="q-mb-md"
                    :readonly="!!eventData.seriesSlug"
                    :rules="[(val) => !!val || 'Series title is required']"
                  />

                  <!-- Series Description -->
                  <q-input
                    data-cy="series-description-input"
                    v-model="seriesFormData.description"
                    label="Series Description (optional)"
                    filled
                    type="textarea"
                    autogrow
                    class="q-mb-md"
                    :readonly="!!eventData.seriesSlug"
                  />

                  <!-- Recurrence Pattern -->
                  <RecurrenceComponent
                    v-model="recurrenceRule"
                    :is-recurring="true"
                    v-model:time-zone="eventData.timeZone"
                    :start-date="eventData.startDate"
                    :hide-toggle="true"
                    @update:start-date="updateStartDate"
                    @update:model-value="handleRecurrenceRuleUpdate"
                  />

                  <!-- Show the series information when viewing a series event -->
                  <div v-if="eventData.seriesSlug" class="text-caption q-mt-md q-pa-sm rounded-borders recurrence-info">
                    <q-icon name="sym_r_info" class="q-mr-xs" color="info" />
                    This event is part of the series "<strong>{{ seriesFormData.name }}</strong>".
                    Any changes to the recurrence pattern will affect all future occurrences.
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Section Separator (between Recurrence and Image) -->
          <q-separator class="q-my-md" v-if="isRecurring" />

          <!-- Event Image -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Event Image</div>

            <div class="row items-center q-col-gutter-md">
              <div class="col-12 col-sm-6">
                <UploadComponent data-cy="event-image" label="Event image" @upload="onEventImageSelect" />
              </div>

              <div class="col-12 col-sm-6" v-if="eventData && eventData.image && typeof eventData.image === 'object' && eventData.image.path">
                <q-img ratio="16/9" :src="eventData.image.path" spinner-color="white"
                  class="rounded-borders" style="height: 120px; max-width: 220px" />
              </div>
            </div>
          </div>

          <!-- Event Description (Markdown) -->
          <div class="q-mt-lg">
            <div class="text-subtitle2 q-mb-sm">Event Description <span class="text-caption text-grey-7">(Supports Markdown)</span></div>

            <q-tabs
              v-model="descriptionTab"
              class="text-primary"
              active-color="primary"
              indicator-color="primary"
              narrow-indicator
            >
              <q-tab name="edit" label="Edit" />
              <q-tab name="preview" label="Preview" />
            </q-tabs>

            <q-separator />

            <q-tab-panels v-model="descriptionTab" animated>
              <q-tab-panel name="edit" class="q-pa-none">
                <q-input
                  data-cy="event-description"
                  filled
                  type="textarea"
                  v-model="eventData.description"
                  label="Event description"
                  hint="Supports Markdown formatting"
                  counter
                  maxlength="2000"
                  autogrow
                  class="q-mt-sm"
                  :rules="[val => !!val || 'Description is required']"
                />
                <div class="text-caption q-mt-xs">
                  <span class="text-weight-medium">Markdown tip:</span>
                  Use **bold**, *italic*, [links](url), and other Markdown syntax
                </div>
              </q-tab-panel>

              <q-tab-panel name="preview" class="q-pa-none">
                <div class="q-pa-md markdown-preview rounded-borders q-mt-sm">
                  <q-markdown
                    :src="eventData.description || '*No content yet*'"
                    class="text-body1 description-preview"
                  />
                </div>
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </q-card-section>
      </q-card>

      <!-- Event Type and Location -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_location_on" class="q-mr-sm" />
            Event Type & Location
          </div>

          <!-- Event Type -->
          <q-tabs data-cy="event-type" no-caps v-model="eventData.type" align="left" indicator-color="primary">
            <q-tab data-cy="event-type-in-person" label="In person" icon="sym_r_person_pin_circle" name="in-person" />
            <q-tab data-cy="event-type-online" label="Online" name="online" icon="sym_r_videocam" />
            <q-tab data-cy="event-type-hybrid" label="Hybrid" name="hybrid" icon="sym_r_diversity_2" />
          </q-tabs>

          <!-- Event Location Online -->
          <q-input data-cy="event-location-online" v-if="eventData.type && ['online', 'hybrid'].includes(eventData.type)"
            filled v-model="eventData.locationOnline" type="url" label="Link to the event" class="q-mt-md" />

          <!-- Event Location -->
          <LocationComponent data-cy="event-location" :location="eventData.location as string"
            :lat="eventData.lat as number" :lon="eventData.lon as number"
            v-if="eventData.type && ['in-person', 'hybrid'].includes(eventData.type)" @update:model-value="onUpdateLocation"
            label="Address or location" class="q-mt-md" />
        </q-card-section>
      </q-card>

      <!-- Event Category -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_category" class="q-mr-sm" />
            Categories
          </div>
          <q-select data-cy="event-categories" v-model="eventData.categories" :options="categoryOptions"
            filled multiple use-chips option-value="id" option-label="name" label="Event Categories" />
        </q-card-section>
      </q-card>

      <!-- Event Settings -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_settings" class="q-mr-sm" />
            Event Settings
          </div>

          <!-- Event Visibility -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Visibility</div>
            <q-select data-cy="event-visibility" v-model="eventData.visibility" label="Event Viewable By" option-value="value"
              option-label="label" emit-value map-options :options="[
                { label: 'The World', value: 'public' },
                { label: 'Authenticated Users', value: 'authenticated' },
                { label: 'People You Invite', value: 'private' }
              ]" filled />
            <p class="text-caption q-mt-sm" v-if="eventData.visibility === EventVisibility.Private">
              If private, the event is hidden from search and accessible only by direct link or group members.
            </p>
            <p class="text-caption q-mt-sm" v-if="eventData.visibility === EventVisibility.Public">
              If public, the event is visible to everyone and searchable.
            </p>
            <p class="text-caption q-mt-sm" v-if="eventData.visibility === EventVisibility.Authenticated">
              If authenticated, the event is visible to authenticated users and searchable.
            </p>
          </div>

          <!-- Attendee Settings -->
          <q-separator spaced />
          <div class="text-subtitle2 q-my-sm">Attendee Settings</div>

          <div class="q-mb-md">
            <!-- Max Attendees -->
            <q-checkbox data-cy="event-max-attendees" :model-value="!!eventData.maxAttendees"
              @update:model-value="eventData.maxAttendees = Number($event)" label="Limit number of attendees?" />
            <q-input data-cy="event-max-attendees-input" v-if="eventData.maxAttendees"
              v-model.number="eventData.maxAttendees" label="Maximum Attendees" filled type="number" class="q-mt-sm" :rules="[
                (val: number) => val > 0 || 'Maximum attendees must be greater than 0',
              ]" />
            <!-- Event Waitlist -->
            <div class="q-mt-sm">
              <q-checkbox v-if="eventData.maxAttendees" data-cy="event-waitlist" :model-value="!!eventData.allowWaitlist"
                @update:model-value="eventData.allowWaitlist = $event" label="Enable waitlist?" />
            </div>
          </div>

          <!-- Group Membership -->
          <div class="q-mb-md" v-if="eventData.group">
            <q-checkbox data-cy="event-require-group-membership"
              :model-value="!!eventData.requireGroupMembership"
              @update:model-value="eventData.requireGroupMembership = $event" label="Require group membership?" />
          </div>

          <!-- Approval Settings -->
          <q-separator spaced />
          <div class="text-subtitle2 q-my-sm">Approval Settings</div>

          <div>
            <q-checkbox data-cy="event-require-approval" :model-value="!!eventData.requireApproval"
              @update:model-value="eventData.requireApproval = $event" label="Require approval for attendance?" />

            <!-- If require approval, show approval question -->
            <q-input type="textarea" counter maxlength="255" v-if="eventData.requireApproval"
              data-cy="event-approval-question" v-model="eventData.approvalQuestion" label="Approval Question"
              filled class="q-mt-sm" />
          </div>
        </q-card-section>
      </q-card>

      <!-- Action buttons -->
      <div class="row justify-end q-gutter-md">
        <q-btn data-cy="event-cancel" no-caps flat label="Cancel" @click="$emit('close')" />
        <q-btn data-cy="event-save-draft" no-caps label="Save as draft"
          v-if="!eventData.status || eventData.status !== 'published'" color="secondary" @click="onSaveDraft" />
        <q-btn data-cy="event-publish" no-caps :label="isRecurring ? 'Publish Series' : 'Publish'" color="primary"
          @click="onPublish" />
      </div>
    </q-form>
  </div>

</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { CategoryEntity, EventEntity, EventStatus, EventType, EventVisibility, FileEntity, GroupEntity, RecurrenceRule } from '../../types'
import LocationComponent from '../common/LocationComponent.vue'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../common/UploadComponent.vue'
import { eventsApi } from '../../api/events'
import DatetimeComponent from '../common/DatetimeComponent.vue'
import RecurrenceComponent from './recurrence-component-shim'
import { categoriesApi } from '../../api/categories'
import { getHumanReadableDateDifference } from '../../utils/dateUtils'
import { QForm } from 'quasar'
import { groupsApi } from '../../api/groups'
import analyticsService from '../../services/analyticsService'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { RecurrenceService } from '../../services/recurrenceService'
import { eventSeriesApi } from '../../api/event-series'
import { toBackendRecurrenceRule } from '../../utils/recurrenceUtils'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { addHours } from 'date-fns'

const { success, error } = useNotification()
const onEventImageSelect = (file: FileEntity) => {
  eventData.value.image = file
}

const categoryOptions = ref<CategoryEntity[]>([])
const groupsOptions = ref<GroupEntity[]>([])

const emit = defineEmits(['created', 'updated', 'close', 'series-created'])
const formRef = ref<QForm | null>(null)
const isLoading = ref<boolean>(false)

// Initialize event data first
const eventData = ref<EventEntity>({
  name: '',
  description: '',
  slug: '',
  startDate: '',
  id: 0,
  type: EventType.InPerson,
  maxAttendees: 0,
  visibility: EventVisibility.Public,
  categories: [],
  ulid: '',
  sourceType: null,
  sourceId: null,
  sourceUrl: null,
  sourceData: null,
  lastSyncedAt: null,
  timeZone: RecurrenceService.getUserTimezone()
  // Removed recurrence-related fields
})

// Recurrence and series controls
const isRecurring = ref(false)
const recurrenceRule = ref<RecurrenceRule>({
  frequency: 'WEEKLY'
})

// Series data kept separate from event data
const seriesFormData = ref({
  name: '',
  description: '',
  timeZone: RecurrenceService.getUserTimezone()
})

// Tab for description editor (edit/preview)
const descriptionTab = ref('edit')

// Store the displayed start and end times
const displayedStartTime = ref<string>('')
const displayedEndTime = ref<string>('')

// --- NEW: Local state for end date checkbox ---
const hasEndDate = ref(!!eventData.value.endDate)

// Now that all reactive variables are initialized, set up watchers
// Watch for changes in the eventData to update isRecurring state and load series data
watch(() => eventData.value, async (newEventData) => {
  // If event has a seriesSlug, it's already part of a recurring series
  if (newEventData.seriesSlug) {
    isRecurring.value = true
    console.log('Event is part of series, enabling recurring mode:', newEventData.seriesSlug)

    // Load the series information to get the recurrence rule
    try {
      await loadSeriesInformation(newEventData.seriesSlug)
    } catch (err) {
      console.error('Failed to load series information:', err)
      error('Failed to load series information')
    }
  }
}, { immediate: true, deep: true })

// Watch for event name changes to sync with series name
watch(() => eventData.value.name, (newName) => {
  if (!seriesFormData.value.name || seriesFormData.value.name === '') {
    seriesFormData.value.name = newName ? `${newName} Series` : ''
  }
})

// Watch for description changes to sync with series description
watch(() => eventData.value.description, (newDesc) => {
  if (!seriesFormData.value.description || seriesFormData.value.description === '') {
    seriesFormData.value.description = newDesc || ''
  }
})

// Watch for recurrence toggle to update series name when enabled
watch(() => isRecurring.value, (isEnabled) => {
  if (isEnabled && eventData.value.name) {
    seriesFormData.value.name = `${eventData.value.name} Series`
  }
})

const onSaveDraft = () => {
  eventData.value.status = EventStatus.Draft
  formRef.value?.submit()
}

const onPublish = () => {
  eventData.value.status = EventStatus.Published
  formRef.value?.submit()
}

const onUpdateLocation = (address: { lat: string, lon: string, location: string }) => {
  eventData.value.lat = parseFloat(address.lat as string)
  eventData.value.lon = parseFloat(address.lon as string)
  eventData.value.location = address.location
}

const authStore = useAuthStore()

onMounted(() => {
  const promises = [
    categoriesApi.getAll().then(res => {
      categoryOptions.value = res.data
    }),
    groupsApi.getAllMe().then(res => {
      groupsOptions.value = res.data

      if (props.group) {
        eventData.value.group = res.data.find(group => group.id === props.group?.id)
      }
    })
  ]

  if (props.editEventSlug) {
    promises.push(
      eventsApi.edit(props.editEventSlug).then(res => {
        eventData.value = res.data
      })
    )
  }

  isLoading.value = true
  // Wait for all promises to resolve and then set loaded to true
  Promise.all(promises).finally(() => {
    isLoading.value = false
  })
})

// Function to load series data including recurrence rule
const loadSeriesInformation = async (seriesSlug: string): Promise<void> => {
  console.log(`Loading series information for: ${seriesSlug}`)
  isLoading.value = true

  try {
    // Fetch the series information
    const seriesResponse = await eventSeriesApi.getBySlug(seriesSlug)
    const seriesData = seriesResponse.data

    // Log the series data for debugging
    console.log('Series data loaded:', seriesData)

    // Update series form data
    seriesFormData.value.name = seriesData.name || ''
    seriesFormData.value.description = seriesData.description || ''

    // Update timezone if not already set
    if (seriesData.timeZone && (!eventData.value.timeZone || eventData.value.timeZone === '')) {
      eventData.value.timeZone = seriesData.timeZone
    }

    // Set the recurrence rule from the series
    if (seriesData.recurrenceRule) {
      console.log('Setting recurrence rule from series:', seriesData.recurrenceRule)

      // Convert from backend RecurrenceRuleDto to frontend RecurrenceRule format if needed
      // The frontend RecurrenceComponent expects 'frequency', 'byweekday', etc.
      const convertedRule: Partial<RecurrenceRule> = {
        frequency: seriesData.recurrenceRule.frequency as RecurrenceRule['frequency'],
        interval: seriesData.recurrenceRule.interval,
        count: seriesData.recurrenceRule.count,
        until: seriesData.recurrenceRule.until,
        bymonth: seriesData.recurrenceRule.bymonth,
        bymonthday: seriesData.recurrenceRule.bymonthday,
        bysetpos: seriesData.recurrenceRule.bysetpos,
        wkst: seriesData.recurrenceRule.wkst
      }

      // Handle the byweekday property
      if (seriesData.recurrenceRule.byweekday) {
        convertedRule.byweekday = seriesData.recurrenceRule.byweekday
      }

      // Update the recurrence rule state - ensure frequency is set to satisfy the type requirement
      recurrenceRule.value = {
        frequency: convertedRule.frequency || 'WEEKLY',
        ...convertedRule
      }
    }
  } catch (err) {
    console.error(`Error loading series data for ${seriesSlug}:`, err)
    throw err // Re-throw to allow the caller to handle the error
  } finally {
    isLoading.value = false
  }
}

interface Props { editEventSlug?: string, group?: GroupEntity }

const props = withDefaults(defineProps<Props>(), {
  editEventSlug: undefined
})

const onSubmit = async () => {
  console.log('FINAL EVENT DATA:', {
    startDate: eventData.value.startDate,
    timeZone: eventData.value.timeZone,
    currentTime: new Date().toISOString(),
    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  })

  console.log('Auth store Bluesky state:', {
    did: authStore.getBlueskyDid,
    handle: authStore.getBlueskyHandle,
    hasStore: !!authStore,
    storeState: authStore.$state
  })

  // Always remove recurrence fields from event data
  const event = {
    ...eventData.value
  }

  // Log event state before submission
  if (event.startDate) {
    console.log('Submitting event with date:', event.startDate)

    // Only apply defaults for completely new events without a specified time
    if (!props.editEventSlug && !displayedStartTime.value) {
      // For new events only, check if time is midnight and apply default if needed
      const dateObj = new Date(event.startDate)
      const hours = dateObj.getHours()
      const minutes = dateObj.getMinutes()

      // If time is midnight (00:00), set a reasonable default time (5:00 PM)
      if (hours === 0 && minutes === 0) {
        console.log('Time is midnight for new event, using default time (5:00 PM)')
        // Use DatetimeComponent to handle this properly
        const datePart = event.startDate.split('T')[0]
        const defaultTime = `${datePart}T17:00:00.000Z`
        event.startDate = defaultTime
      }
    }
  }

  if (eventData.value.categories) {
    event.categories = eventData.value.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  try {
    // Check if user wants to create a recurring series
    if (isRecurring.value && recurrenceRule.value.frequency) {
      // This is a series creation path
      await createEventSeries(event)
    } else {
      // This is the standard single event path
      await createOrUpdateSingleEvent(event)
    }
  } catch (err) {
    console.error('Failed to create/update event:', err)
    error('Failed to create event')
  }
}

// Function to handle creating or updating a single event
const createOrUpdateSingleEvent = async (event: EventEntity) => {
  try {
    let createdEvent

    // If updating an existing event
    if (event.slug) {
      const res = await eventsApi.update(event.slug, event)
      createdEvent = res.data

      // Ensure the status is preserved for correct navigation
      if (event.status && (!createdEvent.status || createdEvent.status !== event.status)) {
        console.log('Status missing in API response, adding from request:', event.status)
        createdEvent.status = event.status
      }

      emit('updated', createdEvent)
      success('Event updated successfully')
      analyticsService.trackEvent('event_updated', {
        event_id: createdEvent.id,
        name: createdEvent.name
      })
    } else {
      // Creating a new event
      // Add Bluesky source info if user has Bluesky connected
      addBlueskySourceInfo(event)

      // Create event in our system
      const res = await eventsApi.create(event)
      createdEvent = res.data

      // Ensure the status is preserved for correct navigation
      if (event.status && (!createdEvent.status || createdEvent.status !== event.status)) {
        console.log('Status missing in API response, adding from request:', event.status)
        createdEvent.status = event.status
      }

      console.log('Created event response:', createdEvent)
      emit('created', createdEvent)
      success('Event created successfully')
      analyticsService.trackEvent('event_created', {
        event_id: createdEvent.id,
        name: createdEvent.name,
        source: event.sourceType || 'web'
      })
    }
  } catch (err) {
    console.error('Failed to create/update single event:', err)
    error('Failed to create/update event')
    throw err
  }
}

// Function to handle creating a recurring event series
const createEventSeries = async (event: EventEntity) => {
  try {
    // Debug log to see what's in the event object
    console.log('Event data being used for series template:', JSON.stringify(event, null, 2))

    // Make sure recurrenceRule has the required frequency property
    if (!recurrenceRule.value.frequency) {
      recurrenceRule.value.frequency = 'WEEKLY'
    }

    // Debug log the recurrenceRule before conversion
    console.log('Event series recurrence rule before conversion:', JSON.stringify(recurrenceRule.value))

    // Convert frontend RecurrenceRule to backend RecurrenceRuleDto format
    const mappedRule = toBackendRecurrenceRule(recurrenceRule.value)

    // Debug log the mapped rule
    console.log('Mapped recurrence rule for series API:', JSON.stringify(mappedRule))

    // Add Bluesky info to event data
    addBlueskySourceInfo(event)

    let templateEvent

    // Check if this event is already part of a series to prevent duplicate creation
    if (event.seriesSlug) {
      console.log(`Event is already part of series ${event.seriesSlug}. Skipping series creation.`)
      // Just update the existing event and return
      const updateResponse = await eventsApi.update(event.slug, event)
      emit('updated', updateResponse.data)
      success('Event updated successfully')
      return
    }

    // When converting an existing event to a recurring event:
    // 1. If event.slug exists, we're in edit mode and should UPDATE the existing event
    //    instead of creating a new one to prevent duplicate events
    // 2. Only create a new event when we're not in edit mode (new event creation)
    if (event.slug) {
      // Update the existing event first
      const updateResponse = await eventsApi.update(event.slug, event)
      templateEvent = updateResponse.data
      console.log('Updated existing event to use as template:', templateEvent)
    } else {
      // Create a new template event
      const eventResponse = await eventsApi.create(event)
      templateEvent = eventResponse.data
      console.log('Created template event:', templateEvent)
    }

    // Create the series from the template
    const seriesCreationData = {
      recurrenceRule: mappedRule,
      timeZone: event.timeZone,
      name: seriesFormData.value.name || event.name,
      description: seriesFormData.value.description || event.description
    }

    console.log('Creating series with data:', seriesCreationData)
    const response = await eventSeriesApi.createSeriesFromEvent(templateEvent.slug, seriesCreationData)
    const createdSeries = response.data

    console.log('Created series response:', createdSeries)

    // IMPORTANT: After creating the series, fetch the template event again to get
    // the updated version with the seriesSlug set
    try {
      const refreshedEventResponse = await eventsApi.getBySlug(templateEvent.slug)
      const refreshedEvent = refreshedEventResponse.data
      console.log('Refreshed template event after series creation:', refreshedEvent)

      if (refreshedEvent && refreshedEvent.seriesSlug === createdSeries.slug) {
        console.log('Confirmed event is linked to series:', refreshedEvent.seriesSlug)
        // Use the correct emit event based on whether we're in edit mode
        if (event.slug) {
          emit('updated', refreshedEvent)
        } else {
          emit('created', refreshedEvent)
        }

        // Notify user
        success(`Event series "${createdSeries.name}" created successfully`)

        // Track analytics
        analyticsService.trackEvent('event_series_created', {
          series_id: createdSeries.id,
          name: createdSeries.name,
          source: event.sourceType || 'web'
        })

        return
      }
    } catch (refreshError) {
      console.error('Error refreshing template event:', refreshError)
      // Continue with fallback logic below if refresh fails
    }

    // Fallback to original logic if we couldn't get the refreshed event
    if (createdSeries.templateEvent && createdSeries.templateEvent.slug) {
      console.log('Using template event from series response:', createdSeries.templateEvent)
      // Use the correct emit event based on whether we're in edit mode
      if (event.slug) {
        emit('updated', createdSeries.templateEvent)
      } else {
        emit('created', createdSeries.templateEvent)
      }
    } else if (createdSeries.events && createdSeries.events.length > 0) {
      // Fallback to the first event in the events array if available
      console.log('Using first event from series response:', createdSeries.events[0])
      // Use the correct emit event based on whether we're in edit mode
      if (event.slug) {
        emit('updated', createdSeries.events[0])
      } else {
        emit('created', createdSeries.events[0])
      }
    } else {
      // Last resort, emit the series for the parent to handle
      console.log('No events found in series, emitting series-created')
      emit('series-created', createdSeries)
    }

    // Notify user
    success(`Event series "${createdSeries.name}" created successfully`)

    // Track analytics
    analyticsService.trackEvent('event_series_created', {
      series_id: createdSeries.id,
      name: createdSeries.name,
      source: event.sourceType || 'web'
    })
  } catch (err) {
    console.error('Failed to create event series:', err)
    error('Failed to create event series')
    throw err
  }
}

// Helper to add Bluesky source information
const addBlueskySourceInfo = (event: EventEntity) => {
  const blueskyDid = authStore.getBlueskyDid
  const blueskyHandle = authStore.getBlueskyHandle

  // Check that DID is not "undefined" string and handle exists
  if (blueskyHandle && blueskyDid && blueskyDid !== 'undefined') {
    console.log('Bluesky user detected, adding source info')
    event.sourceType = 'bluesky'
    event.sourceId = blueskyDid
    event.sourceData = {
      handle: blueskyHandle,
      did: blueskyDid
    }
  }
}

// Handle time info updates from the DatetimeComponent
const handleStartTimeInfo = (timeInfo: { originalHours: number, originalMinutes: number, formattedTime: string }) => {
  console.log('Received time info from DatetimeComponent:', timeInfo)

  // Store the formatted time for display - only used for UI purposes
  displayedStartTime.value = timeInfo.formattedTime

  // Trust the DatetimeComponent to handle timezone conversion correctly
  // No additional conversion or correction is needed
}

// Handle time info updates for end date
// Method to handle setting/clearing end date
const setEndDate = (checked: boolean) => {
  hasEndDate.value = checked // Directly reflect the checkbox state

  if (checked) {
    // If we are checking the box AND a start date exists,
    // always try to set/re-calculate a default end date
    if (eventData.value.startDate && eventData.value.timeZone) {
      try {
        const eventTz = eventData.value.timeZone
        const startDateUtc = new Date(eventData.value.startDate)
        const startDateInEventTz = toZonedTime(startDateUtc, eventTz)
        const endDateInEventTz = addHours(startDateInEventTz, 1)
        const endDateUtc = fromZonedTime(endDateInEventTz, eventTz)
        eventData.value.endDate = endDateUtc.toISOString()
        // eslint-disable-next-line no-console
        console.log(`[setEndDate] Defaulted/Recalculated end date: ${eventData.value.endDate}`)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[setEndDate] Error calculating default end date with timezone:', e)
        eventData.value.endDate = eventData.value.startDate
      }
    } else if (eventData.value.startDate && !eventData.value.timeZone) {
      // Fallback if timezone is somehow missing
      try {
        const startDateObj = new Date(eventData.value.startDate)
        if (!isNaN(startDateObj.getTime())) {
          startDateObj.setHours(startDateObj.getHours() + 1)
          eventData.value.endDate = startDateObj.toISOString()
          // eslint-disable-next-line no-console
          console.warn('[setEndDate] Defaulted end date (UTC based) as event timezone was missing')
        } else {
          // eslint-disable-next-line no-console
          console.warn('[setEndDate] Cannot default end date: Invalid start date')
          eventData.value.endDate = null
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[setEndDate] Error calculating default end date (UTC fallback): ', e)
        eventData.value.endDate = eventData.value.startDate
      }
    }
  } else { // If unchecked
    eventData.value.endDate = null
  }
  // eslint-disable-next-line no-console
  console.log(`[setEndDate] Checkbox to ${checked}, end date is now: ${eventData.value.endDate}`)
  // eslint-disable-next-line no-console
  console.log(`[setEndDate] Start date remains: ${eventData.value.startDate}`)
  // eslint-disable-next-line no-console
  console.log(`[setEndDate] hasEndDate ref is now: ${hasEndDate.value}`)
}

watch(() => eventData.value.endDate, (val) => {
  if (!!val !== hasEndDate.value) { // Only update if different to prevent loops
    hasEndDate.value = !!val
    // eslint-disable-next-line no-console
    console.log(`[watch eventData.endDate] hasEndDate updated to: ${hasEndDate.value}`)
  }
})

const handleEndTimeInfo = (timeInfo: { originalHours: number, originalMinutes: number, formattedTime: string }) => {
  console.log('Received end time info from DatetimeComponent:', timeInfo)

  // Store the formatted time for display - only used for UI purposes
  displayedEndTime.value = timeInfo.formattedTime

  // Trust the DatetimeComponent to handle timezone conversion correctly
  // No additional conversion or correction is needed
}

// This function is intentionally removed as it's no longer used
// The DatetimeComponent now handles all timezone conversions correctly

const updateStartDate = (newStartDate: string) => {
  // Simply use the date as provided - trust DatetimeComponent's handling
  eventData.value.startDate = newStartDate

  console.log('Start date updated:', eventData.value.startDate)
}

// Handle updates to the recurrence rule from the RecurrenceComponent
const handleRecurrenceRuleUpdate = (newRule: RecurrenceRule) => {
  console.log('Recurrence rule updated:', newRule)

  // If this is a series event, we may want to warn the user about changes
  if (eventData.value.seriesSlug) {
    console.log('Series event recurrence rule updated, will affect future occurrences')
  }
}

// Ensure date input is blurred before enabling recurrence
const onRecurrenceToggleClick = async () => {
  // Try to blur the date input if it exists
  await nextTick()
  const dateInputComponent = startDateInputRef.value
  if (dateInputComponent && dateInputComponent.$el) {
    // Find the actual input element inside the DatetimeComponent
    const input = dateInputComponent.$el.querySelector('[data-cy="datetime-component-date-input"]')
    if (input && typeof input.blur === 'function') {
      input.blur()
    }
  }
}

const startDateInputRef = ref()

/**
 * @testing
 * - Set `eventData.startDate` and `eventData.timeZone` directly in tests.
 * - Call `setEndDate(true)` to simulate enabling the end date.
 * - Use data-cy selectors for all user-facing inputs.
 */
defineExpose({
  eventData,
  setEndDate
  // Add more helpers as needed
})
</script>

<style scoped lang="scss">
.c-event-form-basic-component {
  max-width: 900px;
}

.markdown-preview {
  min-height: 100px;
  max-height: 400px;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.02);
}

.description-preview {
  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}

.recurrence-container {
  background-color: rgba(0, 0, 0, 0.03);

  :deep(.q-dark) &, .body--dark & {
    background-color: rgba(255, 255, 255, 0.07);
  }

  :deep(.q-field__native), :deep(.q-field__prefix), :deep(.q-field__suffix), :deep(.q-field__input) {
    color: inherit;
  }
}

.recurrence-info {
  background-color: rgba(0, 100, 255, 0.08);

  :deep(.q-dark) &, .body--dark & {
    background-color: rgba(0, 100, 255, 0.15);
    color: white;
  }
}
</style>
