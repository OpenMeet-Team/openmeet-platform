<template>
  <div class="c-dashboard-profile-form q-gutter-md" style="max-width: 500px">
    <!-- Main profile form -->
    <q-form data-cy="profile-form" @submit="onSubmit">
      <!-- Basic profile information section -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_person" class="q-mr-sm" />
            Basic Information
          </div>

          <div class="q-gutter-md">
            <div @click="openChangeEmailDialog" class="input-wrapper">
              <q-input
                data-cy="profile-email"
                filled
                readonly
                v-model="form.email"
                label="Email"
                type="email"
                :rules="[(val: string) => !!val || 'Email is required']"
              >
                <template v-slot:append>
                  <q-icon name="sym_r_email" />
                </template>
              </q-input>
            </div>

            <q-input
              data-cy="profile-first-name"
              filled
              v-model="form.firstName"
              label="First Name"
              :rules="[(val: string) => !!val || 'First name is required']"
            />

            <q-input
              data-cy="profile-last-name"
              filled
              v-model="form.lastName"
              label="Last Name"
              :rules="[(val: string) => !!val || 'Last name is required']"
            />

            <div class="bio-editor q-mb-md">
              <div class="text-subtitle2 q-mb-sm">Your bio <span class="text-caption text-grey-7">(Supports Markdown)</span></div>

              <q-tabs
                v-model="bioTab"
                class="text-primary"
                active-color="primary"
                indicator-color="primary"
                narrow-indicator
              >
                <q-tab name="edit" label="Edit" />
                <q-tab name="preview" label="Preview" />
              </q-tabs>

              <q-separator />

              <q-tab-panels v-model="bioTab" animated>
                <q-tab-panel name="edit" class="q-pa-none">
                  <q-input
                    data-cy="profile-bio"
                    filled
                    type="textarea"
                    v-model="form.bio"
                    label="Your bio"
                    hint="Supports Markdown formatting"
                    counter
                    maxlength="1000"
                    autogrow
                    class="q-mt-sm"
                  />
                  <div class="text-caption q-mt-xs">
                    <span class="text-weight-medium">Markdown tip:</span>
                    Use **bold**, *italic*, [links](url), and other Markdown syntax
                  </div>
                </q-tab-panel>

                <q-tab-panel name="preview" class="q-pa-none">
                  <div class="q-pa-md markdown-preview bg-grey-1 rounded-borders q-mt-sm">
                    <q-markdown
                      :src="form.bio || '*No content yet*'"
                      class="text-body1"
                    />
                  </div>
                </q-tab-panel>
              </q-tab-panels>
            </div>

            <q-select
              data-cy="profile-interests"
              v-model="form.interests"
              label="Interests"
              multiple
              clearable
              filled
              :options="interests"
              option-label="title"
              option-value="id"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Profile photo section -->
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_photo_camera" class="q-mr-sm" />
            Profile Photo
          </div>

          <div class="row items-center q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <UploadComponent
                data-cy="profile-photo"
                label="Profile picture"
                :crop-options="{autoZoom: true, aspectRatio: 1}"
                @upload="onProfilePhotoSelect"
              />
            </div>

            <div class="col-12 col-sm-6" v-if="localAvatarUrl">
              <q-img
                :src="localAvatarUrl"
                spinner-color="white"
                class="rounded-borders"
                style="height: 100px; max-width: 100px"
              >
                <q-btn
                  data-cy="profile-photo-delete"
                  color="primary"
                  size="md"
                  icon="sym_r_delete"
                  class="all-pointer-events absolute-top-right"
                  @click="onProfilePhotoDelete"
                />
              </q-img>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Bluesky integration section - only shown for Bluesky users -->
      <q-card class="q-mb-md" data-cy="profile-bluesky" v-if="isBlueskyUser">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_cloud" class="q-mr-sm" />
            Bluesky Settings
          </div>
          <div class="q-gutter-y-md">
            <div class="text-subtitle2" v-if="form.preferences?.bluesky?.handle">
              Connected as: {{ form.preferences.bluesky.handle }}
            </div>

            <!-- Display error message if there are Bluesky connection issues -->
            <div v-if="blueskyErrorMessage" class="text-negative q-mb-md">
              <q-icon name="sym_r_error" size="sm" class="q-mr-xs" />
              {{ blueskyErrorMessage }}
            </div>

            <q-toggle
              v-model="form.preferences.bluesky.connected"
              label="Use Bluesky as event source"
              @update:model-value="onBlueskyConnectionToggle"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Main profile update button -->
      <q-card-actions align="right" class="q-mb-lg">
        <q-btn
          data-cy="profile-update"
          no-caps
          :loading="isLoading"
          label="Update Profile"
          type="submit"
          color="primary"
        />
      </q-card-actions>
    </q-form>

    <!-- Matrix settings (separate section) -->
    <q-card class="q-mb-md" data-cy="profile-matrix" v-if="hasMatrixAccount">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_chat" class="q-mr-sm" />
          Matrix Chat Settings
        </div>
        <div class="q-gutter-y-md">
          <div class="text-subtitle2" v-if="matrixUserId">
            Matrix ID: {{ matrixUserId }}
          </div>

          <!-- Device Management Section -->
          <q-expansion-item
            data-cy="matrix-device-section"
            expand-separator
            icon="sym_r_devices"
            label="Device Management"
            caption="View and manage your Matrix devices"
            class="q-mt-md"
          >
            <q-card>
              <q-card-section>
                <div class="text-body2 q-mb-md">
                  You have {{ deviceList.length }} Matrix devices. Current device verification helps secure your encrypted messages.
                </div>

                <!-- Device List -->
                <div class="device-list">
                  <div
                    v-for="device in deviceList"
                    :key="device.deviceId"
                    class="device-item q-mb-sm"
                    :class="{ 'current-device': device.isCurrentDevice }"
                  >
                    <q-card flat bordered class="device-card">
                      <q-card-section class="row items-center">
                        <div class="col">
                          <div class="text-body2">
                            <strong>{{ device.displayName || `Device ${device.deviceId}` }}</strong>
                            <q-chip
                              v-if="device.isCurrentDevice"
                              size="sm"
                              color="primary"
                              text-color="white"
                              class="q-ml-sm"
                            >
                              Current
                            </q-chip>
                          </div>
                          <div class="text-caption text-grey-6">{{ device.deviceId }}</div>
                          <div class="text-caption">
                            <q-icon
                              :name="device.verified ? 'sym_r_verified' : 'sym_r_warning'"
                              :color="device.verified ? 'positive' : 'orange'"
                              size="sm"
                              class="q-mr-xs"
                            />
                            {{ device.verified ? 'Verified' : 'Unverified' }}
                          </div>
                        </div>
                        <div class="col-auto" v-if="!device.verified && !device.isCurrentDevice">
                          <q-btn
                            size="sm"
                            flat
                            color="primary"
                            icon="sym_r_verified"
                            label="Verify"
                            @click="onVerifyDevice(device.deviceId)"
                            :loading="verifyingDevice === device.deviceId"
                          />
                        </div>
                      </q-card-section>
                    </q-card>
                  </div>
                </div>

                <div class="q-mt-md">
                  <q-btn
                    flat
                    color="primary"
                    icon="sym_r_refresh"
                    label="Refresh Devices"
                    @click="onRefreshDevices"
                    :loading="refreshingDevices"
                    class="q-mr-sm"
                  />
                  <q-btn
                    v-if="deviceList.length > 10"
                    flat
                    color="orange"
                    icon="sym_r_cleaning_services"
                    label="Cleanup Old Devices"
                    @click="onCleanupDevices"
                    :loading="cleaningUpDevices"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <!-- Matrix Encryption Reset Section -->
          <q-expansion-item
            data-cy="matrix-encryption-section"
            expand-separator
            icon="sym_r_security"
            label="Matrix Encryption Settings"
            caption="Manage your encrypted messaging keys"
            class="q-mt-md"
          >
            <q-card>
              <q-card-section>
                <!-- Matrix Connection Status -->
                <div class="text-body2 q-mb-md text-grey-7">
                  Manage your Matrix chat integration. Matrix enables encrypted messaging between OpenMeet and other Matrix clients like Element.
                </div>

                <!-- Connection Status Banner -->
                <q-banner class="q-mb-md" :class="matrixConnectionStatus.connected ? 'bg-green-1 text-green-8' : 'bg-orange-1 text-orange-8'">
                  <template v-slot:avatar>
                    <q-icon :name="matrixConnectionStatus.connected ? 'sym_r_check_circle' : 'sym_r_warning'" :color="matrixConnectionStatus.connected ? 'green' : 'orange'" />
                  </template>
                  <div class="text-body2">
                    <strong>Status:</strong> {{ matrixConnectionStatus.message }}
                    <div v-if="matrixConnectionStatus.details" class="text-caption q-mt-xs">{{ matrixConnectionStatus.details }}</div>
                  </div>
                </q-banner>

                <!-- Main Action Buttons -->
                <div class="q-gutter-md">
                  <q-btn
                    data-cy="matrix-connect"
                    no-caps
                    unelevated
                    :loading="isConnectingMatrix"
                    :label="matrixConnectionStatus.connected ? 'Reconnect to Matrix' : 'Connect to Matrix'"
                    color="primary"
                    icon="sym_r_link"
                    @click="onConnectToMatrix"
                    size="md"
                    v-if="!matrixConnectionStatus.connected"
                  />

                  <q-btn
                    data-cy="matrix-setup-cross-signing"
                    no-caps
                    unelevated
                    :loading="settingUpCrossSigning"
                    label="Complete Verification Setup"
                    color="green"
                    icon="sym_r_verified"
                    @click="onSetupCrossSigning"
                    size="md"
                    v-if="matrixConnectionStatus.connected"
                  />

                  <q-btn
                    data-cy="matrix-forgot-recovery-key"
                    no-caps
                    outline
                    :loading="isForgotRecoveryKey"
                    label="Forgot Recovery Key"
                    color="orange"
                    icon="sym_r_lock_reset"
                    @click="onForgotRecoveryKey"
                    size="md"
                  />

                  <q-btn
                    data-cy="matrix-check-status"
                    no-caps
                    flat
                    label="Check Status"
                    color="secondary"
                    icon="sym_r_info"
                    @click="onCheckMatrixStatus"
                    size="md"
                  />
                </div>

                <!-- Help Text -->
                <div class="text-caption text-grey-6 q-mt-md">
                  <div v-if="!matrixConnectionStatus.connected"><strong>Connect to Matrix:</strong> Initial setup or reconnection to Matrix chat service</div>
                  <div v-if="matrixConnectionStatus.connected"><strong>Complete Verification Setup:</strong> Set up cross-signing for full device verification with Element</div>
                  <div><strong>Generate Recovery Key:</strong> Create a new recovery key for your existing encryption (replaces old key)</div>
                  <div><strong>Check Status:</strong> View detailed information about your Matrix connection and encryption status</div>
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

        </div>
      </q-card-section>
    </q-card>

    <!-- Account password section (separate from main profile) -->
    <q-card class="q-mb-md">
      <q-card-section>
        <q-expansion-item
          data-cy="profile-password"
          expand-separator
          icon="sym_r_vpn_key"
          label="Change Account Password"
        >
          <q-card>
            <q-card-section>
              <q-input
                data-cy="profile-old-password"
                v-model="form.oldPassword"
                filled
                maxlength="255"
                :type="isPwd ? 'password' : 'text'"
                label="Current Password"
              >
                <template v-slot:append>
                  <q-icon
                    :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                    class="cursor-pointer"
                    @click="isPwd = !isPwd"
                  />
                </template>
              </q-input>

              <q-input
                minlength="8"
                maxlength="255"
                data-cy="profile-new-password"
                v-model="form.password"
                filled
                :type="isPwd ? 'password' : 'text'"
                label="New Password"
                class="q-mt-md"
              >
                <template v-slot:append>
                  <q-icon
                    :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                    class="cursor-pointer"
                    @click="isPwd = !isPwd"
                  />
                </template>
              </q-input>

              <div class="q-mt-md">
                <q-btn
                  data-cy="profile-change-password"
                  no-caps
                  label="Change Password"
                  color="primary"
                  @click="onChangePassword"
                />
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>
      </q-card-section>
    </q-card>

    <!-- Calendar Integration section -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_calendar_month" class="q-mr-sm" />
          Calendar Integration
        </div>

        <CalendarConnectionsComponent />
      </q-card-section>
    </q-card>

    <!-- Account deletion section -->
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-h6 q-mb-md text-negative">
          <q-icon name="sym_r_warning" class="q-mr-sm" />
          Danger Zone
        </div>
        <q-btn
          data-cy="profile-delete-account"
          no-caps
          label="Delete my account"
          color="negative"
          @click="onDeleteAccount"
        />
      </q-card-section>
    </q-card>

    <!-- Matrix Recovery Key Dialog -->
    <q-dialog
      v-model="showRecoveryKeyDialog"
      persistent
      maximized
      transition-show="slide-up"
      transition-hide="slide-down"
    >
      <q-card class="recovery-key-dialog">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">
            <q-icon name="sym_r_key" color="orange" class="q-mr-sm" />
            Save Your New Recovery Key
          </div>
        </q-card-section>

        <q-card-section>
          <div class="recovery-key-content">
            <div class="text-body1 q-mb-md">
              <strong>Your Matrix encryption has been reset!</strong>
              Here's your new recovery key - you'll need this to unlock your encrypted messages if you forget your passphrase.
            </div>

            <q-banner class="bg-orange-1 text-orange-8 q-mb-md">
              <template v-slot:avatar>
                <q-icon name="sym_r_warning" color="orange" />
              </template>
              <strong>Important:</strong> Store this key safely in your password manager.
              You won't see it again and you'll need it to recover your messages!
            </q-banner>

            <q-card flat class="recovery-key-card q-mb-md">
              <q-card-section>
                <div class="recovery-key-text">{{ recoveryKey }}</div>
                <div class="recovery-key-actions q-mt-md">
                  <q-btn
                    flat
                    color="primary"
                    icon="sym_r_content_copy"
                    label="Copy Key"
                    @click="copyRecoveryKey"
                    class="q-mr-sm"
                  />
                  <q-btn
                    flat
                    color="grey-7"
                    icon="sym_r_download"
                    label="Download"
                    @click="downloadRecoveryKey"
                  />
                </div>
              </q-card-section>
            </q-card>

            <q-checkbox
              v-model="recoveryKeySaved"
              color="green"
              label="I have saved my recovery key safely"
              class="q-mb-md"
            />
          </div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            unelevated
            color="green"
            label="Continue"
            @click="closeRecoveryKeyDialog"
            :disable="!recoveryKeySaved"
            icon="sym_r_check"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Dialog, LoadingBar, Notify } from 'quasar'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { FileEntity, SubCategoryEntity, AuthProvidersEnum } from '../../types'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../../components/common/UploadComponent.vue'
