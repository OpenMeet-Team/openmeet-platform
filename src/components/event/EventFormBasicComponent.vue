<template>
  <SpinnerComponent v-if="isLoading" class="c-event-form-basic-component" />
  <q-form data-cy="event-form" ref="formRef" @submit="onSubmit" class="q-gutter-md" v-if="!isLoading">

    <!-- Event Name -->
    <q-input data-cy="event-name-input" v-model="eventData.name" label="Event Title" filled maxlength="80" counter
      :rules="[(val: string) => !!val || 'Title is required']" />

    <!-- Event Group -->
    <q-select data-cy="event-group" v-if="groupsOptions && groupsOptions.length" v-model="eventData.group"
      :options="groupsOptions" filled option-value="id" option-label="name" map-options emit-value clearable
      label="Group" />

    <!-- Event Start Date -->
    <DatetimeComponent data-cy="event-start-date" class="q-mt-xl" required label="Starting date and time"
      v-model="eventData.startDate" reactive-rules :rules="[(val: string) => !!val || 'Date is required']">
      <template v-slot:after>
        <div class="text-overline text-bold">
          {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
        </div>
      </template>
    </DatetimeComponent>

    <!-- Event End Date -->
    <template v-if="eventData.startDate">
      <q-checkbox data-cy="event-set-end-time" class="q-mt-none" :model-value="!!eventData.endDate"
        @update:model-value="eventData.endDate = $event ? eventData.startDate : ''" label="Set en end time..." />

      <DatetimeComponent data-cy="event-end-date" v-if="eventData.endDate" label="Ending date and time"
        v-model="eventData.endDate" reactive-rules :rules="[(val: string) => !!val || 'Date is required']">
        <!-- (val: string) => (new Date(val) > new Date(eventData.startDate)) || 'End date must be later than the start date.' -->
        <template v-slot:hint>
          <div class="text-bold">
            {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
          </div>
        </template>
      </DatetimeComponent>
    </template>

    <!-- <UploadComponent data-cy="event-image" label="Event image" :crop-options="{ autoZoom: true, aspectRatio: 16 / 9 }" @upload="onEventImageSelect" /> -->
    <UploadComponent data-cy="event-image" label="Event image" @upload="onEventImageSelect" />
    <q-img v-if="eventData && eventData.image"
      :src="typeof eventData.image === 'object' ? eventData.image.path : eventData.image" spinner-color="white"
      style="height: 140px; max-width: 150px" />

    <!-- Event Description -->
    <div class="text-body1 q-mt-md">Event Description</div>
    <q-field class="q-mb-lg q-pa-none" flat :no-error-icon="true" filled ref="description"
      v-model="eventData.description" :rules="[val => (!!val && val !== '<br>') || 'Description is required']">
      <template #control>
        <q-editor data-cy="event-description" flat class="bg-transparent full-width"
          :style="descriptionRef && descriptionRef.hasError ? 'border-color: var(--q-negative)' : ''"
          :model-value="eventData.description as string" @update:model-value="onDescriptionInput" :dense="Screen.lt.md"
          :toolbar="[
            ['bold', 'italic'],
            ['link', 'custom_btn'],
            ['unordered', 'ordered'],
            ['undo', 'redo'],
          ]" />
      </template>
    </q-field>

    <!-- Event Type -->
    <q-tabs data-cy="event-type" no-caps v-model="eventData.type" align="left" indicator-color="primary">
      <q-tab data-cy="event-type-in-person" label="In person" icon="sym_r_person_pin_circle" name="in-person" />
      <q-tab data-cy="event-type-online" label="Online" name="online" icon="sym_r_videocam" />
      <q-tab data-cy="event-type-hybrid" label="Hybrid" name="hybrid" icon="sym_r_diversity_2" />
    </q-tabs>

    <!-- Event Location Online -->
    <q-input data-cy="event-location-online" v-if="eventData.type && ['online', 'hybrid'].includes(eventData.type)"
      filled v-model="eventData.locationOnline" type="url" label="Link to the event" />

    <!-- Event Location -->
    <LocationComponent data-cy="event-location" :location="eventData.location as string" :lat="eventData.lat as number"
      :lon="eventData.lon as number" v-if="eventData.type && ['in-person', 'hybrid'].includes(eventData.type)"
      @update:model-value="onUpdateLocation" label="Address or location" />

    <!-- Event Category -->
    <q-select data-cy="event-categories" class="q-mt-xl" v-model="eventData.categories" :options="categoryOptions" filled
      multiple use-chips option-value="id" option-label="name" label="Event Category" />

    <!-- Event Visibility -->
    <q-select data-cy="event-visibility" v-model="eventData.visibility" label="Event Viewable By" option-value="value"
      option-label="label" emit-value map-options :options="[
        { label: 'The World', value: 'public' },
        { label: 'Authenticated Users', value: 'authenticated' },
        { label: 'People You Invite', value: 'private' }
      ]" filled />
    <p class="text-caption" v-if="eventData.visibility === EventVisibility.Private">
      If private, the event is hidden from search and accessible only by direct link or group members.
    </p>
    <p class="text-caption" v-if="eventData.visibility === EventVisibility.Public">
      If public, the event is visible to everyone and searchable.
    </p>
    <p class="text-caption" v-if="eventData.visibility === EventVisibility.Authenticated">
      If authenticated, the event is visible to authenticated users and searchable.
    </p>

    <div>
      <!-- Max Attendees -->
      <q-checkbox data-cy="event-max-attendees" :model-value="!!eventData.maxAttendees"
        @update:model-value="eventData.maxAttendees = Number($event)" label="Limit number of attendees?" />
      <q-input data-cy="event-max-attendees-input" v-if="eventData.maxAttendees" v-model.number="eventData.maxAttendees"
        label="Maximum Attendees" filled type="number" :rules="[
          (val: number) => val > 0 || 'Maximum attendees must be greater than 0',
        ]" />
      <!-- Event Waitlist -->
      <div>
        <q-checkbox v-if="eventData.maxAttendees" data-cy="event-waitlist" :model-value="!!eventData.allowWaitlist"
          @update:model-value="eventData.allowWaitlist = $event" label="Enable waitlist?" />
      </div>
    </div>

    <!-- Require group membership -->
    <q-checkbox v-if="eventData.group" data-cy="event-require-group-membership" :model-value="!!eventData.requireGroupMembership"
      @update:model-value="eventData.requireGroupMembership = $event" label="Require group membership?" />

    <!-- Require attendee approval -->
    <q-checkbox data-cy="event-require-approval" :model-value="!!eventData.requireApproval"
      @update:model-value="eventData.requireApproval = $event" label="Require approval for attendance?" />
    <!-- If require approval, show approval question -->
    <q-input type="textarea" counter maxlength="255" v-if="eventData.requireApproval" data-cy="event-approval-question"
      v-model="eventData.approvalQuestion" label="Approval Question" filled />

    <!-- Action buttons -->
    <div class="row justify-end q-gutter-md">
      <q-btn data-cy="event-cancel" no-caps flat label="Cancel" @click="$emit('close')" />
      <q-btn data-cy="event-save-draft" no-caps label="Save as draft"
        v-if="!eventData.status || eventData.status !== 'published'" color="secondary" @click="onSaveDraft" />
      <q-btn data-cy="event-publish" no-caps :label="eventData.id ? 'Update' : 'Publish'" color="primary"
        @click="onPublish" />
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, EventEntity, EventStatus, EventType, EventVisibility, FileEntity, GroupEntity } from 'src/types'
import LocationComponent from 'components/common/LocationComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import { eventsApi } from 'src/api/events.ts'
import DatetimeComponent from 'components/common/DatetimeComponent.vue'
import { categoriesApi } from 'src/api/categories.ts'
import { getHumanReadableDateDifference } from 'src/utils/dateUtils'
import { QField, QForm, Screen } from 'quasar'
import { groupsApi } from 'src/api/groups.ts'
import DOMPurify from 'dompurify'
import analyticsService from 'src/services/analyticsService'
import SpinnerComponent from '../common/SpinnerComponent.vue'

