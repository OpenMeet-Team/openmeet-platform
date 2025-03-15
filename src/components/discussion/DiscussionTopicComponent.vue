<template>
  <div class="c-discussion-topic-component" v-if="topic.message">
    <DiscussionMessageComponent class="q-mt-md" :message="topic.message"
      @delete="onDelete" @reply="onReply" @edit="onEdit" />

    <div class="q-ml-xl">
      <DiscussionMessageComponent class="q-mt-md" v-for="child in topic.children" :message="child.message"
        :key="child.id" @delete="onDelete" @reply="onReply" @edit="onEdit" />
    </div>
    <div class="q-pa-md">
      <!-- Edit Form -->
      <template v-if="editingMessageId === topic.message.id">
        <q-input :rules="[val => !!val || 'Message is required']" ref="editInput" v-model="editContent" filled autogrow
          class="q-mb-sm" @keyup.enter="onUpdateMessage" />
        <div class="row justify-end q-gutter-x-sm">
          <q-btn flat label="Cancel" @click="editingMessageId = null" />
          <q-btn :loading="useDiscussionStore().isUpdating" color="primary" label="Save" @click="onUpdateMessage" />
        </div>
      </template>

      <!-- Reply Form -->
      <template v-else-if="replyingToId === topic.message.id">
        <q-input counter maxlength="700" :rules="[val => !!val || 'Message is required']" ref="replyInput" v-model="replyContent" filled
          autogrow placeholder="Write your reply..." @keyup.enter="sendReply" class="q-mb-sm" />
        <div class="row justify-end q-gutter-x-sm">
          <q-btn flat label="Cancel" @click="replyingToId = null" />
          <q-btn :loading="useDiscussionStore().isReplying" color="primary" label="Reply" @click="sendReply" />
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { MatrixMessage } from '../../types/matrix'
import DiscussionMessageComponent from './DiscussionMessageComponent.vue'
import { useDiscussionStore } from '../../stores/discussion-store'
import { useDiscussionDialog } from '../../composables/useDiscussionDialog'
import DOMPurify from 'dompurify'

const editingMessageId = ref<string | null>(null)
const replyingToId = ref<string | null>(null)
const editContent = ref('')
const replyContent = ref('')
const editInput = ref<HTMLInputElement | null>(null)
const replyInput = ref<HTMLInputElement | null>(null)

interface Props {
  topic: {
    topicName: string
    message: MatrixMessage
    children: {
      id: string
      label: string
      content: string
      timestamp: number
      message: MatrixMessage
    }[]
  }
  canModerate?: boolean
  canReply?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canModerate: false,
  canReply: false
})

defineEmits<{
  reply: [parentId: string, message: string]
  update: [messageId: string, content: string]
  delete: [messageId: string]
}>()

const onReply = () => {
  // Get Matrix message event_id
  const messageId = props.topic.message.event_id

  replyingToId.value = messageId
  replyContent.value = ''

  nextTick(() => {
    replyInput.value?.focus()
  })
}

const sendReply = () => {
  const message = DOMPurify.sanitize(replyContent.value.trim())
  if (!message) return

  replyContent.value = ''

  useDiscussionStore().actionSendMessage(message, props.topic.topicName).then(() => {
    replyingToId.value = null
  })
}

const onEdit = (messageId: string, content: string) => {
  editingMessageId.value = messageId
  editContent.value = content

  nextTick(() => {
    editInput.value?.focus()
  })
}

const { openDeleteMessageDialog } = useDiscussionDialog()

const onUpdateMessage = () => {
  const message = DOMPurify.sanitize(editContent.value.trim())
  if (!message) return

  editContent.value = ''

  if (editingMessageId.value) {
    useDiscussionStore().actionUpdateMessage(editingMessageId.value, message).then(() => {
      editingMessageId.value = null
    })
  }
}

const onDelete = (messageId: string) => {
  openDeleteMessageDialog().onOk(() => {
    useDiscussionStore().actionDeleteMessage(messageId)
  })
}
</script>

<style scoped>
.q-tree__node-header {
  padding: 0 !important;
}
</style>
