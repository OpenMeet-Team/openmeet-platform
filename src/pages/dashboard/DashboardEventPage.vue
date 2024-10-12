<template>
  <q-page padding>
    <div class="row q-mb-xl">
      <h1 class="text-h4 q-my-none">Edit Event</h1>
    </div>

    <q-tabs align="left" model-value="" no-caps class="text-primary q-mb-md">
      <q-route-tab :to="{ name: 'DashboardEventGeneralPage', params: { id: $route.params.id }}" name="general"
                   label="General information"/>
      <q-route-tab :to="{ name: 'DashboardEventAttendeesPage', params: { id: $route.params.id }}" name="members"
                   label="Attendees"/>
    </q-tabs>

    <router-view class="q-mt-lg"/>
  </q-page>
</template>

<script setup lang="ts">

</script>
