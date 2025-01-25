<template>
  <div class="c-discussion-component">

    <!-- Messages Section -->
    <q-card-section v-if="!props.messages.length">
      <no-content-component icon="sym_r_comment"
        :label="props.permissions?.canWrite ? 'Start the conversation' : 'No comments yet'" />
    </q-card-section>

    <!-- Input Section -->
    <q-input class="q-px-md q-py-md" ref="newCommentInput" filled v-model="newComment" label="Leave a new comment" @keyup.enter="sendComment" counter
      :disable="!props.permissions?.canWrite" maxlength="700">
      <template v-slot:after>
        <q-btn :loading="useDiscussionStore().isSending" icon="sym_r_send" round color="primary" @click="sendComment" :disabled="!newComment.trim()" />
      </template>
    </q-input>

    <DiscussionTopicComponent class="q-px-md q-py-none" :expanded="expanded"
      @update:expanded="expanded = $event" :can-moderate="props.permissions?.canManage"
      :can-reply="props.permissions?.canWrite" v-for="topic in messageTree" :topic="topic" :key="topic.topicName" />

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ZulipMessageEntity, ZulipTopicEntity } from '../../types/model'
import DiscussionTopicComponent from './DiscussionTopicComponent.vue'
import { useDiscussionStore } from '../../stores/discussion-store'
import DOMPurify from 'dompurify'

interface Props {
  messages: ZulipMessageEntity[]
  topics: ZulipTopicEntity[]
  contextType: 'event' | 'group'
  contextId: string
  permissions: {
    canRead: boolean
    canWrite: boolean
    canManage: boolean
  }
}

onMounted(() => {
  useDiscussionStore().actionSetDiscussionState({
    messages: props.messages,
    topics: props.topics,
    contextType: props.contextType,
    contextId: props.contextId,
    permissions: props.permissions
  })
})

onBeforeUnmount(() => {
  useDiscussionStore().$reset()
})

const messageTree = computed(() => {
  return useDiscussionStore().topics?.map(topic => {
    const topicMessages = useDiscussionStore().messages?.filter(
      message => message.subject === topic.name
    ).sort((a, b) => a.id - b.id)

    const [firstMessage, ...restMessages] = topicMessages ?? []

    return {
      topicName: topic.name,
      message: firstMessage,
      children: restMessages.map(message => ({
        id: message.id,
        label: message.sender_full_name,
        content: message.content,
        timestamp: message.timestamp,
        message
      }))
    }
  })
})

const props = withDefaults(defineProps<Props>(), {
  permissions: () => ({
    canRead: true,
    canWrite: false,
    canManage: false
  })
})
// State
const newComment = ref<string>('')
const expanded = ref<string[]>([])

// Actions
const sendComment = () => {
  if (!props.permissions?.canWrite) return

  const message = DOMPurify.sanitize(newComment.value.trim())
  if (!message) return

  newComment.value = ''

  useDiscussionStore().actionSendMessage(message, new Date().toISOString()).catch(error => {
    newComment.value = message
    throw error
  })
}

</script>
