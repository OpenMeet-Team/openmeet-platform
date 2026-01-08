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
            />

            <div class="q-mb-md">
              <div class="text-subtitle1 text-weight-medium q-mb-sm">Profile Photo</div>
              <div class="row items-center no-wrap q-gutter-md">
                <div class="col">
                  <UploadComponent
                    data-cy="profile-photo"
                    label="Click to upload photo"
                    :crop-options="{autoZoom: true, aspectRatio: 1}"
                    @upload="onProfilePhotoSelect"
                  />
                </div>

                <div v-if="localAvatarUrl" class="col-auto">
                  <q-img
                    :src="localAvatarUrl"
                    spinner-color="white"
                    class="rounded-borders"
                    style="height: 100px; width: 100px"
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
            </div>

            <div class="bio-editor q-mb-md">
              <div class="text-subtitle1 text-weight-medium q-mb-sm">Your Bio</div>

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
                    rows="8"
                    autogrow
                    class="q-mt-sm"
                  />
                  <div class="text-caption q-mt-xs">
                    <a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noopener noreferrer" class="text-primary">Learn more about Markdown formatting</a>
                  </div>
                </q-tab-panel>

                <q-tab-panel name="preview" class="q-pa-none">
                  <div class="q-pa-md markdown-preview rounded-borders q-mt-sm">
                    <q-markdown
                      :src="form.bio || '*No content yet*'"
                      class="text-body1"
                    />
                  </div>
                </q-tab-panel>
              </q-tab-panels>
            </div>
          </div>

          <div class="q-mt-md">
            <q-btn
              data-cy="profile-update"
              no-caps
              :loading="isLoading"
              label="Update Profile"
              type="submit"
              color="primary"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Bluesky integration section - only shown for Bluesky users -->
      <q-card class="q-mb-md" data-cy="profile-bluesky" v-if="isBlueskyUser">
        <q-card-section>
          <div class="text-h6 q-mb-md">
            <q-icon name="sym_r_cloud" class="q-mr-sm" />
            AT Protocol Settings
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
              label="Use AT Protocol as event source"
              @update:model-value="onBlueskyConnectionToggle"
            />
          </div>
        </q-card-section>
      </q-card>
    </q-form>

    <!-- Account password section (only for local email auth users) -->
    <q-card class="q-mb-md" v-if="isLocalAuthUser" data-cy="profile-password">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_vpn_key" class="q-mr-sm" />
          {{ userHasPassword ? 'Change Account Password' : 'Set Account Password' }}
        </div>

        <div class="q-gutter-md">
          <!-- Only show current password field if user has a password -->
          <q-input
            v-if="userHasPassword"
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
            :label="userHasPassword ? 'New Password' : 'Password'"
            :hint="userHasPassword ? '' : 'Must be at least 8 characters'"
          >
            <template v-slot:append>
              <q-icon
                :name="isPwd ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                class="cursor-pointer"
                @click="isPwd = !isPwd"
              />
            </template>
          </q-input>

          <!-- Explanatory text for passwordless users -->
          <div v-if="!userHasPassword" class="text-caption text-grey-7 q-mt-sm">
            <q-icon name="sym_r_info" size="xs" class="q-mr-xs" />
            You currently log in with email verification codes. Setting a password will allow you to log in with email and password instead.
          </div>

          <div class="row q-gutter-sm">
            <q-btn
              data-cy="profile-change-password"
              no-caps
              :label="userHasPassword ? 'Change Password' : 'Set Password'"
              color="primary"
              @click="onChangePassword"
            />

            <!-- Toggle button to switch between set/change password modes -->
            <q-btn
              v-if="userHasPassword"
              flat
              no-caps
              label="Setting initial password?"
              color="grey-7"
              size="sm"
              @click="userHasPassword = false"
              data-cy="profile-toggle-passwordless"
            >
              <q-tooltip>Click if you don't have a password yet</q-tooltip>
            </q-btn>
          </div>
        </div>
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

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Dialog, LoadingBar } from 'quasar'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { FileEntity, SubCategoryEntity, AuthProvidersEnum } from '../../types'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../../components/common/UploadComponent.vue'
import { subcategoriesApi } from '../../api/subcategories'
import { useBlueskyConnection } from '../../composables/useBlueskyConnection'
import { Profile } from '../../types/user'
import { getImageSrc } from '../../utils/imageUtils'
import CalendarConnectionsComponent from '../calendar/CalendarConnectionsComponent.vue'

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
    }
  }
})

const subCategories = ref<SubCategoryEntity[]>([])
const isPwd = ref(true)
const isLoading = ref(false)
const bioTab = ref('edit') // Tab for bio editor (edit/preview)

const authStore = useAuthStore()

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

// Separate function to handle password changes (or setting initial password)
const onChangePassword = async () => {
  try {
    if (!form.value.password || form.value.password.length < 8) {
      error('Password must be at least 8 characters')
      return
    }

    // For users with existing password, require old password
    if (userHasPassword.value && !form.value.oldPassword) {
      error('Current password is required')
      return
    }

    // Create password data object
    const passwordData: { password: string; oldPassword?: string } = {
      password: form.value.password
    }

    // Only include oldPassword if user has an existing password
    if (userHasPassword.value && form.value.oldPassword) {
      passwordData.oldPassword = form.value.oldPassword
    }

    const response = await authApi.updateMe(passwordData)
    useAuthStore().actionSetUser(response.data)

    // Success message depends on whether this was initial password or change
    if (userHasPassword.value) {
      success('Password updated successfully')
    } else {
      success('Password set successfully! You can now log in with email and password.')
      userHasPassword.value = true // User now has a password
    }

    // Clear password fields for security
    form.value.password = ''
    form.value.oldPassword = ''
  } catch (err) {
    console.error('Failed to update password:', err)

    // Provide appropriate error message
    if (userHasPassword.value) {
      error('Failed to update password. Please check your current password is correct.')
    } else {
      error('Failed to set password. Please try again.')
    }
  }
}

// For profile form, we only want to show the local photo being edited
const localAvatarUrl = computed(() => {
  if (form.value?.photo?.path && typeof form.value.photo.path === 'string') {
    return getImageSrc(form.value.photo.path)
  }
  return null
})

// Only show Bluesky settings for Bluesky-authenticated users
const isBlueskyUser = computed(() => {
  return authStore.user.provider === AuthProvidersEnum.bluesky
})

// Only show password change for local email auth users (not OAuth users)
const isLocalAuthUser = computed(() => {
  return !authStore.user.provider || authStore.user.provider === AuthProvidersEnum.email
})

// Track if user has a password set
// We start with assumption they do (most users), but will detect passwordless state
// when they try to change password without old password
const userHasPassword = ref(true)

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
    background-color: rgba(128, 128, 128, 0.1);

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
      background-color: rgba(128, 128, 128, 0.15);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }

    :deep(blockquote) {
      border-left: 4px solid var(--q-primary);
      margin-left: 0;
      padding-left: 16px;
      opacity: 0.7;
    }
  }
}

</style>
