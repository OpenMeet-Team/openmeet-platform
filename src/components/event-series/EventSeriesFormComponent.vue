<template>
  <div class="c-event-series-form-component">
    <SpinnerComponent v-if="isLoading" class="c-event-series-form-component" />
    <q-form data-cy="event-series-form" ref="formRef" @submit="onSubmit" class="q-gutter-md" v-if="!isLoading">

      <!-- Basic Information Card -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_event_repeat" class="q-mr-sm" />
            Event Series Information
          </div>

          <!-- Series Name -->
          <q-input
            data-cy="series-name-input"
            v-model="seriesData.name"
            label="Series Title"
            filled
            maxlength="80"
            counter
            :rules="[(val) => !!val || 'Title is required']"
            class="q-mb-md"
          />

          <!-- Series Description -->
          <q-input
            data-cy="series-description-input"
            v-model="seriesData.description"
            label="Series Description"
            filled
            type="textarea"
            autogrow
            class="q-mb-md"
          />

          <!-- Event Group -->
          <div v-if="groupsOptions && groupsOptions.length" class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Group Association</div>
            <q-select
              data-cy="series-group"
              v-model="seriesData.groupId"
              :options="groupsOptions"
              filled
              option-value="id"
              option-label="name"
              map-options
              emit-value
              clearable
              label="Group"
            />
          </div>

          <!-- Series Timezone -->
          <q-select
            data-cy="series-timezone"
            v-model="seriesData.timeZone"
            :options="timezoneOptions"
            filled
            label="Series Timezone"
            use-input
            hide-selected
            fill-input
            input-debounce="300"
            @filter="filterTimezones"
            class="q-mb-md"
          />
        </q-card-section>
      </q-card>

      <!-- Recurrence Card -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_repeat" class="q-mr-sm" />
            Recurrence Pattern
          </div>

          <!-- Reuse the existing RecurrenceComponent -->
          <RecurrenceComponent
            v-model="recurrenceRule"
            :is-recurring="true"
            v-model:time-zone="seriesData.timeZone"
            :start-date="templateEvent.startDate"
            :hide-toggle="true"
          />
        </q-card-section>
      </q-card>

      <!-- Template Event Card -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_event" class="q-mr-sm" />
            Template Event Properties
          </div>

          <!-- Event Start Date -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Date and Time</div>
            <!-- Reuse the DatetimeComponent -->
            <DatetimeComponent
              data-cy="template-start-date"
              required
              label="Starting date and time"
              v-model="templateEvent.startDate"
              :timeZone="seriesData.timeZone"
              @update:timeZone="seriesData.timeZone = $event"
              reactive-rules
              :rules="[(val) => !!val || 'Date is required']"
            />

            <!-- Event End Date -->
            <template v-if="templateEvent.startDate">
              <q-checkbox
                data-cy="template-set-end-time"
                class="q-mt-md"
                :model-value="!!templateEvent.endDate"
                @update:model-value="templateEvent.endDate = $event ? new Date(new Date(templateEvent.startDate).getTime() + 3600000).toISOString() : ''"
                label="Set an end time..."
              />

              <DatetimeComponent
                data-cy="template-end-date"
                v-if="templateEvent.endDate"
                label="Ending date and time"
                v-model="templateEvent.endDate"
                :timeZone="seriesData.timeZone"
                @update:timeZone="seriesData.timeZone = $event"
                reactive-rules
                :rules="[(val) => !!val || 'Date is required']"
              />
            </template>
          </div>

          <!-- Event Type -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Event Type</div>
            <q-option-group
              data-cy="event-type"
              v-model="templateEvent.type"
              :options="eventTypeOptions"
              color="primary"
              type="radio"
            />
          </div>

          <!-- Location -->
          <div class="q-mb-md" v-if="templateEvent.type !== 'online'">
            <div class="text-subtitle2 q-mb-sm">Location</div>
            <q-input
              data-cy="event-location"
              v-model="templateEvent.location"
              filled
              label="Physical location"
              :rules="[
                val => (templateEvent.type !== 'in-person' && templateEvent.type !== 'hybrid') ||
                !!val || 'Location is required for in-person events'
              ]"
            />
          </div>

          <!-- Online Location -->
          <div class="q-mb-md" v-if="templateEvent.type !== 'in-person'">
            <div class="text-subtitle2 q-mb-sm">Online Location</div>
            <q-input
              data-cy="event-location-online"
              v-model="templateEvent.locationOnline"
              filled
              label="Online meeting link"
              :rules="[
                val => (templateEvent.type !== 'online' && templateEvent.type !== 'hybrid') ||
                !!val || 'Online location is required for online events'
              ]"
            />
          </div>

          <!-- Max Attendees -->
          <div class="q-mb-md">
            <div class="text-subtitle2 q-mb-sm">Capacity & Registration</div>
            <q-input
              data-cy="event-max-attendees"
              v-model.number="templateEvent.maxAttendees"
              type="number"
              filled
              label="Maximum attendees (0 for unlimited)"
              min="0"
            />
          </div>

          <!-- Approval Settings -->
          <div class="q-mb-md">
            <q-checkbox
              data-cy="event-require-approval"
              v-model="templateEvent.requireApproval"
              label="Require approval for attendees"
            />

            <q-input
              v-if="templateEvent.requireApproval"
              data-cy="event-approval-question"
              v-model="templateEvent.approvalQuestion"
              filled
              label="Question for attendees"
              placeholder="Why do you want to attend this event?"
              class="q-mt-sm"
            />
          </div>

          <!-- Waitlist -->
          <div class="q-mb-md">
            <q-checkbox
              data-cy="event-allow-waitlist"
              v-model="templateEvent.allowWaitlist"
              label="Allow waitlist when event is full"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Submit Button -->
      <div class="row justify-end">
        <q-btn data-cy="event-series-submit" type="submit" color="primary" label="Create Event Series" />
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EventSeriesService } from '../../services/eventSeriesService'
import { RecurrenceService } from '../../services/recurrenceService'
import { CreateEventSeriesDto } from '../../api/event-series'
import { EventType } from '../../types'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import DatetimeComponent from '../common/DatetimeComponent.vue'
import RecurrenceComponent from '../event/RecurrenceComponent.vue'
import { useQuasar } from 'quasar'
import { toBackendRecurrenceRule } from '../../utils/recurrenceUtils'

