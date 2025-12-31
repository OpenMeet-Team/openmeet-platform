<script setup lang="ts">
import { GroupEntity } from '../../types'
import GroupsItemComponent from './GroupsItemComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { RouteLocationRaw } from 'vue-router'

interface Props {
  groups?: GroupEntity[]
  loading?: boolean
  layout?: 'grid' | 'list'
  emptyMessage?: string
  showPagination?: boolean
  currentPage: number
  totalPages?: number
  label?: string
  hideLink?: boolean
  to?: RouteLocationRaw
  linkText?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  layout: 'list',
  emptyMessage: 'No groups found',
  showPagination: false,
  currentPage: 1,
  label: 'Groups',
  hideLink: false,
  to: () => ({ name: 'GroupsPage' }),
  linkText: 'See all groups'
})

const emit = defineEmits(['page-change', 'update:currentPage'])

const onPageChange = (page: number) => {
  emit('update:currentPage', page)
  emit('page-change', page)
}
</script>

<template>
  <div class="groups-list" data-cy="group-item">
    <SubtitleComponent
      v-if="label"
      :label="label"
      :to="to"
      :hide-link="hideLink"
      :link-text="linkText"
    />
    <!-- Loading skeleton -->
    <div
      v-if="loading"
      :class="[
        'groups-container',
        { 'groups-grid': layout === 'grid' }
      ]"
    >
      <div v-for="n in 6" :key="n" class="group-skeleton" :class="layout">
        <div class="skeleton-image">
          <q-skeleton height="150px" />
        </div>
        <div class="skeleton-content">
          <q-skeleton type="text" width="70%" class="q-mb-sm" />
          <q-skeleton type="text" width="50%" class="q-mb-xs" />
          <q-skeleton type="text" width="40%" class="q-mb-xs" />
          <div class="skeleton-footer">
            <q-skeleton type="text" width="30%" class="q-mr-sm" />
            <q-skeleton type="QBadge" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Groups Grid/List -->
      <ul :class="[
        'groups-container',
        { 'groups-grid': layout === 'grid' }
      ]" v-if="groups?.length">
        <li v-for="group in groups" :key="group.id">
          <GroupsItemComponent
            :group="group"
            :layout="layout"
          />
        </li>
      </ul>

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
  list-style: none;
  padding: 0;
  margin: 0;
  &.groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
}

.group-skeleton {
  margin-bottom: 16px;

  &.grid {
    display: flex;
    flex-direction: column;
    height: 300px;

    .skeleton-image {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
    }

    .skeleton-content {
      padding: 16px;
      flex: 1;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
    }
  }

  &.list {
    display: flex;
    align-items: stretch;
    min-height: 150px;

    .skeleton-image {
      width: 300px;
      min-width: 100px;
      border-radius: 8px;
      overflow: hidden;
    }

    .skeleton-content {
      padding: 16px;
      flex: 1;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
  }
}

.skeleton-footer {
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .group-skeleton.list {
    flex-direction: column;

    .skeleton-image {
      width: 100%;
      min-width: 0;
    }
  }
}
</style>
