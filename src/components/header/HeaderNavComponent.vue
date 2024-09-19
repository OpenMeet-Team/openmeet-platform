<script setup lang="ts">

</script>

<template>
  <q-tabs>
    <q-route-tab :to="{name: 'HomePage'}">
      Home
    </q-route-tab>
    <q-route-tab :to="{name: 'EventsPage'}">
      Events
    </q-route-tab>
    <q-route-tab :to="{name: 'EventPage', params: {eventId: 'event-id'}}">
      Event
    </q-route-tab>

  </q-tabs>
</template>

<style scoped lang="scss">

</style>