const $q = useQuasar()
const formRef = ref(null)
const isLoading = ref(false)

// Event Series data
const seriesData = ref({
  name: '',
  description: '',
  timeZone: RecurrenceService.getUserTimezone(),
  groupId: null
})

// Recurrence Rule
const recurrenceRule = ref({
  frequency: 'WEEKLY',
  interval: 1,
  count: 10,
  byweekday: undefined,
  bymonth: undefined,
  bymonthday: undefined,
  until: undefined
})

// Template Event
const templateEvent = ref({
  startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  endDate: '',
  type: EventType.InPerson,
  location: '',
  locationOnline: '',
  maxAttendees: 0,
  requireApproval: false,
  approvalQuestion: '',
  allowWaitlist: false,
  categories: []
})

// Event Type Options
const eventTypeOptions = [
  { label: 'In Person', value: EventType.InPerson },
  { label: 'Online', value: EventType.Online },
  { label: 'Hybrid', value: EventType.Hybrid }
]

// Mock groups - in a real app, this would come from a store or API
const groupsOptions = ref([
  { id: 1, name: 'Group 1' },
  { id: 2, name: 'Group 2' }
])

// Timezone options
const timezoneOptions = ref(RecurrenceService.getTimezones())
const filterTimezones = (val: string, update: (callback: () => void) => void) => {
  if (val === '') {
    update(() => {
      timezoneOptions.value = RecurrenceService.getTimezones()
    })
    return
  }

  update(() => {
    timezoneOptions.value = RecurrenceService.searchTimezones(val)
  })
}

const onSubmit = async () => {
  try {
    isLoading.value = true

    // Convert frontend RecurrenceRule to backend format
    const mappedRecurrenceRule = toBackendRecurrenceRule(recurrenceRule.value)

    console.log('Mapped recurrence rule:', mappedRecurrenceRule)

    // Build the event series data
    const eventSeriesData: CreateEventSeriesDto = {
      name: seriesData.value.name,
      description: seriesData.value.description,
      timeZone: seriesData.value.timeZone,
      recurrenceRule: mappedRecurrenceRule,
      templateEvent: {
        startDate: templateEvent.value.startDate,
        endDate: templateEvent.value.endDate || undefined,
        type: templateEvent.value.type,
        location: templateEvent.value.location,
        locationOnline: templateEvent.value.locationOnline,
        maxAttendees: templateEvent.value.maxAttendees,
        requireApproval: templateEvent.value.requireApproval,
        approvalQuestion: templateEvent.value.approvalQuestion,
        allowWaitlist: templateEvent.value.allowWaitlist,
        categories: templateEvent.value.categories
      }
    }

    // Add group ID if selected
    if (seriesData.value.groupId) {
      eventSeriesData.groupId = seriesData.value.groupId
    }

    // Create the event series
    const result = await EventSeriesService.create(eventSeriesData)

    // Show success notification
    $q.notify({
      type: 'positive',
      message: `Event series "${result.name}" created successfully!`
    })

    // Reset form
    if (formRef.value) {
      // @ts-expect-error formRef.value.reset() exists but TypeScript doesn't know about it
      formRef.value.reset()
    }
  } catch (error) {
    console.error('Error creating event series:', error)
    $q.notify({
      type: 'negative',
      message: `Failed to create event series: ${error.message || 'Unknown error'}`
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.c-event-series-form-component {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}
</style>
