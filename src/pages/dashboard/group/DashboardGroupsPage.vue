<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto">

    <SpinnerComponent v-if="isLoading" />

    <div class="row justify-between items-start">
      <DashboardTitle defaultBack label="Your groups" />
      <q-btn v-if="hostedGroups?.length" no-caps color="primary" icon="sym_r_add" label="Create Group"
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
import { apiGetDashboardGroups } from 'src/api/dashboard.ts'
import DashboardGroupItem from 'components/dashboard/DashboardGroupItem.vue'
import { GroupEntity } from 'src/types'
import { useAuthStore } from 'stores/auth-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import DashboardTitle from 'src/components/dashboard/DashboardTitle.vue'

const router = useRouter()

const isLoading = ref<boolean>(false)
const userGroups = ref<GroupEntity[]>([])
const hostedGroups = computed(() => userGroups.value?.filter(group => group.createdBy?.id === useAuthStore().getUserId))
const memberedGroups = computed(() => userGroups.value?.filter(group => group.groupMember?.groupRole?.name === 'member'))

useMeta({
  title: 'Your groups'
})

const fetchData = async () => {
  LoadingBar.start()
  return apiGetDashboardGroups().then(res => {
    userGroups.value = res.data.sort((a, b) => b.name.localeCompare(a.name))
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
  router.push({ name: 'DashboardGroupsCreatePage' })
}

</script>

<style scoped></style>
