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

    <UploadComponent label="Group image" @upload="onGroupImageSelect"/>

    <q-img
      v-if="group && group.image && group.image.path"
      :src="group.image.path"
      spinner-color="white"
      style="height: 140px; max-width: 150px"
    />

   <slot></slot>
  </q-form>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Group, UploadedFile } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { groupsApi } from 'src/api/groups.ts'
import UploadComponent from 'components/common/UploadComponent.vue'

const group = ref<Group>({
  id: 0,
  name: '',
  description: '',
  categories: [],
  location: ''
})

const onGroupImageSelect = (file: UploadedFile) => {
  group.value.image = file
}

const categoryOptions = [
  'Technology', 'Sports & Fitness', 'Arts & Culture',
  'Food & Drink', 'Social', 'Professional', 'Education',
  'Hobbies & Crafts', 'Health & Wellness', 'Music',
  'Outdoor & Adventure', 'Language & Ethnic Identity'
]

const { error } = useNotification()

const emit = defineEmits(['created', 'updated'])

onMounted(() => {
  // TODO fetch categories
  categoriesApi.getAll().then(res => {
    console.log(res.data)
  })
  if (props.editGroupId) {
    groupsApi.getById(props.editGroupId).then(res => {
      group.value = res.data
    })
  }
})

const props = withDefaults(defineProps<{ editGroupId?: string }>(), {
  editGroupId: undefined
})

const onSubmit = async () => {
  try {
    if (group.value.id) {
      const res = await groupsApi.update(group.value.id, group.value)
      emit('updated', res.data)
    } else {
      const res = await groupsApi.create(group.value)
      emit('created', res.data)
    }
  } catch (err) {
    console.log(err)
    error('Failed to create an event')
  }
}

</script>

<style scoped lang="scss">

</style>
