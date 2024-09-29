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
      <div v-for="group in filteredGroups" :key="group.id" class="col-12 col-md-6 col-lg-4">
        <q-card class="group-card">
          <q-card-section>
            <div class="text-h6">{{ group.name }}</div>
            <div class="text-subtitle2">{{ group.category }}</div>
          </q-card-section>

          <q-card-section>
            <div class="text-body2">
              <strong>Interests:</strong> {{ group.interests.join(', ') }}
            </div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <div class="text-body2">
              <q-icon name="sym_r_people" /> {{ group.memberCount }} members
            </div>
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)" />
            <q-btn flat color="secondary" label="Join" @click="joinGroup(group.id)" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <div v-if="filteredGroups.length === 0" class="text-center q-mt-xl">
      <q-icon name="sym_r_search_off" size="4em" color="grey-5" />
      <p class="text-h6 text-grey-6">No groups found matching your criteria</p>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

const $q = useQuasar()
const router = useRouter()

interface Group {
  id: number;
  name: string;
  category: string;
  interests: string[];
  memberCount: number;
}

const groups = ref<Group[]>([
  {
    id: 1,
    name: 'Tech Enthusiasts',
    category: 'Technology',
    interests: ['Programming', 'AI', 'Web Development'],
    memberCount: 1250
  },
  {
    id: 2,
    name: 'Outdoor Adventures',
    category: 'Sports & Fitness',
    interests: ['Hiking', 'Camping', 'Rock Climbing'],
    memberCount: 850
  },
  {
    id: 3,
    name: 'Book Lovers Club',
    category: 'Arts & Culture',
    interests: ['Fiction', 'Non-fiction', 'Poetry'],
    memberCount: 500
  },
  {
    id: 4,
    name: 'Foodies Unite',
    category: 'Food & Drink',
    interests: ['Cooking', 'Restaurant Hopping', 'Wine Tasting'],
    memberCount: 750
  },
  {
    id: 5,
    name: 'Green Earth Initiative',
    category: 'Environment',
    interests: ['Sustainability', 'Conservation', 'Recycling'],
    memberCount: 600
  }
])

const categories = [
  { label: 'All Categories', value: '' },
  { label: 'Technology', value: 'Technology' },
  { label: 'Sports & Fitness', value: 'Sports & Fitness' },
  { label: 'Arts & Culture', value: 'Arts & Culture' },
  { label: 'Food & Drink', value: 'Food & Drink' },
  { label: 'Environment', value: 'Environment' }
]

const selectedCategory = ref('')
const searchQuery = ref('')

const filteredGroups = computed(() => {
  return groups.value.filter(group => {
    const categoryMatch = !selectedCategory.value || group.category === selectedCategory.value
    const searchMatch = !searchQuery.value ||
      group.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      group.interests.some(interest => interest.toLowerCase().includes(searchQuery.value.toLowerCase()))
    return categoryMatch && searchMatch
  })
})

const viewGroup = (groupId: number) => {
  // In a real app, you'd navigate to the group details page
  console.log('View group:', groupId)
  router.push({ name: 'GroupPage', params: { id: groupId } })
}

const joinGroup = (groupId: number) => {
  // In a real app, you'd make an API call to join the group
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    group.memberCount++
    $q.notify({
      color: 'positive',
      textColor: 'white',
      icon: 'check_circle',
      message: `You've joined ${group.name}!`
    })
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