import { subcategoriesApi } from '../../api/subcategories'
import { useBlueskyConnection } from '../../composables/useBlueskyConnection'
import { useMatrixAccess } from '../../composables/useMatrixAccess'
import { logger } from '../../utils/logger'
import { Profile } from '../../types/user'
import { getImageSrc } from '../../utils/imageUtils'
import CalendarConnectionsComponent from '../calendar/CalendarConnectionsComponent.vue'
import { matrixClientManager } from '../../services/MatrixClientManager'
import { MatrixEncryptionService } from '../../services/MatrixEncryptionManager'
import { MatrixDeviceManager } from '../../services/MatrixDeviceManager'

const { error, success } = useNotification()

const form = ref<Profile>({
  id: 0,
  slug: '',
  ulid: '',
  email: '',
  firstName: null,
  lastName: null,
  preferences: {
    bluesky: {
      connected: false,
      disconnectedAt: null,
      connectedAt: null,
      did: null,
      handle: null,
      avatar: null
    },
    matrix: {
      connected: false,
      disconnectedAt: null,
      connectedAt: null,
      hasDirectAccess: false,
      lastPasswordChanged: null
    }
  }
})

const subCategories = ref<SubCategoryEntity[]>([])
const isPwd = ref(true)
const isLoading = ref(false)
const bioTab = ref('edit') // Tab for bio editor (edit/preview)

