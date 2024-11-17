<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventStore } from 'src/stores/event-store'
import { ZulipMessageEntity, ZulipTopicEntity } from 'src/types/model'

defineProps<{
    messages: ZulipMessageEntity[]
    topics: ZulipTopicEntity[]
}>()

const newComment = ref<string>('')
const event = computed(() => useEventStore().event)

const sendComment = () => {
  console.log('sendComment', newComment.value)
  const comment = newComment.value.trim()
  newComment.value = ''
  useEventStore().actionCreateEventComment(event.value?.ulid ?? '', comment)
}
</script>

<template>
    <div class="c-discussion-component">

        <q-input filled v-model="newComment" label="Leave a new comment" @keyup.enter="sendComment" counter maxlength="700">
            <template v-slot:after>
                <q-btn icon="sym_r_send" round color="primary" @click="sendComment" />
            </template>
        </q-input>

        <q-card-section v-if="!event?.topics?.length">
            <no-content-component icon="sym_r_comment" label="No comments yet" />
        </q-card-section>

        <!-- Separate topics with nested comments -->
        <!-- <div v-for="topic in event?.topics" :key="topic.id">
            <div class="text-h6">{{ topic.name }}</div>
            <q-chat-message v-for="comment in topic.comments" :key="comment.id" :name="comment.user?.name"
                :text="[comment.comment]" />
        </div>
        <q-chat-message v-for="comment in event?.comments" :key="comment.id" :name="comment.user?.name"
            :text="[comment.comment]" /> -->
    </div>
</template>
