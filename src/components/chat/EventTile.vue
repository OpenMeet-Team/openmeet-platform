<!--
Matrix Event Tile Component - Following Element Web patterns

This component displays Matrix events directly from the SDK without conversion,
following Element Web's proven approach for better performance and maintainability.
-->

<template>
  <div
    v-if="shouldDisplayEvent"
    class="event-tile"
    :class="[
      `event-type-${mxEvent.getType().replace('.', '-')}`,
      { 'own-event': isOwnEvent }
    ]"
  >
    <!-- Message Events -->
    <div v-if="isMessageEvent" class="message-event" :class="{ 'own-event-container': isOwnEvent }">
      <div class="row q-gutter-sm no-wrap" :class="{ 'reverse': isOwnEvent }">
        <!-- Avatar (left side for others, right side for own) -->
        <q-avatar
          v-if="!isOwnEvent || mode === 'desktop'"
          :size="mode === 'mobile' ? '28px' : '36px'"
          class="message-avatar"
          :class="{ 'order-last': isOwnEvent }"
        >
          <img v-if="senderAvatarUrl" :src="senderAvatarUrl" />
          <div v-else class="avatar-fallback" :style="{ backgroundColor: getSenderColor(senderId) }">
            {{ senderDisplayName?.charAt(0)?.toUpperCase() || '?' }}
          </div>
        </q-avatar>

        <!-- Message Content -->
        <div class="message-content" :class="{ 'own-message': isOwnEvent }">
          <!-- Sender Name (for others only) -->
          <div
            v-if="!isOwnEvent && showSenderNames"
            class="sender-name q-mb-xxs row items-baseline"
          >
            <div class="text-weight-bold sender-display-name" :style="{ color: getSenderColor(senderId) }">
              {{ senderDisplayName }}
            </div>
            <div class="message-time text-caption q-ml-sm">
              {{ formatTime(eventTimestamp) }}
            </div>
          </div>

          <!-- Message Body with Metadata Row -->
          <div class="message-body-container">
            <div class="message-body-wrapper" :class="{ 'own-message-body': isOwnEvent }">
              <MessageBody
                :mxEvent="mxEvent"
                :content="eventContent"
                :msgtype="msgtype"
              />
            </div>

            <!-- Message Metadata Row -->
            <div class="message-metadata row items-center q-mt-xxs" :class="{ 'justify-end': isOwnEvent, 'justify-start': !isOwnEvent }">
              <!-- Time/Date -->
              <div class="message-time text-caption text-grey-6">
                {{ formatTime(eventTimestamp) }}
              </div>

              <!-- Encryption Shield -->
              <q-icon
                v-if="isEncrypted"
                name="fas fa-shield-alt"
                size="12px"
                color="green-6"
                class="q-ml-xs"
              >
                <q-tooltip>Encrypted message</q-tooltip>
              </q-icon>

              <!-- Delete Icon (if can delete) -->
              <q-btn
                v-if="canDelete"
                flat
                dense
                size="sm"
                icon="fas fa-trash"
                color="grey-6"
                class="q-ml-xs delete-btn"
                @click="$emit('deleteMessage', mxEvent)"
              >
                <q-tooltip>Delete message</q-tooltip>
              </q-btn>

              <!-- Read Receipt Status (own messages only) -->
              <div v-if="isOwnEvent" class="read-status q-ml-xs">
                <q-icon
                  v-if="messageStatus === 'sent'"
                  name="fas fa-check"
                  size="12px"
                  color="grey-6"
                >
                  <q-tooltip>Sent</q-tooltip>
                </q-icon>
                <q-icon
                  v-else-if="messageStatus === 'delivered'"
                  name="fas fa-check-double"
                  size="12px"
                  color="grey-6"
                >
                  <q-tooltip>Delivered</q-tooltip>
                </q-icon>
                <q-icon
                  v-else-if="messageStatus === 'read'"
                  name="fas fa-check-double"
                  size="12px"
                  color="blue-6"
                >
                  <q-tooltip>Read</q-tooltip>
                </q-icon>
                <q-icon
                  v-else-if="messageStatus === 'failed'"
                  name="fas fa-exclamation-triangle"
                  size="12px"
                  color="red-6"
                >
                  <q-tooltip>Failed to send</q-tooltip>
                </q-icon>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- State Events (membership, etc.) -->
    <div v-else-if="isStateEvent" class="state-event text-center q-py-sm">
      <div class="text-caption text-grey-6">
        {{ getStateEventText() }}
      </div>
    </div>

    <!-- Redacted/Deleted Messages -->
    <div v-else-if="mxEvent.isRedacted()" class="redacted-event" :class="{ 'own-event-container': isOwnEvent }">
      <div class="row q-gutter-sm no-wrap" :class="{ 'reverse': isOwnEvent }">
        <!-- Avatar (same positioning as original message) -->
        <q-avatar
          v-if="!isOwnEvent || mode === 'desktop'"
          :size="mode === 'mobile' ? '28px' : '36px'"
          class="message-avatar"
          :class="{ 'order-last': isOwnEvent }"
        >
          <img v-if="senderAvatarUrl" :src="senderAvatarUrl" />
          <div v-else class="avatar-fallback" :style="{ backgroundColor: getSenderColor(senderId) }">
            {{ senderDisplayName?.charAt(0)?.toUpperCase() || '?' }}
          </div>
        </q-avatar>

        <!-- Redacted message content -->
        <div class="message-content" :class="{ 'own-message': isOwnEvent }">
          <div class="redacted-message-body" :class="{ 'own-redacted-body': isOwnEvent }">
            <q-icon name="fas fa-trash" class="q-mr-xs" />
            Message deleted
          </div>
        </div>
      </div>
    </div>

    <!-- Encrypted Events that couldn't be decrypted -->
    <div v-else-if="isEncryptedEvent" class="encrypted-event">
      <div class="text-caption text-orange q-pa-sm">
        <q-icon name="fas fa-lock" class="q-mr-xs" />
        Unable to decrypt message
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EventType, type MatrixEvent } from 'matrix-js-sdk'
import { format } from 'date-fns'
import MessageBody from './MessageBody.vue'

