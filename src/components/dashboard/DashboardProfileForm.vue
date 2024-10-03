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

    <LocationComponent2 label="Location" v-model="form.location"/>

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
import { onMounted, reactive, ref } from 'vue'
import { Dialog, useQuasar } from 'quasar'
import { authApi } from 'src/api/auth.ts'
import { useAuthStore } from 'stores/auth-store.ts'
import { UploadedFile, Location } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import LocationComponent2 from 'components/common/LocationComponent2.vue'
import UploadComponent from 'components/common/UploadComponent.vue'

interface UserForm {
  email: string
  firstName?: string
  lastName?: string
  photo?: UploadedFile
  location?: Location
  password?: string
  oldPassword?: string
}

const $q = useQuasar()
const { error } = useNotification()

const form = reactive<UserForm>({
  email: '',
  firstName: '',
  lastName: '',
  photo: {
    id: '',
    path: ''
  }
  // password: '',
  // oldPassword: ''
})
const isPwd = ref(true)

const onSubmit = async () => {
  authApi.updateMe(form).then(res => {
    useAuthStore().actionSetUser(res.data)
    $q.notify({
      color: 'positive',
      message: 'Profile updated successfully',
      icon: 'sym_r_check'
    })
  }).catch(err => {
    console.log(err)
    error('Failed to update profile')
  })
}

onMounted(() => {
  authApi.getMe().then(res => {
    form.email = res.data.email
    form.firstName = res.data.firstName
    form.lastName = res.data.lastName
    form.photo = res.data.photo
    // Object.assign(form, res.data)
  })
})

const onProfilePhotoSelect = (file: UploadedFile) => {
  form.photo = file
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
