<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      v-model="eventData.title"
      label="Event Title"
      filled
      :rules="[val => !!val || 'Title is required']"
    />

    <div class="row">
      <div class="row q-gutter-md">
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
        />
      </div>
      <q-space/>
      <div class="row q-gutter-md">
        <q-input
          v-model="eventData.endDate"
          filled
          label="End Date"
          type="date"
        />
        <q-input
          v-model="eventData.endTime"
          filled
          label="End Time"
          type="time"
        />
      </div>
    </div>

    <q-file
      v-model="eventData.image"
      filled
      label="Event Image"
      accept="image/*"
    >
      <template v-slot:prepend>
        <q-icon name="sym_r_attach_file"/>
      </template>
    </q-file>

    <q-input
      v-model="eventData.description"
      label="Event Description"
      type="textarea"
      filled
      :rules="[val => !!val || 'Description is required']"
    />

    <EventFormLocationComponent
      v-model="eventData.location"
      @update:model-value="handleLocationChange"
    />

    <q-select
      v-model="eventData.category"
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
    <q-btn label="Create Event" type="submit" color="primary"/>
  </q-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'
import EventFormLocationComponent from 'components/event/EventFormLocationComponent.vue'

const $q = useQuasar()

interface EventData {
  title: string;
  startDate: string;
  startTime: string
  endDate: string;
  endTime: string
  location?: {
    type?: 'online' | 'in-person' | 'hybrid'
    physicalLocation?: string
    onlineLink?: string
  }
  category: string
  image?: File | null
  description?: string;
  date: string;
  time: string;
  maxAttendees: number;
}

const handleLocationChange = (newLocation: EventData['location']) => {
  console.log('Location changed:', newLocation)

  // You can perform additional actions here based on the new location
  // if (newLocation.type === 'online') {
  //   $q.notify({
  //     message: 'Remember to provide a valid online meeting link!',
  //     color: 'info'
  //   })
  // } else if (newLocation.type === 'in-person') {
  //   $q.notify({
  //     message: 'Make sure to specify the exact physical location.',
  //     color: 'info'
  //   })
  // } else if (newLocation.type === 'hybrid') {
  //   $q.notify({
  //     message: 'Please provide both physical and online meeting details.',
  //     color: 'info'
  //   })
  // }
}

const eventData = ref<EventData>({
  title: '',
  description: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  date: '',
  time: '',
  location: {
    type: 'in-person'
  },
  maxAttendees: 50,
  image: null,
  category: ''
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
