<script setup lang="ts">
import { CategoryEntity, GroupEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'

interface Props {
  group: GroupEntity
}
defineEmits(['view'])
defineProps<Props>()

const { navigateToGroup } = useNavigation()
</script>

<template>
  <div class="row q-my-md q-gutter-md wrap">
    <q-img class="cursor-pointer rounded-borders" style="max-width: 300px; height: 150px;" @click="navigateToGroup(group.slug, group.id)" ratio="16/9" :src="getImageSrc(group.image)"/>
    <div class="col">
        <div class="text-h5 text-bold q-pa-none cursor-pointer elipsys" @click="navigateToGroup(group.slug, group.id)">{{ group.name }}</div>
        <div class="text-subtitle2" v-if="group.categories">
          {{ group.categories.map((c: number | CategoryEntity) => typeof c === 'object' ? c.name : '').join(', ') }}
        </div>
      <div class="text-subtitle2">{{ group.location }}</div>
      <div class="q-mt-sm text-body2">
        <span v-if="group.groupMembersCount" class="q-mr-md"><q-icon name="sym_r_people" /> {{ group.groupMembersCount }} members</span>
        <q-badge>{{ group.visibility }}</q-badge>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">

</style>
