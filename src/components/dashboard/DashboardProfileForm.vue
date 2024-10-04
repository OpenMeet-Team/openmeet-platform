<template>
  <q-form @submit="onSubmit" class="q-gutter-md" style="max-width: 500px">
    <q-input
      filled
      disable
      v-model="form.email"
      label="Email"
      type="email"
      :rules="[val => !!val || 'Email is required']"
    />

    <q-input
      filled
      v-model="form.firstName"
      label="First Name"
      :rules="[val => !!val || 'First name is required']"
    />

    <q-input
      filled
      v-model="form.lastName"
      label="Last Name"
      :rules="[val => !!val || 'Last name is required']"
    />

    <UploadComponent label="Profile picture" @upload="onProfilePhotoSelect"/>
<!--    <q-file-->
<!--      filled-->
<!--      :model-value="null"-->
<!--      label="Profile Photo"-->
<!--      accept="image/*"-->
<!--      @update:model-value="onProfilePhotoSelect"-->
<!--    >-->
<!--      <template v-slot:prepend>-->
<!--        <q-icon name="sym_r_attach_file"/>-->
<!--      </template>-->
<!--    </q-file>-->

    <q-img
      v-if="form && form.photo && form.photo.path"
      :src="form.photo.path"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

    <LocationComponent2 label="Location" :model-value="form.location?.address" @update:model-value="onLocationSet"/>

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

    <div>
      <q-btn label="Submit" type="submit" color="primary"/>
      <q-btn label="Delete account" color="negative" flat class="q-ml-sm" @click="onDeleteAccount"/>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Dialog } from 'quasar'
import { authApi } from 'src/api/auth.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { UploadedFile, ApiAuthUser, OSMLocationSuggestion } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import LocationComponent2 from 'components/common/LocationComponent2.vue'
import UploadComponent from 'components/common/UploadComponent.vue'

interface UserLocation {
  lat: number
  lon: number
  address: string
}

interface Profile extends ApiAuthUser {
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

const onLocationSet = (location: OSMLocationSuggestion) => {
  console.log(location)
  // form.value.
}

const onSubmit = async () => {
  authApi.updateMe(form.value).then(res => {
    useAuthStore().actionSetUser(res.data)
    success('Profile updated successfully')
  }).catch(err => {
    console.log(err)
    error('Failed to update profile')
  })
}

onMounted(() => {
  authApi.getMe().then(res => {
    // form.email = res.data.email
    // form.firstName = res.data.firstName
    // form.lastName = res.data.lastName
    // form.photo = res.data.photo
    form.value = res.data
    // Object.assign(form, res.data)
  })
})

const onProfilePhotoSelect = (file: UploadedFile) => {
  form.value.photo = file
  // return apiUploadFileToS3(file).then(response => {
  //   form.photo = response
  // }).catch(error => {
  //   error(error.message)
  // })
  // const formData = new FormData()
  // formData.append('file', file, file.name)
  //
  // return apiFilesUpload(formData).then(e => {
  //   console.log(e)
  //   form.photo = e.data.file
  // })
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