interface Props {
  mxEvent: MatrixEvent
  mode?: 'desktop' | 'mobile' | 'inline'
  showSenderNames?: boolean
  currentUserId?: string
  currentRoom?: any
  decryptionCounter?: number
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'desktop',
  showSenderNames: true
})

// Define emits
const emit = defineEmits<{
  deleteMessage: [event: MatrixEvent]
}>()

// Event properties following Element Web patterns
// Force reactivity by accessing event properties in computed and decryption counter
const eventContent = computed(() => {
  // Access decryptionCounter to force re-evaluation when events get decrypted
  const counter = props.decryptionCounter || 0
  const content = props.mxEvent.getContent()
  console.debug(`🎯 EventTile(${props.mxEvent.getId()}): Content accessed`, {
    hasContent: !!content,
    msgtype: content.msgtype,
    body: content.body?.substring(0, 50),
    isDecrypted: !content.encrypted,
    decryptionCounter: counter
  })
  return content
})
const senderId = computed(() => props.mxEvent.getSender() || '')
const eventTimestamp = computed(() => new Date(props.mxEvent.getTs()))
const eventType = computed(() => props.mxEvent.getType())
const msgtype = computed(() => eventContent.value.msgtype)

// Sender information
const isOwnEvent = computed(() => senderId.value === props.currentUserId)
const senderMember = computed(() => props.mxEvent.sender)
const senderDisplayName = computed(() => {
  return senderMember.value?.name ||
         senderMember.value?.rawDisplayName ||
         senderId.value.split(':')[0].substring(1) ||
         'Unknown'
})
const senderAvatarUrl = computed(() => {
  return senderMember.value?.getAvatarUrl('', 40, 40, 'crop') || undefined
})

// Event type checks following Element Web patterns
const isMessageEvent = computed(() => eventType.value === EventType.RoomMessage)
const isStateEvent = computed(() => {
  return eventType.value === EventType.RoomMember ||
         eventType.value === EventType.RoomName ||
         eventType.value === EventType.RoomTopic ||
         eventType.value === EventType.RoomAvatar ||
         eventType.value === EventType.RoomEncryption
})
const isEncryptedEvent = computed(() => {
  const result = eventType.value === EventType.RoomEncrypted || eventType.value === 'm.room.encrypted'
  console.debug('🔐 isEncryptedEvent check:', {
    eventType: eventType.value,
    EventTypeRoomEncrypted: EventType.RoomEncrypted,
    result
  })
  return result
})

// Message features
const isEncrypted = computed(() => {
  // Check if the event is encrypted (either was encrypted or is an encrypted event type)
  return props.mxEvent.isEncrypted() || isEncryptedEvent.value
})

const canDelete = computed(() => {
  if (!props.currentUserId) return false

  // Can always delete our own messages
  if (isOwnEvent.value) return true

  // Check room power levels for moderation permissions
  const room = props.currentRoom
  if (!room) return false

  try {
    const powerLevels = room.currentState.getStateEvents('m.room.power_levels', '')?.getContent()
    if (!powerLevels) {
      console.debug('🔍 No power levels found in room')
      return false
    }

    const currentUserId = props.currentUserId
    const userLevel = powerLevels.users?.[currentUserId] ?? powerLevels.users_default ?? 0
    const redactLevel = powerLevels.redact ?? 50

    // Room owners (level 100) and moderators (level 50+) can delete messages
    const canModerate = userLevel >= redactLevel

    // Debug logging to see what's happening
    console.debug('🔍 Delete permission check:', {
      currentUserId,
      userLevel,
      redactLevel,
      canModerate,
      powerLevels: powerLevels.users,
      isOwnEvent: isOwnEvent.value,
      senderId: senderId.value,
      eventId: props.mxEvent.getId()
    })

    return canModerate
  } catch (error) {
    console.warn('Error checking delete permissions:', error)
    return false
  }
})

