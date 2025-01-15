<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto" data-cy="groups-page">
    <SpinnerComponent v-if="useGroupsStore().isLoading"/>

    <div class="row text-h4">
      <span class="text-bold q-ml-xs">Groups list</span>
    </div>

    <div class="row q-col-gutter-md q-mb-lg q-mt-md">
      <CategoriesFilterComponent/>
      <LocationFilterComponent/>
      <RadiusFilterComponent/>
      <div class="row items-center" v-if="route.query.categories || route.query.location || route.query.radius">
        <q-btn data-cy="groups-reset-filters" no-caps size="md" flat label="Reset filters" @click="router.push({ path: ''})"/>
      </div>
    </div>

    <GroupsListComponent
      :groups="groups?.data"
      :loading="useGroupsStore().isLoading"
      :show-pagination="true"
      :current-page="currentPage"
      :total-pages="groups?.totalPages"
      layout="list"
      label=""
      @page-change="onPageChange"
    />

  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import LocationFilterComponent from 'components/common/LocationFilterComponent.vue'
import CategoriesFilterComponent from 'components/common/CategoriesFilterComponent.vue'
import RadiusFilterComponent from 'components/common/RadiusFilterComponent.vue'
import { useGroupsStore } from 'stores/groups-store.ts'
import GroupsListComponent from 'components/group/GroupsListComponent.vue'

const router = useRouter()
const route = useRoute()

useMeta({
  title: 'Groups'
})

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)
const groups = computed(() => useGroupsStore().groups)

onMounted(() => {
  LoadingBar.start()
  useGroupsStore().actionGetGroupsState(route.query).finally(LoadingBar.stop)
})

onBeforeUnmount(() => {
  useGroupsStore().$reset()
})

const fetchGroups = async () => {
  LoadingBar.start()
  useGroupsStore().actionGetGroups(route.query).finally(LoadingBar.stop)
}

watch(() => currentPage.value, (newVal) => {
  if (newVal) {
    router.push({ query: { ...route.query, page: newVal } })
  }
})
watch(() => route.query, fetchGroups)

const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
}

</script>

<style scoped>

</style>
