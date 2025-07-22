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
          <q-icon v-if="chat.isEncrypted" name="sym_r_lock" size="12px" color="green" class="q-ml-xs" />
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions q-mb-lg">
        <q-btn-group spread class="full-width">
          <q-btn
            icon="sym_r_videocam"
            label="Video"
            color="primary"
            outline
            @click="startVideoCall"
            :disable="chat.type === 'event'"
          />
          <q-btn
            icon="sym_r_call"
            label="Audio"
            color="primary"
            outline
            @click="startAudioCall"
            :disable="chat.type === 'event'"
          />
        </q-btn-group>
      </div>

      <!-- Members Section with real Matrix data -->
      <div class="members-section q-mb-lg">
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2 col">
            Members ({{ matrixMembers.length }})
          </div>
          <q-btn
            icon="sym_r_refresh"
            flat
            round
            size="sm"
            @click="refreshMembers"
            :loading="isLoadingMembers"
          />
        </div>

        <q-list v-if="matrixMembers.length > 0">
          <q-item
            v-for="member in matrixMembers"
            :key="member.userId"
            dense
          >
            <q-item-section avatar>
              <q-avatar size="32px">
                <img v-if="member.avatarUrl" :src="member.avatarUrl" />
                <div v-else class="bg-primary text-white">
                  {{ getInitials(member.displayName || member.userId) }}
                </div>
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ member.displayName || getMatrixDisplayName(member.userId) }}</q-item-label>
              <q-item-label caption>
                <span class="text-grey-6">{{ member.userId }}</span>
                <q-icon
                  v-if="member.powerLevel >= 50"
                  name="admin_panel_settings"
                  size="12px"
                  color="orange"
                  class="q-ml-xs"
                >
                  <q-tooltip>Admin</q-tooltip>
                </q-icon>
                <q-icon
                  v-else-if="member.powerLevel >= 25"
                  name="shield"
                  size="12px"
                  color="blue"
                  class="q-ml-xs"
                >
                  <q-tooltip>Moderator</q-tooltip>
                </q-icon>
                <q-badge
                  v-if="member.membership === 'invite'"
                  color="orange"
                  text-color="white"
                  label="invited"
                  class="q-ml-xs"
                />
                <q-badge
                  v-if="isCurrentUser(member.userId)"
                  color="green"
                  text-color="white"
                  label="you"
                  class="q-ml-xs"
                />
              </q-item-label>
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

        <div v-else class="text-center text-grey-5 q-pa-md">
          <q-icon name="sym_r_people" size="32px" />
          <div>No members found</div>
        </div>
      </div>

      <!-- Room Statistics -->
      <div v-if="roomStats" class="room-stats q-mb-lg">
        <div class="text-subtitle2 q-mb-sm">Room Statistics</div>
        <q-list>
          <q-item dense>
            <q-item-section avatar>
              <q-icon name="sym_r_chat_bubble" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Total Messages</q-item-label>
              <q-item-label caption>{{ roomStats.totalMessages || 0 }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item dense>
            <q-item-section avatar>
              <q-icon name="sym_r_schedule" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Last Activity</q-item-label>
              <q-item-label caption>{{ formatLastActivity(chat.lastActivity) }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-item dense>
            <q-item-section avatar>
              <q-icon name="sym_r_storage" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Room Version</q-item-label>
              <q-item-label caption>{{ roomStats.roomVersion || 'Unknown' }}</q-item-label>
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
              <q-icon name="sym_r_security" />
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
              <q-icon name="sym_r_info" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Group Details</q-item-label>
              <q-item-label caption>View group page</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="sym_r_chevron_right" size="12px" />
            </q-item-section>
          </q-item>

          <q-item dense>
            <q-item-section avatar>
              <q-icon name="sym_r_schedule" />
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
              <q-icon name="sym_r_event" />
            </q-item-section>
            <q-item-section>
              <q-item-label>Event Details</q-item-label>
              <q-item-label caption>View event page</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="sym_r_chevron_right" size="12px" />
            </q-item-section>
          </q-item>

          <q-item v-if="chat.eventDate" dense>
            <q-item-section avatar>
              <q-icon name="sym_r_schedule" />
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
            <q-icon name="sym_r_notifications" />
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
            <q-icon name="sym_r_block" />
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
            <q-icon name="sym_r_download" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Export Chat</q-item-label>
            <q-item-label caption>Download conversation history</q-item-label>
          </q-item-section>
        </q-item>

        <q-item dense clickable @click="clearHistory">
          <q-item-section avatar>
            <q-icon name="sym_r_clear" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Clear History</q-item-label>
            <q-item-label caption>Delete all messages</q-item-label>
          </q-item-section>
        </q-item>

        <q-item v-if="canLeaveChat" dense clickable @click="leaveChat" class="text-negative">
          <q-item-section avatar>
            <q-icon name="sym_r_logout" color="negative" />
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
        <q-icon name="sym_r_info" size="48px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-6">No chat selected</div>
        <div class="text-body2 text-grey-5">Select a chat to view details</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { format } from 'date-fns'
import { Room, MatrixEvent } from 'matrix-js-sdk'
import { matrixClientService } from '../../services/matrixClientService'
// import { useAuthStore } from '../../stores/auth-store'
import { getMatrixDisplayName } from '../../utils/matrixUtils'

interface Chat {
  id: string
  name: string
  type: 'direct' | 'group' | 'event'
  matrixRoomId: string
  lastActivity?: Date
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

interface MatrixMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  membership: 'join' | 'invite' | 'leave' | 'ban'
  powerLevel: number
}

interface RoomStats {
  totalMessages: number
  roomVersion?: string
  createdAt?: Date
}

interface Props {
  chat: Chat | null
  contextType: 'all' | 'direct' | 'group' | 'event'
  contextId?: string
}

const props = defineProps<Props>()

// State
const notificationsEnabled = ref(true)
const matrixMembers = ref<MatrixMember[]>([])
const roomStats = ref<RoomStats | null>(null)
const isLoadingMembers = ref(false)

const router = useRouter()
const $q = useQuasar()
// const authStore = useAuthStore()

// Matrix data loading
const loadMatrixMembers = async () => {
  if (!props.chat?.matrixRoomId) return

  isLoadingMembers.value = true
  try {
    console.log('🔄 Loading Matrix members for room:', props.chat.matrixRoomId)
    const matrixClient = await matrixClientService.initializeClient()
    if (!matrixClient) return

    const room = matrixClient.getRoom(props.chat.matrixRoomId)
    if (!room) {
      console.warn('⚠️ Matrix room not found:', props.chat.matrixRoomId)
      return
    }

    // Get room members with detailed information
    const members = room.getJoinedMembers()
    const currentMembers: MatrixMember[] = []

    for (const member of members) {
      const memberEvent = room.getMember(member.userId)
      if (memberEvent && memberEvent.membership === 'join') {
        currentMembers.push({
          userId: member.userId,
          displayName: member.name,
          avatarUrl: member.getAvatarUrl('', 32, 32, 'crop', false, false) || undefined,
          membership: memberEvent.membership,
          powerLevel: room.getMember(member.userId)?.powerLevel || 0
        })
      }
    }

    // Sort members: admins first, then by display name
    currentMembers.sort((a, b) => {
      if (a.powerLevel !== b.powerLevel) {
        return b.powerLevel - a.powerLevel
      }
      const nameA = a.displayName || getMatrixDisplayName(a.userId)
      const nameB = b.displayName || getMatrixDisplayName(b.userId)
      return nameA.localeCompare(nameB)
    })

    matrixMembers.value = currentMembers
    console.log(`✅ Loaded ${currentMembers.length} Matrix members`)

    // Load room statistics
    loadRoomStats(room)
  } catch (error) {
    console.error('❌ Failed to load Matrix members:', error)
  } finally {
    isLoadingMembers.value = false
  }
}

const loadRoomStats = (room: Room) => {
  try {
    const timeline = room.getLiveTimeline()
    const events = timeline.getEvents()

    // Count message events
    const messageEvents = events.filter((event: MatrixEvent) =>
      event.getType() === 'm.room.message' && !event.isRedacted()
    )

    roomStats.value = {
      totalMessages: messageEvents.length,
      roomVersion: room.getVersion(),
      createdAt: new Date(room.timeline?.[0]?.getTs() || Date.now())
    }
  } catch (error) {
    console.error('⚠️ Failed to load room stats:', error)
  }
}

// Watch for chat changes
watch(() => props.chat, (newChat) => {
  if (newChat) {
    loadMatrixMembers()
  }
}, { immediate: true })

const refreshMembers = async () => {
  await loadMatrixMembers()
}

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
    case 'direct': return chat.isEncrypted ? 'sym_r_lock' : 'sym_r_person'
    case 'group': return 'sym_r_group'
    case 'event': return 'sym_r_event'
    default: return 'sym_r_chat'
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

/*
const getMemberStatus = (member: { status?: string }): string => {
  switch (member.status) {
    case 'online': return 'Online'
    case 'away': return 'Away'
    case 'offline': return 'Offline'
    default: return 'Member'
  }
}
*/

const formatDate = (date?: Date): string => {
  if (!date) return 'Unknown'
  return format(date, 'MMM d, yyyy')
}

const formatEventDate = (date: Date): string => {
  return format(date, 'MMM d, yyyy h:mm a')
}

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

const isCurrentUser = (userId: string): boolean => {
  const client = matrixClientService.getClient()
  return client?.getUserId() === userId
}

const formatLastActivity = (date?: Date): string => {
  if (!date) return 'Never'
  return format(date, 'PPp')
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

const showMemberActions = (member: { userId: string; displayName?: string; avatarUrl?: string; membership: string; powerLevel: number }) => {
  $q.dialog({
    title: member.displayName || member.userId,
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

/* Dark mode border fixes */
.q-dark .chat-header,
.q-dark .quick-actions,
.q-dark .members-section,
.q-dark .context-info,
.q-dark .chat-settings,
.q-dark .advanced-actions {
  border-color: rgba(255, 255, 255, 0.2);
}

.empty-state {
  padding: 40px 20px;
}
</style>
