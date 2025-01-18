<script setup lang="ts">
import { EventEntity } from 'src/types'
import EventsItemComponent from './EventsItemComponent.vue'
import NoContentComponent from '../global/NoContentComponent.vue'
import SpinnerComponent from '../common/SpinnerComponent.vue'
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

    <SpinnerComponent v-if="loading" />

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
</style>
