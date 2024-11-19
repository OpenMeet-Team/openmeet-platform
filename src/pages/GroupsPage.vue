<template>
  <q-page padding style="max-width: 1024px" class="q-mx-auto" data-cy="groups-page">
    <SpinnerComponent v-if="useGroupsStore().isLoading"/>

    <div class="row text-h4">
      <router-link class="q-mr-xs router-link-inherit" active-class="text-bold" :to="{ name: 'EventsPage' }">Events list</router-link>/
      <span class="text-bold q-ml-xs">Groups list</span>
    </div>

    <div class="row q-col-gutter-md q-mb-lg q-mt-md">
      <CategoriesFilterComponent/>
      <LocationFilterComponent/>
      <div class="row items-center" v-if="route.query.categories || route.query.location">
        <q-btn data-cy="groups-reset-filters" no-caps size="md" flat label="Reset filters" @click="router.push({ path: ''})"/>
      </div>
    </div>

    <template v-if="!useGroupsStore().isLoading">
      <div v-if="groups?.data?.length">
        <div v-for="group in groups.data" :key="group.id" class="col-12 col-sm-6 col-md-4">
          <GroupsItemComponent data-cy="groups-item" :group="group"/>
        </div>
      </div>

      <NoContentComponent v-if="!useGroupsStore().isLoading && !groups?.data?.length" label="No groups found matching your criteria" icon="sym_r_search_off"/>

      <q-pagination v-if="!useGroupsStore().isLoading && groups && groups.totalPages && groups.totalPages > 1"
                    v-model="currentPage"
                    :max="groups.totalPages"
                    @input="onPageChange"
      />
    </template>

  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { LoadingBar, useMeta } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import GroupsItemComponent from 'components/group/GroupsItemComponent.vue'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import NoContentComponent from 'components/global/NoContentComponent.vue'
import LocationFilterComponent from 'components/common/LocationFilterComponent.vue'
import CategoriesFilterComponent from 'components/common/CategoriesFilterComponent.vue'
import { useGroupsStore } from 'stores/groups-store.ts'

const router = useRouter()
const route = useRoute()

useMeta({
  title: 'Groups'
})

// Pagination
const currentPage = ref(parseInt(route.query.page as string) || 1)
const groups = computed(() => useGroupsStore().groups)

onMounted(() => {
  console.log('GroupsPage onMounted')
  LoadingBar.start()
  useGroupsStore().actionGetGroupsState(route.query).finally(LoadingBar.stop)
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
