<template>
  <q-page data-cy="dashboard-group-page" padding class="q-mx-auto q-pb-xl" style="max-width: 1200px;">
    <DashboardTitle :backTo="{ name: 'DashboardGroupsPage' }" label="Edit Group" />

    <GroupFormComponent class="q-mt-md col" :editGroupSlug="route.params.slug as string"
      @close="router.push({ name: 'DashboardGroupsPage' })" />
  </q-page>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import GroupFormComponent from 'src/components/group/GroupFormComponent.vue'

const route = useRoute()
const router = useRouter()

</script>
