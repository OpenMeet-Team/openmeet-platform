<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">
    <div class="row justify-between items-start q-mb-md">
      <DashboardTitle defaultBack label="My Groups" />
      <q-btn
        no-caps
        color="primary"
        icon="sym_r_add"
        label="Create Group"
        @click="onAddNewGroup"
      />
    </div>

    <!-- Tabs for Leading / Member -->
    <q-tabs
      v-model="activeTab"
      class="text-grey-7 q-mb-lg"
      active-color="primary"
      indicator-color="primary"
      align="left"
      narrow-indicator
    >
      <q-tab name="leader" label="Groups You Lead" no-caps />
      <q-tab name="member" label="Groups You're In" no-caps />
    </q-tabs>

    <SpinnerComponent v-if="isLoading" />

    <template v-if="!isLoading">
      <!-- No groups state -->
      <NoContentComponent
        v-if="groups.length === 0"
        @click="activeTab === 'leader' ? onAddNewGroup() : exploreGroups()"
        :buttonLabel="activeTab === 'leader' ? 'Create a Group' : 'Explore Groups'"
        :label="activeTab === 'leader' ? 'You don\'t lead any groups yet.' : 'You haven\'t joined any groups yet.'"
        icon="sym_r_group"
      />

      <!-- Groups list -->
      <template v-else>
        <div class="column q-gutter-y-md q-mb-lg">
          <GroupsItemComponent
            v-for="group in groups"
            :key="group.id"
            :group="group"
            layout="list"
            class="col-12"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center q-mt-lg">
          <q-pagination
            v-model="currentPage"
            :max="totalPages"
            :max-pages="7"
            direction-links
            boundary-links
            @update:model-value="onPageChange"
          />
        </div>
      </template>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoadingBar, useMeta } from 'quasar'
import { groupsApi } from '../../../api/groups'
import { GroupEntity } from '../../../types'
import SpinnerComponent from '../../../components/common/SpinnerComponent.vue'
import DashboardTitle from '../../../components/dashboard/DashboardTitle.vue'
import GroupsItemComponent from '../../../components/group/GroupsItemComponent.vue'
import NoContentComponent from '../../../components/global/NoContentComponent.vue'

const route = useRoute()
const router = useRouter()
const isLoading = ref(false)
const groups = ref<GroupEntity[]>([])
const currentPage = ref(1)
const totalPages = ref(1)
const total = ref(0)
const limit = 10

// Get initial tab from query param or default to 'leader'
const activeTab = ref<'leader' | 'member'>(
  (route.query.role as 'leader' | 'member') || 'leader'
)

useMeta({
  title: 'My Groups'
})

const fetchGroups = async () => {
  isLoading.value = true
  LoadingBar.start()

  try {
    const res = await groupsApi.getDashboardGroupsPaginated({
      page: currentPage.value,
      limit,
      role: activeTab.value
    })
    groups.value = res.data.data
    totalPages.value = res.data.totalPages
    total.value = res.data.total
  } finally {
    isLoading.value = false
    LoadingBar.stop()
  }
}

onMounted(() => {
  fetchGroups()
})

// Watch for tab changes
watch(activeTab, () => {
  currentPage.value = 1
  router.replace({ query: { role: activeTab.value } })
  fetchGroups()
})

const onPageChange = () => {
  fetchGroups()
}

const onAddNewGroup = () => {
  router.push({ name: 'DashboardGroupCreatePage' })
}

const exploreGroups = () => {
  router.push({ name: 'GroupsPage' })
}
</script>