// Matrix encryption reset state
// Matrix encryption service state
// const encryptionService = ref<MatrixEncryptionService | null>(null)
const isConnectingMatrix = ref(false)
const isForgotRecoveryKey = ref(false)

// Helper to initialize encryption service when needed
// const getOrCreateEncryptionService = (): MatrixEncryptionService | null => {
//   const client = matrixClientManager.getClient()
//   if (!client) return null
//   if (!encryptionService.value) {
//     encryptionService.value = new MatrixEncryptionService(client)
//     logger.debug('✅ Encryption service initialized in profile form')
//   }
//   return encryptionService.value
// }
const showRecoveryKeyDialog = ref(false)
const recoveryKey = ref('')
const recoveryKeySaved = ref(false)

// Matrix connection status
const matrixConnectionStatus = ref({
  connected: false,
  message: 'Not connected to Matrix',
  details: 'Click "Connect to Matrix" to get started'
})

// Device management state
const deviceList = ref<Array<{deviceId: string, displayName?: string, isCurrentDevice: boolean, verified: boolean}>>([])
const refreshingDevices = ref(false)
const cleaningUpDevices = ref(false)
const settingUpCrossSigning = ref(false)
const verifyingDevice = ref<string | null>(null)

// Matrix integration
const {
  hasMatrixAccount: checkHasMatrixAccount,
  getMatrixUserId
} = useMatrixAccess()

