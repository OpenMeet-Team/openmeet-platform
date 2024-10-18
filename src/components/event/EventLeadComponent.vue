<script setup lang="ts">

import { computed } from 'vue'
import { useEventStore } from 'stores/event-store.ts'
import { getImageSrc } from 'src/utils/imageUtils.ts'
import { useNavigation } from 'src/composables/useNavigation.ts'

const event = computed(() => useEventStore().event)
const { navigateToGroup } = useNavigation()
</script>

<template>
    <div v-if="event?.group" class="row items-center q-py-sm">
      <q-btn round class="q-mr-md" @click="navigateToGroup(event.group.slug, event.group.id)">
        <q-avatar size="48px">
          <img  v-if="event.group.image" :src="getImageSrc(event.group.image)" :alt="event.group.name">
          <q-icon name="sym_r_group"/>
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold"><q-btn @click="navigateToGroup(event.group.slug, event.group.id)" flat size="md" padding="none" no-caps :label="event.group.name"/></q-item-label>
      </div>
    </div>
    <div v-else-if="event?.user" class="row items-center q-py-sm">
      <q-btn round class="q-mr-md">
        <q-avatar size="48px">
          <img v-if="event.user.photo" :src="getImageSrc(event.user.photo)" :alt="event.user.name">
          <q-icon name="sym_r_person"/>
        </q-avatar>
      </q-btn>
      <div>
        <q-item-label>Hosted by</q-item-label>
        <q-item-label class="text-bold">{{ event.user.name }}</q-item-label>
      </div>
    </div>
</template>

<style scoped lang="scss">

</style>
