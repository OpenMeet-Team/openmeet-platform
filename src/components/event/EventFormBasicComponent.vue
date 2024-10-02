<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      v-model="eventData.title"
      label="Event Title"
      filled
      :rules="[val => !!val || 'Title is required']"
    />

    <div class="row">
      <div class="row q-gutter-md items-center">
        <q-input
          v-model="eventData.startDate"
          filled
          label="Start Date"
          :rules="[val => !!val || 'Date is required']"
          type="date"
        />
        <q-input
          v-model="eventData.startTime"
          filled
          label="Start Time"
          :rules="[val => !!val || 'Time is required']"
          type="time"
        >
          <template v-slot:after>
            {{ Intl.DateTimeFormat().resolvedOptions().timeZone }}
          </template>
        </q-input>
      </div>
      <q-space/>
      <!--      <div class="row q-gutter-md">-->
      <!--        <q-input-->
      <!--          v-model="eventData.endDate"-->
      <!--          filled-->
      <!--          label="End Date"-->
      <!--          type="date"-->
      <!--        />-->
      <!--        <q-input-->
      <!--          v-model="eventData.endTime"-->
      <!--          filled-->
      <!--          label="End Time"-->
      <!--          type="time"-->
      <!--        />-->
      <!--      </div>-->
    </div>

    <div class="row q-gutter-md">
      <q-file
        filled
        :model-value="null"
        label="Event image"
        accept="image/*"
        @update:model-value="onEventImageSelect"
      >
        <template v-slot:prepend>
          <q-icon name="sym_r_attach_file"/>
        </template>
      </q-file>

      <q-img
        v-if="eventData && eventData.image && eventData.image.path"
        :src="eventData.image.path"
        spinner-color="white"
        style="height: 140px; max-width: 150px"
      />
    </div>

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
               v-model="eventData.onlineLocation" label="Link to the event"/>
      <LocationComponent v-if="eventData.type && ['in-person', 'hybrid'].includes(eventData.type)"
                        v-model="eventData.location" label="Address or location"/>
    </div>

    <q-select
      v-model="eventData.categories"
      :options="categoryOptions"
      filled
      label="Event Category"
    />

    <q-input
      v-model.number="eventData.maxAttendees"
      label="Maximum Attendees"
      filled
      type="number"
      :rules="[
          val => val > 0 || 'Maximum attendees must be greater than 0',
          val => val <= 1000 || 'Maximum attendees cannot exceed 1000'
        ]"
    />
    <slot></slot>
  </q-form>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { apiUploadFileToS3 } from 'src/api/files.ts'
import { EventData } from 'src/types'
import LocationComponent from 'components/common/LocationComponent.vue'

const $q = useQuasar()

const onEventImageSelect = (file: File) => {
  return apiUploadFileToS3(file).then(response => {
    eventData.image = response
  }).catch(error => {
    Notify.create({
      type: 'negative',
      message: error.message
    })
  })
}

const eventData = reactive<Partial<EventData>>({
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  location: {
    name: '',
    address: '',
    city: '',
    state: '',
    country: '',
    latitude: undefined,
    longitude: undefined
  } as Location,
  maxAttendees: 50,
  categories: []
})

const categoryOptions = [
  'Conference', 'Seminar', 'Workshop', 'Networking', 'Social', 'Other'
]

const onSubmit = async () => {
  try {
    // Here you would typically make an API call to save the event
    // For this example, we'll just simulate an API call with a timeout
    await new Promise(resolve => setTimeout(resolve, 1000))

    $q.notify({
      color: 'positive',
      textColor: 'white',
      icon: 'cloud_done',
      message: 'Event created successfully'
    })

    // Reset form after successful submission
    // eventData.value = {
    //   title: '',
    //   description: '',
    //   date: '',
    //   time: '',
    //   maxAttendees: 50
    // }
  } catch (error) {
    $q.notify({
      color: 'negative',
      textColor: 'white',
      icon: 'warning',
      message: 'Failed to create event'
    })
  }
}
</script>
