<template>
  <q-page class="c-create-event-series-page q-pa-md">
    <div class="row items-center q-mb-md">
      <div class="col">
        <div class="text-h4">Create Event Series</div>
        <div class="text-subtitle1">Create a new recurring event series</div>
      </div>

      <div class="col-auto">
        <q-btn flat color="primary" icon="sym_r_arrow_back" label="Back" to="/events" />
      </div>
    </div>

    <EventSeriesFormComponent />
  </q-page>
</template>

<script setup lang="ts">
import EventSeriesFormComponent from '../components/event-series/EventSeriesFormComponent.vue'
</script>

<style scoped>
.c-create-event-series-page {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
