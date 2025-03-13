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
import { useMessageStore } from '../../stores/unified-message-store'
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
const messageStore = useMessageStore()

import { ensureMatrixUser } from '../../utils/matrixUtils'

// Initialize the discussion state and load messages
onMounted(async () => {
  console.log('DiscussionComponent mounted for', props.contextType, props.contextId)

  useDiscussionStore().actionSetDiscussionState({
    messages: props.messages || [],
    topics: props.topics || [],
    contextType: props.contextType,
    contextId: props.contextId,
    permissions: props.permissions
  })

  // Initialize unified message store with the same context
  if (props.contextId) {
    // The first parameter should be the Matrix room ID which is the same as contextId for events/groups
    console.log('Setting unified message store context:', props.contextId, props.contextType)
    messageStore.setContext(
      props.contextId,
      props.contextType,
      props.contextId
    )
    messageStore.setPermissions(props.permissions)

    // Specifically request to join this room for real-time updates
    // We need this because the auto-join from join-user-rooms might miss rooms
    import('../../services/matrixService').then(({ matrixService }) => {
      // Try multiple times with increasing delays to ensure we join the room
      const joinRoom = async (attempt = 1) => {
        try {
          if (matrixService.isConnected) {
            console.log(`!!!DEBUG!!! Attempt ${attempt}: Explicitly joining discussion room:`, props.contextId)
            const result = await matrixService.joinRoom(props.contextId)
            console.log('!!!DEBUG!!! Join room result:', result)

            // Force reload messages after joining
            if (result) {
              console.log('!!!DEBUG!!! Room joined successfully, loading messages')
              setTimeout(() => loadMessages(), 500)
            }
          } else if (attempt < 5) {
            console.log(`!!!DEBUG!!! Matrix not connected yet on attempt ${attempt}, will try again`)
            // Try again after delay
            setTimeout(() => joinRoom(attempt + 1), 1000 * attempt)
          }
        } catch (err) {
          console.error('!!!DEBUG!!! Error joining discussion room:', err)
          if (attempt < 5) {
            console.log(`!!!DEBUG!!! Will retry (attempt ${attempt + 1}/5) after delay`)
            setTimeout(() => joinRoom(attempt + 1), 1000 * attempt)
          }
        }
      }

      // Start the join attempt sequence after a short delay
      setTimeout(() => joinRoom(), 1000)
    }).catch(err => {
      console.error('!!!DEBUG!!! Error importing matrixService:', err)
    })
  }

  // Ensure user has Matrix credentials before loading messages
  if (props.permissions?.canRead) {
    await ensureMatrixUser()

    // Initialize Matrix connection for real-time events
    if (!messageStore.matrixConnected) {
      await messageStore.initializeMatrix()
    }
  }

  // Load initial messages
  await loadMessages()
})

onBeforeUnmount(() => {
  // Clean up both stores properly
  useDiscussionStore().$reset()

  // Clean up the message store but don't disconnect from Matrix
  // as other components might be using it
  messageStore.cleanup()
})

// Compute the message tree structure for display
const messageTree = computed(() => {
  // Get topics from discussion store
  const topics = useDiscussionStore().topics || []

  // Get messages from the unified message store for this context
  // Create reactive dependency by accessing through computed getter
  const messages = props.contextId
    ? messageStore.currentRoomMessages || [] : []

  console.log('!!!DEBUG!!! Recomputing message tree with', messages.length, 'messages in room', props.contextId)
  console.log('!!!DEBUG!!! Active room ID in messageStore:', messageStore.activeRoomId)

  // Log all messages for debugging
  if (messages.length > 0) {
    console.log('!!!DEBUG!!! All messages in unified store:', JSON.stringify(messages))
  }

  return topics?.map(topic => {
    // Filter messages by topic from the unified store
    const topicMessages = messages.filter(
      message => {
        // For Matrix messages, check content.topic
        if ('content' in message && 'topic' in message.content) {
          return message.content.topic === topic.name
        }
        // Add default topic for messages without one
        if ('content' in message && !message.content.topic) {
          message.content.topic = 'General'
          return topic.name === 'General'
        }
        return false
      }
    ).sort((a, b) => {
      // Sort by timestamp
      const aTime = a.origin_server_ts || a.timestamp || 0
      const bTime = b.origin_server_ts || b.timestamp || 0
      return aTime - bTime
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
    // Load messages from the unified message store
    const result = await messageStore.loadMessages()

    // Still load from discussion store to get topics
    // This will eventually be replaced once unified store fully supports topics
    const discussionResult = await useDiscussionStore().actionLoadMessages()

    // Use pagination token from either result
    if (result) {
      hasMoreMessages.value = !!result.end
      paginationToken.value = result.end
    } else if (discussionResult) {
      hasMoreMessages.value = !!discussionResult.end
      paginationToken.value = discussionResult.end
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
    // Load more messages from the unified message store
    const result = await messageStore.loadMessages(50, paginationToken.value)

    // Also load from discussion store to ensure all topics are loaded
    await useDiscussionStore().actionLoadMessages(50, paginationToken.value)

    // Update pagination state
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

  try {
    // Send message through the unified message store only
    // This will ensure real-time updates for all users
    await messageStore.sendMessage(message)
    console.log('Message sent successfully through unified message store')
  } catch (error) {
    console.error('Failed to send message:', error)
    newComment.value = message
  }
}

</script>
