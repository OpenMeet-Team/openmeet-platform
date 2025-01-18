<script setup lang="ts">
import { EventEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils'
import { useNavigation } from 'src/composables/useNavigation'
import { formatDate } from 'src/utils/dateUtils'

interface Props {
  event: EventEntity;
  layout?: 'grid' | 'list';
}

defineProps<Props>()
const { navigateToEvent, navigateToGroup } = useNavigation()
</script>

<template>
  <div class="event-item" :class="layout">
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
      <div class="text-caption">
        <q-badge>{{ event.type }}</q-badge>
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

      .event-image {
        border-radius: 8px;

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

      .event-image {
        border-radius: 8px;
        overflow: hidden;
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
</style>