const messageStatus = computed(() => {
  if (!isOwnEvent.value) return null

  // Check if the event failed to send
  if (props.mxEvent.status === 'not_sent') return 'failed'

  // Check if event has been sent successfully
  if (props.mxEvent.getId() && props.mxEvent.status !== 'sending') {
    // For now, we'll consider all sent messages as "sent"
    // In a full implementation, we'd check read receipts for "delivered" and "read"
    return 'sent'
  }

  return 'sending'
})

// Display logic
const shouldDisplayEvent = computed(() => {
  const eventId = props.mxEvent.getId()
  const eventType = props.mxEvent.getType()

  // Always display redacted events (will show as "Message deleted")
  if (props.mxEvent.isRedacted()) {
    console.debug(`🎭 EventTile(${eventId}): Redacted event, showing as deleted`)
    return true
  }

  // Display message events, state events we care about, and encrypted events
  const shouldShow = isMessageEvent.value || isStateEvent.value || isEncryptedEvent.value

  console.debug(`🎭 EventTile(${eventId}): Display check`, {
    eventType,
    isMessageEvent: isMessageEvent.value,
    isStateEvent: isStateEvent.value,
    isEncryptedEvent: isEncryptedEvent.value,
    shouldShow
  })

  return shouldShow
})

// State event text generation
const getStateEventText = (): string => {
  const content = eventContent.value
  const prevContent = props.mxEvent.getPrevContent()
  const senderName = senderDisplayName.value

  switch (eventType.value) {
    case EventType.RoomMember:
      const membership = content.membership
      const prevMembership = prevContent?.membership
      const targetId = props.mxEvent.getStateKey()
      const targetName = targetId === senderId.value ? senderName
        : (targetId?.split(':')[0].substring(1) || 'Someone')

      switch (membership) {
        case 'join':
          return prevMembership === 'join'
            ? `${senderName} updated their profile`
            : `${senderName} joined the room`
        case 'leave':
          return targetId === senderId.value
            ? `${senderName} left the room`
            : `${senderName} removed ${targetName}`
        case 'invite':
          return `${senderName} invited ${targetName}`
        case 'ban':
          return `${senderName} banned ${targetName}`
        default:
          return `${senderName} ${membership} ${targetName}`
      }

    case EventType.RoomName:
      return `${senderName} changed the room name to "${content.name}"`

    case EventType.RoomTopic:
      return `${senderName} changed the room topic to "${content.topic}"`

    case EventType.RoomEncryption:
      return `${senderName} enabled encryption`

    default:
      return `${senderName} sent a ${eventType.value} event`
  }
}

// Utility functions
const formatTime = (timestamp: Date): string => {
  return format(timestamp, 'HH:mm')
}

const getSenderColor = (userId: string): string => {
  // Simple hash-based color generation
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 50%, 50%)`
}
</script>

<style scoped>
.event-tile {
  margin-bottom: 4px; /* Very compact spacing */
}

.message-event {
  /* Inherit existing message styles */
}

.message-content {
  flex: 1;
  min-width: 0;
}

/* Own message container styling */
.own-event-container {
  display: flex;
  justify-content: flex-end;
}

.own-event-container .message-content {
  max-width: 70%;
}

.own-message {
  margin-left: auto;
  text-align: right;
}

.own-message-body {
  background: #2196f3;
  color: white;
  padding: 4px 8px; /* Very compact padding */
  border-radius: 12px; /* Smaller radius */
  margin-bottom: 1px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 0.85rem; /* Smaller text */
}

/* Other message styling */
.message-content:not(.own-message) .message-body-wrapper {
  background: #f5f5f5;
  color: #333;
  padding: 4px 8px; /* Very compact padding */
  border-radius: 12px; /* Smaller radius */
  margin-bottom: 1px;
  display: inline-block;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 0.85rem; /* Smaller text */
}

/* Message metadata styling */
.message-metadata {
  font-size: 0.7rem;
  gap: 3px;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.event-tile:hover .delete-btn {
  opacity: 1;
}

.read-status {
  display: flex;
  align-items: center;
}

.message-avatar {
  flex-shrink: 0;
  margin-right: 6px;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: white;
  font-weight: 600;
  border-radius: 50%;
}

.sender-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sender-display-name {
  font-size: 0.8rem;
}

.message-time {
  opacity: 0.7;
  font-size: 0.7rem;
}

.state-event {
  opacity: 0.8;
  font-style: italic;
}

.redacted-event {
  margin-bottom: 4px;
}

.redacted-message-body {
  background: #f0f0f0;
  color: #666;
  padding: 4px 8px;
  border-radius: 12px;
  margin-bottom: 1px;
  display: inline-block;
  font-size: 0.8rem;
  font-style: italic;
  opacity: 0.7;
}

.own-redacted-body {
  background: #e3f2fd;
  color: #1976d2;
  margin-left: auto;
  text-align: right;
}

.encrypted-event {
  background: rgba(255, 193, 7, 0.1);
  border-radius: 4px;
  border-left: 3px solid #ffc107;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .encrypted-event {
    background: rgba(255, 193, 7, 0.2);
  }
}
</style>
