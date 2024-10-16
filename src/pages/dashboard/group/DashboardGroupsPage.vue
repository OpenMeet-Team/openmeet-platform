<template>
  <q-page padding v-if="loaded">

    <DashboardTitle label="My Groups">
      <q-btn v-if="hostedGroups && hostedGroups.length"
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Group"
        @click="onAddNewGroup"
      />
    </DashboardTitle>

    <NoContentComponent v-if="hostedGroups && !hostedGroups.length" @click="onAddNewGroup" buttonLabel="Add new Group" label="You haven't created any groups yet." icon="sym_r_groups"/>
    <div v-else class="row q-col-gutter-md">
      <template v-if="hostedGroups">
        <div v-for="group in hostedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
        </div>
      </template>
    </div>

    <div class="row items-center justify-between q-my-xl">
      <h1 class="text-h4 q-my-none">Member Groups</h1>
    </div>

    <NoContentComponent v-if="memberedGroups && !memberedGroups.length" @click="exploreGroups" buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group"/>

    <div v-else class="row q-col-gutter-md">
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
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import { useAuthStore } from 'stores/auth-store.ts'

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

const viewGroup = (groupId: string) => {
  console.log(groupId)
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const editGroup = (groupId: string) => {
  router.push({ name: 'DashboardGroupBasicPage', params: { id: groupId } })
}

const confirmLeaveGroup = (group: GroupEntity) => {
  openLeaveGroupDialog(group).onOk(() => {
    userGroups.value = userGroups.value.filter(g => g.id !== group.id)
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
