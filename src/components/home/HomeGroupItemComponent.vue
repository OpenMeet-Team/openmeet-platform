<script setup lang="ts">
import { GroupEntity } from 'src/types'
import { truncateDescription } from 'src/utils/stringUtils'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { encodeNumberToLowercaseString } from 'src/utils/encoder.ts'
import { useRouter } from 'vue-router'

const router = useRouter()
interface Props {
  group: GroupEntity
}

defineProps<Props>()
defineEmits(['view'])
</script>

<template>
  <q-card class="group-card">
    <q-img :src="getImageSrc(group.image)" :ratio="16/9">
      <div class="absolute-bottom text-subtitle2 text-center bg-black-4 full-width">
        {{ group.name }}
      </div>
    </q-img>
    <q-card-section>
      <div class="text-h6">{{ group.name }}</div>
      <div class="text-subtitle2">{{ group.categories }}</div>
    </q-card-section>
    <q-card-section class="q-pt-none" v-if="group.description">
      {{ truncateDescription(group.description) }}
    </q-card-section>
    <q-card-actions align="right">
      <q-btn flat color="primary" label="View Group" @click="router.push({ name: 'GroupPage', params: { slug: group.slug, id: encodeNumberToLowercaseString(group.id) } })"/>
    </q-card-actions>
  </q-card>
</template>

<style scoped lang="scss">

</style>