// Computed properties for Matrix integration
const hasMatrixAccount = computed(() => checkHasMatrixAccount())
const matrixUserId = computed(() => getMatrixUserId())

// Main profile form submission - handles basic profile data only (not passwords)
const onSubmit = async () => {
  try {
    isLoading.value = true

    // Create a user object with only the basic profile properties
    // No password fields here - those are handled separately
    const profileData = {
      firstName: form.value.firstName,
      lastName: form.value.lastName,
      email: form.value.email,
      bio: form.value.bio,
      interests: form.value.interests,

      // Only send the ID of the photo to avoid Vue warnings
      // If we have a photo object but no ID (a newly uploaded photo), send the whole photo
      photo: form.value.photo ? (form.value.photo.id ? { id: form.value.photo.id } : form.value.photo) : null,

      // Include preferences for integration settings
      ...(form.value.preferences ? {
        preferences: form.value.preferences
      } : {})
    }

    const response = await authApi.updateMe(profileData)
    useAuthStore().actionSetUser(response.data)
    success('Profile updated successfully')

    if (response.data.email !== form.value.email) {
      Dialog.create({
        title: 'Confirm Email',
        message: `Please confirm your new email by clicking the link in the email we just sent you to ${form.value.email}.`
      })
    }
  } catch (err) {
    console.error('Failed to update profile:', err)
    error('Failed to update profile')
  } finally {
    isLoading.value = false
  }
}

// Separate function to handle password changes
const onChangePassword = async () => {
  try {
    if (!form.value.password || form.value.password.length < 8) {
      error('New password must be at least 8 characters')
      return
    }

    if (!form.value.oldPassword) {
      error('Current password is required')
      return
    }

    // Create an object with just the password fields
    const passwordData = {
      password: form.value.password,
      oldPassword: form.value.oldPassword
    }

    const response = await authApi.updateMe(passwordData)
    useAuthStore().actionSetUser(response.data)
    success('Password updated successfully')

    // Clear password fields for security
    form.value.password = ''
    form.value.oldPassword = ''
  } catch (err) {
    console.error('Failed to update password:', err)
    error('Failed to update password. Please check your current password is correct.')
  }
}

const interests = computed(() => {
  return subCategories.value
})

// For profile form, we only want to show the local photo being edited
const localAvatarUrl = computed(() => {
  if (form.value?.photo?.path && typeof form.value.photo.path === 'string') {
    return getImageSrc(form.value.photo.path)
  }
  return null
})

// Only show Bluesky settings for Bluesky-authenticated users
const isBlueskyUser = computed(() => {
  const authStore = useAuthStore()
  return authStore.user.provider === AuthProvidersEnum.bluesky
})

onMounted(async () => {
  LoadingBar.start()

  try {
    const [subcategoriesRes, userRes] = await Promise.all([
      subcategoriesApi.getAll(),
      authApi.getMe()
    ])

    subCategories.value = subcategoriesRes.data
    const userData = userRes.data as unknown as Profile

    // Initialize form with user data
    form.value = {
      ...userData,
      preferences: {
        bluesky: {
          connected: userData.preferences?.bluesky?.connected || false,
          disconnectedAt: userData.preferences?.bluesky?.disconnectedAt || null,
          connectedAt: userData.preferences?.bluesky?.connectedAt || null,
          did: userData.preferences?.bluesky?.did || null,
          handle: userData.preferences?.bluesky?.handle || null,
          avatar: userData.preferences?.bluesky?.avatar || null
        },
        matrix: {
          connected: userData.preferences?.matrix?.connected || false,
          disconnectedAt: userData.preferences?.matrix?.disconnectedAt || null,
          connectedAt: userData.preferences?.matrix?.connectedAt || null,
          hasDirectAccess: userData.preferences?.matrix?.hasDirectAccess || false,
          lastPasswordChanged: userData.preferences?.matrix?.lastPasswordChanged || null
        }
      }
    }

    // Load device list if Matrix is available
    if (hasMatrixAccount.value) {
      try {
        await onRefreshDevices()
      } catch (err) {
        console.error('Failed to load device list:', err)
        // Don't show error to user since device management is secondary
      }
    }
  } catch (err) {
    console.error('Failed to load profile data:', err)
    error('Failed to load profile data')
  } finally {
    LoadingBar.stop()
  }
})

