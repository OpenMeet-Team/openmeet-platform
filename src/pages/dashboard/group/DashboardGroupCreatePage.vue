<template>
  <q-page padding class="c-dashboard-group-create-page q-mx-auto" style="max-width: 1200px;">
    <div class="row items-center q-mb-lg">
      <q-btn
        flat
        round
        icon="sym_r_arrow_back"
        @click="onClose"
        class="q-mr-md"
        aria-label="Go back"
      />
      <div class="text-h4 text-bold">Create New Group</div>
    </div>

    <GroupFormComponent
      class="col"
      @created="onGroupCreated"
      @updated="onGroupUpdated"
      @close="onClose"
    />
  </q-page>
</template>

<script setup lang="ts">
import GroupFormComponent from '../../../components/group/GroupFormComponent.vue'
import { useRouter, useRoute } from 'vue-router'
import { GroupEntity } from '../../../types'
import { useMeta } from 'quasar'
import { useNavigation } from '../../../composables/useNavigation'

const router = useRouter()
const route = useRoute()
const { goBack } = useNavigation()

useMeta({
  title: 'Create Group'
})

// Handle when a group is created
const onGroupCreated = (group: GroupEntity) => {
  console.log('Group created, navigating to:', group)
  if (group && group.slug) {
    router.push({ name: 'GroupPage', params: { slug: group.slug } })
  } else {
    console.error('Cannot navigate: group is missing slug property', group)
  }
}

// Handle when a group is updated
const onGroupUpdated = (group: GroupEntity) => {
  console.log('Group updated, navigating to:', group)
  if (group && group.slug) {
    router.push({ name: 'GroupPage', params: { slug: group.slug } })
  } else {
    console.error('Cannot navigate: group is missing slug property', group)
  }
}

// Handle when user closes/cancels the form
const onClose = () => {
  const redirect = route.query.redirect as string
  if (redirect) {
    router.push(redirect)
  } else {
    goBack({ name: 'DashboardGroupsPage' })
  }
}
</script>

<style scoped>
/* Page styling handled by q-page padding */
</style>
