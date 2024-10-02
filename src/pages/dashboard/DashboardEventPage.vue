<template>
  <q-page padding>
    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Create New Event</h1>
    </div>

    <EventFormComponent style="max-width: 500px">
      <q-btn label="Create Event" type="submit" color="primary"/>
    </EventFormComponent>
  </q-page>
</template>

<script setup lang="ts">
import EventFormComponent from 'components/event/EventFormBasicComponent.vue'

</script>