const onProfilePhotoSelect = (file: FileEntity) => {
  // Assign to form.value.photo directly without enumerating properties
  form.value.photo = file
}

const onProfilePhotoDelete = () => {
  // Set photo to an object with just ID = 0, which indicates deletion
  // The API only needs the ID, not the full FileEntity structure
  form.value.photo = { id: 0 }
}

const openChangeEmailDialog = () => {
  Dialog.create({
    title: 'Change Email',
    prompt: {
      model: form.value.email,
      type: 'email',
      isValid: (val: string) => Boolean(val || 'Email is required')
    },
    cancel: {
      label: 'Cancel',
      flat: true
    },
    ok: {
      label: 'Change',
      color: 'primary'
    }
  }).onOk((val: string) => {
    form.value.email = val
  })
}

const { toggleConnection } = useBlueskyConnection()
const blueskyErrorMessage = ref<string | null>(null)

const onBlueskyConnectionToggle = async (enabled: boolean) => {
  const success = await toggleConnection(enabled)
  if (!success) {
    // Reset the toggle to the previous state if the operation failed
    form.value.preferences.bluesky.connected = !enabled
  } else {
    form.value.preferences.bluesky.connected = enabled
    if (enabled) {
      form.value.preferences.bluesky.connectedAt = new Date()
      form.value.preferences.bluesky.disconnectedAt = null
    } else {
      form.value.preferences.bluesky.disconnectedAt = new Date()
    }
  }
}

const onDeleteAccount = () => {
  Dialog.create({
    title: 'Confirm Account Deletion',
    message: 'Are you sure you want to delete your account? This action cannot be undone.',
    cancel: {
      color: 'primary'
    },
    ok: {
      label: 'Delete',
      flat: true,
      color: 'negative'
    }
  }).onOk(() => {
    authApi.deleteMe().then(() => useAuthStore().actionLogout())
  })
}

// Matrix encryption reset functionality
/* const onResetMatrixEncryption = async () => {
  const confirmed = await new Promise((resolve) => {
    Dialog.create({
      title: 'Reset Matrix Encryption',
      message: 'This will reset your Matrix encryption and generate a new recovery key. You will lose access to historical encrypted messages unless you have your current recovery key.',
      cancel: true,
      persistent: true,
      ok: {
        label: 'Reset Encryption',
        color: 'orange'
      }
    }).onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })

  if (!confirmed) return

  isResettingMatrix.value = true

  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      error('Matrix client not available')
      return
    }

    const secretStorageService = new MatrixSecretStorageService(client)

    // Perform the reset with isReset=true to clear existing state
    const result = await secretStorageService.setupSecretStorage(true)

    if (result.success && result.recoveryKey) {
      recoveryKey.value = result.recoveryKey
      showRecoveryKeyDialog.value = true
      success('Matrix encryption reset successfully!')
    } else {
      error(`Failed to reset Matrix encryption: ${result.error}`)
    }
  } catch (err) {
    console.error('Matrix encryption reset failed:', err)
    error(`Reset failed: ${err.message}`)
  } finally {
    isResettingMatrix.value = false
  }
} */

