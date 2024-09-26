<template>
  <q-form @submit="onSubmit" class="q-gutter-md">
    <q-input
      v-model="form.name"
      label="Group Name"
      :rules="[val => !!val || 'Group name is required']"
    />
    <q-input
      v-model="form.description"
      type="textarea"
      label="Description"
      :rules="[val => !!val || 'Description is required']"
    />
    <q-select
      v-model="form.category"
      :options="categoryOptions"
      label="Category"
      :rules="[val => !!val || 'Category is required']"
    />
    <q-input
      v-model="form.location"
      label="Location"
      :rules="[val => !!val || 'Location is required']"
    />
    <q-file
      v-model="form.image"
      label="Group Image"
      accept="image/*"
    >
      <template v-slot:prepend>
        <q-icon name="attach_file"/>
      </template>
    </q-file>
    <q-select
      multiple
      use-chips
      v-model="form.interests"
      label="Interests (press Enter after each)"
    />
    <div class="row justify-end q-gutter-sm">
      <q-btn label="Cancel" color="negative" v-close-popup/>
      <q-btn label="Create Group" type="submit" color="primary"/>
    </div>
  </q-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const form = ref({
  name: '',
  description: '',
  category: null,
  location: '',
  image: null,
  interests: []
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
  emit('submit', { ...form.value })

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
