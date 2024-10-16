<script setup lang="ts">
import { CategoryEntity, GroupEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'
import { truncateDescription } from '../../utils/stringUtils.ts'

interface Props {
  group: GroupEntity
}
defineEmits(['view'])
defineProps<Props>()

const { navigateToGroup } = useNavigation()
</script>

<template>
  <q-card class="event-card shadow-0 q-my-xl">
    <q-card-section horizontal>
      <q-img class="cursor-pointer" @click="navigateToGroup(group.slug, group.id)" style="max-width: 150px" :src="getImageSrc(group.image)"/>
      <q-card-actions vertical class="justify-around q-px-md">
        <div class="text-h5 q-pa-none cursor-pointer" @click="navigateToGroup(group.slug, group.id)">{{ group.name }}</div>
        <div class="text-subtitle2" v-if="group.categories">
          {{ group.categories.map((c: number | CategoryEntity) => typeof c === 'object' ? c.name : '').join(', ') }}
        </div>
        <div class="text-subtitle2">{{ group.location }}</div>
        <div class="text-body2" v-if="group.description">{{ truncateDescription(group.description) }}</div>
        <div class="q-mt-sm text-body2">
          <span v-if="group.membersCount" class="q-mr-md"><q-icon name="sym_r_people" /> {{ group.membersCount }} members</span>
          <q-badge>{{ group.visibility }}</q-badge>
        </div>
      </q-card-actions>
    </q-card-section>
  </q-card>
</template>

<style scoped lang="scss">

</style>