// Simplified Matrix connection methods
const onConnectToMatrix = async () => {
  try {
    isConnectingMatrix.value = true

    // Check if we already have a Matrix session
    const client = matrixClientManager.getClient()
    if (client) {
      matrixConnectionStatus.value = {
        connected: true,
        message: 'Reconnected to Matrix',
        details: 'Matrix chat is ready to use'
      }

      Notify.create({
        type: 'positive',
        message: 'Matrix reconnected successfully!',
        timeout: 3000
      })
      return
    }

    // Use the real Matrix connection logic (same as chat orchestrator)
    matrixConnectionStatus.value = {
      connected: false,
      message: 'Connecting to Matrix...',
      details: 'Initializing Matrix client and authentication'
    }

    logger.debug('🔗 Initializing Matrix client from profile settings')

    // Try to restore from stored session first (Element Web pattern)
    let newClient = await matrixClientManager.initializeClient()
    if (!newClient) {
      // No stored session - start authentication flow
      logger.debug('🔗 No stored session found, starting authentication flow')
      newClient = await matrixClientManager.startAuthenticationFlow()
    } else {
      logger.debug('✅ Restored Matrix session from storage')
    }
    if (newClient) {
      matrixConnectionStatus.value = {
        connected: true,
        message: 'Connected to Matrix',
        details: 'Matrix chat is ready to use'
      }

      Notify.create({
        type: 'positive',
        message: 'Matrix connected successfully!',
        timeout: 3000
      })

      // Refresh devices to show the new connection
      if (hasMatrixAccount.value) {
        await onRefreshDevices()
      }

      logger.debug('✅ Matrix connected from profile settings - ready for chat')
    } else {
      throw new Error('Failed to initialize Matrix client')
    }
  } catch (error) {
    logger.error('Failed to connect to Matrix:', error)

    matrixConnectionStatus.value = {
      connected: false,
      message: 'Connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }

    Notify.create({
      type: 'negative',
      message: `Failed to connect to Matrix: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timeout: 5000
    })
  } finally {
    isConnectingMatrix.value = false
  }
}

const onForgotRecoveryKey = async () => {
  const confirmed = await new Promise((resolve) => {
    Dialog.create({
      title: 'Generate New Recovery Key',
      message: 'This will generate a new recovery key for your existing encryption setup. Your old recovery key will no longer work. Continue?',
      cancel: true,
      persistent: true,
      ok: {
        label: 'Generate New Key',
        color: 'orange'
      }
    }).onOk(() => resolve(true)).onCancel(() => resolve(false))
  })

  if (!confirmed) return

  try {
    isForgotRecoveryKey.value = true

    logger.debug('🔑 Generating new recovery key via preferences')

    // Get Matrix client and create encryption service
    const client = matrixClientManager.getClient()
    if (!client) {
      throw new Error('Matrix client not available')
    }

    const encryptionService = new MatrixEncryptionService(client)

    // Use the new generateNewRecoveryKey method
    const result = await encryptionService.generateNewRecoveryKey()

    if (result.success && result.recoveryKey) {
      matrixConnectionStatus.value = {
        connected: true,
        message: 'New recovery key generated successfully',
        details: 'Please save your new recovery key securely'
      }

      // Show the new recovery key to the user (using existing UI)
      recoveryKey.value = result.recoveryKey
      showRecoveryKeyDialog.value = true

      Notify.create({
        type: 'positive',
        message: 'New recovery key generated! Please save it securely.',
        timeout: 5000
      })
    } else {
      throw new Error(result.error || 'Failed to generate new recovery key')
    }
  } catch (error) {
    logger.error('Recovery key generation failed:', error)

    Notify.create({
      type: 'negative',
      message: `Failed to generate recovery key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timeout: 5000
    })
  } finally {
    isForgotRecoveryKey.value = false
  }
}

const onCheckMatrixStatus = async () => {
  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      matrixConnectionStatus.value = {
        connected: false,
        message: 'Not connected to Matrix',
        details: 'Matrix client not available'
      }
      error('Matrix client not available')
      return
    }

    const crypto = client.getCrypto()
    if (!crypto) {
      matrixConnectionStatus.value = {
        connected: true,
        message: 'Connected to Matrix (encryption disabled)',
        details: 'Matrix encryption not available'
      }
      error('Matrix encryption not available')
      return
    }

    // Use more robust status checking that doesn't depend on secret storage key cache
    const [secretStorageReady, crossSigningReady, hasBackup] = await Promise.all([
      crypto.isSecretStorageReady(),
      // Use cross-signing status check that doesn't require secret storage key cache
      crypto.getCrossSigningStatus().then(status => {
        // Check if cross-signing keys exist on the server (more reliable than isCrossSigningReady)
        const hasPublicKeys = !!(status?.publicKeysOnDevice)
        const hasPrivateKeys = !!(
          status?.privateKeysCachedLocally?.masterKey ||
          status?.privateKeysCachedLocally?.selfSigningKey ||
          status?.privateKeysCachedLocally?.userSigningKey
        )
        logger.debug('🔍 Cross-signing status check:', {
          hasPublicKeys,
          hasPrivateKeys,
          status,
          result: hasPublicKeys // Use public keys as the indicator of cross-signing being set up
        })
        return hasPublicKeys // Cross-signing is "ready" if public keys are trusted
      }).catch((err) => {
        logger.debug('Cross-signing status check failed:', err)
        return false
      }),
      crypto.getKeyBackupInfo().then(info => !!info).catch(() => false)
    ])

    const userId = client.getUserId()
    const deviceId = client.getDeviceId()

    let deviceTrusted = false
    let verificationDetails = ''
    if (userId && deviceId) {
      const deviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
      // Check both local verification AND cross-signing verification (like Element does)
      const isLocallyVerified = deviceInfo?.localVerified || false
      const isCrossSigningVerified = deviceInfo?.crossSigningVerified || false
      const isSDKVerified = deviceInfo?.isVerified() || false
      deviceTrusted = isLocallyVerified && isCrossSigningVerified
      verificationDetails = `Local: ${isLocallyVerified ? '✅' : '❌'}, Cross-signing: ${isCrossSigningVerified ? '✅' : '❌'}, SDK: ${isSDKVerified ? '✅' : '❌'}`
    }

    // Update connection status based on results
    const allReady = secretStorageReady && crossSigningReady && deviceTrusted
    matrixConnectionStatus.value = {
      connected: true,
      message: allReady ? 'Connected and fully encrypted' : 'Connected (encryption needs setup)',
      details: allReady ? 'All encryption features working' : 'Some encryption features need attention'
    }

    Dialog.create({
      title: 'Matrix Encryption Status',
      message: `
        • Secret Storage: ${secretStorageReady ? '✅ Ready' : '❌ Not Ready'}
        • Cross-Signing: ${crossSigningReady ? '✅ Ready' : '❌ Not Ready'}
        • Key Backup: ${hasBackup ? '✅ Available' : '❌ Not Available'}
        • Current Device: ${deviceTrusted ? '✅ Fully Verified' : '❌ Not Fully Verified'} (${verificationDetails})
        • User ID: ${userId || 'Not available'}
        • Device ID: ${deviceId || 'Not available'}
      `,
      html: true,
      ok: 'Close'
    })
  } catch (err) {
    console.error('Failed to check Matrix status:', err)
    error(`Status check failed: ${err.message}`)
  }
}

