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
    <q-img
      class="cursor-pointer event-image"
      @click="navigateToEvent(event)"
      :src="getImageSrc(event.image)"
      :ratio="16 / 9"
    >
      <div class="absolute-top-left q-pa-xs">
        <q-badge>{{ event.type }}</q-badge>
      </div>
    </q-img>

    <div class="event-content">
      <div
        class="text-subtitle1 text-bold cursor-pointer"
        @click="navigateToEvent(event)"
      >
        {{ event.name }}
      </div>
      <div class="text-caption">{{ formatDate(event.startDate) }}</div>
      <div class="text-caption">{{ event.location }}</div>
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

    .event-image {
      width: 100%;
    }

    .event-content {
      padding: 16px;
      flex: 1;
    }
  }

  &.list {
    display: flex;
    align-items: stretch;

    .event-image {
      width: 160px;
      min-width: 160px;
      border-radius: 8px;
      overflow: hidden;

      @media (min-width: 600px) {
        width: 240px;
        min-width: 240px;
      }
    }

    .event-content {
      padding: 16px;
      flex: 1;
    }
  }
}
</style>
