<template>
  <q-card class="atproto-identity-card" data-cy="atproto-identity-card">
    <q-card-section>
      <div class="text-h6 q-mb-md">
        <q-icon name="sym_r_cloud" class="q-mr-sm" />
        AT Protocol Identity
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex flex-center q-pa-md" data-cy="identity-loading">
        <q-spinner color="primary" size="2em" />
      </div>

      <!-- No identity state -->
      <template v-else-if="!identity">
        <div class="q-mb-md">
          <q-banner class="bg-blue-1 text-dark" rounded>
            <template v-slot:avatar>
              <q-icon name="sym_r_info" color="primary" />
            </template>
            No AT Protocol identity linked to your account
          </q-banner>
        </div>

        <!-- Recovery available banner -->
        <div v-if="recoveryStatus?.hasExistingAccount" class="q-mb-md" data-cy="recovery-banner">
          <q-banner class="bg-green-1 text-dark" rounded>
            <template v-slot:avatar>
              <q-icon name="sym_r_cloud_download" color="positive" />
            </template>
            <div class="text-body2">
              We found an existing AT Protocol account linked to your email.
              You can recover it or create a new one.
            </div>
          </q-banner>
        </div>

        <!-- Action buttons -->
        <div class="q-gutter-sm">
          <!-- Recover button (shown if recovery available) -->
          <q-btn
            v-if="recoveryStatus?.hasExistingAccount"
            data-cy="recover-identity-btn"
            color="positive"
            no-caps
            :loading="recovering"
            :disable="recovering"
            @click="$emit('recover')"
          >
            <q-icon name="sym_r_cloud_download" class="q-mr-sm" />
            Let OpenMeet manage it
          </q-btn>

          <!-- Create button -->
          <q-btn
            data-cy="create-identity-btn"
            :color="recoveryStatus?.hasExistingAccount ? 'grey-7' : 'primary'"
            :outline="recoveryStatus?.hasExistingAccount"
            no-caps
            :disable="recovering"
            @click="$emit('create')"
          >
            <q-icon name="sym_r_add" class="q-mr-sm" />
            {{ recoveryStatus?.hasExistingAccount ? 'Create New Identity' : 'Create AT Protocol Identity' }}
          </q-btn>
        </div>
      </template>

      <!-- Identity exists -->
      <template v-else>
        <!-- External PDS warning -->
        <div v-if="!identity.isCustodial && !identity.isOurPds" class="q-mb-md">
          <q-banner class="bg-orange-1 text-dark" rounded>
            <template v-slot:avatar>
              <q-icon name="sym_r_info" color="warning" />
            </template>
            Your identity is hosted on an external PDS. Account changes must be made through your PDS provider.
          </q-banner>
        </div>

        <div class="q-gutter-y-md">
          <!-- Handle -->
          <div v-if="identity.handle" class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">Handle</div>
            <div class="col row items-center no-wrap">
              <span class="text-body1 text-weight-medium q-mr-sm">@{{ identity.handle }}</span>
              <q-btn
                data-cy="copy-handle-btn"
                flat
                round
                dense
                size="sm"
                icon="sym_r_content_copy"
                @click="copyHandle"
              >
                <q-tooltip>Copy handle</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- DID -->
          <div class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">DID</div>
            <div class="col row items-center no-wrap">
              <code class="text-body2 q-mr-sm">{{ truncatedDid }}</code>
              <q-btn
                data-cy="copy-did-btn"
                flat
                round
                dense
                size="sm"
                icon="sym_r_content_copy"
                @click="copyDid"
              >
                <q-tooltip>Copy full DID</q-tooltip>
              </q-btn>
            </div>
          </div>

          <!-- Status -->
          <div class="row items-center">
            <div class="text-subtitle2 text-grey-7 col-3">Status</div>
            <div class="col">
              <q-chip
                :color="statusColor"
                text-color="white"
                size="sm"
              >
                {{ statusText }}
              </q-chip>
            </div>
          </div>

          <!-- View on Bluesky link -->
          <div class="q-mt-md">
            <a
              data-cy="bluesky-profile-link"
              :href="blueskyProfileUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary"
            >
              View Profile on Bluesky
              <q-icon name="sym_r_open_in_new" size="xs" class="q-ml-xs" />
            </a>
          </div>

          <!-- Take ownership section for custodial identities on our PDS -->
          <template v-if="identity.isCustodial && identity.isOurPds">
            <q-separator class="q-my-md" />

            <!-- Normal state: show Take Ownership button with pre-flow instructions -->
            <div v-if="!takeOwnershipPending" class="q-mt-md">
              <div class="text-body2 text-grey-8 q-mb-md">
                Taking ownership lets you manage this identity directly. You'll:
                <ol class="q-pl-md q-my-sm">
                  <li>Receive a password reset email</li>
                  <li>Set your own password</li>
                  <li>Sign in to continue publishing events</li>
                </ol>
              </div>
              <q-btn
                data-cy="take-ownership-btn"
                color="secondary"
                no-caps
                outline
                @click="$emit('initiate-take-ownership')"
              >
                <q-icon name="sym_r_key" class="q-mr-sm" />
                Take Ownership
              </q-btn>
            </div>

            <!-- Pending state: show instructions and password reset form -->
            <div v-else class="q-mt-md">
              <q-banner class="bg-blue-1 text-dark q-mb-md" rounded>
                <template v-slot:avatar>
                  <q-icon name="sym_r_mail" color="primary" />
                </template>
                <div class="text-body2">
                  Check your email at <strong>{{ takeOwnershipEmail }}</strong> for a password reset code.
                  Enter the code and your new password below.
                </div>
              </q-banner>

              <!-- Password reset error -->
              <div v-if="passwordResetError" class="q-mb-md">
                <q-banner class="bg-red-1 text-dark" rounded data-cy="password-reset-error">
                  <template v-slot:avatar>
                    <q-icon name="sym_r_error" color="negative" />
                  </template>
                  {{ passwordResetError }}
                </q-banner>
              </div>

              <!-- Password reset form -->
              <div class="q-gutter-md q-mb-md">
                <q-input
                  data-cy="password-reset-token"
                  v-model="resetToken"
                  label="Reset Code"
                  hint="Enter the code from your email"
                  filled
                  inputmode="numeric"
                  :error="!!validationErrors.token"
                  :error-message="validationErrors.token"
                />

                <q-input
                  data-cy="password-reset-password"
                  v-model="resetPassword"
                  label="New Password"
                  hint="Must be at least 8 characters"
                  filled
                  :type="showPassword ? 'text' : 'password'"
                  :error="!!validationErrors.password"
                  :error-message="validationErrors.password"
                >
                  <template v-slot:append>
                    <q-icon
                      :name="showPassword ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                      class="cursor-pointer"
                      @click="showPassword = !showPassword"
                    />
                  </template>
                </q-input>

                <q-input
                  data-cy="password-reset-confirm"
                  v-model="resetPasswordConfirm"
                  label="Confirm Password"
                  filled
                  :type="showPassword ? 'text' : 'password'"
                  :error="!!validationErrors.confirm"
                  :error-message="validationErrors.confirm"
                >
                  <template v-slot:append>
                    <q-icon
                      :name="showPassword ? 'sym_r_visibility_off' : 'sym_r_visibility'"
                      class="cursor-pointer"
                      @click="showPassword = !showPassword"
                    />
                  </template>
                </q-input>
              </div>

              <div class="q-gutter-sm">
                <q-btn
                  data-cy="submit-password-reset-btn"
                  color="primary"
                  no-caps
                  :loading="resettingPassword"
                  :disable="resettingPassword"
                  @click="submitPasswordReset"
                >
                  <q-icon name="sym_r_check" class="q-mr-sm" />
                  Set Password & Complete
                </q-btn>

                <q-btn
                  data-cy="cancel-take-ownership-btn"
                  flat
                  no-caps
                  color="grey-7"
                  :disable="resettingPassword"
                  @click="$emit('cancel-take-ownership')"
                >
                  Cancel
                </q-btn>
              </div>
            </div>

            <!-- Handle change section (only when not in take ownership flow and domain is configured) -->
            <template v-if="!takeOwnershipPending && handleDomain">
              <q-separator class="q-my-md" />

              <div class="q-mt-md">
                <div class="text-subtitle2 text-grey-7 q-mb-sm">Change Handle</div>

                <div v-if="!editingHandle" class="row items-center q-gutter-sm">
                  <q-btn
                    data-cy="edit-handle-btn"
                    color="primary"
                    no-caps
                    outline
                    size="sm"
                    @click="startEditingHandle"
                  >
                    <q-icon name="sym_r_edit" class="q-mr-sm" size="xs" />
                    Change Handle
                  </q-btn>
                </div>

                <div v-else class="q-gutter-sm">
                  <q-input
                    data-cy="new-handle-input"
                    v-model="newHandle"
                    label="Username"
                    filled
                    dense
                    :error="!!handleError"
                    :error-message="handleError"
                    @keyup.enter="submitHandleChange"
                    @keyup.escape="cancelEditingHandle"
                  >
                    <template v-slot:append>
                      <span class="text-grey-7 text-body2">{{ handleDomain }}</span>
                    </template>
                  </q-input>

                  <div class="q-gutter-sm">
                    <q-btn
                      data-cy="submit-handle-btn"
                      color="primary"
                      no-caps
                      size="sm"
                      :loading="updatingHandle"
                      :disable="updatingHandle || !newHandle.trim()"
                      @click="submitHandleChange"
                    >
                      Save
                    </q-btn>
                    <q-btn
                      data-cy="cancel-handle-btn"
                      flat
                      no-caps
                      size="sm"
                      color="grey-7"
                      :disable="updatingHandle"
                      @click="cancelEditingHandle"
                    >
                      Cancel
                    </q-btn>
                  </div>
                </div>
              </div>
            </template>
          </template>

          <!-- Link external account for post-ownership users without active session -->
          <template v-if="!identity.isCustodial && !identity.hasActiveSession">
            <q-separator class="q-my-md" />

            <div class="q-mt-md">
              <q-banner class="bg-orange-1 text-dark q-mb-md" rounded>
                <template v-slot:avatar>
                  <q-icon name="sym_r_link_off" color="warning" />
                </template>
                <div class="text-body2">
                  Your AT Protocol session has expired. Link your account again to enable publishing.
                </div>
              </q-banner>

              <q-btn
                data-cy="relink-identity-btn"
                color="primary"
                no-caps
                :loading="linking"
                @click="startLinking"
              >
                <q-icon name="sym_r_link" class="q-mr-sm" />
                Re-link Account
              </q-btn>
            </div>
          </template>
        </div>
      </template>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref, reactive, watch } from 'vue'