// Recovery key dialog functions
const closeRecoveryKeyDialog = () => {
  if (recoveryKeySaved.value) {
    showRecoveryKeyDialog.value = false
    recoveryKey.value = ''
    recoveryKeySaved.value = false
  }
}

const copyRecoveryKey = async () => {
  try {
    await navigator.clipboard.writeText(recoveryKey.value)
    success('Recovery key copied to clipboard')
  } catch (err) {
    console.error('Failed to copy recovery key:', err)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = recoveryKey.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    success('Recovery key copied to clipboard')
  }
}

const downloadRecoveryKey = () => {
  const element = document.createElement('a')
  const file = new Blob([
    'OpenMeet Matrix Recovery Key\n',
    `Generated: ${new Date().toISOString()}\n`,
    `User: ${matrixUserId.value || 'Unknown'}\n`,
    '\n',
    `Recovery Key:\n${recoveryKey.value}\n`,
    '\n',
    'IMPORTANT: Store this key safely. You need it to unlock your encrypted messages if you lose access to your account.\n'
  ], { type: 'text/plain' })
  element.href = URL.createObjectURL(file)
  element.download = `openmeet-matrix-recovery-key-${new Date().toISOString().split('T')[0]}.txt`
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
  URL.revokeObjectURL(element.href)
  success('Recovery key downloaded')
}

// Device management methods
const onRefreshDevices = async () => {
  refreshingDevices.value = true
  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      error('Matrix client not available')
      return
    }

    const deviceService = new MatrixDeviceManager(client)
    const devices = await deviceService.getAllUserDevices()
    deviceList.value = devices

    success(`Refreshed device list - found ${devices.length} devices`)
  } catch (err) {
    console.error('Failed to refresh devices:', err)
    error('Failed to refresh device list')
  } finally {
    refreshingDevices.value = false
  }
}

const onVerifyDevice = async (deviceId: string) => {
  verifyingDevice.value = deviceId
  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      error('Matrix client not available')
      return
    }

    const deviceService = new MatrixDeviceManager(client)
    const result = await deviceService.manuallyVerifyDevice(deviceId)

    if (result.success) {
      success('Device verified successfully')
      // Refresh the device list to show updated verification status
      await onRefreshDevices()
    } else {
      error(`Failed to verify device: ${result.error}`)
    }
  } catch (err) {
    console.error('Failed to verify device:', err)
    error('Failed to verify device')
  } finally {
    verifyingDevice.value = null
  }
}

const onCleanupDevices = async () => {
  const confirmed = await new Promise((resolve) => {
    Dialog.create({
      title: 'Cleanup Old Devices',
      message: 'This will attempt to delete old Matrix devices (keeping the 5 most recent + current device). Note: Some servers may not support device deletion.',
      cancel: true,
      persistent: true,
      ok: {
        label: 'Cleanup Devices',
        color: 'orange'
      }
    }).onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })

  if (!confirmed) return

  cleaningUpDevices.value = true
  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      error('Matrix client not available')
      return
    }

    const deviceService = new MatrixDeviceManager(client)
    const result = await deviceService.cleanupStaleDevices(5)

    if (result.success) {
      if (result.deletedCount > 0) {
        success(`Successfully cleaned up ${result.deletedCount} old devices`)
      } else if (result.serverSupported === false) {
        error('Matrix server does not support device management')
      } else {
        success('No cleanup needed - device count is manageable')
      }

      // Refresh device list
      await onRefreshDevices()
    } else {
      error(`Device cleanup failed: ${result.error}`)
    }
  } catch (err) {
    console.error('Failed to cleanup devices:', err)
    error('Failed to cleanup devices')
  } finally {
    cleaningUpDevices.value = false
  }
}

