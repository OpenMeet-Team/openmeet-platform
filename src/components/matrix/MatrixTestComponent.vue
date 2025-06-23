<template>
  <div class="matrix-chat-client">
    <!-- Header -->
    <div class="chat-header q-pa-md bg-primary text-white">
      <div class="row items-center">
        <q-icon name="sym_r_chat" size="32px" class="q-mr-md" />
        <div class="text-h6">OpenMeet Matrix Chat</div>
        <q-space />
        <q-badge
          :color="authStatus.color"
          :label="authStatus.label"
          class="q-mr-sm"
        />
        <q-btn
          v-if="!isConnected"
          :label="'Connect'"
          color="white"
          text-color="primary"
          :loading="isConnecting"
          @click="connect()"
          dense
        />
        <q-btn
          v-else
          icon="sym_r_logout"
          color="white"
          text-color="primary"
          @click="disconnect()"
          dense
          round
        />
      </div>
    </div>

    <!-- Main Chat Interface -->
    <div v-if="isConnected" class="chat-container">
      <div class="row no-wrap" style="height: 80vh;">
        <!-- Room List Sidebar -->
        <div class="room-sidebar bg-grey-1 q-pa-md" style="width: 300px; border-right: 1px solid #e0e0e0;">
          <div class="text-subtitle1 q-mb-md">Rooms</div>

          <!-- Room Creation Tabs -->
          <q-tabs v-model="sidebarTab" dense class="q-mb-md">
            <q-tab name="rooms" label="My Rooms" />
            <q-tab name="join" label="Join" />
          </q-tabs>

          <q-tab-panels v-model="sidebarTab">
            <!-- My Rooms -->
            <q-tab-panel name="rooms" class="q-pa-none">
              <q-list>
                <q-item
                  v-for="room in userRooms"
                  :key="room.roomId"
                  clickable
                  @click="selectRoom(room as Room)"
                  :class="{ 'bg-blue-1': selectedRoom?.roomId === room.roomId }"
                  class="q-mb-xs room-item"
                >
                  <q-item-section avatar>
                    <q-avatar size="32px" :color="isRoomEncrypted(room.roomId) ? 'green' : 'blue'" text-color="white">
                      <q-icon :name="isRoomEncrypted(room.roomId) ? 'lock' : 'group'" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label lines="1">{{ room.name || 'Unnamed Room' }}</q-item-label>
                    <q-item-label caption>{{ room.getJoinedMemberCount?.() || 0 }} members</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-tab-panel>

            <!-- Join Rooms -->
            <q-tab-panel name="join" class="q-pa-none">
              <q-expansion-item icon="sym_r_chat" label="Direct Message" class="q-mb-sm">
                <div class="q-pa-sm">
                  <q-input
                    v-model="searchTerm"
                    label="Search Users"
                    placeholder="Search by name"
                    dense
                    outlined
                    @input="searchUsers"
                    class="q-mb-sm"
                  />
                  <q-list v-if="searchResults.length > 0">
                    <q-item
                      v-for="user in searchResults"
                      :key="user.user_id"
                      clickable
                      @click="startDirectMessage(user.user_id)"
                      dense
                    >
                      <q-item-section>
                        <q-item-label>{{ user.display_name || user.user_id }}</q-item-label>
                        <q-item-label caption>{{ user.user_id }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </div>
              </q-expansion-item>

              <q-expansion-item icon="sym_r_event" label="Event Chat" class="q-mb-sm">
                <div class="q-pa-sm">
                  <q-input
                    v-model="eventSlug"
                    label="Event Slug"
                    placeholder="event-slug"
                    dense
                    outlined
                    class="q-mb-sm"
                  />
                  <q-btn
                    label="Join Event Chat"
                    color="primary"
                    @click="joinEventChat"
                    :loading="isJoiningRoom"
                    :disable="!eventSlug"
                    dense
                    class="full-width"
                  />
                </div>
              </q-expansion-item>

              <q-expansion-item icon="sym_r_group" label="Group Chat">
                <div class="q-pa-sm">
                  <q-input
                    v-model="groupSlug"
                    label="Group Slug"
                    placeholder="group-slug"
                    dense
                    outlined
                    class="q-mb-sm"
                  />
                  <q-btn
                    label="Join Group Chat"
                    color="primary"
                    @click="joinGroupChat"
                    :loading="isJoiningRoom"
                    :disable="!groupSlug"
                    dense
                    class="full-width"
                  />
                </div>
              </q-expansion-item>
            </q-tab-panel>
          </q-tab-panels>
        </div>

        <!-- Chat Area -->
        <div v-if="selectedRoom" class="chat-area flex column" style="flex: 1;">
          <!-- Chat Header -->
          <div class="chat-room-header q-pa-md bg-grey-2" style="border-bottom: 1px solid #e0e0e0;">
            <div class="row items-center">
              <q-avatar size="32px" :color="isRoomEncrypted(selectedRoom.roomId) ? 'green' : 'blue'" text-color="white" class="q-mr-sm">
                <q-icon :name="isRoomEncrypted(selectedRoom.roomId) ? 'lock' : 'group'" />
              </q-avatar>
              <div>
                <div class="text-subtitle1">{{ selectedRoom.name || 'Chat Room' }}</div>
                <div class="text-caption">
                  {{ isRoomEncrypted(selectedRoom.roomId) ? '🔐 Encrypted' : '📢 Public' }} •
                  {{ selectedRoom.getJoinedMemberCount?.() || 0 }} members
                </div>
              </div>
              <q-space />
              <q-btn icon="sym_r_group" flat round @click="showMemberList = !showMemberList" />
            </div>
          </div>

          <!-- Messages Area -->
          <div class="messages-container q-pa-md" style="flex: 1; overflow-y: auto; max-height: calc(80vh - 200px);">
            <div v-for="message in roomMessages" :key="message.getId()" class="message-item q-mb-md">
              <div class="row">
                <q-avatar size="32px" class="q-mr-sm">
                  <img v-if="getUserProfile(message.getSender(), selectedRoom.roomId).avatarUrl"
                       :src="getContentUrl(getUserProfile(message.getSender(), selectedRoom.roomId).avatarUrl!, 32, 32)" />
                  <div v-else class="bg-primary text-white">
                    {{ getUserProfile(message.getSender(), selectedRoom.roomId).displayName?.charAt(0) || '?' }}
                  </div>
                </q-avatar>
                <div style="flex: 1;">
                  <div class="row items-center q-mb-xs">
                    <span class="text-weight-bold q-mr-sm">
                      {{ getUserProfile(message.getSender(), selectedRoom.roomId).displayName || message.getSender() }}
                    </span>
                    <span class="text-caption text-grey-6">
                      {{ formatTime(message.getTs()) }}
                    </span>
                  </div>
                  <div class="message-content">
                    <!-- Text Message -->
                    <div v-if="message.getContent().msgtype === 'm.text'">
                      {{ message.getContent().body }}
                    </div>
                    <!-- Image Message -->
                    <div v-else-if="message.getContent().msgtype === 'm.image'">
                      <img
                        :src="getContentUrl(message.getContent().url, 300, 200)"
                        :alt="message.getContent().body"
                        style="max-width: 300px; border-radius: 8px;"
                        class="cursor-pointer"
                        @click="showImageModal(getContentUrl(message.getContent().url))"
                      />
                      <div class="text-caption q-mt-xs">{{ message.getContent().body }}</div>
                    </div>
                    <!-- File Message -->
                    <div v-else-if="message.getContent().msgtype === 'm.file'">
                      <q-card flat bordered class="q-pa-sm" style="max-width: 300px;">
                        <div class="row items-center">
                          <q-icon name="attach_file" class="q-mr-sm" />
                          <div>
                            <div>{{ message.getContent().body }}</div>
                            <div class="text-caption">{{ formatFileSize(message.getContent().info?.size) }}</div>
                          </div>
                          <q-space />
                          <q-btn
                            icon="download"
                            flat
                            round
                            size="sm"
                            @click="downloadFile(message.getContent().url, message.getContent().body)"
                          />
                        </div>
                      </q-card>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Typing Indicators -->
            <div v-if="typingUsers.length > 0" class="typing-indicator q-mt-md">
              <q-icon name="more_horiz" class="typing-dots" />
              <span class="text-caption text-grey-6 q-ml-sm">
                {{ formatTypingUsers(typingUsers) }}
              </span>
            </div>
          </div>

          <!-- Message Input -->
          <div class="message-input q-pa-md bg-grey-1" style="border-top: 1px solid #e0e0e0;">
            <div class="row q-gutter-sm">
              <q-btn
                icon="attach_file"
                flat
                round
                @click="triggerFileUpload"
              />
              <q-file
                ref="fileInput"
                v-model="selectedFile"
                style="display: none;"
                @input="uploadFile"
                accept="*/*"
              />
              <q-input
                v-model="messageText"
                placeholder="Type a message..."
                dense
                outlined
                style="flex: 1;"
                @keyup.enter="sendMessage"
                @keydown="handleTyping"
                @keyup="stopTyping"
              />
              <q-btn
                icon="send"
                color="primary"
                @click="sendMessage"
                :loading="isSending"
                :disable="!messageText.trim()"
                round
              />
            </div>
          </div>
        </div>

        <!-- Member List Sidebar -->
        <div v-if="selectedRoom && showMemberList" class="member-sidebar bg-grey-1 q-pa-md" style="width: 250px; border-left: 1px solid #e0e0e0;">
          <div class="text-subtitle1 q-mb-md">Members ({{ roomMembers.length }})</div>
          <q-list>
            <q-item v-for="member in roomMembers" :key="member.userId" dense>
              <q-item-section avatar>
                <q-avatar size="24px">
                  <img v-if="getUserProfile(member.userId, selectedRoom.roomId).avatarUrl"
                       :src="getContentUrl(getUserProfile(member.userId, selectedRoom.roomId).avatarUrl!, 24, 24)" />
                  <div v-else class="bg-grey text-white">
                    {{ getUserProfile(member.userId, selectedRoom.roomId).displayName?.charAt(0) || '?' }}
                  </div>
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ getUserProfile(member.userId, selectedRoom.roomId).displayName || member.userId }}</q-item-label>
                <q-item-label caption>{{ member.membership }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </div>

        <!-- Empty State -->
        <div v-else class="empty-state flex flex-center" style="flex: 1;">
          <div class="text-center">
            <q-icon name="sym_r_chat" size="64px" color="grey-5" />
            <div class="text-h6 q-mt-md text-grey-6">Select a room to start chatting</div>
            <div class="text-body2 text-grey-5">Choose a room from the sidebar or join a new one</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connection Required State -->
    <div v-else class="connection-required flex flex-center" style="height: 50vh;">
      <div class="text-center">
        <q-icon name="sym_r_chat" size="64px" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-6">Connect to Matrix</div>
        <div class="text-body2 text-grey-5 q-mb-md">Connect to start using Matrix chat</div>
        <q-btn
          label="Connect to Matrix"
          color="primary"
          :loading="isConnecting"
          @click="connect()"
        />
      </div>
    </div>

    <!-- Image Modal -->
    <q-dialog v-model="imageModal" maximized>
      <q-card>
        <q-card-section class="row items-center">
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section class="q-pa-none flex flex-center">
          <img :src="imageModalSrc" style="max-width: 100%; max-height: 90vh;" />
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Error Display -->
    <q-banner v-if="error" class="bg-negative text-white fixed-bottom">
      <template v-slot:avatar>
        <q-icon name="sym_r_error" />
      </template>
      {{ error }}
      <template v-slot:action>
        <q-btn flat label="Dismiss" @click="error = null" />
      </template>
    </q-banner>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/auth-store'
import matrixClientService from '../../services/matrixClientService'
import type { Room, MatrixEvent, RoomMember } from 'matrix-js-sdk'

// Reactive state
const isConnecting = ref(false)
const isConnected = ref(false)
const isSending = ref(false)
const isJoiningRoom = ref(false)
const matrixUserId = ref<string | null>(null)
const error = ref<string | null>(null)

// Chat functionality state
const sidebarTab = ref('rooms')
const eventSlug = ref('')
const groupSlug = ref('')
const messageText = ref('')
const searchTerm = ref('')
const searchResults = ref<Array<{ user_id: string; display_name?: string; avatar_url?: string }>>([])
const userRooms = ref<Room[]>([])
const selectedRoom = ref<Room | null>(null)
const roomMessages = ref<MatrixEvent[]>([])
const roomMembers = ref<RoomMember[]>([])
const showMemberList = ref(false)
const typingUsers = ref<string[]>([])
const selectedFile = ref<File | null>(null)
const imageModal = ref(false)
const imageModalSrc = ref('')

// Mobile-specific state
const mobileView = ref('rooms') // 'rooms', 'chat', 'members'

// Typing indicators
const typingTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const isUserTyping = ref(false)

// Auth store
const authStore = useAuthStore()

// Computed
const authStatus = computed(() => {
  if (!authStore.isAuthenticated) {
    return { color: 'negative', label: 'Not logged into OpenMeet' }
  }
  if (isConnected.value) {
    return { color: 'positive', label: 'Connected to Matrix' }
  }
  if (isConnecting.value) {
    return { color: 'warning', label: 'Connecting...' }
  }
  return { color: 'grey', label: 'Ready to connect' }
})

// Methods
const connect = async () => {
  if (!authStore.isAuthenticated) {
    error.value = 'Please log into OpenMeet first'
    return
  }

  isConnecting.value = true
  error.value = null

  try {
    const client = await matrixClientService.connectToMatrix()
    isConnected.value = true
    matrixUserId.value = client.getUserId() || null

    // Set up event listeners
    setupEventListeners()

    // Auto-load user rooms
    setTimeout(() => {
      loadUserRooms()
      // Default to chat view if we have rooms on mobile
      if (userRooms.value.length > 0 && window.innerWidth < 600) {
        mobileView.value = 'rooms'
      }
    }, 1000)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to connect to Matrix: ${errorMessage}`
  } finally {
    isConnecting.value = false
  }
}

const disconnect = async () => {
  try {
    await matrixClientService.cleanup()
    isConnected.value = false
    matrixUserId.value = null
    selectedRoom.value = null
    userRooms.value = []
    roomMessages.value = []
    roomMembers.value = []
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Disconnect error:', errorMessage)
  }
}

const loadUserRooms = async () => {
  if (!isConnected.value) return

  try {
    const rooms = matrixClientService.getRooms() // Get raw Matrix Room objects
    userRooms.value = rooms
    sidebarTab.value = 'rooms'
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to load rooms:', errorMessage)
  }
}

const startDirectMessage = async (userId: string) => {
  isJoiningRoom.value = true
  try {
    const room = await matrixClientService.joinDirectMessageRoom(userId)
    if (window.innerWidth < 600) {
      selectRoomMobile(room)
    } else {
      selectRoom(room)
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to start direct message: ${errorMessage}`
  } finally {
    isJoiningRoom.value = false
  }
}

const joinEventChat = async () => {
  if (!eventSlug.value.trim()) return

  isJoiningRoom.value = true
  try {
    const { room } = await matrixClientService.joinEventChatRoom(eventSlug.value)
    if (window.innerWidth < 600) {
      selectRoomMobile(room)
    } else {
      selectRoom(room)
    }
    eventSlug.value = ''
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to join event chat: ${errorMessage}`
  } finally {
    isJoiningRoom.value = false
  }
}

const joinGroupChat = async () => {
  if (!groupSlug.value.trim()) return

  isJoiningRoom.value = true
  try {
    const { room } = await matrixClientService.joinGroupChatRoom(groupSlug.value)
    if (window.innerWidth < 600) {
      selectRoomMobile(room)
    } else {
      selectRoom(room)
    }
    groupSlug.value = ''
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to join group chat: ${errorMessage}`
  } finally {
    isJoiningRoom.value = false
  }
}

const selectRoom = (room: Room) => {
  selectedRoom.value = room
  loadRoomMessages()
  loadRoomMembers()
  updateTypingUsers()
}

const selectRoomMobile = (room: Room) => {
  selectRoom(room)
  mobileView.value = 'chat' // Auto-switch to chat view on mobile
}

const loadRoomMessages = () => {
  if (!selectedRoom.value) return

  try {
    const messages = matrixClientService.getRoomTimeline(selectedRoom.value.roomId, 50)
    roomMessages.value = messages
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to load messages:', errorMessage)
  }
}

const loadRoomMembers = () => {
  if (!selectedRoom.value) return

  try {
    const members = matrixClientService.getRoomMembers(selectedRoom.value.roomId)
    roomMembers.value = members
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Failed to load members:', errorMessage)
  }
}

const sendMessage = async () => {
  if (!selectedRoom.value || !messageText.value.trim()) return

  isSending.value = true
  try {
    await matrixClientService.sendMessage(selectedRoom.value.roomId, {
      msgtype: 'm.text',
      body: messageText.value
    })
    messageText.value = ''

    // Reload messages to show the new one
    setTimeout(() => loadRoomMessages(), 500)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to send message: ${errorMessage}`
  } finally {
    isSending.value = false
  }
}

const searchUsers = async () => {
  if (!searchTerm.value.trim() || searchTerm.value.length < 3) {
    searchResults.value = []
    return
  }

  try {
    const results = await matrixClientService.searchUsers(searchTerm.value)
    searchResults.value = results
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('User search failed:', errorMessage)
  }
}

const handleTyping = async () => {
  if (!selectedRoom.value || isUserTyping.value) return

  isUserTyping.value = true
  try {
    await matrixClientService.sendTyping(selectedRoom.value.roomId, true)
  } catch (err) {
    console.error('Failed to send typing indicator:', err)
  }
}

const stopTyping = async () => {
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }

  typingTimer.value = setTimeout(async () => {
    if (selectedRoom.value && isUserTyping.value) {
      isUserTyping.value = false
      try {
        await matrixClientService.sendTyping(selectedRoom.value.roomId, false)
      } catch (err) {
        console.error('Failed to stop typing indicator:', err)
      }
    }
  }, 3000)
}

const updateTypingUsers = () => {
  if (!selectedRoom.value) return

  try {
    const typing = matrixClientService.getRoomTypingUsers(selectedRoom.value.roomId)
    typingUsers.value = typing.filter(userId => userId !== matrixUserId.value)
  } catch (err) {
    console.error('Failed to get typing users:', err)
  }
}

const triggerFileUpload = () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  if (input) {
    input.click()
  }
}

const uploadFile = async () => {
  if (!selectedFile.value || !selectedRoom.value) return

  try {
    await matrixClientService.uploadAndSendFile(selectedRoom.value.roomId, selectedFile.value)
    selectedFile.value = null

    // Reload messages to show the new file
    setTimeout(() => loadRoomMessages(), 500)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = `Failed to upload file: ${errorMessage}`
  }
}

const downloadFile = (mxcUrl: string, filename: string) => {
  const url = matrixClientService.getContentUrl(mxcUrl)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

const showImageModal = (src: string) => {
  imageModalSrc.value = src
  imageModal.value = true
}

const isRoomEncrypted = (roomId: string): boolean => {
  return matrixClientService.isRoomEncrypted(roomId)
}

const getUserProfile = (userId: string, roomId?: string) => {
  return matrixClientService.getUserProfile(userId, roomId)
}

const getContentUrl = (mxcUrl: string, width?: number, height?: number): string => {
  return matrixClientService.getContentUrl(mxcUrl, width, height)
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString()
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return 'Unknown size'
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

const formatTypingUsers = (users: string[]): string => {
  if (users.length === 0) return ''
  if (users.length === 1) {
    const profile = getUserProfile(users[0], selectedRoom.value?.roomId)
    return `${profile.displayName || users[0]} is typing...`
  }
  if (users.length === 2) {
    const profiles = users.map(u => getUserProfile(u, selectedRoom.value?.roomId))
    return `${profiles[0].displayName || users[0]} and ${profiles[1].displayName || users[1]} are typing...`
  }
  return `${users.length} people are typing...`
}

const setupEventListeners = () => {
  // Listen for Matrix events via DOM events
  const handleMatrixMessage = (event: CustomEvent) => {
    // If this message is for the currently selected room, refresh the room messages
    if (selectedRoom.value && event.detail.roomId === selectedRoom.value.roomId) {
      setTimeout(() => loadRoomMessages(), 100)
    }
  }

  const handleMatrixTyping = (event: CustomEvent) => {
    // Update typing indicators for current room
    if (selectedRoom.value && event.detail.roomId === selectedRoom.value.roomId) {
      updateTypingUsers()
    }
  }

  window.addEventListener('matrix:message', handleMatrixMessage)
  window.addEventListener('matrix:typing', handleMatrixTyping)
}

// Lifecycle
onMounted(() => {
  // Check for Matrix SSO completion in URL
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('loginToken')) {
    const loginToken = urlParams.get('loginToken')
    console.log('Matrix SSO completion detected, token:', loginToken?.substring(0, 20) + '...')

    // Automatically complete the Matrix connection
    isConnecting.value = true

    matrixClientService.connectToMatrix()
      .then(client => {
        isConnected.value = true
        matrixUserId.value = client.getUserId() || null
        setupEventListeners()

        // Auto-load user rooms
        setTimeout(() => {
          loadUserRooms()
          // Default to chat view if we have rooms on mobile
          if (userRooms.value.length > 0 && window.innerWidth < 600) {
            mobileView.value = 'rooms'
          }
        }, 1000)
      })
      .catch(err => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        error.value = `Failed to complete Matrix authentication: ${errorMessage}`
      })
      .finally(() => {
        isConnecting.value = false
      })
  }

  // Check if Matrix client is already ready
  if (matrixClientService.isReady()) {
    isConnected.value = true
    const client = matrixClientService.getClient()
    if (client) {
      matrixUserId.value = client.getUserId() || null
      setupEventListeners()

      // Auto-load user rooms
      setTimeout(() => {
        loadUserRooms()
        // Default to chat view if we have rooms on mobile
        if (userRooms.value.length > 0 && window.innerWidth < 600) {
          mobileView.value = 'rooms'
        }
      }, 500)
    }
  }
})

onUnmounted(() => {
  // Cleanup event listeners
  window.removeEventListener('matrix:message', () => {})
  window.removeEventListener('matrix:typing', () => {})

  // Clear typing timer
  if (typingTimer.value) {
    clearTimeout(typingTimer.value)
  }
})
</script>

<style scoped>
.matrix-chat-client {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.chat-container {
  flex: 1;
  overflow: hidden;
}

.room-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.messages-container {
  scroll-behavior: smooth;
}

.message-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

.typing-dots {
  animation: typing 1.5s infinite;
}

@keyframes typing {
  0%, 20% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
  80%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
}

.cursor-pointer {
  cursor: pointer;
}
</style>
