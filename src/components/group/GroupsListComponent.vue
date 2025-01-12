<script setup lang="ts">
import { GroupEntity } from 'src/types'
import GroupsItemComponent from './GroupsItemComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
interface Props {
  groups?: GroupEntity[]
  loading?: boolean
  layout?: 'grid' | 'list'
  emptyMessage?: string
  showPagination?: boolean
  currentPage: number
  totalPages?: number
  label?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  layout: 'list',
  emptyMessage: 'No groups found',
  showPagination: false,
  currentPage: 1,
  label: 'Groups'
})

const emit = defineEmits(['page-change', 'update:currentPage'])

const onPageChange = (page: number) => {
  emit('update:currentPage', page)
  emit('page-change', page)
}
</script>

<template>
  <div class="groups-list">
    <SubtitleComponent v-if="label" :label="label" :to="{ name: 'GroupsPage' }">
      All Groups<q-icon name="sym_r_arrow_forward" />
    </SubtitleComponent>
    <SpinnerComponent v-if="loading" />

    <template v-else>
      <!-- Groups Grid/List -->
      <div :class="[
        'groups-container',
        { 'groups-grid': layout === 'grid' }
      ]" v-if="groups?.length">
        <GroupsItemComponent
          v-for="group in groups"
          :key="group.id"
          :group="group"
          :layout="layout"
        />
      </div>

      <!-- Empty State -->
      <NoContentComponent
        v-else
        :label="emptyMessage"
        icon="sym_r_group"
      />

      <!-- Pagination -->
      <q-pagination
        v-if="showPagination && totalPages && totalPages > 1"
        :model-value="currentPage"
        :max="totalPages"
        @update:model-value="onPageChange"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.groups-container {
  &.groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
}
</style>
