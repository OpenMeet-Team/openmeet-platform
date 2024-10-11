<script setup lang="ts">
import { GroupEntity } from 'src/types'

defineEmits(['edit', 'view', 'leave', 'delete'])

interface Props {
  group: GroupEntity
}

defineProps<Props>()

// Type declaration for the role color function
const getRoleColor = (role: string): string => {
  switch (role) {
    case 'owner': return 'primary'
    case 'manager': return 'secondary'
    case 'participant': return 'tertiary'
    default: return 'grey'
  }
}

</script>

<template>
  <q-card class="group-card">
    <q-img :src="(typeof group.image === 'object' ? group.image.path : group.image) || 'https://via.placeholder.com/350'"
           :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">{{ group.name }}</div>
    </q-img>
    <q-card-section>
      <div class="text-h6">{{ group.name }}</div>
      <div class="text-subtitle2" v-if="group.categories">
        {{ group.categories.map(c => typeof c === 'object' ? c.name : '').join(', ') }}
      </div>
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
      <q-btn flat color="primary" label="View Group" @click="$emit('view', group.id)"/>
      <q-btn flat color="primary" label="Edit Group" @click="$emit('edit', group.id)"/>
      <q-btn flat color="secondary" label="Leave Group" @click="$emit('leave', group)"/>
      <q-btn flat color="negative" label="Delete" @click="$emit('delete', group)" />
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