const { error } = useNotification()
const onEventImageSelect = (file: FileEntity) => {
  eventData.value.image = file
}

const categoryOptions = ref<CategoryEntity[]>([])
const groupsOptions = ref<GroupEntity[]>([])

const emit = defineEmits(['created', 'updated', 'close'])
const formRef = ref<QForm | null>(null)
const isLoading = ref<boolean>(false)
const descriptionRef = ref<QField | null>(null)

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
  ulid: ''
})

const onDescriptionInput = (val: string) => {
  eventData.value.description = DOMPurify.sanitize(val)
}

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

onMounted(() => {
  const promises = [
    categoriesApi.getAll().then(res => {
      categoryOptions.value = res.data
    }),
    groupsApi.getAllMe({}).then(res => {
      groupsOptions.value = res.data.data
      if (props.group) {
        eventData.value.group = res.data.data.find(group => group.id === props.group?.id)
      }
    })
  ]

  if (props.editEventUlid) {
    promises.push(
      eventsApi.edit(props.editEventUlid).then(res => {
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

interface Props { editEventUlid?: string, group?: GroupEntity }

const props = withDefaults(defineProps<Props>(), {
  editEventUlid: undefined
})

const onSubmit = async () => {
  const event = {
    ...eventData.value
  }

  if (eventData.value.categories) {
    event.categories = eventData.value.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  try {
    if (event.ulid) {
      const res = await eventsApi.update(event.ulid, event)
      emit('updated', res.data)
      analyticsService.trackEvent('event_updated', { event_id: res.data.id, name: res.data.name })
    } else {
      const res = await eventsApi.create(event)
      emit('created', res.data)
      analyticsService.trackEvent('event_created', { event_id: res.data.id, name: res.data.name })
    }
  } catch (err) {
    console.log(err)
    error('Failed to create an event')
  }
}
</script>
