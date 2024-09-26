<script setup lang="ts">

import EventFormComponent from 'components/event/EventFormComponent.vue'
</script>

<template>
  <q-dialog>
    <q-card class="full-width q-pa-md" style="max-width: 600px">
      <q-card-section>
        <div class="text-h6">Create new Event</div>
      </q-card-section>

      <EventFormComponent/>
    </q-card>
  </q-dialog>
</template>

<style scoped lang="scss">

</style>
