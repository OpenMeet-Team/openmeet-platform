<script setup lang="ts">
import { GroupEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'
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
  <div class="group-item" :class="layout">
    <!-- Group Image -->
    <q-img
      :src="getImageSrc(group.image)"
      class="cursor-pointer group-image"
      @click="navigateToGroup(group)"
      :ratio="16 / 9"
    />

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

    .group-image {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
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

    .group-image {
      width: 160px;
      min-width: 160px;
      border-radius: 8px;
      overflow: hidden;

      @media (min-width: 600px) {
        width: 240px;
        min-width: 240px;
      }

      @media (min-width: 1024px) {
        width: 300px;
        min-width: 300px;
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
}
</style>
