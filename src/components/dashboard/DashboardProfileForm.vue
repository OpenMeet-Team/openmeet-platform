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

    </q-form>

    <!-- AT Protocol Identity section - shown for users with identity OR non-Bluesky users who can create one -->
    <AtprotoIdentityCard
      v-if="atprotoIdentity || !isBlueskyUser"
      :identity="atprotoIdentity"
      :loading="atprotoLoading"
      :recovery-status="recoveryStatus"
      :recovering="recovering"
      :take-ownership-pending="takeOwnershipPending"
      :take-ownership-email="takeOwnershipEmail"
      :taking-ownership="takingOwnership"
      :resetting-password="resettingPassword"
      :password-reset-error="passwordResetError"
      :updating-handle="updatingHandle"
      :handle-error="handleError"
      :handle-domain="handleDomain"
      :linking="linking"
      @create="onCreateAtprotoIdentity"
      @recover="onRecoverAtprotoIdentity"
      @initiate-take-ownership="onInitiateTakeOwnership"
      @complete-take-ownership="onCompleteTakeOwnership"
      @cancel-take-ownership="onCancelTakeOwnership"
      @reset-password="onResetPdsPassword"
      @update-handle="onUpdateHandle"
      @link="onLinkIdentity"
      data-cy="profile-atproto-identity"
      class="q-mb-md"
    />

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

    <!-- Privacy & Analytics section -->
    <q-card class="q-mb-md" data-cy="profile-privacy-analytics">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_analytics" class="q-mr-sm" />
          Privacy & Analytics
        </div>

        <q-toggle
          v-model="analyticsOptOut"
          label="Opt out of analytics"
          data-cy="analytics-optout-toggle"
          @update:model-value="onAnalyticsOptOutChange"
        />

        <div class="text-caption text-grey-7 q-mt-sm">
          When enabled, we will not collect analytics data about your usage. This helps us improve OpenMeet, but you can opt out at any time.
        </div>
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

    <!-- Handle input dialog for AT Protocol account linking -->
    <q-dialog v-model="showLinkDialog" data-cy="link-handle-dialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-h6">Connect AT Protocol Account</div>
          <div class="text-body2 text-grey-7 q-mt-sm">
            Enter the handle of the AT Protocol account you want to connect.
          </div>
        </q-card-section>

        <q-card-section>
          <q-banner v-if="linkError" class="bg-red-1 text-dark q-mb-md" rounded data-cy="link-handle-error">
            <template v-slot:avatar>
              <q-icon name="sym_r_error" color="negative" />
            </template>
            {{ linkError }}
          </q-banner>

          <q-input
            data-cy="link-handle-input"
            v-model="linkHandle"
            label="AT Protocol Handle"
            placeholder="e.g. alice.bsky.social"
            filled
            autofocus
            @keyup.enter="submitLinkHandle"
          />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn
            data-cy="link-handle-cancel"
            flat
            no-caps
            label="Cancel"
            color="grey-7"
            @click="cancelLinkDialog"
          />
          <q-btn
            data-cy="link-handle-connect"
            no-caps
            label="Connect"
            color="primary"
            :loading="linking"
            :disable="!linkHandle.trim()"
            @click="submitLinkHandle"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Dialog, LoadingBar } from 'quasar'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { FileEntity, SubCategoryEntity, AuthProvidersEnum } from '../../types'
import { useNotification } from '../../composables/useNotification'
import UploadComponent from '../../components/common/UploadComponent.vue'
import { subcategoriesApi } from '../../api/subcategories'
import { Profile } from '../../types/user'
import { getImageSrc } from '../../utils/imageUtils'
import CalendarConnectionsComponent from '../calendar/CalendarConnectionsComponent.vue'
import AtprotoIdentityCard from '../atproto/AtprotoIdentityCard.vue'
import { atprotoApi } from '../../api/atproto'
import type { AtprotoIdentityDto, AtprotoRecoveryStatusDto } from '../../types/atproto'
import analyticsService from '../../services/analyticsService'

const router = useRouter()
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

