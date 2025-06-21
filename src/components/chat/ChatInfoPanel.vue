<template>
  <div class="chat-info-panel q-pa-md">
    <div v-if="chat" class="chat-details">
      <!-- Chat Header -->
      <div class="chat-header text-center q-mb-lg">
        <q-avatar size="80px" :color="getChatColor(chat)" text-color="white" class="q-mb-sm">
          <q-icon :name="getChatIcon(chat)" size="32px" />
        </q-avatar>
        <div class="text-h6">{{ chat.name }}</div>
        <div class="text-caption text-grey-6">
          {{ getChatTypeLabel(chat) }}
          <q-icon v-if="chat.isEncrypted" name="fas fa-lock" size="12px" color="green" class="q-ml-xs" />
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions q-mb-lg">
        <q-btn-group spread class="full-width">
          <q-btn
            icon="videocam"
            label="Video"
            color="primary"
            outline
            @click="startVideoCall"
            :disable="chat.type === 'event'"
          />
          <q-btn
            icon="call"
            label="Audio"
            color="primary"
            outline
            @click="startAudioCall"
            :disable="chat.type === 'event'"
          />
        </q-btn-group>
      </div>

      <!-- Members Section -->
      <div v-if="chat.participants && chat.participants.length > 0" class="members-section q-mb-lg">
        <div class="text-subtitle2 q-mb-sm">
          Members ({{ chat.participants.length }})
        </div>
        <q-list>
          <q-item
            v-for="member in chat.participants"
            :key="member.id"
            dense
          >
            <q-item-section avatar>
              <q-avatar size="32px">
                <img v-if="member.avatar" :src="member.avatar" />
                <div v-else class="bg-grey text-white">
                  {{ member.name.charAt(0) }}
                </div>
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ member.name }}</q-item-label>
              <q-item-label caption>{{ getMemberStatus(member) }}</q-item-label>
            </q-item-section>
            <q-item-section side v-if="canManageMembers">
              <q-btn
                icon="more_vert"
                flat
                round
                size="sm"
                @click="showMemberActions(member)"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </div>

      <!-- Context Information -->
      <div class="context-info q-mb-lg">
        <div class="text-subtitle2 q-mb-sm">Information</div>

        <!-- Direct Message Info -->
        <div v-if="chat.type === 'direct'" class="direct-info">
          <q-item dense>
            <q-item-section avatar>
              <q-icon name="security" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Encryption</q-item-label>
              <q-item-label caption>
                {{ chat.isEncrypted ? 'End-to-end encrypted' : 'Not encrypted' }}
              </q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <!-- Group Info -->
        <div v-else-if="chat.type === 'group'" class="group-info">
          <q-item dense clickable @click="viewGroupDetails">
            <q-item-section avatar>
              <q-icon name="info" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Group Details</q-item-label>
              <q-item-label caption>View group page</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="chevron_right" size="12px" />
            </q-item-section>
          </q-item>

          <q-item dense>
            <q-item-section avatar>
              <q-icon name="schedule" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Created</q-item-label>
              <q-item-label caption>{{ formatDate(chat.createdAt) }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>

        <!-- Event Info -->
        <div v-else-if="chat.type === 'event'" class="event-info">
          <q-item dense clickable @click="viewEventDetails">
            <q-item-section avatar>
              <q-icon name="event" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Event Details</q-item-label>
              <q-item-label caption>View event page</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="chevron_right" size="12px" />
            </q-item-section>
          </q-item>

          <q-item v-if="chat.eventDate" dense>
            <q-item-section avatar>
              <q-icon name="schedule" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Event Date</q-item-label>
              <q-item-label caption>{{ formatEventDate(chat.eventDate) }}</q-item-label>
            </q-item-section>
          </q-item>
        </div>
      </div>

      <!-- Chat Settings -->
      <div class="chat-settings q-mb-lg">
        <div class="text-subtitle2 q-mb-sm">Settings</div>

        <q-item dense>
          <q-item-section avatar>
            <q-icon name="notifications" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Notifications</q-item-label>
            <q-item-label caption>{{ notificationsEnabled ? 'Enabled' : 'Disabled' }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-toggle
              v-model="notificationsEnabled"
              @update:model-value="updateNotifications"
            />
          </q-item-section>
        </q-item>

        <q-item v-if="chat.type === 'direct'" dense>
          <q-item-section avatar>
            <q-icon name="block" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Block User</q-item-label>
            <q-item-label caption>Block this person</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              icon="block"
              flat
              round
              size="sm"
              color="negative"
              @click="blockUser"
            />
          </q-item-section>
        </q-item>
      </div>

      <!-- Advanced Actions -->
      <div class="advanced-actions">
        <div class="text-subtitle2 q-mb-sm">Actions</div>

        <q-item dense clickable @click="exportChat">
          <q-item-section avatar>
            <q-icon name="download" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Export Chat</q-item-label>
            <q-item-label caption>Download conversation history</q-item-label>
          </q-item-section>
        </q-item>

        <q-item dense clickable @click="clearHistory">
          <q-item-section avatar>
            <q-icon name="clear" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Clear History</q-item-label>
            <q-item-label caption>Delete all messages</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="canLeaveChat" dense clickable @click="leaveChat" class="text-negative">
          <q-item-section avatar>
            <q-icon name="logout" color="negative" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Leave {{ chat.type === 'direct' ? 'Conversation' : 'Chat' }}</q-item-label>
            <q-item-label caption>You can rejoin later</q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state flex flex-center full-height">
      <div class="text-center">
        <q-icon name="info_outline" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-6">No chat selected</div>
        <div class="text-body2 text-grey-5">Select a chat to view details</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { format } from 'date-fns'

interface Chat {
  id: string
  name: string
  type: 'direct' | 'group' | 'event'
  matrixRoomId: string
  participants?: Array<{
    id: string
    name: string
    avatar?: string
    status?: 'online' | 'offline' | 'away'
  }>
  isEncrypted?: boolean
  createdAt?: Date
  eventDate?: Date
}

interface Props {
  chat: Chat | null
  contextType: 'all' | 'direct' | 'group' | 'event'
  contextId?: string
}

const props = defineProps<Props>()

// State
const notificationsEnabled = ref(true)

const router = useRouter()
const $q = useQuasar()

// Computed
const canManageMembers = computed(() => {
  // Check if user has permission to manage members
  return props.chat?.type === 'group' // Simplified logic
})

const canLeaveChat = computed(() => {
  // Direct messages can't be "left", groups and events can be
  return props.chat?.type !== 'direct'
})

// Methods
const getChatColor = (chat: Chat): string => {
  switch (chat.type) {
    case 'direct': return 'blue'
    case 'group': return 'purple'
    case 'event': return 'green'
    default: return 'grey'
  }
}

const getChatIcon = (chat: Chat): string => {
  switch (chat.type) {
    case 'direct': return chat.isEncrypted ? 'fas fa-lock' : 'fas fa-user'
    case 'group': return 'groups'
    case 'event': return 'event'
    default: return 'chat'
  }
}

const getChatTypeLabel = (chat: Chat): string => {
  switch (chat.type) {
    case 'direct': return 'Direct Message'
    case 'group': return 'Group Discussion'
    case 'event': return 'Event Discussion'
    default: return 'Chat'
  }
}

const getMemberStatus = (member: { status?: string }): string => {
  switch (member.status) {
    case 'online': return 'Online'
    case 'away': return 'Away'
    case 'offline': return 'Offline'
    default: return 'Member'
  }
}

const formatDate = (date?: Date): string => {
  if (!date) return 'Unknown'
  return format(date, 'MMM d, yyyy')
}

const formatEventDate = (date: Date): string => {
  return format(date, 'MMM d, yyyy h:mm a')
}

const startVideoCall = () => {
  $q.notify({
    message: 'Video calling coming soon!',
    type: 'info'
  })
}

const startAudioCall = () => {
  $q.notify({
    message: 'Audio calling coming soon!',
    type: 'info'
  })
}

const viewGroupDetails = () => {
  if (props.chat && props.contextId) {
    router.push(`/groups/${props.contextId}`)
  }
}

const viewEventDetails = () => {
  if (props.chat && props.contextId) {
    router.push(`/events/${props.contextId}`)
  }
}

const showMemberActions = (member: { id: string; name: string }) => {
  $q.dialog({
    title: member.name,
    message: 'What would you like to do?',
    options: {
      type: 'radio',
      model: '',
      items: [
        { label: 'View Profile', value: 'profile' },
        { label: 'Send Direct Message', value: 'dm' },
        { label: 'Remove from Chat', value: 'remove', color: 'negative' }
      ]
    },
    cancel: true
  }).onOk((action) => {
    switch (action) {
      case 'profile':
        // Navigate to profile
        break
      case 'dm':
        // Start direct message
        break
      case 'remove':
        // Remove member
        break
    }
  })
}

const updateNotifications = (enabled: boolean) => {
  // Update notification settings for this chat
  $q.notify({
    message: `Notifications ${enabled ? 'enabled' : 'disabled'}`,
    type: 'positive'
  })
}

const blockUser = () => {
  $q.dialog({
    title: 'Block User',
    message: 'Are you sure you want to block this person? They won\'t be able to send you messages.',
    cancel: true,
    persistent: true
  }).onOk(() => {
    // Block the user
    $q.notify({
      message: 'User blocked',
      type: 'positive'
    })
  })
}

const exportChat = () => {
  $q.notify({
    message: 'Exporting chat history...',
    type: 'info'
  })
  // Implement chat export functionality
}

const clearHistory = () => {
  $q.dialog({
    title: 'Clear Chat History',
    message: 'Are you sure you want to delete all messages? This cannot be undone.',
    cancel: true,
    persistent: true
  }).onOk(() => {
    // Clear chat history
    $q.notify({
      message: 'Chat history cleared',
      type: 'positive'
    })
  })
}

const leaveChat = () => {
  const chatType = props.chat?.type === 'group' ? 'group' : 'event'

  $q.dialog({
    title: `Leave ${chatType.charAt(0).toUpperCase() + chatType.slice(1)}`,
    message: `Are you sure you want to leave this ${chatType}? You can rejoin later.`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    // Leave the chat
    $q.notify({
      message: `Left ${chatType}`,
      type: 'positive'
    })
  })
}
</script>

<style scoped>
.chat-info-panel {
  height: 100%;
  overflow-y: auto;
}

.chat-header {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 16px;
}

.quick-actions {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 16px;
}

.members-section,
.context-info,
.chat-settings,
.advanced-actions {
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 16px;
}

.advanced-actions {
  border-bottom: none;
}

.empty-state {
  padding: 40px 20px;
}
</style>
