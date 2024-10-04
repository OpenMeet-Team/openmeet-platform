<script setup lang="ts">

import GroupFormBasicComponent from 'components/group/GroupFormBasicComponent.vue'
import { useRouter } from 'vue-router'
import { Group } from 'src/types'

const router = useRouter()
const onGroupUpdated = (group: Group) => {
  router.push({ name: 'DashboardGroupsPage', params: { id: group.id } })
}
</script>

<template>
  <GroupFormBasicComponent @updated="onGroupUpdated" :edit-group-id="$route.params.id as string" style="max-width: 500px">
    <div class="row justify-end q-gutter-sm">
      <q-btn label="Cancel" color="negative" :to="{ name: 'DashboardGroupsPage'}"/>
      <q-btn label="Create Group" type="submit" color="primary"/>
    </div>
  </GroupFormBasicComponent>
</template>

<style scoped lang="scss">

</style>