// AT Protocol identity state
const atprotoIdentity = ref<AtprotoIdentityDto | null>(null)
const atprotoLoading = ref(false)
const recoveryStatus = ref<AtprotoRecoveryStatusDto | null>(null)
const recovering = ref(false)

// Take ownership state
const takeOwnershipPending = ref(false)
const takeOwnershipEmail = ref('')
const takingOwnership = ref(false)
const resettingPassword = ref(false)
const passwordResetError = ref('')

// Handle change state
const updatingHandle = ref(false)
const handleError = ref('')
const handleDomain = computed(() => atprotoIdentity.value?.validHandleDomains?.[0] || '.opnmt.me')

// Link external account state
const linking = ref(false)
const showLinkDialog = ref(false)
const linkHandle = ref('')
const linkError = ref('')

// Analytics opt-out state
const analyticsOptOut = ref(analyticsService.hasOptedOut())

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

// Create AT Protocol identity
const onCreateAtprotoIdentity = async () => {
  try {
    atprotoLoading.value = true
    const response = await atprotoApi.createIdentity()
    atprotoIdentity.value = response.data
    success('AT Protocol identity created successfully')
  } catch (err) {
    console.error('Failed to create AT Protocol identity:', err)
    error('Failed to create AT Protocol identity')
  } finally {
    atprotoLoading.value = false
  }
}

// Check AT Protocol recovery status
const checkRecoveryStatus = async () => {
  try {
    const response = await atprotoApi.getRecoveryStatus()
    recoveryStatus.value = response.data
  } catch (err) {
    console.error('Failed to check recovery status:', err)
    // Silent fail - just means no recovery available
    recoveryStatus.value = { hasExistingAccount: false }
  }
}

// Recover existing AT Protocol identity as custodial
const onRecoverAtprotoIdentity = async () => {
  try {
    recovering.value = true
    const response = await atprotoApi.recoverAsCustodial()
    atprotoIdentity.value = response.data
    recoveryStatus.value = null // Clear recovery status after successful recovery
    success('AT Protocol identity recovered successfully')
  } catch (err) {
    console.error('Failed to recover AT Protocol identity:', err)
    error('Failed to recover AT Protocol identity')
  } finally {
    recovering.value = false
  }
}

// Initiate take ownership - sends password reset email
const onInitiateTakeOwnership = async () => {
  try {
    takingOwnership.value = true
    const response = await atprotoApi.initiateTakeOwnership()
    takeOwnershipEmail.value = response.data.email
    takeOwnershipPending.value = true
    success('Password reset email sent')
  } catch (err) {
    console.error('Failed to initiate take ownership:', err)
    error('Failed to send password reset email')
  } finally {
    takingOwnership.value = false
  }
}

// Complete take ownership - marks identity as non-custodial
const onCompleteTakeOwnership = async () => {
  try {
    takingOwnership.value = true
    await atprotoApi.completeTakeOwnership()
    // Refresh identity to show updated status
    const response = await atprotoApi.getIdentity()
    atprotoIdentity.value = response.data
    takeOwnershipPending.value = false
    takeOwnershipEmail.value = ''
    success('You now have full ownership of your AT Protocol identity')
  } catch (err) {
    console.error('Failed to complete take ownership:', err)
    error('Failed to complete ownership transfer. Make sure you have set your password.')
  } finally {
    takingOwnership.value = false
  }
}

// Cancel take ownership flow
const onCancelTakeOwnership = () => {
  takeOwnershipPending.value = false
  takeOwnershipEmail.value = ''
  passwordResetError.value = ''
}

