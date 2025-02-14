<template>
  <q-form data-cy="profile-form" @submit="onSubmit" class="c-dashboard-profile-form q-gutter-md" style="max-width: 500px">

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

    <q-input
      data-cy="profile-bio"
      filled
      type="textarea"
      v-model="form.bio"
      label="Your bio"
      counter
      maxlength="255"
    />

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

    <UploadComponent
      data-cy="profile-photo"
      class="q-mt-xl"
      label="Profile picture"
      :crop-options="{autoZoom: true, aspectRatio: 1}"
      @upload="onProfilePhotoSelect"
    />

    <q-img
      v-if="form && form.photo && form.photo.path"
      :src="form.photo.path"
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

<!--    <LocationComponent label="Location" v-model:location="form.location.address" v-model:latitude="form.location.lat" v-model:longitude="form.location.lon"/>-->

    <q-card class="q-mb-md" data-cy="profile-bluesky">
      <q-card-section>
        <div class="text-h6 q-mb-md">
          <q-icon name="sym_r_cloud" class="q-mr-sm" />
          Bluesky Settings
        </div>
        <div class="q-gutter-y-md">
          <div class="text-subtitle2" v-if="form.preferences?.bluesky?.handle">
            Connected as: {{ form.preferences.bluesky.handle }}
          </div>
          <q-toggle
            v-model="form.preferences.bluesky.connected"
            label="Use Bluesky as event source"
            @update:model-value="onBlueskyConnectionToggle"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-expansion-item
      data-cy="profile-password"
      expand-separator
      icon="sym_r_vpn_key"
      label="Change Password"
    >
      <q-card>
        <q-card-section>
          <!-- required password if expansion is open -->

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
        </q-card-section>
      </q-card>
    </q-expansion-item>

    <q-card-actions align="right">
      <q-btn
        data-cy="profile-delete-account"
        no-caps
        label="Delete account"
        color="negative"
        flat
        class="q-ml-sm"
        @click="onDeleteAccount"
      />
      <q-btn
        data-cy="profile-update"
        no-caps
        :loading="isLoading"
        label="Update"
        type="submit"
        color="primary"
      />
    </q-card-actions>
  </q-form>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Dialog, LoadingBar } from 'quasar'
import { authApi } from '../../api/auth'
import { useAuthStore } from '../../stores/auth-store'
import { FileEntity, SubCategoryEntity } from '../../types'
import { useNotification } from '../../composables/useNotification'
// import LocationComponent from 'components/common/LocationComponent.vue'
import UploadComponent from '../../components/common/UploadComponent.vue'
import { subcategoriesApi } from '../../api/subcategories'
import { useBlueskyConnection } from '../../composables/useBlueskyConnection'

interface UserLocation {
  lat: number
  lon: number
  address: string
}

interface BlueskyPreferences {
  did?: string
  handle?: string
  connected?: boolean
  disconnectedAt?: Date | null
  connectedAt?: Date | null
}

interface UserPreferences {
  bluesky?: BlueskyPreferences
}

interface Profile {
  id: number
  slug: string
  ulid: string
  email: string
  firstName?: string | null
  lastName?: string | null
  bio?: string
  photo?: FileEntity | null
  oldPassword?: string
  password?: string
  location?: UserLocation
  preferences?: UserPreferences
  interests?: SubCategoryEntity[]
}

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
      connectedAt: null
    }
  }
})

const subCategories = ref<SubCategoryEntity[]>([])

const isPwd = ref(true)
const isLoading = ref(false)

const onSubmit = async () => {
  const user = {
    ...form.value
  }

  if (form.value.photo && form.value.photo.id) {
    user.photo = Object.assign({}, { id: form.value.photo.id })
  }

  isLoading.value = true
  authApi.updateMe(user).then(res => {
    useAuthStore().actionSetUser(res.data)
    success('Profile updated successfully')

    if (res.data.email !== form.value.email) {
      Dialog.create({
        title: 'Confirm Email',
        message: `Please confirm your new email by clicking the link in the email we just sent you to ${form.value.email}.`
      })
    }
  }).catch(err => {
    console.log(err)
    error('Failed to update profile')
  }).finally(() => {
    isLoading.value = false
  })
}

const interests = computed(() => {
  return subCategories.value
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
        ...userData.preferences
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
  form.value.photo = file
}

const onProfilePhotoDelete = () => {
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

const onBlueskyConnectionToggle = async (enabled: boolean) => {
  const success = await toggleConnection(enabled)
  if (!success) {
    // Revert the toggle if the operation failed
    form.value.preferences.bluesky.connected = !enabled
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
