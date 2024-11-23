<script setup lang="ts">
import { GroupEntity } from 'src/types'
import { getImageSrc } from 'src/utils/imageUtils'

interface Props {
  group: GroupEntity
}

defineProps<Props>()

</script>

<template>
  <router-link class="router-link-inherit" :to="{ name: 'GroupPage', params: { slug: group.slug } }">
    <q-card flat class="group-card">
      <q-card-section class="q-pa-none">
        <q-img :src="getImageSrc(group.image)"
             :ratio="16/9"
             spinner-color="primary"
             class="rounded-borders"
             spinner-size="40px"
      />
      </q-card-section>
      <q-item-section class="q-mt-sm">
        <q-item-label lines="2" class="elipsys text-bold">{{ group.name }}</q-item-label>
      </q-item-section>
    </q-card>
  </router-link>

</template>

<style scoped lang="scss">

</style>
