<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      v-model="eventData.title"
      label="Event Title"
      filled
      :rules="[val => !!val || 'Title is required']"
    />
    <q-input
      v-model="eventData.description"
      label="Event Description"
      type="textarea"
      filled
      :rules="[val => !!val || 'Description is required']"
    />
    <q-input
      v-model="eventData.date"
      label="Event Date"
      filled
      type="date"
      :rules="[val => !!val || 'Date is required']"
    />
    <q-input
      v-model="eventData.time"
      label="Event Time"
      filled
      type="time"
      :rules="[val => !!val || 'Time is required']"
    />
    <q-input
      v-model="eventData.location"
      label="Event Location"
      filled
      :rules="[val => !!val || 'Location is required']"
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

const $q = useQuasar()

interface EventData {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxAttendees: number;
}

const eventData = ref<EventData>({
  title: '',
  description: '',
  date: '',
  time: '',
  location: '',
  maxAttendees: 50
})

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
    eventData.value = {
      title: '',
      description: '',
      date: '',
      time: '',
      location: '',
      maxAttendees: 50
    }
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
