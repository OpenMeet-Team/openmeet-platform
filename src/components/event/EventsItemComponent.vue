<script setup lang="ts">
import { EventEntity } from '../../types'
import { getImageSrc } from '../../utils/imageUtils'
import { useNavigation } from '../../composables/useNavigation'
import { formatDate } from '../../utils/dateUtils'
import { getSourceColor } from '../../utils/eventUtils'

interface Props {
  event: EventEntity;
  layout?: 'grid' | 'list';
}

defineProps<Props>()
const { navigateToEvent, navigateToGroup } = useNavigation()

/**
 * Format a series slug to be more readable
 */
const formatSeriesSlug = (slug: string): string => {
  // Convert slug to title case (e.g., "my-event-series" → "My Event Series")
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
</script>

<template>
  <div class="event-item" :class="layout" data-cy="events-item">
    <div class="event-image-container">
      <q-img
        loading="lazy"
        class="cursor-pointer event-image"
        @click="navigateToEvent(event)"
        :src="getImageSrc(event.image)"
        :ratio="16 / 9"
      />
    </div>

    <div class="event-content">
      <div
        class="text-subtitle1 text-bold cursor-pointer"
        @click="navigateToEvent(event)"
      >
        {{ event.name }}
      </div>
      <div class="text-caption">{{ formatDate(event.startDate) }}</div>
      <div class="text-caption">{{ event.location }}</div>
      <div class="text-caption badges-container">
        <q-badge>{{ event.type }}</q-badge>
        <q-badge
          v-if="event.sourceType"
          :color="getSourceColor(event.sourceType)"
          class="q-ml-sm"
        >
          <q-icon
            v-if="event.sourceType === 'bluesky'"
            name="fa-brands fa-bluesky"
            size="xs"
            class="q-mr-xs"
          />
          {{ event.sourceType }}
        </q-badge>
        <q-badge
          v-if="event.seriesSlug"
          color="teal"
          class="q-ml-sm"
        >
          <q-icon name="sym_r_event_repeat" size="xs" class="q-mr-xs" />
          {{ event.series?.name || formatSeriesSlug(event.seriesSlug) }}
        </q-badge>
      </div>
      <div
        v-if="event.group"
        class="text-caption cursor-pointer"
        @click="navigateToGroup(event.group)"
      >
        {{ event.group.name }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.event-item {
  margin-bottom: 16px;

  &.grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    margin-bottom: 0;

    .event-image-container {
      width: 100%;
      min-width: 100px;

      .event-image {
        border-radius: 8px;
        min-width: 100px;

        :deep(.q-img__content) {
          background-size: cover;
          background-position: center;
        }
      }
    }

    .event-content {
      padding: 16px;
      flex: 1;
      border-radius: 8px;

      // Light mode
      background: $primary-light-gray;
      color: $purple-600;

      body.body--dark & {
        background: $purple-600;
        color: white;
      }
    }
  }

  &.list {
    display: flex;
    align-items: stretch;

    .event-image-container {
      width: 300px;
      min-width: 100px;

      .event-image {
        border-radius: 8px;
        overflow: hidden;
        min-width: 100px;
      }
    }

    .event-content {
      padding: 16px;
      flex: 1;
      border-radius: 8px;

      // Light mode
      background: $primary-light-gray;
      color: $purple-600;

      body.body--dark & {
        background: $purple-600;
        color: white;
      }
    }
  }
}

.badges-container {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
