<script setup lang="ts">
import { CategoryEntity, GroupEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { computed } from 'vue'

interface Props {
  group: GroupEntity
}
defineEmits(['view'])
const props = defineProps<Props>()

const memberText = computed(() => {
  return props.group.groupMembersCount === 1 ? 'member' : 'members'
})

const { navigateToGroup } = useNavigation()
</script>

<template>
  <div class="c-groups-item-component row q-mb-lg q-col-gutter-lg" data-cy="groups-item-component">
    <div class="col-12 col-sm-4">
      <q-img height="150px" class="cursor-pointer rounded-borders" data-cy="groups-item-image"
        @click="navigateToGroup(group)" ratio="16/9" :src="getImageSrc(group.image)" />
    </div>
    <div class="col-12 col-sm-8 column">
      <div class="text-h5 text-bold q-pa-none cursor-pointer elipsys" data-cy="groups-item-name" @click="navigateToGroup(group)">{{
        group.name }}</div>
      <div class="text-subtitle2" v-if="group.categories">
        {{ group.categories.map((c: number | CategoryEntity) => typeof c === 'object' ? c.name : '').join(', ') }}
      </div>
      <div class="text-subtitle2" data-cy="groups-item-location">{{ group.location }}</div>
      <q-space />
      <div class="q-mt-sm text-body2">
        <span v-if="group.groupMembersCount" class="q-mr-md">
          <q-icon name="sym_r_people" />
          {{ group.groupMembersCount }} {{ memberText }}
        </span>
        <q-badge>{{ group.visibility }}</q-badge>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
