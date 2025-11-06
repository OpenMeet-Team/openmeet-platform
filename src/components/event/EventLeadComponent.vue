<script setup lang="ts">

import { computed } from 'vue'
import { useEventStore } from '../../stores/event-store'
import { getImageSrc } from '../../utils/imageUtils'
import { useUserIdentifier } from '../../composables/useUserIdentifier'

const event = computed(() => useEventStore().event)
const { getUserIdentifier } = useUserIdentifier()

// Get the best identifier for the user profile link (handle > DID > slug)
const userIdentifier = computed(() => {
  return event.value?.user ? getUserIdentifier(event.value.user) : null
})
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
      <q-btn round class="q-mr-md" :to="{ name: 'MemberPage', params: { slug: userIdentifier } }">
        <q-avatar size="48px">
          <img :src="getImageSrc(event.user?.photo)" :alt="event.user?.name">
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold cursor-pointer"><router-link class="router-link-inherit" :to="{ name: 'MemberPage', params: { slug: userIdentifier } }">{{ event.user.name }}</router-link></q-item-label>
      </div>
    </div>
</template>

<style scoped lang="scss">

</style>
