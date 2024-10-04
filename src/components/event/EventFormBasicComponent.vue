<template>
  <q-form @submit="onSubmit" class="q-gutter-md">

    <q-input
      v-model="eventData.name"
      label="Event Title"
      filled
      :rules="[val => !!val || 'Title is required']"
    />

    <DatetimeComponent required label="Starting date and time" v-model="eventData.startDate" :rules="[(val: string) => !!val || 'Date is required']"/>

    <UploadComponent label="Event image" @upload="onEventImageSelect"/>

    <q-img
      v-if="eventData && eventData.image"
      :src="typeof eventData.image === 'object' ? eventData.image.path : eventData.image"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

    <q-input
      v-model="eventData.description"
      label="Event Description"
      type="textarea"
      filled
      :rules="[val => !!val || 'Description is required']"
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
                         :model-value="eventData.location" @update:model-value="onUpdateLocation" label="Address or location"/>
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
import { reactive } from 'vue'
import { EventData, OSMLocationSuggestion, UploadedFile } from 'src/types'
// import LocationComponent from 'components/common/LocationComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'
import UploadComponent from 'components/common/UploadComponent.vue'
import { eventsApi } from 'src/api/events.ts'
import DatetimeComponent from 'components/common/DatetimeComponent.vue'
import LocationComponent2 from 'components/common/LocationComponent2.vue'

const { error } = useNotification()
const onEventImageSelect = (file: UploadedFile) => {
  eventData.image = file
}

const eventData = reactive<EventData>({
  name: '',
  description: '',
  startDate: '',
  id: 0,
  type: 'online',
  maxAttendees: 0,
  categories: []
})

const categoryOptions = [
  'Conference', 'Seminar', 'Workshop', 'Networking', 'Social', 'Other'
]

const onUpdateLocation = (location: OSMLocationSuggestion) => {
  eventData.lat = location.lat
  eventData.lon = location.lon
  eventData.location = location.display_name
}

const onSubmit = async () => {
  try {
    const event = await eventsApi.create(eventData)

    console.log(event)
    // success('Event created!')

    // router.push({ name: 'EventPage', params: { id: event.data.id } })
  } catch (err) {
    console.log(err)
    error('Failed to create an event')
  }
}
</script>
