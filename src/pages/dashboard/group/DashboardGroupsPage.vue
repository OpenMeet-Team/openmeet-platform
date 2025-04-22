<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">

    <SpinnerComponent v-if="isLoading" />

    <div class="row justify-between items-start">
      <DashboardTitle defaultBack label="Your groups" />
      <q-btn no-caps color="primary" icon="sym_r_add" label="Create Group"
        @click="onAddNewGroup" />
    </div>

    <template v-if="!isLoading">
      <div>
        <div v-if="hostedGroups?.length" class="row q-col-gutter-lg q-mt-md">
          <div v-for="group in hostedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <DashboardGroupItem :group="group" />
          </div>
        </div>
        <NoContentComponent v-else @click="onAddNewGroup" buttonLabel="Add new Group"
          label="You haven't created any groups yet." icon="sym_r_groups" />
      </div>

      <div class="row text-h4 justify-between q-mt-xl text-bold">Member Groups</div>

      <NoContentComponent v-if="memberedGroups && !memberedGroups.length" @click="exploreGroups"
        buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group" />

      <div v-else class="row q-col-gutter-md q-mt-md">
        <template v-if="memberedGroups">
          <div v-for="group in memberedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4 col-lg-3">
            <DashboardGroupItem :group="group" />
          </div>
        </template>
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { groupsApi } from '../../../api/groups'
import DashboardGroupItem from '../../../components/dashboard/DashboardGroupItem.vue'
import { GroupEntity } from '../../../types'
import { useAuthStore } from '../../../stores/auth-store'
import SpinnerComponent from '../../../components/common/SpinnerComponent.vue'
import DashboardTitle from '../../../components/dashboard/DashboardTitle.vue'

// Define extended type that can include the additional properties from backend
type ExtendedGroupEntity = GroupEntity & {
  isCreator?: boolean;
  upcomingEventsCount?: number;
}

const router = useRouter()
const isLoading = ref<boolean>(false)
const userGroups = ref<ExtendedGroupEntity[]>([])

// Filter groups by checking if user is the creator
const hostedGroups = computed(() => {
  const userId = useAuthStore().getUserId
  return userGroups.value?.filter(group => {
    // Check for isCreator property first if available
    if (group.isCreator !== undefined) {
      return group.isCreator === true
    }
    // Fall back to comparing createdBy.id with userId
    return group.createdBy?.id === userId
  })
})

// Filter groups where user is a member but not creator
const memberedGroups = computed(() => {
  const userId = useAuthStore().getUserId
  return userGroups.value?.filter(group => {
    // If isCreator property is available, use it
    if (group.isCreator !== undefined) {
      return group.isCreator === false && group.groupMember?.groupRole?.name === 'member'
    }
    // Fall back to comparing createdBy.id with userId
    return group.createdBy?.id !== userId && group.groupMember?.groupRole?.name === 'member'
  })
})

useMeta({
  title: 'Your groups'
})

const fetchData = async () => {
  LoadingBar.start()
  return groupsApi.getDashboardGroups().then(res => {
    // Cast the response data to our extended type
    userGroups.value = res.data as ExtendedGroupEntity[]
    // Sort by name to ensure consistent display
    userGroups.value.sort((a, b) => a.name.localeCompare(b.name))
  }).finally(LoadingBar.stop)
}

onMounted(() => {
  isLoading.value = true
  fetchData().finally(() => (isLoading.value = false))
})

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const onAddNewGroup = () => {
  router.push({ name: 'DashboardGroupCreatePage' })
}
</script>

<style scoped></style>
