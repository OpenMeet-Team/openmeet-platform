<script setup lang="ts">

import GroupFormBasicComponent from 'components/group/GroupFormBasicComponent.vue'
import { useRouter, useRoute } from 'vue-router'
import { GroupEntity } from 'src/types'

const router = useRouter()
const route = useRoute()
const onGroupUpdated = (group: GroupEntity) => {
  router.push({ name: 'DashboardGroupsPage', params: { id: group.id } })
}
const onClose = () => {
  router.push({ name: 'DashboardGroupsPage' })
}
</script>

<template>
  <GroupFormBasicComponent @updated="onGroupUpdated" :edit-group-id="route.params.id as string" style="max-width: 500px" @close="onClose"/>
</template>

<style scoped lang="scss">

</style>