const onSetupCrossSigning = async () => {
  settingUpCrossSigning.value = true
  try {
    const client = matrixClientManager.getClient()
    if (!client) {
      error('Matrix client not available')
      return
    }

    // Use new unified encryption service (Element Web style)
    const encryptionService = new MatrixEncryptionService(client)

    // Make debugging available in console
    const windowWithDebug = window as Window & { encryptionDebug?: Record<string, unknown> }
    windowWithDebug.encryptionDebug = {
      service: encryptionService,
      getStatus: () => encryptionService.getStatus(),
      getDebugInfo: () => encryptionService.getDebugInfo(),
      setupWithPassphrase: (passphrase: string) => encryptionService.setupEncryption(passphrase),
      reset: () => encryptionService.resetEncryption(),
      unlockWithRecoveryKey: async (recoveryKey: string) => {
        // Helper to unlock and set up encryption using recovery key
        logger.debug('Setting up encryption with recovery key...')
        const result = await encryptionService.setupEncryption(recoveryKey)
        logger.debug('Setup result:', result)
        return result
      }
    }

    // First check current status
    const statusBefore = await encryptionService.getStatus()
    logger.debug('Status before setup:', statusBefore)

    // This function appears to be a debug/testing function, so we'll just show the status
    const result: { success: boolean; message: string; error?: string } = { success: true, message: 'Use the UI or debug functions to set up encryption' }

    if (result.success) {
      success('Encryption debug tools are ready! Use window.encryptionDebug to interact with the service.')

      // Check status after
      const statusAfter = await encryptionService.getStatus()
      logger.debug('Status after setup:', statusAfter)

      await onRefreshDevices()
    } else {
      error(`Cross-signing setup failed: ${result.error || result.message || 'Unknown error'}`)

      // Debug the failure
      const debugInfo = await encryptionService.getDebugInfo()
      logger.debug('Debug info for failure:', debugInfo)
    }
  } catch (err) {
    console.error('Failed to setup cross-signing:', err)
    error(`Cross-signing setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  } finally {
    settingUpCrossSigning.value = false
  }
}

// Complete Matrix reset functionality
/* const onForceResetCrossSigningKeys = async () => {
  const confirmed = await new Promise((resolve) => {
    Dialog.create({
      title: 'Force Reset Cross-Signing Keys',
      message: 'This will reset your cross-signing keys on the Matrix server to match your secret storage. This should fix key mismatch issues between OpenMeet and Element. Continue?',
      cancel: true,
      persistent: true,
      ok: {
        label: 'Reset Cross-Signing Keys',
        color: 'orange'
      }
    }).onOk(() => resolve(true)).onCancel(() => resolve(false))
  })

  if (!confirmed) return

  try {
    isForcingResetCrossSigning.value = true

    const matrixClient = matrixClientManager.getClient()
    if (!matrixClient) {
      throw new Error('Matrix client not available')
    }

    const crossSigningService = new MatrixCrossSigningService(matrixClient)
    const result = await crossSigningService.resetComplete()

    if (result.success) {
      Notify.create({
        type: 'positive',
        message: 'Cross-signing keys reset successfully! Your device should now appear verified in Element.',
        timeout: 5000
      })

      // Show new recovery key if generated
      if (result.recoveryKey) {
        recoveryKey.value = result.recoveryKey
        showRecoveryKeyDialog.value = true

        Notify.create({
          type: 'info',
          message: 'NEW RECOVERY KEY generated! Save it now - Element will need this key.',
          timeout: 8000
        })
      }

      // Refresh devices to show updated verification status
      await onRefreshDevices()
    } else {
      throw new Error(result.error || 'Force reset failed')
    }
  } catch (error) {
    logger.error('❌ Force reset cross-signing keys failed:', error)

    Notify.create({
      type: 'negative',
      message: `Failed to reset cross-signing keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timeout: 8000
    })
  } finally {
    isForcingResetCrossSigning.value = false
  }
} */

/* const onResetMatrixCompletely = async () => {
  const confirmed = await new Promise((resolve) => {
    Dialog.create({
      title: 'Complete Matrix Reset',
      message: 'This will completely reset your Matrix integration: clear all local data (devices, encryption keys, storage), log you out of Matrix, and require you to reconnect. Are you absolutely sure?',
      cancel: true,
      persistent: true,
      ok: {
        label: 'Reset Everything',
        color: 'negative'
      }
    }).onOk(() => resolve(true))
      .onCancel(() => resolve(false))
  })

  if (!confirmed) return

  isResettingMatrixCompletely.value = true

  try {
    const client = matrixClientManager.getClient()
    const userId = client?.getUserId()

    success('Starting complete Matrix reset...')

    // Use the comprehensive reset method from MatrixClientManager
    await matrixClientManager.resetMatrixCompletely(userId)

    success('Matrix reset complete! Reloading page to start fresh...')

    // Wait a moment for the success message to be seen
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  } catch (err) {
    console.error('Complete Matrix reset failed:', err)
    error(`Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  } finally {
    isResettingMatrixCompletely.value = false
  }
} */
</script>

<style lang="scss" scoped>
.bio-editor {
  .markdown-preview {
    min-height: 100px;
    max-height: 300px;
    overflow-y: auto;

    :deep(a) {
      color: var(--q-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }

      &::after {
        display: none;
      }
    }

    :deep(img) {
      max-width: 100%;
      border-radius: 4px;
    }

    :deep(code) {
      background-color: rgba(0, 0, 0, 0.05);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }

    :deep(blockquote) {
      border-left: 4px solid var(--q-primary);
      margin-left: 0;
      padding-left: 16px;
      color: rgba(0, 0, 0, 0.7);
    }
  }
}

/* Matrix Recovery Key Dialog Styles */
.recovery-key-dialog {
  max-width: 600px;
  margin: auto;
  max-height: 90vh;
}

.recovery-key-content {
  max-height: 70vh;
  overflow-y: auto;
}

.recovery-key-card {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
}

.recovery-key-text {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 12px;
  word-break: break-all;
  line-height: 1.4;
  text-align: center;
  letter-spacing: 0.5px;
}

.recovery-key-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* Dark mode support */
.body--dark .recovery-key-card {
  background: #2d2d2d;
  border-color: #3a3a3a;
}

.body--dark .recovery-key-text {
  background: #1a1a1a;
  border-color: #4a4a4a;
  color: #e5e7eb;
}

/* Device Management Styles */
.device-list {
  max-height: 400px;
  overflow-y: auto;
}

.device-item {
  transition: all 0.2s ease;
}

.device-card {
  border: 1px solid #e0e0e0;
  transition: border-color 0.2s ease;
}

.device-card:hover {
  border-color: var(--q-primary);
}

.current-device .device-card {
  background: rgba(25, 118, 210, 0.05);
  border-color: var(--q-primary);
}

/* Dark mode support for device cards */
.body--dark .device-card {
  border-color: #3a3a3a;
  background: #2d2d2d;
}

.body--dark .device-card:hover {
  border-color: var(--q-primary);
}

.body--dark .current-device .device-card {
  background: rgba(144, 202, 249, 0.1);
}
</style>
