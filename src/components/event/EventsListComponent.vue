<script setup lang="ts">
import { EventEntity } from '../../types'
import EventsItemComponent from './EventsItemComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { RouteLocationRaw } from 'vue-router'

interface Props {
  events?: EventEntity[]
  loading?: boolean
  layout?: 'grid' | 'list'
  emptyMessage?: string
  showPagination?: boolean
  currentPage?: number
  totalPages?: number
  label?: string
  hideLink?: boolean
  to?: RouteLocationRaw
  linkText?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  layout: 'list',
  emptyMessage: 'No events found',
  showPagination: false,
  currentPage: 1,
  label: 'Events',
  hideLink: false,
  to: () => ({ name: 'EventsPage' }),
  linkText: 'See all events'
})

const emit = defineEmits(['page-change', 'update:currentPage'])

const onPageChange = (page: number) => {
  emit('update:currentPage', page)
  emit('page-change', page)
}
</script>

<template>
  <div class="events-list">
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
        'events-container',
        { 'events-grid': layout === 'grid' }
      ]"
    >
      <div v-for="n in 6" :key="n" class="event-skeleton" :class="layout">
        <div class="skeleton-image">
          <q-skeleton height="150px" />
        </div>
        <div class="skeleton-content">
          <q-skeleton type="text" width="80%" class="q-mb-sm" />
          <q-skeleton type="text" width="60%" class="q-mb-xs" />
          <q-skeleton type="text" width="40%" class="q-mb-xs" />
          <div class="skeleton-badges">
            <q-skeleton type="QBadge" class="q-mr-sm" />
            <q-skeleton type="QBadge" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Events Grid/List -->
      <div
        :class="[
          'events-container',
          { 'events-grid': layout === 'grid' }
        ]"
        v-if="events?.length"
      >
        <EventsItemComponent
          v-for="event in events"
          :key="event.id"
          :event="event"
          :layout="layout"
        />
      </div>

      <!-- Empty State -->
      <slot name="empty" v-if="!events?.length">
        <NoContentComponent
          :label="emptyMessage"
          icon="sym_r_event"
        />
      </slot>

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
.events-container {
  &.events-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }
}

.event-skeleton {
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

.skeleton-badges {
  display: flex;
  gap: 8px;
}

@media (max-width: 700px) {
  .event-skeleton.list {
    flex-direction: column;

    .skeleton-image {
      width: 100%;
      min-width: 0;
    }
  }
}
</style>
