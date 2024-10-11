<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-md-6">
        <q-select
          v-model="selectedCategory"
          :options="categories"
          label="Filter by Category"
          outlined
          emit-value
          map-options
          clearable
          option-value="id"
          option-label="name"
          class="full-width"
        />
      </div>
      <div class="col-12 col-md-6">
        <q-input
          v-model="searchQuery"
          outlined
          label="Search Groups"
          class="full-width"
        >
          <template v-slot:append>
            <q-icon name="sym_r_search" />
          </template>
        </q-input>
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div v-for="group in groups.data" :key="group.id" class="col-12 col-md-6 col-lg-4">
        <GroupsItemComponent :group="group" @view="viewGroup" @join="joinGroup"/>
      </div>
    </div>

    <div v-if="groups.data.length === 0" class="text-center q-mt-xl">
      <q-icon name="sym_r_search_off" size="4em" color="grey-5" />
      <p class="text-h6 text-grey-6">No groups found matching your criteria</p>
    </div>

    <q-pagination v-if="groups && groups.data"
                  v-model="currentPage"
                  :max="groups.totalPages"
                  @input="onPageChange"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { LoadingBar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import { groupsApi } from 'src/api/groups.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { CategoryEntity, GroupPaginationEntity } from 'src/types'
import GroupsItemComponent from 'components/group/GroupsItemComponent.vue'
import { useNotification } from 'src/composables/useNotification.ts'

const router = useRouter()
const route = useRoute()

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
  groupsApi.getAll(route.query).then(res => {
    groups.value = res.data
  }).finally(LoadingBar.stop)
}

// Change page and update URL
const onPageChange = (page: number) => {
  router.push({ query: { ...route.query, page } })
}

onMounted(() => {
  LoadingBar.start()
  Promise.all([
    groupsApi.getAll(route.query).then(res => {
      groups.value = res.data
    }),
    categoriesApi.getAll().then(res => {
      categories.value = res.data
    })
  ]).finally(LoadingBar.stop)
})

const categories = ref<CategoryEntity[]>([])

const groups = ref<GroupPaginationEntity>({
  data: [],
  total: 0,
  page: 1,
  totalPages: 0
})

const selectedCategory = ref('')
const searchQuery = ref('')
const { success, error } = useNotification()

// const filteredGroups = computed(() => {
//   return groups.value.filter(group => {
//     const categoryMatch = !selectedCategory.value
//     const searchMatch = !searchQuery.value ||
//       group.name.toLowerCase().includes(searchQuery.value.toLowerCase())
//     return categoryMatch && searchMatch
//   })
// })

const viewGroup = (groupId: number) => {
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const joinGroup = (groupId: number) => {
  const group = groups.value.data.find(g => g.id === groupId)
  if (group) {
    groupsApi.join(groupId).then(() => {
      success(`You've joined ${group.name}!`)
    }).catch(err => {
      console.log(err.message)
      error('Joining group failed. Please try again')
    })
    // group.membersCount++
  }
}
</script>

<style scoped>
.group-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.group-card .q-card__section:nth-last-child(2) {
  flex-grow: 1;
}
</style>
