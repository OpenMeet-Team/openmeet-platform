<script setup lang="ts">
import { computed } from 'vue'
import SubtitleComponent from '../common/SubtitleComponent.vue'
import { useEventStore } from 'src/stores/event-store'
import DiscussionComponent from '../discussion/DiscussionComponent.vue'

const event = computed(() => useEventStore().event)

</script>

<template>
    <div class="c-event-topics-component" v-if="event">
        <SubtitleComponent label="Comments" class="q-mt-lg q-px-md c-event-topics-component" />

        <DiscussionComponent :messages="event?.comments ?? []" :topics="event?.topics ?? []" />
    </div>
</template>
