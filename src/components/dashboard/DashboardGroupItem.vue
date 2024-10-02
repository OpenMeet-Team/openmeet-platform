<script setup lang="ts">
import { ref } from 'vue'

const emits = defineEmits(['edit', 'view', 'leave'])
// Define the types for the group data
interface Group {
  id: string;
  imageUrl: string | null;
  name: string;
  category: string;
  userRole: string;
}

// Example group data (replace this with actual data fetching)
const group = ref<Group>({
  id: '1',
  imageUrl: null,
  name: 'Vue.js Enthusiasts',
  category: 'Programming',
  userRole: 'owner'
})

// Type declaration for the role color function
const getRoleColor = (role: string): string => {
  switch (role) {
    case 'owner': return 'primary'
    case 'manager': return 'secondary'
    case 'participant': return 'tertiary'
    default: return 'grey'
  }
}

// Function stubs for viewing, editing, and leaving group actions
const viewGroup = (groupId: string) => {
  console.log(`View Group: ${groupId}`)
  emits('view', groupId)
}

const editGroup = (groupId: string) => {
  console.log(`Edit Group: ${groupId}`)
  emits('edit', groupId)
}

const confirmLeaveGroup = (group: Group) => {
  console.log(`Leave Group: ${group.name}`)
  emits('leave', group)
}
</script>

<template>
  <q-card class="group-card">
    <q-img :src="group.imageUrl || 'https://via.placeholder.com/350'" :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
        {{ group.name }}
      </div>
    </q-img>
    <q-card-section>
      <div class="text-h6">{{ group.name }}</div>
      <div class="text-subtitle2">{{ group.category }}</div>
    </q-card-section>
    <q-card-section class="q-pt-none">
      <q-chip
          :color="getRoleColor(group.userRole)"
          text-color="white"
          icon="sym_r_person"
      >
        {{ group.userRole }}
      </q-chip>
    </q-card-section>
    <q-separator/>
    <q-card-actions align="right">
      <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)"/>
      <q-btn flat color="primary" label="Edit Group" @click="editGroup(group.id)"/>
      <q-btn flat color="secondary" label="Leave Group" @click="confirmLeaveGroup(group)"/>
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
