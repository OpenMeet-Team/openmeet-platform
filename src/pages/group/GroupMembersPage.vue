<template>
  <div class="q-pa-md" v-if="group" style="max-width: 600px; margin: 0 auto;">
    <SpinnerComponent v-if="isLoading"/>
    <template v-if="!isLoading && group">
      <div class="text-h5 q-mb-md">All members <span v-if="group.groupMembers?.length">{{ group.groupMembers.length }}</span></div>
      <div class="row q-col-gutter-md q-mb-md">
        <div class="col-12 col-sm-8">
          <q-input
            v-model="searchQuery"
            label="Search members"
            outlined
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-select
            v-model="roleFilter"
            :options="roleOptions"
            label="Filter by role"
            outlined
          />
        </div>
      </div>
      <q-list bordered separator>
        <q-item v-for="user in filteredUsers" :key="user.id">
          <q-item-section avatar>
            <q-avatar>
              <img :src="user.avatar" :alt="user.name" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ user.name }}</q-item-label>
            <q-item-label caption>
              {{ capitalizeFirstLetter(user.role) }} • Joined {{ user.joinDate }}
            </q-item-label>
            <q-item-label caption>Last visited {{ user.lastVisit }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <NoContentComponent v-if="!group.groupMembers?.length" label="No group members yet" icon="sym_r_group"/>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from 'stores/group-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'

const group = computed(() => useGroupStore().group)
const isLoading = ref<boolean>(false)

interface User {
  id: number
  name: string
  role: 'admin' | 'member'
  joinDate: string
  lastVisit: string
  avatar: string
}

const users = ref<User[]>([
  { id: 1, name: 'Adam Smith', role: 'member', joinDate: 'Aug 27, 2018', lastVisit: '6 years ago', avatar: '/placeholder.svg?height=40&width=40' },
  { id: 2, name: 'Aditya Patel', role: 'member', joinDate: 'Nov 22, 2023', lastVisit: '11 months ago', avatar: '/placeholder.svg?height=40&width=40' },
  { id: 3, name: 'Alex Johnson', role: 'member', joinDate: 'Jun 14, 2018', lastVisit: '6 years ago', avatar: '/placeholder.svg?height=40&width=40' },
  { id: 4, name: 'Sarah Lee', role: 'admin', joinDate: 'Jan 5, 2022', lastVisit: '2 days ago', avatar: '/placeholder.svg?height=40&width=40' }
])

const searchQuery = ref('')
const roleFilter = ref<'all' | 'admin' | 'member'>('all')

const roleOptions = [
  { label: 'All', value: 'all' },
  { label: 'Organiser', value: 'admin' },
  { label: 'Member', value: 'member' }
]

const filteredUsers = computed(() => {
  return users.value.filter(user =>
    user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) &&
    (roleFilter.value === 'all' || user.role === roleFilter.value)
  )
})

onMounted(() => {
  isLoading.value = true
  if (group.value) useGroupStore().actionGetGroupMembersById(String(group.value.id)).finally(() => (isLoading.value = false))
})

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
</script>
