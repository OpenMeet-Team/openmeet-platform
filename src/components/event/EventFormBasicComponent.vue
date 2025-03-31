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
            <DatetimeComponent data-cy="event-start-date" required label="Starting date and time"
              v-model="eventData.startDate" :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
              reactive-rules :rules="[(val: string) => !!val || 'Date is required']" />

            <!-- Event End Date -->
            <template v-if="eventData.startDate">
              <q-checkbox data-cy="event-set-end-time" class="q-mt-md" :model-value="!!eventData.endDate"
                @update:model-value="eventData.endDate = $event ? eventData.startDate : ''" label="Set an end time..." />

              <DatetimeComponent data-cy="event-end-date" v-if="eventData.endDate" label="Ending date and time"
                v-model="eventData.endDate" :timeZone="eventData.timeZone" @update:timeZone="eventData.timeZone = $event"
                reactive-rules :rules="[(val: string) => !!val || 'Date is required']">
                <template v-slot:hint>
                  <div class="text-bold">
                    {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
                  </div>
                </template>
              </DatetimeComponent>

            </template>

            <!-- Recurrence Component -->
            <RecurrenceComponent
              v-if="eventData.startDate"
              v-model="eventData.recurrenceRule"
              v-model:is-recurring="eventData.isRecurring"
              v-model:time-zone="eventData.timeZone"
              :start-date="eventData.startDate"
            />
          </div>

          <!-- Section Separator (between Recurrence and Image) -->
          <q-separator class="q-my-md" v-if="eventData.isRecurring" />

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
        <q-btn data-cy="event-publish" no-caps label="Publish" color="primary"
          @click="onPublish" />
      </div>
    </q-form>
  </div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CategoryEntity, EventEntity, EventStatus, EventType, EventVisibility, FileEntity, GroupEntity } from '../../types'
import LocationComponent from '../common/LocationComponent.vue'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../common/UploadComponent.vue'
import { eventsApi } from '../../api/events'
import DatetimeComponent from '../common/DatetimeComponent.vue'
import RecurrenceComponent from './RecurrenceComponent.vue'
import { categoriesApi } from '../../api/categories'
import { getHumanReadableDateDifference } from '../../utils/dateUtils'
import { QForm } from 'quasar'
import { groupsApi } from '../../api/groups'
// DOMPurify import removed
import analyticsService from '../../services/analyticsService'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import { useAuthStore } from '../../stores/auth-store'
import { RecurrenceService } from '../../services/recurrenceService'

const { error } = useNotification()
const onEventImageSelect = (file: FileEntity) => {
  eventData.value.image = file
}

const categoryOptions = ref<CategoryEntity[]>([])
const groupsOptions = ref<GroupEntity[]>([])

const emit = defineEmits(['created', 'updated', 'close'])
const formRef = ref<QForm | null>(null)
const isLoading = ref<boolean>(false)

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
  timeZone: RecurrenceService.getUserTimezone(),
  isRecurring: false,
  recurrenceRule: undefined,
  recurrenceExceptions: []
})

// Tab for description editor (edit/preview)
const descriptionTab = ref('edit')

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
  console.log('Auth store Bluesky state:', {
    did: authStore.getBlueskyDid,
    handle: authStore.getBlueskyHandle,
    hasStore: !!authStore,
    storeState: authStore.$state
  })

  const event = {
    ...eventData.value
  }

  if (eventData.value.categories) {
    event.categories = eventData.value.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  try {
    let createdEvent

    // If updating an existing event
    if (event.slug) {
      const res = await eventsApi.update(event.slug, event)
      createdEvent = res.data
      emit('updated', createdEvent)
      analyticsService.trackEvent('event_updated', {
        event_id: createdEvent.id,
        name: createdEvent.name
      })
    } else {
      // Creating a new event
      // If user has Bluesky connected, set source info
      const blueskyDid = authStore.getBlueskyDid
      const blueskyHandle = authStore.getBlueskyHandle

      console.log('Checking Bluesky credentials:', { blueskyDid, blueskyHandle })

      // Check that DID is not "undefined" string and handle exists
      if (blueskyHandle && blueskyDid && blueskyDid !== 'undefined') {
        console.log('Bluesky user detected:', {
          did: blueskyDid,
          handle: blueskyHandle
        })

        event.sourceType = 'bluesky'
        event.sourceId = blueskyDid
        event.sourceData = {
          handle: blueskyHandle,
          did: blueskyDid
        }
      } else {
        console.log('No valid Bluesky credentials found:', { blueskyDid, blueskyHandle })
      }

      // Create event in our system
      const res = await eventsApi.create(event)
      createdEvent = res.data
      console.log('Created event response:', createdEvent)
      emit('created', createdEvent)
      analyticsService.trackEvent('event_created', {
        event_id: createdEvent.id,
        name: createdEvent.name,
        source: event.sourceType || 'web'
      })
    }
  } catch (err) {
    console.error('Failed to create/update event:', err)
    error('Failed to create an event')
  }
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
</style>
