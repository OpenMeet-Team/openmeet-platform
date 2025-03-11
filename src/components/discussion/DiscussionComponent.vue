<template>
  <div class="c-discussion-component">
    <q-pull-to-refresh @refresh="refreshMessages">
      <!-- Messages Loading Section -->
      <q-inner-loading :showing="isLoading">
        <q-spinner-dots size="40px" color="primary" />
      </q-inner-loading>

      <!-- Messages Section -->
      <q-card-section v-if="!messageTree.length && !isLoading">
        <no-content-component icon="sym_r_comment"
          :label="props.permissions?.canWrite ? 'Start the conversation' : 'No comments yet'" />
      </q-card-section>

      <!-- Input Section -->
      <q-input data-cy="discussion-input" class="q-px-md q-py-md" ref="newCommentInput" filled v-model="newComment" label="Leave a new comment" @keyup.enter="sendComment" counter
        :disable="!props.permissions?.canWrite" maxlength="700">
        <template v-slot:after>
          <q-btn data-cy="discussion-send-button" :loading="useDiscussionStore().isSending" icon="sym_r_send" round color="primary" @click="sendComment" :disabled="!newComment.trim()" />
        </template>
      </q-input>

      <!-- Message List -->
      <div v-if="messageTree.length">
        <!-- Load More Button -->
        <div class="text-center q-pa-md" v-if="hasMoreMessages">
          <q-btn flat color="primary" @click="loadMoreMessages" :loading="isLoadingMore">
            Load Earlier Messages
          </q-btn>
        </div>

        <DiscussionTopicComponent class="q-px-md q-py-none" :expanded="expanded"
          @update:expanded="expanded = $event" :can-moderate="props.permissions?.canManage"
          :can-reply="props.permissions?.canWrite" v-for="topic in messageTree" :topic="topic" :key="topic.topicName" />
      </div>
    </q-pull-to-refresh>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import DiscussionTopicComponent from './DiscussionTopicComponent.vue'
import { useDiscussionStore } from '../../stores/discussion-store'
import DOMPurify from 'dompurify'

import { MatrixMessage } from '../../types/matrix'

interface Props {
  messages?: MatrixMessage[]
  topics?: { name: string }[]
  contextType: 'event' | 'group'
  contextId: string
  permissions: {
    canRead: boolean
    canWrite: boolean
    canManage: boolean
  }
}

// Component state
const newComment = ref<string>('')
const expanded = ref<string[]>([])
const isLoading = ref<boolean>(false)
const isLoadingMore = ref<boolean>(false)
const hasMoreMessages = ref<boolean>(false)
const paginationToken = ref<string>('')

import { ensureMatrixUser } from '../../utils/matrixUtils'

// Initialize the discussion state and load messages
onMounted(async () => {
  useDiscussionStore().actionSetDiscussionState({
    messages: props.messages || [],
    topics: props.topics || [],
    contextType: props.contextType,
    contextId: props.contextId,
    permissions: props.permissions
  })

  // Ensure user has Matrix credentials before loading messages
  if (props.permissions?.canWrite) {
    await ensureMatrixUser()
  }

  // Load initial messages
  await loadMessages()
})

onBeforeUnmount(() => {
  useDiscussionStore().$reset()
})

// Compute the message tree structure for display
const messageTree = computed(() => {
  return useDiscussionStore().topics?.map(topic => {
    // Filter messages by topic - look for topic in content.topic for Matrix messages
    const topicMessages = useDiscussionStore().messages?.filter(
      message => {
        // For Matrix messages, check content.topic
        if ('content' in message && 'topic' in message.content) {
          return message.content.topic === topic.name
        }
        return false
      }
    ).sort((a, b) => {
      // For Matrix messages, sort by timestamp
      if ('origin_server_ts' in a && 'origin_server_ts' in b) {
        return a.origin_server_ts - b.origin_server_ts
      }
      return 0
    })

    const [firstMessage, ...restMessages] = topicMessages ?? []

    return {
      topicName: topic.name,
      message: firstMessage,
      children: restMessages.map(message => ({
        id: 'event_id' in message ? message.event_id : '',
        label: 'sender' in message ? message.sender : '',
        content: 'content' in message && 'body' in message.content ? message.content.body : '',
        timestamp: 'origin_server_ts' in message ? message.origin_server_ts : 0,
        message
      }))
    }
  }).filter(topic => topic.message !== undefined) // Filter out topics with no messages
})

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  topics: () => [],
  permissions: () => ({
    canRead: true,
    canWrite: false,
    canManage: false
  })
})

// Load initial messages
const loadMessages = async () => {
  if (!props.permissions.canRead) return

  isLoading.value = true
  try {
    const result = await useDiscussionStore().actionLoadMessages()
    if (result) {
      hasMoreMessages.value = !!result.end
      paginationToken.value = result.end
    }
  } catch (err) {
    console.error('Error loading messages:', err)
  } finally {
    isLoading.value = false
  }
}

// Load more messages (pagination)
const loadMoreMessages = async () => {
  if (!paginationToken.value || isLoadingMore.value) return

  isLoadingMore.value = true
  try {
    const result = await useDiscussionStore().actionLoadMessages(50, paginationToken.value)
    if (result) {
      hasMoreMessages.value = !!result.end
      paginationToken.value = result.end
    }
  } catch (err) {
    console.error('Error loading more messages:', err)
  } finally {
    isLoadingMore.value = false
  }
}

// Refresh messages (pull-to-refresh)
const refreshMessages = async (done: () => void) => {
  try {
    await loadMessages()
  } finally {
    done()
  }
}

// Send a new comment
const sendComment = async () => {
  if (!props.permissions?.canWrite) return

  const message = DOMPurify.sanitize(newComment.value.trim())
  if (!message) return

  // Store the message temporarily
  const tempMessage = newComment.value
  newComment.value = ''

  // Ensure the user has a Matrix user ID before sending
  const hasMatrixId = await ensureMatrixUser()
  if (!hasMatrixId) {
    newComment.value = tempMessage
    return
  }

  // Use the first topic as the default topic for new comments
  // If no topics exist, create a "General" topic
  const defaultTopic = useDiscussionStore().topics.length > 0
    ? useDiscussionStore().topics[0].name
    : 'General'

  useDiscussionStore().actionSendMessage(message, defaultTopic).catch(error => {
    console.error('Failed to send message:', error)
    newComment.value = message
  })
}

</script>
