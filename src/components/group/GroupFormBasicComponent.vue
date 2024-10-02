<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      filled
      v-model="group.name"
      label="Group Name"
      :rules="[val => !!val || 'Group name is required']"
    />
    <q-input
      filled
      v-model="group.description"
      type="textarea"
      label="Description"
      :rules="[val => !!val || 'Description is required']"
    />
    <q-select
      filled
      multiple
      use-chips
      v-model="group.categories"
      :options="categoryOptions"
      :rules="[val => !!val.length || 'Categories is required']"
      label="Categories (press Enter after each)"
    />
    <q-input
      filled
      v-model="group.location"
      label="Location"
      :rules="[val => !!val || 'Location is required']"
    />

    <q-file
      filled
      :model-value="null"
      label="Group image"
      accept="image/*"
      @update:model-value="onGroupImageSelect"
    >
      <template v-slot:prepend>
        <q-icon name="sym_r_attach_file"/>
      </template>
    </q-file>

    <q-img
      v-if="group && group.image && group.image.path"
      :src="group.image.path"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

    <div class="row justify-end q-gutter-sm">
      <q-btn label="Cancel" color="negative" v-close-popup/>
      <q-btn label="Create Group" type="submit" color="primary"/>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { UploadedFile } from 'src/types'
import { apiUploadFileToS3 } from 'src/api/files.ts'

const $q = useQuasar()

interface BasicGroup {
  name: string
  description: string
  categories: []
  location: ''
  image?: UploadedFile
}

const group = reactive<BasicGroup>({
  name: '',
  description: '',
  categories: [],
  location: ''
})

const onGroupImageSelect = (file: File) => {
  return apiUploadFileToS3(file).then(response => {
    group.image = response
  }).catch(error => {
    Notify.create({
      type: 'negative',
      message: error.message
    })
  })
  // const formData = new FormData()
  // formData.append('file', file, file.name)
  //
  // return apiFilesUpload(formData).then(e => {
  //   console.log(e)
  //   form.photo = e.data.file
  // })
}

onMounted(() => {
  console.log('mounted basic')
})

const categoryOptions = [
  'Technology', 'Sports & Fitness', 'Arts & Culture',
  'Food & Drink', 'Social', 'Professional', 'Education',
  'Hobbies & Crafts', 'Health & Wellness', 'Music',
  'Outdoor & Adventure', 'Language & Ethnic Identity'
]

const emit = defineEmits(['submit'])

const onSubmit = () => {
  // Here you would typically make an API call to create the group
  // For this example, we'll just emit the form data
  emit('submit', { ...group })

  $q.notify({
    color: 'positive',
    textColor: 'white',
    icon: 'cloud_done',
    message: 'Group created successfully'
  })
}
</script>

<style scoped lang="scss">

</style>
