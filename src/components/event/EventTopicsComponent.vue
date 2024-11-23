<script setup lang="ts">
import { computed } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from 'src/stores/event-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'

const event = computed(() => useEventStore().event)

</script>

<template>
  <div class="c-event-topics-component" v-if="event">
    <SubtitleComponent :count="event.topics?.length" label="Comments" class="q-mt-lg q-px-md c-event-topics-component" hide-link />

    <DiscussionComponent v-if="event.messages && event.topics" :messages="event?.messages ?? []" :topics="event?.topics ?? []" :context-type="'event'"
      :context-id="event?.slug ?? ''" :permissions="{
        canRead: true,
        canWrite: true,
        canManage: true
      }" />

    <NoContentComponent v-else icon="sym_r_error" label="No comments yet" />
  </div>
</template>
