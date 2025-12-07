<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto q-pb-xl">

    <SpinnerComponent v-if="isLoading" />

    <div class="row justify-between items-start">
      <DashboardTitle defaultBack label="Your Groups" />
      <q-btn no-caps color="primary" icon="sym_r_add" label="Create Group"
        @click="onAddNewGroup" />
    </div>

    <template v-if="!isLoading && summary">
      <!-- Stats Summary - clean text style -->
      <div class="text-body2 text-grey-7 q-mt-md q-mb-lg summary-line">
        <span v-if="summary.counts.leading">
          <strong class="text-primary">{{ summary.counts.leading }}</strong> leading
        </span>
        <span v-if="summary.counts.leading && summary.counts.member" class="separator">·</span>
        <span v-if="summary.counts.member">
          <strong class="text-secondary">{{ summary.counts.member }}</strong> member
        </span>
      </div>

      <!-- No groups state -->
      <template v-if="summary.counts.leading === 0 && summary.counts.member === 0">
        <NoContentComponent
          @click="exploreGroups"
          buttonLabel="Explore Groups"
          label="You haven't joined any groups yet."
          icon="sym_r_group"
        />
      </template>

      <!-- Groups You Lead -->
      <template v-if="summary.leadingGroups.length > 0">
        <div class="text-h6 q-mb-sm flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="sym_r_shield_person" class="q-mr-sm" color="primary" />
            Groups You Lead
            <q-badge v-if="moreLeadingCount > 0" color="grey-6" class="q-ml-sm">
              {{ moreLeadingCount }} more
            </q-badge>
          </div>
          <q-btn
            v-if="moreLeadingCount > 0"
            flat
            no-caps
            color="primary"
            label="View all"
            icon-right="sym_r_arrow_forward"
            @click="viewAllLeadingGroups"
          />
        </div>
        <div class="q-mb-lg">
          <GroupsItemComponent
            v-for="group in summary.leadingGroups"
            :key="group.id"
            :group="group"
            layout="list"
          />
        </div>
      </template>

      <!-- Groups You're In -->
      <template v-if="summary.memberGroups.length > 0">
        <div class="text-h6 q-mb-sm flex items-center justify-between">
          <div class="flex items-center">
            <q-icon name="sym_r_group" class="q-mr-sm" color="secondary" />
            Groups You're In
            <q-badge v-if="moreMemberCount > 0" color="grey-6" class="q-ml-sm">
              {{ moreMemberCount }} more
            </q-badge>
          </div>
          <q-btn
            v-if="moreMemberCount > 0"
            flat
            no-caps
            color="primary"
            label="View all"
            icon-right="sym_r_arrow_forward"
            @click="viewAllMemberGroups"
          />
        </div>
        <div class="q-mb-lg">
          <GroupsItemComponent
            v-for="group in summary.memberGroups"
            :key="group.id"
            :group="group"
            layout="list"
          />
        </div>
      </template>

      <!-- Explore more groups -->
      <div class="q-mt-xl text-center">
        <q-btn
          outline
          no-caps
          color="primary"
          icon="sym_r_explore"
          label="Explore More Groups"
          @click="exploreGroups"
        />
      </div>
    </template>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRouter } from 'vue-router'
import { groupsApi } from '../../../api/groups'
import { DashboardGroupsSummaryEntity } from '../../../types'
import SpinnerComponent from '../../../components/common/SpinnerComponent.vue'
import DashboardTitle from '../../../components/dashboard/DashboardTitle.vue'
import GroupsItemComponent from 'src/components/group/GroupsItemComponent.vue'
import NoContentComponent from '../../../components/global/NoContentComponent.vue'

const router = useRouter()
const isLoading = ref<boolean>(false)
const summary = ref<DashboardGroupsSummaryEntity | null>(null)

// Computed values for "more" counts
const moreLeadingCount = computed(() => {
  if (!summary.value) return 0
  return Math.max(0, summary.value.counts.leading - summary.value.leadingGroups.length)
})

const moreMemberCount = computed(() => {
  if (!summary.value) return 0
  return Math.max(0, summary.value.counts.member - summary.value.memberGroups.length)
})

useMeta({
  title: 'Your Groups'
})

const fetchData = async () => {
  LoadingBar.start()
  return groupsApi.getDashboardSummary().then(res => {
    summary.value = res.data
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

const viewAllLeadingGroups = () => {
  router.push({ name: 'DashboardMyGroupsPage', query: { role: 'leader' } })
}

const viewAllMemberGroups = () => {
  router.push({ name: 'DashboardMyGroupsPage', query: { role: 'member' } })
}
</script>

<style scoped lang="scss">
.summary-line {
  .separator {
    margin: 0 0.5rem;
    color: #ccc;
  }
}
</style>
