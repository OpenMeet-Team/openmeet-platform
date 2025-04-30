<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">

    <SpinnerComponent v-if="isLoading" />

    <div class="row justify-between items-start">
      <DashboardTitle defaultBack label="Your groups" />
      <q-btn no-caps color="primary" icon="sym_r_add" label="Create Group"
        @click="onAddNewGroup" />
    </div>

    <template v-if="!isLoading">
      <q-tabs align="left" no-caps v-model="tab" class="text-primary q-mb-md q-mt-md">
        <q-tab name="member" label="Member in" />
        <q-tab name="admin" label="Leader in" />
        <q-tab name="all" label="All" />
      </q-tabs>

      <q-tab-panels v-model="tab" animated>
        <q-tab-panel name="member">
          <NoContentComponent v-if="memberedGroups && !memberedGroups.length" @click="exploreGroups"
            buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group" />
          <div v-else class="column q-gutter-y-md">
            <GroupsItemComponent v-for="group in memberedGroups" :key="group.id" :group="group" layout="list" class="col-12" />
          </div>
        </q-tab-panel>

        <q-tab-panel name="admin">
          <div v-if="hostedGroups?.length" class="column q-gutter-y-md">
            <GroupsItemComponent v-for="group in hostedGroups" :key="group.id" :group="group" layout="list" class="col-12" />
          </div>
          <NoContentComponent v-else @click="onAddNewGroup" buttonLabel="Add new Group"
            label="You haven't created any groups yet." icon="sym_r_groups" />
        </q-tab-panel>

        <q-tab-panel name="all">
          <NoContentComponent v-if="!userGroups.length" @click="exploreGroups"
            buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group" />
          <div v-else class="column q-gutter-y-md">
            <GroupsItemComponent v-for="group in userGroups" :key="group.id" :group="group" layout="list" class="col-12" />
          </div>
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { groupsApi } from '../../../api/groups'
import { GroupEntity } from '../../../types'
import SpinnerComponent from '../../../components/common/SpinnerComponent.vue'
import DashboardTitle from '../../../components/dashboard/DashboardTitle.vue'
import GroupsItemComponent from 'src/components/group/GroupsItemComponent.vue'
import NoContentComponent from '../../../components/global/NoContentComponent.vue'

// Define extended type that can include the additional properties from backend
type ExtendedGroupEntity = GroupEntity & {
  isCreator?: boolean;
  upcomingEventsCount?: number;
}

const router = useRouter()
const isLoading = ref<boolean>(false)
const userGroups = ref<ExtendedGroupEntity[]>([])
const tab = ref<'member' | 'admin'>('member')

// Filter groups by checking if user is the creator or a leadership role
const hostedGroups = computed(() => {
  return userGroups.value?.filter(group => {
    // Check for isCreator property first if available
    if (group.isCreator === true) {
      return true
    }
    // Include groups where user has admin or moderator role
    const role = group.groupMember?.groupRole?.name
    if (role === 'admin' || role === 'moderator' || role === 'owner') {
      return true
    }
    return false
  })
})

// Filter groups where user is a member but not in leadership role
const memberedGroups = computed(() => {
  return userGroups.value?.filter(group => {
    const role = group.groupMember?.groupRole?.name
    // Only include regular members, not those with leadership roles
    return role === 'member'
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
