<script setup lang="ts">
import { GroupEntity } from 'src/types'
import { encodeNumberToLowercaseString } from 'src/utils/encoder'
import { getImageSrc } from 'src/utils/imageUtils'

interface Props {
  group: GroupEntity
}

defineProps<Props>()

</script>

<template>
  <router-link class="router-link-inherit" :to="{ name: 'GroupPage', params: { slug: group.slug, id: encodeNumberToLowercaseString(group.id) } }">
    <q-card flat class="group-card">
      <q-img :src="getImageSrc(group.image)"
             :ratio="16/9"
             spinner-color="primary"
             class="rounded-borders"
             spinner-size="40px"
      />
      <q-item-section>
        <q-item-label lines="2" class="elipsys">{{ group.name }}</q-item-label>
      </q-item-section>
    </q-card>
  </router-link>

</template>

<style scoped lang="scss">

</style>
