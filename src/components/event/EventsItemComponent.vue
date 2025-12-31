<script setup lang="ts">
import { EventEntity } from '../../types'
import { getImageSrc } from '../../utils/imageUtils'
import { formatDate } from '../../utils/dateUtils'
import { getSourceColor } from '../../utils/eventUtils'

interface Props {
  event: EventEntity;
  layout?: 'grid' | 'list';
}

defineProps<Props>()

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
  <article class="event-item" :class="layout" data-cy="events-item">
    <div class="event-image-container">
      <router-link :to="{ name: 'EventPage', params: { slug: event.slug } }">
        <q-img
          loading="lazy"
          class="event-image"
          :src="getImageSrc(event.image)"
          :ratio="16 / 9"
          :alt="event.name"
          style="min-height: 150px"
          spinner-color="primary"
        />
      </router-link>
    </div>

    <div class="event-content">
      <router-link
        :to="{ name: 'EventPage', params: { slug: event.slug } }"
        class="text-subtitle1 text-bold"
        style="color: inherit; text-decoration: none;"
      >
        {{ event.name }}
      </router-link>
      <div class="text-caption">{{ formatDate(event.startDate) }}</div>
      <div class="text-caption">{{ event.location }}</div>
      <div class="text-caption badges-container">
        <q-badge>{{ event.type }}</q-badge>
        <q-badge
          v-if="event.status === 'cancelled'"
          color="red"
          class="q-ml-sm"
        >
          <q-icon name="sym_r_cancel" size="xs" class="q-mr-xs" />
          Cancelled
        </q-badge>
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
        <q-badge
          v-if="event.attendeesCount"
          color="purple"
          class="q-ml-sm"
        >
          <q-icon name="sym_r_people" size="xs" class="q-mr-xs" />
          {{ event.attendeesCount }} attending
        </q-badge>
      </div>
      <router-link
        v-if="event.group"
        :to="{ name: 'GroupPage', params: { slug: event.group.slug } }"
        class="text-caption"
        style="color: inherit; text-decoration: none;"
      >
        {{ event.group.name }}
      </router-link>
    </div>
  </article>
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
        min-height: 150px;

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
        min-height: 150px;
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
  flex-wrap: wrap;
  gap: 4px;
}

@media (max-width: 700px) {
  .event-item.list {
    flex-direction: column;
    align-items: stretch;

    .event-image-container {
      width: 100% !important;
      min-width: 0 !important;
    }
    .event-image {
      width: 100% !important;
      min-width: 0 !important;
      max-height: 180px;
      object-fit: cover;
    }
    .event-content {
      padding: 10px !important;
      font-size: 0.97em;
    }
  }
}
</style>