import { copyToClipboard, Notify } from 'quasar'
import type { AtprotoIdentityDto, AtprotoRecoveryStatusDto } from '../../types/atproto'

const props = defineProps<{
  identity: AtprotoIdentityDto | null
  loading: boolean
  recoveryStatus: AtprotoRecoveryStatusDto | null
  recovering: boolean
  takeOwnershipPending?: boolean
  takeOwnershipEmail?: string
  takingOwnership?: boolean
  resettingPassword?: boolean
  passwordResetError?: string
  updatingHandle?: boolean
  handleError?: string
  handleDomain?: string
  linking?: boolean
}>()

// eslint-disable-next-line func-call-spacing
const emit = defineEmits<{
  (e: 'create'): void
  (e: 'recover'): void
  (e: 'initiate-take-ownership'): void
  (e: 'complete-take-ownership'): void
  (e: 'cancel-take-ownership'): void
  (e: 'reset-password', payload: { token: string; password: string }): void
  (e: 'update-handle', handle: string): void
  (e: 'link'): void
}>()

// Password reset form state
const resetToken = ref('')
const resetPassword = ref('')
const resetPasswordConfirm = ref('')
const showPassword = ref(false)
const validationErrors = reactive({
  token: '',
  password: '',
  confirm: ''
})

// Handle change state
const editingHandle = ref(false)
const newHandle = ref('')

