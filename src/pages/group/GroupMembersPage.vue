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
            map-options
            emit-value
            label="Filter by role"
            outlined
          />
        </div>
      </div>
      <q-list bordered separator>
        <q-item v-for="member in filteredMembers" :key="member.id" clickable :to="{ name: 'MemberPage', params: { id: member.user.id } }">
          <q-item-section avatar>
            <q-avatar>
              <img :src="getImageSrc(member.user?.photo)" :alt="member.user?.name" />
            </q-avatar>
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ member.user.name }}</q-item-label>
            <q-item-label caption>
              {{ capitalizeFirstLetter(member.groupRole.name) }} • <span v-if="member.createdAt">Joined {{ formatDate(member.createdAt, 'DD MMM YYYY') }}</span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
      <NoContentComponent v-if="!group.groupMembers?.length" :label="getNoContentMessage" icon="sym_r_group"/>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupStore } from 'stores/group-store.ts'
import SpinnerComponent from 'components/common/SpinnerComponent.vue'
import { getImageSrc } from 'src/utils/imageUtils'
import { formatDate } from 'src/utils/dateUtils'
import { GroupRoleType } from 'src/types'

const group = computed(() => useGroupStore().group)
const groupMembers = computed(() => useGroupStore().group?.groupMembers)
const isLoading = ref<boolean>(false)
const searchQuery = ref('')
const roleFilter = ref<GroupRoleType | ''>('')

const roleOptions = [
  { label: 'All', value: '' },
  { label: 'Organiser', value: 'owner' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'Member', value: 'member' }
]

const filteredMembers = computed(() => {
  return groupMembers.value?.filter(member => {
    const nameMatch = member.user?.name?.toLowerCase().includes(searchQuery.value.toLowerCase())
    const roleMatch = !roleFilter.value || member.groupRole.name.toLowerCase() === roleFilter.value.toLowerCase()

    return nameMatch && roleMatch
  })
})

const getNoContentMessage = computed(() => {
  if (searchQuery.value || roleFilter.value) {
    return 'No members found with current filters'
  }
  return 'No group members yet'
})

onMounted(() => {
  isLoading.value = true
  if (group.value) useGroupStore().actionGetGroupMembers(String(group.value.id)).finally(() => (isLoading.value = false))
})

const capitalizeFirstLetter = (string: string) => {
  return string.charAt(0).toUpperCase() + string.slice(1)
}
</script>
