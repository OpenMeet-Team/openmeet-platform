<template>
  <q-page padding v-if="loaded">

    <DashboardTitle label="My Groups">
      <q-btn v-if="userGroups && userGroups.data.length"
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Group"
        @click="onAddNewGroup"
      />
    </DashboardTitle>

    <NoContentComponent v-if="userGroups && !userGroups.data.length" @click="onAddNewGroup" buttonLabel="Add new Group" label="You haven't created any groups yet." icon="sym_r_groups"/>
    <div v-else class="row q-col-gutter-md">
      <template v-if="userGroups">
        <div v-for="group in userGroups.data" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
        </div>
      </template>
    </div>

    <div class="row items-center justify-between q-my-xl">
      <h1 class="text-h4 q-my-none">Member Groups</h1>
    </div>

    <NoContentComponent v-if="userGroups && userGroups.data.length === 0" @click="exploreGroups" buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group"/>

    <div v-else class="row q-col-gutter-md">
      <template v-if="userGroups">
        <div v-for="group in userGroups.data" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group" @view="viewGroup" @edit="editGroup" @leave="confirmLeaveGroup" @delete="onDeleteGroup"/>
        </div>
      </template>
    </div>

    <q-pagination class="q-mt-xl"
                  v-if="userGroups && userGroups.totalPages && userGroups.totalPages > 1"
                  v-model="currentPage"
                  :max="userGroups.totalPages"
                  @input="onPageChange"
    />

  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { LoadingBar } from 'quasar'
import { useRouter, useRoute } from 'vue-router'
import { apiGetDashboardGroups } from 'src/api/dashboard.ts'
import DashboardGroupItem from 'components/dashboard/DashboardGroupItem.vue'
import { GroupEntity, GroupPaginationEntity } from 'src/types'
import { useGroupDialog } from 'src/composables/useGroupDialog.ts'
import DashboardTitle from 'components/dashboard/DashboardTitle.vue'
import NoContentComponent from 'components/common/NoContentComponent.vue'

const router = useRouter()
const route = useRoute()

const loaded = ref<boolean>(false)
const userGroups = ref<GroupPaginationEntity>({
  data: [],
  total: 0,
  page: 1,
  totalPages: 0
})
const currentPage = ref(parseInt(route.query.page as string) || 1)

// Watch for route changes to update the page
watch(
  () => route.query.page,
  (newPage) => {
    currentPage.value = parseInt(newPage as string) || 1
    fetchData()
  }
)

const fetchData = async () => {
  LoadingBar.start()
  return apiGetDashboardGroups().then(res => {
    userGroups.value = res.data
  }).finally(LoadingBar.stop)
}

// Change page and update URL
const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
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
    userGroups.value.data = userGroups.value.data.filter(g => g.id !== group.id)
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
