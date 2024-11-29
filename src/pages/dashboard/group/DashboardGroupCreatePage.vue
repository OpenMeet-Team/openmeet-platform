<template>
  <q-page padding class="c-dashboard-group-create-page">
    <div class="q-mx-auto" style="max-width: 500px">
      <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Create a Group" />

      <div class="row justify-center">
        <GroupFormComponent class="col" @close="router.push({ name: 'DashboardGroupsPage' })" />
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from 'components/group/GroupFormComponent.vue'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import { useRouter } from 'vue-router'
const router = useRouter()
</script>
