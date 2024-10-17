<script setup lang="ts">

import { computed } from 'vue'
import { useEventStore } from 'stores/event-store.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'

const event = computed(() => useEventStore().event)
</script>

<template>
    <div v-if="event?.user" class="row items-center q-py-sm">
      <q-btn round class="q-mr-md">
        <q-avatar size="48px">
          <img :src="getImageSrc(event.user.photo, 'https://placehold.co/100')">
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold">{{ event.user.name || event.user.firstName + ' ' + event.user.lastName }}</q-item-label>
      </div>
    </div>

</template>

<style scoped lang="scss">

</style>
