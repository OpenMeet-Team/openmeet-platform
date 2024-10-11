<template>
  <q-page padding>
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Edit Group"/>

    <q-tabs align="left" model-value="" no-caps class="text-primary q-mb-md">
      <q-route-tab :to="{ name: 'DashboardGroupBasicPage', params: { id: route.params.id }}" name="basic" label="Basic settings" />
      <q-route-tab :to="{ name: 'DashboardGroupMembersPage', params: { id: route.params.id }}" name="members" label="Members settings" />
      <q-route-tab :to="{ name: 'DashboardGroupPrivacyPage', params: { id: route.params.id }}" name="privacy" label="Privacy settings" />
    </q-tabs>

    <router-view/>

  </q-page>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

const route = useRoute()

</script>
