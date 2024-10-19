<template>
  <q-page padding v-if="loaded">

    <SpinnerComponent v-if="!loaded"/>

    <div class="row text-h4 justify-between">
      <router-link class="router-link-inherit" active-class="text-bold" :to="{ name: 'DashboardGroupsPage' }">Your groups</router-link>
      <q-btn v-if="hostedGroups?.length"
             no-caps
             color="primary"
             icon="sym_r_add"
             label="Create Group"
             @click="onAddNewGroup"
      />
    </div>

    <NoContentComponent v-if="hostedGroups && !hostedGroups.length" @click="onAddNewGroup" buttonLabel="Add new Group" label="You haven't created any groups yet." icon="sym_r_groups"/>

    <div v-else class="row q-col-gutter-md q-mt-md">
      <template v-if="hostedGroups">
        <div v-for="group in hostedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
        </div>
      </template>
    </div>

    <div class="row text-h4 justify-between">
      <router-link class="router-link-inherit" active-class="text-bold" :to="{ name: 'DashboardGroupsPage' }">Member Groups</router-link>
    </div>

    <NoContentComponent v-if="memberedGroups && !memberedGroups.length" @click="exploreGroups" buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group"/>

    <div v-else class="row q-col-gutter-md q-mt-md">
      <template v-if="memberedGroups">
        <div v-for="group in memberedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
        </div>
      </template>
    </div>

  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { apiGetDashboardGroups } from 'src/api/dashboard.ts'
import DashboardGroupItem from 'components/dashboard/DashboardGroupItem.vue'
import { GroupEntity } from 'src/types'
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { encodeNumberToLowercaseString } from 'src/utils/encoder.ts'
import { groupsApi } from 'src/api/groups.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

const router = useRouter()

const loaded = ref<boolean>(false)
const userGroups = ref<GroupEntity[]>([])
const hostedGroups = computed(() => userGroups.value?.filter(group => group.groupMembers?.some(member => member.user?.id === useAuthStore().getUserId && member.groupRole?.name !== 'member')))
const memberedGroups = computed(() => userGroups.value?.filter(group => group.groupMembers?.some(member => member.user?.id === useAuthStore().getUserId && member.groupRole?.name === 'member')))

useMeta({
  title: 'My groups'
})
const fetchData = async () => {
  LoadingBar.start()
  return apiGetDashboardGroups().then(res => {
    userGroups.value = res.data
  }).finally(LoadingBar.stop)
}

onMounted(() => {
  fetchData().finally(() => (loaded.value = true))
})

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const viewGroup = (group: GroupEntity) => {
  router.push({ name: 'GroupPage', params: { slug: group.slug, id: encodeNumberToLowercaseString(group.id) } })
}

const editGroup = (group: GroupEntity) => {
  router.push({ name: 'DashboardGroupBasicPage', params: { id: group.id } })
}

const confirmLeaveGroup = (group: GroupEntity) => {
  openLeaveGroupDialog().onOk(() => {
    groupsApi.leave(String(group.id)).then(() => {
      userGroups.value = userGroups.value.filter(g => g.id !== group.id)
    })
  })
}

const { openDeleteGroupDialog, openLeaveGroupDialog } = useGroupDialog()

const onDeleteGroup = (group: GroupEntity) => {
  openDeleteGroupDialog(group)
}

const onAddNewGroup = () => {
  router.push({ name: 'DashboardGroupsCreatePage' })
}

</script>

<style scoped>
.group-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.group-card .q-card__section:nth-last-child(3) {
  flex-grow: 1;
}
</style>
