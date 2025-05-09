<template>
  <q-page padding>
    <div class="container q-pa-md">
      <div class="q-mb-md">
        <router-link to="/admin" class="q-pr-sm">
          <q-icon name="sym_r_arrow_back" />
          Back to Admin Dashboard
        </router-link>
      </div>

      <h1 class="text-h4 text-primary q-mb-md">Chat Room Management</h1>

      <div class="q-mb-lg bg-blue-1 q-pa-md rounded-borders">
        <p class="text-subtitle1 q-mb-none">
          <q-icon name="sym_r_info" color="info" class="q-mr-sm" />
          This tool allows you to manage chat rooms for events and groups. You can delete existing chat rooms
          and create new ones if needed.
        </p>
      </div>

      <q-tabs
        v-model="currentTab"
        class="text-primary q-mb-lg"
        indicator-color="primary"
        align="left"
      >
        <q-tab name="events" label="Event Chat Rooms" />
        <q-tab name="groups" label="Group Chat Rooms" />
      </q-tabs>

      <q-tab-panels v-model="currentTab" animated>
        <!-- Event Chat Rooms Panel -->
        <q-tab-panel name="events">
          <q-card class="q-mb-lg">
            <q-card-section>
              <div class="text-h6">Manage Event Chat Room</div>
            </q-card-section>

            <q-card-section>
              <q-form @submit="handleEventAction" class="q-gutter-md">
                <q-input
                  v-model="eventSlug"
                  label="Event Slug"
                  placeholder="event-slug"
                  outlined
                  :error="!!eventSlugError"
                  :error-message="eventSlugError"
                >
                  <template v-slot:prepend>
                    <q-icon name="sym_r_event" />
                  </template>
                </q-input>

                <div class="row q-gutter-md">
                  <q-btn
                    type="button"
                    color="negative"
                    label="Delete Chat Room"
                    icon="sym_r_delete"
                    :loading="loading"
                    :disable="loading || !eventSlug"
                    @click="confirmDeleteEventRoom"
                  />
                  <q-btn
                    type="button"
                    color="primary"
                    label="Create New Chat Room"
                    icon="sym_r_add"
                    :loading="loading"
                    :disable="loading || !eventSlug"
                    @click="confirmCreateEventRoom"
                  />
                  <q-btn
                    type="button"
                    color="secondary"
                    label="Reset Chat Room"
                    icon="sym_r_restart_alt"
                    :loading="loading"
                    :disable="loading || !eventSlug"
                    @click="resetEventRoom"
                  />
                </div>
              </q-form>
            </q-card-section>
          </q-card>
        </q-tab-panel>

        <!-- Group Chat Rooms Panel -->
        <q-tab-panel name="groups">
          <q-card class="q-mb-lg">
            <q-card-section>
              <div class="text-h6">Manage Group Chat Room</div>
            </q-card-section>

            <q-card-section>
              <q-form @submit="handleGroupAction" class="q-gutter-md">
                <q-input
                  v-model="groupSlug"
                  label="Group Slug"
                  placeholder="group-slug"
                  outlined
                  :error="!!groupSlugError"
                  :error-message="groupSlugError"
                >
                  <template v-slot:prepend>
                    <q-icon name="sym_r_groups" />
                  </template>
                </q-input>

                <div class="row q-gutter-md">
                  <q-btn
                    type="button"
                    color="negative"
                    label="Delete Chat Room"
                    icon="sym_r_delete"
                    :loading="loading"
                    :disable="loading || !groupSlug"
                    @click="confirmDeleteGroupRoom"
                  />
                  <q-btn
                    type="button"
                    color="primary"
                    label="Create New Chat Room"
                    icon="sym_r_add"
                    :loading="loading"
                    :disable="loading || !groupSlug"
                    @click="confirmCreateGroupRoom"
                  />
                  <q-btn
                    type="button"
                    color="secondary"
                    label="Reset Chat Room"
                    icon="sym_r_restart_alt"
                    :loading="loading"
                    :disable="loading || !groupSlug"
                    @click="resetGroupRoom"
                  />
                </div>
              </q-form>
            </q-card-section>
          </q-card>
        </q-tab-panel>
      </q-tab-panels>

      <!-- Confirmation Dialog -->
      <q-dialog v-model="confirmDialog" persistent>
        <q-card style="min-width: 350px">
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">{{ confirmTitle }}</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            {{ confirmMessage }}
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="primary" v-close-popup />
            <q-btn flat label="Confirm" color="negative" @click="confirmActionExecute" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <!-- Result Dialog -->
      <q-dialog v-model="resultDialog">
        <q-card style="min-width: 350px">
          <q-card-section :class="resultSuccess ? 'bg-positive text-white' : 'bg-negative text-white'">
            <div class="text-h6">{{ resultSuccess ? 'Success' : 'Error' }}</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            {{ resultMessage }}
          </q-card-section>

          <q-card-actions align="right">
            <q-btn flat label="Close" color="primary" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth-store'
import { UserRole } from '../../types'
import { api } from '../../boot/axios'

const router = useRouter()
const authStore = useAuthStore()

const currentTab = ref('events')
const eventSlug = ref('')
const eventSlugError = ref('')
const groupSlug = ref('')
const groupSlugError = ref('')
const loading = ref(false)

