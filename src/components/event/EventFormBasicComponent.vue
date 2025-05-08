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
                v-model="eventData.startDate" :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
                @update:time-info="handleStartTimeInfo"
                reactive-rules :rules="[(val: string) => !!val || 'Date is required']" />
            </div>

            <!-- Event End Date -->
            <template v-if="eventData.startDate">
              <q-checkbox data-cy="event-set-end-time" class="q-mt-md" :model-value="!!eventData.endDate"
                @update:model-value="eventData.endDate = $event ? eventData.startDate : null" label="Set an end time..." />

              <div v-if="eventData.endDate">
                <DatetimeComponent data-cy="event-end-date" label="Ending date and time"
                  v-model="eventData.endDate" :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
                  @update:time-info="handleEndTimeInfo"
                  reactive-rules :rules="[(val: string) => !!val || 'Date is required']">
                  <template v-slot:hint>
                    <div class="text-bold">
                      {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
                    </div>
                  </template>
                </DatetimeComponent>

                <!-- End time confirmation display -->
                <div class="text-caption q-mt-xs">
                  <q-icon name="sym_r_schedule" size="xs" class="q-mr-xs" color="primary" />
                  <strong>End time:</strong> {{ displayedEndTime || formatEventTime(eventData.endDate) }}
                </div>
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
                  <div class="text-body2 q-mb-md q-pa-sm rounded-borders recurrence-info">
                    <q-icon name="sym_r_info" class="q-mr-xs" color="info" />
                    This will create an event series. All occurrences will share the same basic information.
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
                  />

                  <!-- Recurrence Pattern -->
                  <RecurrenceComponent
                    v-model="recurrenceRule"
                    :is-recurring="true"
                    v-model:time-zone="eventData.timeZone"
                    :start-date="eventData.startDate"
                    :hide-toggle="true"
                    @update:start-date="updateStartDate"
                  />
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
import { onMounted, ref, watch } from 'vue'
import { formatInTimeZone } from 'date-fns-tz'
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

// Now that all reactive variables are initialized, set up watchers
// Watch for changes in the eventData to update isRecurring state
watch(() => eventData.value, (newEventData) => {
  // If event has a seriesSlug, it's already part of a recurring series
  if (newEventData.seriesSlug) {
    isRecurring.value = true
    console.log('Event is part of series, enabling recurring mode:', newEventData.seriesSlug)
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

  // CRITICAL FIX: Ensure we have a proper time in the event (not 00:00)
  if (event.startDate) {
    console.log('Checking event time before submission:', event.startDate)

    // If we have an explicitly set time from the user (via time picker), use that
    if (displayedStartTime.value) {
      console.log('Using user-selected time:', displayedStartTime.value)

      // Parse the displayed time to get hours and minutes
      // This is the time the user explicitly selected
      const timeRegex = /(\d{1,2}):(\d{2})\s*([AP]M)/i
      const match = displayedStartTime.value.match(timeRegex)

      if (match) {
        let hours = parseInt(match[1], 10)
        const minutes = parseInt(match[2], 10)
        const period = match[3].toUpperCase()

        // Convert to 24-hour time
        if (period === 'PM' && hours < 12) hours += 12
        if (period === 'AM' && hours === 12) hours = 0

        // ALWAYS force the correct time from what the user selected
        // Ignore any time that might currently be in the event object
        console.log(`CRITICAL: Forcing selected time: ${hours}:${minutes} ${period}`)

        // Get the date components only
        const dateOnly = event.startDate.split('T')[0]

        // Build a full datetime string from the date and selected time
        const localTimeStr = `${dateOnly}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
        console.log('Local time string:', localTimeStr)

        // IMPORTANT FIX: Properly convert to UTC regardless of timezone
        // Format with timezone offset so we know exactly what timezone we're dealing with
        const timezonedString = formatInTimeZone(
          new Date(localTimeStr),
          event.timeZone,
          "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
        )
        console.log('Formatted with timezone offset:', timezonedString)

        // When we parse this string, JavaScript automatically converts to UTC
        const utcDate = new Date(timezonedString)
        console.log('Converted to proper UTC time:', utcDate.toISOString())

        // Additional debug information about timezones
        console.log('Timezone detailed info:', {
          inputTime: `${hours}:${minutes}`,
          inputDate: dateOnly,
          localTimeStr,
          selectedTimezone: event.timeZone,
          browserTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timezonedString,
          utcISOString: utcDate.toISOString(),
          utcHours: utcDate.getUTCHours(),
          utcMinutes: utcDate.getUTCMinutes()
        })

        // Store the properly converted UTC time as ISO string
        event.startDate = utcDate.toISOString()
        console.log('Enforced exact user-selected time with timezone conversion:', event.startDate)

        // Store original time values for debugging
        console.log('Original time values:', { hours, minutes })
      }
    } else { // If we don't have a user-selected time, use the time from the existing event
      // Important: When editing an existing event, preserve its original time
      // unless explicitly changed by the user.
      console.log('No user-selected time, preserving existing event time:', event.startDate)

      // We only need to check for midnight (00:00) in new events
      if (!props.editEventSlug) {
        // For new events only, check if time is midnight and apply default if needed
        const dateObj = new Date(event.startDate)
        const hours = dateObj.getHours()
        const minutes = dateObj.getMinutes()

        // If time is midnight (00:00), set a reasonable default time (5:00 PM)
        if (hours === 0 && minutes === 0) {
          console.log('Time is midnight for new event, applying default time (5:00 PM)')

          // Get date components only
          const dateOnly = event.startDate.split('T')[0]

          // Use date with a 5:00 PM default time
          const startTime = '17:00:00' // 5:00 PM

          // Create the combined date-time string
          const localTimeStr = `${dateOnly}T${startTime}`
          console.log('Setting default time to 5:00 PM:', localTimeStr)

          // Convert from local timezone to the event's timezone, then to UTC
          // First create a date in the local timezone
          const localDate = new Date(localTimeStr)
          console.log('Local date before conversion:', localDate.toISOString())

          // Format this date as if it were in the event's timezone with offset
          // This gives us a string like "2025-06-02T17:00:00-10:00" for Honolulu
          const timezonedString = formatInTimeZone(
            localDate,
            event.timeZone,
            "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives you timezone offset
          )
          console.log('Formatted with timezone offset:', timezonedString)

          // When we parse this string, JavaScript automatically converts to UTC
          const utcDate = new Date(timezonedString)
          console.log('Converted to UTC:', utcDate.toISOString())

          // Store the proper UTC time
          event.startDate = utcDate.toISOString()

          console.log('Start time with timezone conversion:', event.startDate)
          console.log('Fixed new event time with timezone awareness:', event.startDate)

          // Also fix end date if it exists
          if (event.endDate) {
            // If we have a user-selected end time, use that
            if (displayedEndTime.value) {
              // Parse the displayed end time to get hours and minutes
              const endTimeRegex = /(\d{1,2}):(\d{2})\s*([AP]M)/i
              const endMatch = displayedEndTime.value.match(endTimeRegex)

              if (endMatch) {
                let endHours = parseInt(endMatch[1], 10)
                const endMinutes = parseInt(endMatch[2], 10)
                const endPeriod = endMatch[3].toUpperCase()

                // Convert to 24-hour time
                if (endPeriod === 'PM' && endHours < 12) endHours += 12
                if (endPeriod === 'AM' && endHours === 12) endHours = 0

                // FIXED TIMEZONE CONVERSION - same fix as for start date
                const endDateOnly = event.endDate.split('T')[0]
                const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`

                // Convert from local timezone to the event's timezone, then to UTC
                // First create a date in the local timezone
                const endLocalDate = new Date(`${endDateOnly}T${endTime}:00`)
                console.log('Local end date before conversion:', endLocalDate.toISOString())

                // Format this date as if it were in the event's timezone with offset
                const endTimezonedDateString = formatInTimeZone(
                  endLocalDate,
                  event.timeZone,
                  "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives you timezone offset
                )
                console.log('End time formatted with timezone offset:', endTimezonedDateString)

                // When we parse this string, JavaScript automatically converts to UTC
                const endUtcDate = new Date(endTimezonedDateString)
                console.log('End time converted to UTC:', endUtcDate.toISOString())
                console.log('UTC hours in end time:', endUtcDate.getUTCHours())

                event.endDate = endUtcDate.toISOString()
                console.log('Enforced user-selected end time with timezone awareness:', event.endDate)

                // Store original end time values for debugging
                console.log('Original end time values:', { endHours, endMinutes })
              } else {
                // Use end date with a 6:00 PM default time
                const endDateOnly = event.endDate.split('T')[0]
                const endTime = '18:00:00' // 6:00 PM

                // Create the combined date-time string
                const endLocalTimeStr = `${endDateOnly}T${endTime}`
                console.log('Setting default end time to 6:00 PM:', endLocalTimeStr)

                // Convert to the selected timezone using date-fns-tz
                const endTimezonedString = formatInTimeZone(
                  new Date(endLocalTimeStr),
                  event.timeZone,
                  "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives you timezone offset
                )

                // Parse back to get proper UTC time
                const endUtcDate = new Date(endTimezonedString)
                event.endDate = endUtcDate.toISOString()

                console.log('End time with timezone conversion:', event.endDate)
                console.log('Fixed end time to default with timezone awareness:', event.endDate)
              }
            } else {
              // Default end time for events without a selected end time
              const endDateOnly = event.endDate.split('T')[0]
              const endTime = '18:00:00' // 6:00 PM

              // Create the combined date-time string
              const endLocalTimeStr = `${endDateOnly}T${endTime}`
              console.log('Setting default end time to 6:00 PM:', endLocalTimeStr)

              // Convert from local timezone to the event's timezone, then to UTC
              // First create a date in the local timezone
              const endLocalDate = new Date(endLocalTimeStr)
              console.log('Local end date before conversion:', endLocalDate.toISOString())

              // Format this date as if it were in the event's timezone with offset
              const endTimezonedString = formatInTimeZone(
                endLocalDate,
                event.timeZone,
                "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives you timezone offset
              )
              console.log('End time formatted with timezone offset:', endTimezonedString)

              // When we parse this string, JavaScript automatically converts to UTC
              const endUtcDate = new Date(endTimezonedString)
              console.log('End time converted to UTC:', endUtcDate.toISOString())

              // Store the proper UTC time
              event.endDate = endUtcDate.toISOString()

              console.log('End time with timezone conversion:', event.endDate)
              console.log('Fixed end time to default with timezone awareness:', event.endDate)
            }
          }
        }
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

// Helper function to format time in a user-friendly way
const formatEventTime = (isoString: string): string => {
  if (!isoString) return ''

  try {
    const date = new Date(isoString)
    // Check if time is midnight
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      return '5:00 PM (default time)'
    }

    // Format time as 12-hour clock with AM/PM
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch (e) {
    console.error('Error formatting time:', e)
    return '5:00 PM (default time)'
  }
}

// Store the displayed start and end times
const displayedStartTime = ref<string>('')
const displayedEndTime = ref<string>('')

// Handle time info updates from the DatetimeComponent
const handleStartTimeInfo = (timeInfo: { originalHours: number, originalMinutes: number, formattedTime: string }) => {
  console.log('Received time info from DatetimeComponent:', timeInfo)

  // Store the formatted time for display
  displayedStartTime.value = timeInfo.formattedTime

  // If we have specific time parts, ensure event data has the correct time
  if (timeInfo.originalHours !== undefined && timeInfo.originalMinutes !== undefined) {
    // Immediately update event data with the correct time
    setExplicitEventTime(timeInfo.originalHours, timeInfo.originalMinutes)

    // CRITICAL: Force the correct time into the eventData object with proper timezone conversion
    const fixEventTime = () => {
      if (eventData.value.startDate) {
        // Get the date part of the ISO string
        const datePart = eventData.value.startDate.split('T')[0]
        // Create a local time string with the explicit time
        const localTimeStr = `${datePart}T${timeInfo.originalHours.toString().padStart(2, '0')}:${timeInfo.originalMinutes.toString().padStart(2, '0')}:00`

        // Properly convert to UTC with timezone
        const timezonedString = formatInTimeZone(
          new Date(localTimeStr),
          eventData.value.timeZone || 'UTC',
          "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
        )

        // Convert to proper UTC time
        const utcDate = new Date(timezonedString)
        const correctTimeISO = utcDate.toISOString()

        // Only update if the time is different
        if (eventData.value.startDate !== correctTimeISO) {
          console.log('Correcting event time to match user selection:', correctTimeISO)
          eventData.value.startDate = correctTimeISO
        }
      }
    }

    // Apply correction immediately and after a short delay to catch any overrides
    fixEventTime()
    setTimeout(fixEventTime, 50)
  }
}

// Handle time info updates for end date
const handleEndTimeInfo = (timeInfo: { originalHours: number, originalMinutes: number, formattedTime: string }) => {
  console.log('Received end time info from DatetimeComponent:', timeInfo)

  // Store the formatted time for display
  displayedEndTime.value = timeInfo.formattedTime

  // If we have specific time parts, ensure event data has the correct time
  if (timeInfo.originalHours !== undefined && timeInfo.originalMinutes !== undefined) {
    // For end time, we use the exact time provided
    if (eventData.value.endDate) {
      // Set end time explicitly with proper timezone conversion
      const datePart = eventData.value.endDate.split('T')[0]
      // Create a local time string with the explicit time
      const localTimeStr = `${datePart}T${timeInfo.originalHours.toString().padStart(2, '0')}:${timeInfo.originalMinutes.toString().padStart(2, '0')}:00`

      // Properly convert to UTC with timezone
      const timezonedString = formatInTimeZone(
        new Date(localTimeStr),
        eventData.value.timeZone || 'UTC',
        "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
      )

      // Convert to proper UTC time
      const utcDate = new Date(timezonedString)
      const correctTimeISO = utcDate.toISOString()

      // Only update if different
      if (eventData.value.endDate !== correctTimeISO) {
        console.log('End time explicitly set to:', `${timeInfo.originalHours}:${timeInfo.originalMinutes}`, correctTimeISO)
        eventData.value.endDate = correctTimeISO
      }

      // CRITICAL: Create a function to ensure the end time is preserved with proper timezone conversion
      const fixEndTime = () => {
        if (eventData.value.endDate) {
          const datePart = eventData.value.endDate.split('T')[0]
          // Create a local time string with the explicit time
          const localTimeStr = `${datePart}T${timeInfo.originalHours.toString().padStart(2, '0')}:${timeInfo.originalMinutes.toString().padStart(2, '0')}:00`

          // Properly convert to UTC with timezone
          const timezonedString = formatInTimeZone(
            new Date(localTimeStr),
            eventData.value.timeZone || 'UTC',
            "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
          )

          // Convert to proper UTC time
          const utcDate = new Date(timezonedString)
          const correctTimeISO = utcDate.toISOString()

          if (eventData.value.endDate !== correctTimeISO) {
            console.log('Correcting end time to match user selection:', correctTimeISO)
            eventData.value.endDate = correctTimeISO
          }
        }
      }

      // Apply correction immediately and after a short delay to catch any overrides
      fixEndTime()
      setTimeout(fixEndTime, 50)
    }
  }
}

// Sets a specific time for the event with proper timezone conversion
const setExplicitEventTime = (hours: number, minutes: number) => {
  if (eventData.value.startDate) {
    const datePart = eventData.value.startDate.split('T')[0]
    // Build local time string
    const localTimeStr = `${datePart}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`

    // CRITICAL: Properly convert to UTC with timezone
    const timezonedString = formatInTimeZone(
      new Date(localTimeStr),
      eventData.value.timeZone || 'UTC',
      "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
    )

    // Convert to proper UTC time
    const utcDate = new Date(timezonedString)
    eventData.value.startDate = utcDate.toISOString()

    console.log('Start time explicitly set to:', `${hours}:${minutes}`, eventData.value.startDate)
  }

  // Also update end time if it exists
  if (eventData.value.endDate) {
    const endDatePart = eventData.value.endDate.split('T')[0]
    const endHours = (hours + 1) % 24 // Default end time is start time + 1 hour

    // Build local time string for end time
    const localEndTimeStr = `${endDatePart}T${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`

    // Properly convert end time to UTC with timezone
    const endTimezonedString = formatInTimeZone(
      new Date(localEndTimeStr),
      eventData.value.timeZone || 'UTC',
      "yyyy-MM-dd'T'HH:mm:ssxxx"
    )

    // Convert to proper UTC time
    const utcEndDate = new Date(endTimezonedString)
    eventData.value.endDate = utcEndDate.toISOString()

    console.log('End time explicitly set to:', `${endHours}:${minutes}`, eventData.value.endDate)
  }
}

const updateStartDate = (newStartDate: string) => {
  // First store the direct value as we need it for parsing
  const tempStartDate = newStartDate

  // Extract the time from the new start date
  const date = new Date(tempStartDate)
  const hours = date.getHours()
  const minutes = date.getMinutes()

  // Get the date part for timezone conversion
  const datePart = tempStartDate.split('T')[0]

  // Create a time string for conversion
  let timeHours = hours
  let timeMinutes = minutes

  // If time is midnight, set a default time (5:00 PM)
  if (hours === 0 && minutes === 0) {
    timeHours = 17 // 5:00 PM
    timeMinutes = 0
  }

  // Build local time string
  const localTimeStr = `${datePart}T${timeHours.toString().padStart(2, '0')}:${timeMinutes.toString().padStart(2, '0')}:00`

  // Properly convert to UTC with timezone
  const timezonedString = formatInTimeZone(
    new Date(localTimeStr),
    eventData.value.timeZone || 'UTC',
    "yyyy-MM-dd'T'HH:mm:ssxxx" // 'xxx' gives timezone offset
  )

  // Convert to proper UTC time
  const utcDate = new Date(timezonedString)
  eventData.value.startDate = utcDate.toISOString()

  console.log('Start date updated with timezone conversion:', {
    original: tempStartDate,
    localTimeStr,
    timezonedString,
    utcResult: eventData.value.startDate
  })
}
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