// Reset PDS password and complete take ownership
const onResetPdsPassword = async (payload: { token: string; password: string }) => {
  try {
    resettingPassword.value = true
    passwordResetError.value = ''

    // First reset the password on the PDS
    await atprotoApi.resetPdsPassword(payload.token, payload.password)

    // Then mark the identity as non-custodial
    await atprotoApi.completeTakeOwnership()

    // Refresh identity to show updated status
    const response = await atprotoApi.getIdentity()
    atprotoIdentity.value = response.data
    takeOwnershipPending.value = false
    takeOwnershipEmail.value = ''
    success('Password set! Connecting your account...')

    // Auto-redirect to OAuth to complete the flow
    // This establishes the session so the user can publish
    // Pass the handle directly to skip the dialog
    const identityHandle = atprotoIdentity.value?.handle
    if (identityHandle) {
      await onLinkIdentity(identityHandle)
    }
  } catch (err) {
    console.error('Failed to reset PDS password:', err)
    // Extract error message from response if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorMessage = (err as any)?.response?.data?.message || 'Invalid token or password reset failed. Please try again.'
    passwordResetError.value = errorMessage
  } finally {
    resettingPassword.value = false
  }
}

// Update AT Protocol handle
const onUpdateHandle = async (handle: string) => {
  try {
    updatingHandle.value = true
    handleError.value = ''
    const response = await atprotoApi.updateHandle(handle)
    atprotoIdentity.value = response.data
    success('Handle updated successfully')
  } catch (err) {
    console.error('Failed to update handle:', err)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorMessage = (err as any)?.response?.data?.message || 'Failed to update handle'
    handleError.value = errorMessage
    error(errorMessage)
  } finally {
    updatingHandle.value = false
  }
}

// Link external AT Protocol account
// When called with a handle (e.g., from password reset auto-flow), links directly.
// When called without a handle, shows the handle input dialog.
const onLinkIdentity = async (handle?: string) => {
  if (!handle) {
    // Show dialog to prompt user for a handle
    linkHandle.value = ''
    linkError.value = ''
    showLinkDialog.value = true
    return
  }

  try {
    linking.value = true
    const response = await atprotoApi.linkIdentity(handle, 'web')
    // Redirect to OAuth authorization URL
    window.location.href = response.data.authUrl
  } catch (err) {
    console.error('Failed to initiate link:', err)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorMessage = (err as any)?.response?.data?.message || 'Failed to initiate account linking'
    error(errorMessage)
  } finally {
    linking.value = false
  }
}

// Submit handle from the link dialog
const submitLinkHandle = async () => {
  const handle = linkHandle.value.trim()
  if (!handle) {
    linkError.value = 'Please enter a handle'
    return
  }

  try {
    linking.value = true
    linkError.value = ''
    const response = await atprotoApi.linkIdentity(handle, 'web')
    showLinkDialog.value = false
    window.location.href = response.data.authUrl
  } catch (err) {
    console.error('Failed to initiate link:', err)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorMessage = (err as any)?.response?.data?.message || 'Failed to initiate account linking'
    linkError.value = errorMessage
  } finally {
    linking.value = false
  }
}

// Cancel the link dialog
const cancelLinkDialog = () => {
  showLinkDialog.value = false
  linkHandle.value = ''
  linkError.value = ''
}

// Handle analytics opt-out toggle change
const onAnalyticsOptOutChange = async (value: boolean) => {
  try {
    if (value) {
      analyticsService.optOut()
    } else {
      analyticsService.optIn()
    }

    await authApi.updateMe({
      preferences: { analytics: { optOut: value } }
    })
  } catch (err) {
    console.error('Failed to update analytics preference:', err)
    // Revert toggle on error
    analyticsOptOut.value = !value
    if (value) {
      analyticsService.optIn()
    } else {
      analyticsService.optOut()
    }
    error('Failed to update analytics preference')
  }
}

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
          did: userData.preferences?.bluesky?.did || null,
          handle: userData.preferences?.bluesky?.handle || null,
          avatar: userData.preferences?.bluesky?.avatar || null
        }
      }
    }

    // Load AT Protocol identity from user data (included in /auth/me response)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userDataWithIdentity = userRes.data as any
    if (userDataWithIdentity.atprotoIdentity) {
      atprotoIdentity.value = userDataWithIdentity.atprotoIdentity
    } else {
      // No identity - check if recovery is available
      await checkRecoveryStatus()
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
    authApi.deleteMe().then(async () => {
      await useAuthStore().actionLogout()
      router.push('/')
    })
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
