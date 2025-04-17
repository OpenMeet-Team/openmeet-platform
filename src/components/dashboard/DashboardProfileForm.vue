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

          <div v-if="hasDirectAccess" class="text-caption q-mb-md">
            <q-icon name="sym_r_check_circle" color="positive" size="sm" />
            Direct Matrix access is enabled. Last password set: {{ getLastPasswordChangedFormatted }}
          </div>

          <q-expansion-item
            data-cy="matrix-password-section"
            expand-separator
            icon="sym_r_vpn_key"
            :label="hasDirectAccess ? 'Change Matrix Password' : 'Set Matrix Password for Direct Access'"
            caption="Allows you to use third-party Matrix clients"
          >
            <q-card>
              <q-card-section>
                <p class="text-caption">
                  This password enables you to access your Matrix account directly using third-party
                  Matrix clients like Element, FluffyChat, or SchildiChat.
                </p>

                <q-input
                  data-cy="matrix-password"
                  v-model="matrixPassword"
                  filled
                  maxlength="255"
                  minlength="8"
                  :type="isMatrixPwdVisible ? 'text' : 'password'"
                  label="Matrix Password"
                  hint="At least 8 characters"
                  :rules="[(val) => val.length >= 8 || 'Password must be at least 8 characters']"
                >
                  <template v-slot:append>
                    <q-icon
                      :name="isMatrixPwdVisible ? 'sym_r_visibility' : 'sym_r_visibility_off'"
                      class="cursor-pointer"
                      @click="isMatrixPwdVisible = !isMatrixPwdVisible"
                    />
                  </template>
                </q-input>

                <q-input
                  data-cy="matrix-password-confirm"
                  v-model="matrixPasswordConfirm"
                  filled
                  maxlength="255"
                  :type="isMatrixPwdVisible ? 'text' : 'password'"
                  label="Confirm Matrix Password"
                  class="q-mt-md"
                  :rules="[
                    (val) => val === matrixPassword || 'Passwords do not match',
                    (val) => val.length >= 8 || 'Password must be at least 8 characters'
                  ]"
                >
                  <template v-slot:append>
                    <q-icon
                      :name="isMatrixPwdVisible ? 'sym_r_visibility' : 'sym_r_visibility_off'"
                      class="cursor-pointer"
                      @click="isMatrixPwdVisible = !isMatrixPwdVisible"
                    />
                  </template>
                </q-input>

                <div class="q-mt-md">
                  <q-btn
                    data-cy="matrix-set-password"
                    no-caps
                    :loading="isSettingMatrixPassword"
                    :disable="matrixPassword.length < 8 || matrixPassword !== matrixPasswordConfirm"
                    label="Set Matrix Password"
                    color="primary"
                    @click="onSetMatrixPassword"
                  />
                </div>
              </q-card-section>
            </q-card>
          </q-expansion-item>

          <div class="text-caption q-mt-md">
            <q-icon name="sym_r_info" color="info" size="sm" class="q-mr-xs" />
            Matrix passwords are managed separately from your OpenMeet account password.
            This password is only used for direct Matrix client access.
          </div>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Dialog, LoadingBar, date } from 'quasar'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { FileEntity, SubCategoryEntity, AuthProvidersEnum } from '../../types'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../../components/common/UploadComponent.vue'
import { subcategoriesApi } from '../../api/subcategories'
import { useBlueskyConnection } from '../../composables/useBlueskyConnection'
import { useMatrixAccess } from '../../composables/useMatrixAccess'
import { Profile } from '../../types/user'
import { getImageSrc } from '../../utils/imageUtils'

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
const isMatrixPwdVisible = ref(false)
const isLoading = ref(false)
const matrixPassword = ref('')
const matrixPasswordConfirm = ref('')
const bioTab = ref('edit') // Tab for bio editor (edit/preview)

// Matrix integration
const {
  isSettingPassword: isSettingMatrixPassword,
  setMatrixPassword,
  hasMatrixAccount: checkHasMatrixAccount,
  hasDirectAccess: checkHasDirectAccess,
  getMatrixUserId
} = useMatrixAccess()

// Computed properties for Matrix integration
const hasMatrixAccount = computed(() => checkHasMatrixAccount())
const hasDirectAccess = computed(() => checkHasDirectAccess())
const matrixUserId = computed(() => getMatrixUserId())

// Format the last password change date
const getLastPasswordChangedFormatted = computed(() => {
  const lastChanged = form.value.preferences?.matrix?.lastPasswordChanged
  if (!lastChanged) return 'Never'

  return date.formatDate(new Date(lastChanged), 'MMMM D, YYYY')
})

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

const onSetMatrixPassword = async () => {
  if (matrixPassword.value !== matrixPasswordConfirm.value) {
    error('Passwords do not match')
    return
  }

  if (matrixPassword.value.length < 8) {
    error('Password must be at least 8 characters')
    return
  }

  const result = await setMatrixPassword(matrixPassword.value)
  if (result) {
    // Clear the password fields for security (do this immediately)
    matrixPassword.value = ''
    matrixPasswordConfirm.value = ''

    // Update the UI to reflect direct access
    const userData = useAuthStore().user
    if (userData) {
      // Update the form preferences properly
      if (!form.value.preferences) {
        form.value.preferences = {}
      }

      // Create matrix preferences object if it doesn't exist
      if (!form.value.preferences.matrix) {
        form.value.preferences.matrix = {}
      }

      // Set the necessary fields without replacing the entire object
      form.value.preferences.matrix.hasDirectAccess = true
      form.value.preferences.matrix.lastPasswordChanged = new Date()
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
</style>
