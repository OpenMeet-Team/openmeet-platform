<script setup lang="ts">

import EventFormComponent from 'components/event/EventFormBasicComponent.vue'
</script>

<template>
  <q-dialog persistent>
    <q-card class="full-width q-pa-md" style="max-width: 500px">
      <div class="row q-mb-xl">
        <h1 class="text-h4 q-my-none">Create New Event</h1>
      </div>

      <EventFormComponent>
        <div class="row justify-end q-gutter-md">
          <q-btn flat label="Cancel" v-close-popup/>
          <q-btn label="Create Event" type="submit" color="primary"/>
        </div>
      </EventFormComponent>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