const startEditingHandle = () => {
  // Pre-fill with current handle's local part
  const currentHandle = props.identity?.handle || ''
  const domain = props.handleDomain || ''
  if (domain && currentHandle.endsWith(domain)) {
    newHandle.value = currentHandle.slice(0, -domain.length)
  } else {
    newHandle.value = ''
  }
  editingHandle.value = true
}

const cancelEditingHandle = () => {
  editingHandle.value = false
  newHandle.value = ''
}

const submitHandleChange = () => {
  if (!newHandle.value.trim() || !props.handleDomain) return

  const domain = props.handleDomain
  let handle = newHandle.value.trim()

  // Add domain if not already present
  if (!handle.endsWith(domain)) {
    handle = handle + domain
  }

  emit('update-handle', handle)
}

// Reset handle editing state when handle updates successfully
watch(() => props.identity?.handle, () => {
  if (!props.updatingHandle) {
    editingHandle.value = false
    newHandle.value = ''
  }
})

// Link external account
const startLinking = () => {
  emit('link')
}

// Clear form when takeOwnershipPending changes to false
watch(() => props.takeOwnershipPending, (pending) => {
  if (!pending) {
    resetToken.value = ''
    resetPassword.value = ''
    resetPasswordConfirm.value = ''
    validationErrors.token = ''
    validationErrors.password = ''
    validationErrors.confirm = ''
  }
})

