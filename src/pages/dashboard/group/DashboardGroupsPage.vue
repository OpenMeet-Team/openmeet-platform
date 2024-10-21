<template>
  <q-page padding v-if="loaded">

    <SpinnerComponent v-if="!loaded"/>

    <div class="row text-h4 justify-between">
      <span class="text-bold">Your groups</span>
      <q-btn v-if="hostedGroups?.length"
             no-caps
             color="primary"
             icon="sym_r_add"
             label="Create Group"
             @click="onAddNewGroup"
      />
    </div>

    <div>
      <div v-if="hostedGroups?.length" class="row q-col-gutter-md q-mt-md">
        <div v-for="group in hostedGroups" :key="group.id" class="col-12 col-sm-3 col-md-3 col-lg-2">
          <DashboardGroupItem :group="group"/>
        </div>
      </div>
      <NoContentComponent v-else @click="onAddNewGroup" buttonLabel="Add new Group" label="You haven't created any groups yet." icon="sym_r_groups"/>
    </div>

    <div class="row text-h4 justify-between q-mt-xl text-bold">Member Groups</div>

    <NoContentComponent v-if="memberedGroups && !memberedGroups.length" @click="exploreGroups" buttonLabel="Explore Groups" label="You haven't joined any groups yet." icon="sym_r_group"/>

    <div v-else class="row q-col-gutter-md q-mt-md">
      <template v-if="memberedGroups">
        <div v-for="group in memberedGroups" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <DashboardGroupItem :group="group"/>
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
import { useAuthStore } from 'stores/auth-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

const router = useRouter()

const loaded = ref<boolean>(false)
const userGroups = ref<GroupEntity[]>([])
const hostedGroups = computed(() => userGroups.value?.filter(group => group.groupMembers?.some(member => member.user?.id === useAuthStore().getUserId && member.groupRole?.name !== 'member')))
const memberedGroups = computed(() => userGroups.value?.filter(group => group.groupMembers?.some(member => member.user?.id === useAuthStore().getUserId && member.groupRole?.name === 'member')))

useMeta({
  title: 'Your groups'
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
