<template>
  <q-form @submit="onSubmit" class="q-gutter-md">

    <q-input
      v-model="eventData.name"
      label="Event Title"
      filled
      :rules="[val => !!val || 'Title is required']"
    />

<!--    <div>-->
<!--      {{ eventData.startDate }} - {{ new Date(eventData.startDate) }} - {{ new Date(eventData.startDate) > new Date() }} <br>-->
<!--      {{ eventData.endDate }} - {{ new Date(eventData.endDate) > new Date(eventData.startDate) }} <br>-->
<!--    </div>-->

    <DatetimeComponent required label="Starting date and time" v-model="eventData.startDate" reactive-rules
                       :rules="[(val: string) => !!val || 'Date is required']"> <!-- (val: string) => (new Date(val) > new Date()) || 'Start date cannot be in the past.' -->
      <!-- Display Timezone -->
      <template v-slot:after>
        <div class="text-overline text-bold">
          {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
        </div>
      </template>
    </DatetimeComponent>
    <template v-if="eventData.startDate">
      <q-checkbox :model-value="!!eventData.endDate"
                  @update:model-value="eventData.endDate = $event ? eventData.startDate : ''"
                  label="Set en end time..."/>
      <DatetimeComponent v-if="eventData.endDate" label="Ending date and time" v-model="eventData.endDate"
                         reactive-rules
                         :rules="[(val: string) => !!val || 'Date is required']"> <!-- (val: string) => (new Date(val) > new Date(eventData.startDate)) || 'End date must be later than the start date.' -->
        <template v-slot:hint>
          <div class=" text-bold">
            {{ getHumanReadableDateDifference(eventData.startDate, eventData.endDate) }}
          </div>
        </template>
      </DatetimeComponent>
    </template>

    <UploadComponent label="Event image" @upload="onEventImageSelect"/>

    <q-img
      v-if="eventData && eventData.image"
      :src="typeof eventData.image === 'object' ? eventData.image.path : eventData.image"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

<!--    <q-input-->
<!--      v-model="eventData.description"-->
<!--      label="Event Description"-->
<!--      type="textarea"-->
<!--      filled-->
<!--      :rules="[val => !!val || 'Description is required']"-->
<!--    />-->

    <div class="text-h6 q-mt-lg">Event Description</div>
    <q-editor
      filled
      :style="Dark.isActive ? 'background-color: rgba(255, 255, 255, 0.07)' : 'background-color: rgba(0, 0, 0, 0.05)'"
      v-model="eventData.description as string"
      :dense="Screen.lt.md"
      :toolbar="[
        ['bold', 'italic'],
        ['link', 'custom_btn'],
        ['unordered', 'ordered'],
        ['undo', 'redo'],
      ]"
    />

    <div class="column q-my-xl">
      <q-select
        filled
        :rules="[val => !!val || 'Event type is required']"
        v-model="eventData.type"
        :options="[
      { label: 'Online', value: 'online' },
      { label: 'In-Person', value: 'in-person' },
      { label: 'Hybrid', value: 'hybrid' }
      ]"
        label="Event Type"
        outlined
        emit-value
      />

      <q-input v-if="eventData.type && ['online', 'hybrid'].includes(eventData.type)" filled
               v-model="eventData.locationOnline" type="url" label="Link to the event"/>
      <!--      <LocationComponent v-if="false && eventData.type && ['in-person', 'hybrid'].includes(eventData.type)"-->
      <!--                         v-model="eventData.location" label="Address or location"/>-->
      <LocationComponent2 v-if="eventData.type && ['in-person', 'hybrid'].includes(eventData.type)"
                          :model-value="eventData.location" @update:model-value="onUpdateLocation"
                          label="Address or location"/>
    </div>

    <q-select
      v-model="eventData.categories"
      :options="categoryOptions"
      filled
      label="Event Category"
    />

    <q-checkbox :model-value="!!eventData.maxAttendees" @update:model-value="eventData.maxAttendees = Number($event)"
                label="Limit number of members?"/>
    <q-input
      v-if="eventData.maxAttendees"
      v-model.number="eventData.maxAttendees"
      label="Maximum Attendees"
      filled
      type="number"
      :rules="[
          val => val > 0 || 'Maximum attendees must be greater than 0',
        ]"
    />
    <slot></slot>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { EventData, OSMLocationSuggestion, UploadedFile } from 'src/types'
// import LocationComponent from 'components/common/LocationComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import { eventsApi } from 'src/api/events.ts'
import DatetimeComponent from 'components/common/DatetimeComponent.vue'
import LocationComponent2 from 'components/common/LocationComponent2.vue'
import { categoriesApi } from 'src/api/categories.ts'
import { getHumanReadableDateDifference } from 'src/utils/dateUtils'
import { Dark, Screen } from 'quasar'

const { error } = useNotification()
const onEventImageSelect = (file: UploadedFile) => {
  eventData.value.image = file
}

const emit = defineEmits(['created', 'updated'])

const eventData = ref<EventData>({
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  id: 0,
  type: 'online',
  maxAttendees: 0,
  categories: []
})

const categoryOptions = [
  'Conference', 'Seminar', 'Workshop', 'Networking', 'Social', 'Other'
]

const onUpdateLocation = (location: OSMLocationSuggestion) => {
  eventData.value.lat = location.lat
  eventData.value.lon = location.lon
  eventData.value.location = location.display_name
}

onMounted(() => {
  // TODO fetch categories
  categoriesApi.getAll().then(res => {
    console.log(res.data)
  })
  if (props.editEventId) {
    eventsApi.getById(props.editEventId).then(res => {
      eventData.value = res.data
    })
  }
})

const props = withDefaults(defineProps<{ editEventId?: string }>(), {
  editEventId: undefined
})

const onSubmit = async () => {
  try {
    if (eventData.value.id) {
      const event = await eventsApi.update(eventData.value.id, eventData.value)
      emit('updated', event.data)
    } else {
      const event = await eventsApi.create(eventData.value)
      emit('created', event.data)
    }
  } catch (err) {
    console.log(err)
    error('Failed to create an event')
  }
}
</script>
