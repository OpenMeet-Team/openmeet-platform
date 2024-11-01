<template>
  <q-form @submit="onSubmit" class="q-gutter-md" style="max-width: 500px">

    <div @click="openChangeEmailDialog" class="input-wrapper">
      <q-input
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
      filled
      v-model="form.firstName"
      label="First Name"
      :rules="[(val: string) => !!val || 'First name is required']"
    />

    <q-input
      filled
      v-model="form.lastName"
      label="Last Name"
      :rules="[(val: string) => !!val || 'Last name is required']"
    />

    <q-input
      filled
      type="textarea"
      v-model="form.bio"
      label="Your bio"
    />

    <UploadComponent class="q-mt-xl" label="Profile picture" :crop-options="{autoZoom: true, aspectRatio: 1}" @upload="onProfilePhotoSelect"/>

    <q-img
      v-if="form && form.photo && form.photo.path"
      :src="form.photo.path"
      spinner-color="white"
      class="rounded-borders"
      style="height: 100px; max-width: 100px"
    >
      <q-btn color="primary" size="md" icon="sym_r_delete" class="all-pointer-events absolute-top-right" @click="onProfilePhotoDelete"/>
  </q-img>

<!--    <LocationComponent label="Location" v-model:location="form.location.address" v-model:latitude="form.location.lat" v-model:longitude="form.location.lon"/>-->

    <q-expansion-item
      expand-separator
      icon="sym_r_vpn_key"
      label="Change Password"
    >
      <q-card>
        <q-card-section>
          <q-input
            v-model="form.oldPassword"
            filled
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
      <q-btn no-caps label="Delete account" color="negative" flat class="q-ml-sm" @click="onDeleteAccount"/>
      <q-btn no-caps :loading="isLoading" label="Update" type="submit" color="primary"/>
    </q-card-actions>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Dialog, LoadingBar } from 'quasar'
import { authApi } from 'src/api/auth.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { FileEntity, UserEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
// import LocationComponent from 'components/common/LocationComponent.vue'
import UploadComponent from 'components/common/UploadComponent.vue'

interface UserLocation {
  lat: number
  lon: number
  address: string
}

interface Profile extends UserEntity {
  oldPassword?: string
  password?: string
  location?: UserLocation
}

const { error, success } = useNotification()

const form = ref<Profile>({
  id: 0,
  email: ''
})

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

onMounted(() => {
  LoadingBar.start()
  authApi.getMe().then(res => {
    form.value = res.data
    // Object.assign(form, res.data)
  }).finally(() => LoadingBar.stop())
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
