<script setup lang="ts">
import { ref } from 'vue'
import { GroupEntity } from 'src/types'

const emits = defineEmits(['edit', 'view', 'leave', 'delete'])
// Define the types for the group data

// Example group data (replace this with actual data fetching)
const group = ref<GroupEntity>({
  id: 0,
  name: ''
  // userRole: 'owner'
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
const viewGroup = (groupId: number) => {
  emits('view', groupId)
}

const editGroup = (groupId: number) => {
  emits('edit', groupId)
}

const confirmLeaveGroup = (group: GroupEntity) => {
  emits('leave', group)
}
const onDeleteEvent = (group: GroupEntity) => {
  emits('delete', group)
}
</script>

<template>
  <q-card class="group-card">
    <!-- 'https://via.placeholder.com/350' -->
    <q-img :src="typeof group.image === 'object' ? group.image.path : group.image"
           :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
        {{ group.name }}
      </div>
    </q-img>
    <q-card-section>
      <div class="text-h6">{{ group.name }}</div>
<!--      <div class="text-subtitle2" v-if="group.categories">{{ group.categories.map(c => c.name) }}</div>-->
    </q-card-section>
    <q-card-section class="q-pt-none">
      <q-chip
          :color="getRoleColor('admin')"
          text-color="white"
          icon="sym_r_person"
      >
        group.userRole
      </q-chip>
    </q-card-section>
    <q-separator/>
    <q-card-actions align="right">
      <q-btn flat color="primary" label="View Group" @click="viewGroup(group.id)"/>
      <q-btn flat color="primary" label="Edit Group" @click="editGroup(group.id)"/>
      <q-btn flat color="secondary" label="Leave Group" @click="confirmLeaveGroup(group)"/>
      <q-btn flat color="negative" label="Delete" @click="onDeleteEvent(group)" />
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
