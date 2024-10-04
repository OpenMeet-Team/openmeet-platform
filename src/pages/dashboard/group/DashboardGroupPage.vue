<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-xl">
      <h1 class="text-h4 q-my-none">Edit Group</h1>
    </div>

    <q-tabs align="left" model-value="" no-caps class="text-primary q-mb-md">
      <q-route-tab :to="{ name: 'DashboardGroupBasicPage', params: { id: route.params.id }}" name="basic" label="Basic settings" />
      <q-route-tab :to="{ name: 'DashboardGroupMembersPage', params: { id: route.params.id }}" name="members" label="Members settings" />
      <q-route-tab :to="{ name: 'DashboardGroupPrivacyPage', params: { id: route.params.id }}" name="privacy" label="Privacy settings" />
    </q-tabs>

    <router-view/>

  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { groupsApi } from 'src/api/dashboard.ts'
import { LoadingBar } from 'quasar'
import { useRoute } from 'vue-router'

const route = useRoute()

onMounted(() => {
  LoadingBar.start()
  groupsApi.getAll().finally(LoadingBar.stop)
})
</script>