// Confirmation dialog
const confirmDialog = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingAction = ref(async () => {})

// Result dialog
const resultDialog = ref(false)
const resultSuccess = ref(false)
const resultMessage = ref('')

// Check if user is an admin
onMounted(() => {
  if (!authStore.hasRole(UserRole.Admin)) {
    // Redirect non-admin users to home page
    router.push('/')
  }
})

// Event room management
async function deleteEventRoom () {
  if (!eventSlug.value) {
    eventSlugError.value = 'Please enter a valid event slug'
    return
  }

  try {
    loading.value = true
    const response = await api.delete(`/api/chat/admin/event/${eventSlug.value}/chatroom`)

    resultSuccess.value = response.data?.success || false
    resultMessage.value = response.data?.message || 'Chat room deleted successfully'
    resultDialog.value = true
  } catch (error) {
    console.error('Error deleting event chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to delete chat room'}`
    resultDialog.value = true
  } finally {
    loading.value = false
  }
}

async function createEventRoom () {
  if (!eventSlug.value) {
    eventSlugError.value = 'Please enter a valid event slug'
    return
  }

  try {
    loading.value = true
    const response = await api.post(`/api/chat/admin/event/${eventSlug.value}/chatroom`)

    resultSuccess.value = response.data?.success || false
    resultMessage.value = response.data?.message || 'Chat room created successfully'
    resultDialog.value = true
  } catch (error) {
    console.error('Error creating event chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to create chat room'}`
    resultDialog.value = true
  } finally {
    loading.value = false
  }
}

async function resetEventRoom () {
  // Reset is a combination of delete and create
  try {
    await deleteEventRoom()
    await createEventRoom()

    resultSuccess.value = true
    resultMessage.value = 'Chat room was successfully reset'
    resultDialog.value = true
  } catch (error) {
    console.error('Error resetting event chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to reset chat room'}`
    resultDialog.value = true
  }
}

// Group room management
async function deleteGroupRoom () {
  if (!groupSlug.value) {
    groupSlugError.value = 'Please enter a valid group slug'
    return
  }

  try {
    loading.value = true
    const response = await api.delete(`/api/chat/admin/group/${groupSlug.value}/chatroom`)

    resultSuccess.value = response.data?.success || false
    resultMessage.value = response.data?.message || 'Chat room deleted successfully'
    resultDialog.value = true
  } catch (error) {
    console.error('Error deleting group chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to delete chat room'}`
    resultDialog.value = true
  } finally {
    loading.value = false
  }
}

async function createGroupRoom () {
  if (!groupSlug.value) {
    groupSlugError.value = 'Please enter a valid group slug'
    return
  }

  try {
    loading.value = true
    const response = await api.post(`/api/chat/admin/group/${groupSlug.value}/chatroom`)

    resultSuccess.value = response.data?.success || false
    resultMessage.value = response.data?.message || 'Chat room created successfully'
    resultDialog.value = true
  } catch (error) {
    console.error('Error creating group chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to create chat room'}`
    resultDialog.value = true
  } finally {
    loading.value = false
  }
}

async function resetGroupRoom () {
  // Reset is a combination of delete and create
  try {
    await deleteGroupRoom()
    await createGroupRoom()

    resultSuccess.value = true
    resultMessage.value = 'Chat room was successfully reset'
    resultDialog.value = true
  } catch (error) {
    console.error('Error resetting group chat room:', error)
    resultSuccess.value = false
    resultMessage.value = `Error: ${error instanceof Error ? error.message : 'Failed to reset chat room'}`
    resultDialog.value = true
  }
}

// Confirmation handlers
function confirmDeleteEventRoom () {
  confirmTitle.value = 'Delete Event Chat Room'
  confirmMessage.value = `Are you sure you want to delete the chat room for event "${eventSlug.value}"? This will permanently remove all messages and cannot be undone.`
  pendingAction.value = deleteEventRoom
  confirmDialog.value = true
}

function confirmCreateEventRoom () {
  confirmTitle.value = 'Create Event Chat Room'
  confirmMessage.value = `Are you sure you want to create a new chat room for event "${eventSlug.value}"?`
  pendingAction.value = createEventRoom
  confirmDialog.value = true
}

function confirmDeleteGroupRoom () {
  confirmTitle.value = 'Delete Group Chat Room'
  confirmMessage.value = `Are you sure you want to delete the chat room for group "${groupSlug.value}"? This will permanently remove all messages and cannot be undone.`
  pendingAction.value = deleteGroupRoom
  confirmDialog.value = true
}

function confirmCreateGroupRoom () {
  confirmTitle.value = 'Create Group Chat Room'
  confirmMessage.value = `Are you sure you want to create a new chat room for group "${groupSlug.value}"?`
  pendingAction.value = createGroupRoom
  confirmDialog.value = true
}

async function confirmActionExecute () {
  await pendingAction.value()
}

// Form submission handlers (preventDefault only)
function handleEventAction (e: Event) {
  e.preventDefault()
}

function handleGroupAction (e: Event) {
  e.preventDefault()
}

defineOptions({
  name: 'ChatRoomAdminPage'
})
</script>

<style scoped lang="scss">
.container {
  max-width: 800px;
  margin: 0 auto;
}

a {
  text-decoration: none;
  color: $primary;
  display: inline-flex;
  align-items: center;
}
</style>
