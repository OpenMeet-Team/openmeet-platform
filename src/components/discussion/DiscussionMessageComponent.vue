<template>
  <q-card flat bordered class="q-pa-md c-discussion-message-component">
    <div class="row items-center justify-between full-width">
      <div class="column">
        <div class="row items-center">
          <span class="text-weight-medium">{{ message.sender_full_name }}</span>
          <span class="q-ml-md text-caption text-grey" v-if="message.timestamp">
            {{ getHumanReadableDateDifference(new Date(message.timestamp * 1000), new Date()) }} ago
          </span>
        </div>
      </div>
      <div class="row items-center q-gutter-x-sm">
        <q-btn v-if="useDiscussionStore().permissions.canWrite" flat round size="sm" icon="sym_r_reply" @click.stop="onReply" />
        <template v-if="useDiscussionStore().permissions.canManage">
          <q-btn class="hidden" flat round size="sm" icon="sym_r_edit" @click.stop="onEdit" /> <!-- TODO: make visible -->
          <q-btn class="hidden" flat round size="sm" icon="sym_r_delete" @click.stop="onDelete" /> <!-- TODO: make visible -->
        </template>
      </div>
    </div>
    <div class="text-body2 q-mt-md" v-html="message.content"></div>
  </q-card>
</template>

<script setup lang="ts">
import { useDiscussionStore } from 'src/stores/discussion-store'
import { ZulipMessageEntity } from 'src/types'
import { getHumanReadableDateDifference } from 'src/utils/dateUtils'

interface Props {
  message: ZulipMessageEntity
}

interface Emits {
  (e: 'delete', id: number): void
  (e: 'edit', id: number, content: string): void
  (e: 'reply', id: number): void
}

const emit = defineEmits<Emits>()

const onDelete = () => {
  emit('delete', props.message.id)
}

const onReply = () => {
  emit('reply', props.message.id)
}

const onEdit = () => {
  emit('edit', props.message.id, props.message.content.replace(/<\/?[^>]+(>|$)/g, ''))
}

const props = defineProps<Props>()
</script>
