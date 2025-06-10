<script setup lang="ts">
import { GroupEntity } from '../../types'
import { getImageSrc } from '../../utils/imageUtils'
import { useNavigation } from '../../composables/useNavigation'
import { computed } from 'vue'

interface Props {
  group: GroupEntity;
  layout?: 'grid' | 'list';
}
defineEmits(['view'])
const props = defineProps<Props>()

const memberText = computed(() => {
  return props.group.groupMembersCount === 1 ? 'member' : 'members'
})

const { navigateToGroup } = useNavigation()
</script>

<template>
  <div class="group-item" :class="layout" data-cy="group-item">
    <!-- Group Image -->
    <div class="group-image-container">
      <q-img data-cy="group-item-image"
        :src="getImageSrc(group.image)"
        class="cursor-pointer group-image"
        @click="navigateToGroup(group)"
        :ratio="16 / 9"
        style="min-height: 150px"
        spinner-color="primary"
        loading="lazy"
      />
    </div>

    <!-- Group Info -->
    <div class="group-content">
      <div
        class="text-h5 cursor-pointer"
        @click="navigateToGroup(group)"
      >
        {{ group.name }}
      </div>

      <!-- Categories -->
      <div v-if="group.categories" class="text-body1">
        {{
          group.categories
            .map((c) => (typeof c === "object" ? c.name : ""))
            .join(", ")
        }}
      </div>

      <!-- Location -->
      <div class="text-body1">{{ group.location }}</div>

      <!-- Member Count & Visibility -->
      <div class="group-footer">
        <span v-if="group.groupMembersCount">
          <q-icon name="sym_r_people" />
          {{ group.groupMembersCount }} {{ memberText }}
        </span>
        <q-badge v-if="group.visibility" :class="[group.groupMembersCount ? 'q-ml-sm' : '']">{{ group.visibility }}</q-badge>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.group-item {
  margin-bottom: 16px;

  &:last-child {
    margin-bottom: 0;
  }

  &.grid {
    display: flex;
    flex-direction: column;
    height: 100%;
    margin-bottom: 0;

    .group-image-container {
      width: 100%;

      .group-image {
        border-radius: 8px;
        overflow: hidden;
        min-height: 150px;
      }
    }

    .group-content {
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

    .group-image-container {
      width: 300px;

      .group-image {
        border-radius: 8px;
        overflow: hidden;
        min-height: 150px;
      }
    }

    .group-content {
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

    // Mobile responsive: stack vertically on smaller screens
    @media (max-width: 768px) {
      flex-direction: column;

      .group-image-container {
        width: 100%;
      }
    }
  }
}
</style>
