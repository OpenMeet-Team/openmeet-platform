<script setup lang="ts">

import { computed } from 'vue'
import { useEventStore } from '../../stores/event-store'
import { getImageSrc } from '../../utils/imageUtils'

const event = computed(() => useEventStore().event)
</script>

<template>
    <div v-if="event?.group" class="row items-center q-py-sm q-px-md">
      <q-btn round class="q-mr-md" :to="{ name: 'GroupPage', params: { slug: event.group.slug } }">
        <q-avatar size="48px">
          <img :src="getImageSrc(event.group?.image)" :alt="event.group?.name">
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold cursor-pointer"><router-link class="router-link-inherit" :to="{ name: 'GroupPage', params: { slug: event.group.slug } }">{{ event.group.name }}</router-link></q-item-label>
      </div>
    </div>
    <div v-else-if="event?.user" class="row items-center q-py-sm q-px-md">
      <q-btn round class="q-mr-md" :to="{ name: 'MemberPage', params: { slug: event.user.slug } }">
        <q-avatar size="48px">
          <img :src="getImageSrc(event.user?.photo)" :alt="event.user?.name">
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold cursor-pointer"><router-link class="router-link-inherit" :to="{ name: 'MemberPage', params: { slug: event.user.slug } }">{{ event.user.name }}</router-link></q-item-label>
      </div>
    </div>
</template>

<style scoped lang="scss">

</style>
