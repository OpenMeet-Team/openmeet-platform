<template>
  <q-page data-cy="dashboard-group-page" padding class="q-mx-auto q-pb-xl" style="max-width: 1200px;">
    <DashboardTitle defaultBack label="Edit Group" />

    <GroupFormComponent class="q-mt-md col" :editGroupSlug="route.params.slug as string"
      @close="onClose" />
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import GroupFormComponent from 'src/components/group/GroupFormComponent.vue'

const route = useRoute()
const router = useRouter()

// Handle when user closes/cancels the form
const onClose = () => {
  // Use browser history to go back to where user came from
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push({ name: 'DashboardGroupsPage' })
  }
}
</script>