const validateForm = (): boolean => {
  let valid = true

  // Clear previous errors
  validationErrors.token = ''
  validationErrors.password = ''
  validationErrors.confirm = ''

  // Validate token
  if (!resetToken.value.trim()) {
    validationErrors.token = 'Token is required'
    valid = false
  }

  // Validate password length
  if (resetPassword.value.length < 8) {
    validationErrors.password = 'Password must be at least 8 characters'
    valid = false
  }

  // Validate passwords match
  if (resetPassword.value !== resetPasswordConfirm.value) {
    validationErrors.confirm = 'Passwords do not match'
    valid = false
  }

  return valid
}

const submitPasswordReset = () => {
  if (!validateForm()) {
    return
  }

  emit('reset-password', {
    token: resetToken.value.trim(),
    password: resetPassword.value
  })
}

const truncatedDid = computed(() => {
  if (!props.identity?.did) return ''
  const did = props.identity.did
  if (did.length <= 30) return did
  // Show first 20 chars and last 6 chars for better readability
  return `${did.slice(0, 20)}...${did.slice(-6)}`
})

const statusText = computed(() => {
  if (!props.identity) return ''
  // Custodial identities show custody status
  if (props.identity.isCustodial) {
    return 'Managed by OpenMeet'
  }
  // Non-custodial identities show session state
  if (props.identity.hasActiveSession) {
    return 'Connected'
  }
  return 'Needs authentication'
})

const statusColor = computed(() => {
  if (!props.identity) return 'grey'
  // Custodial identities use primary color
  if (props.identity.isCustodial) return 'primary'
  // Non-custodial: green if connected, warning if needs auth
  if (props.identity.hasActiveSession) return 'positive'
  return 'warning'
})

const blueskyProfileUrl = computed(() => {
  // Prefer handle, fall back to DID
  const identifier = props.identity?.handle || props.identity?.did
  if (!identifier) return ''
  return `https://bsky.app/profile/${identifier}`
})

const copyDid = async () => {
  if (!props.identity?.did) return
  try {
    await copyToClipboard(props.identity.did)
    Notify.create({
      type: 'positive',
      message: 'DID copied to clipboard',
      position: 'top'
    })
  } catch (err) {
    console.error('Failed to copy DID:', err)
    Notify.create({
      type: 'negative',
      message: 'Failed to copy DID',
      position: 'top'
    })
  }
}

const copyHandle = async () => {
  if (!props.identity?.handle) return
  try {
    await copyToClipboard(props.identity.handle)
    Notify.create({
      type: 'positive',
      message: 'Handle copied to clipboard',
      position: 'top'
    })
  } catch (err) {
    console.error('Failed to copy handle:', err)
    Notify.create({
      type: 'negative',
      message: 'Failed to copy handle',
      position: 'top'
    })
  }
}
</script>

<style lang="scss" scoped>
.atproto-identity-card {
  code {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
}
</style>
