<template>
  <q-page padding>

    <DashboardTitle label="My Groups">
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Group"
        @click="onAddNewGroup"
      />
    </DashboardTitle>

    <div v-if="userGroups.length === 0" class="text-center q-pa-md">
      <q-icon name="sym_r_groups" size="4em" color="grey-5"/>
      <p class="text-h6 text-grey-6 q-mt-sm">You haven't joined any groups yet.</p>
      <q-btn color="primary" label="Explore Groups" @click="exploreGroups" class="q-mt-md"/>
    </div>

    <div v-else class="row q-col-gutter-md">
      <div v-for="group in userGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
        <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
      </div>
    </div>

    <div class="row items-center justify-between q-my-xl">
      <h1 class="text-h4 q-my-none">Member Groups</h1>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { LoadingBar } from 'quasar'
import { useRouter } from 'vue-router'
import { apiGetDashboardGroups } from 'src/api/dashboard.ts'
import DashboardGroupItem from 'components/dashboard/DashboardGroupItem.vue'
import { GroupEntity } from 'src/types'
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'

const userGroups = ref<GroupEntity[]>([])
const router = useRouter()

onMounted(() => {
  LoadingBar.start()
  apiGetDashboardGroups().then(res => {
    userGroups.value = res.data
  }).finally(LoadingBar.stop)
})

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}

const viewGroup = (groupId: string) => {
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
