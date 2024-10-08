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
      :rules="[val => !!val.length || 'Categories is required']"
      v-model="group.categories"
      :options="categoryOptions"
      filled
      multiple
      use-chips
      option-value="id"
      option-label="name"
      label="Categories (press Enter after each)"
    />

    <q-input
      filled
      v-model="group.location"
      label="Location"
      :rules="[val => !!val || 'Location is required']"
    />

    <UploadComponent label="Group image" :crop-options="{autoZoom: true, aspectRatio: 16/9}" @upload="onGroupImageSelect"/>

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
import { CategoryEntity, GroupEntity, UploadedFileEntity } from 'src/types'
import { useNotification } from 'src/composables/useNotification.ts'
import { categoriesApi } from 'src/api/categories.ts'
import { groupsApi } from 'src/api/groups.ts'
import UploadComponent from 'components/common/UploadComponent.vue'

const group = ref<GroupEntity>({
  id: 0,
  name: '',
  description: '',
  categories: [],
  location: ''
})

const onGroupImageSelect = (file: UploadedFileEntity) => {
  group.value.image = file
}

const categoryOptions = ref<CategoryEntity[]>([])

const { error } = useNotification()

const emit = defineEmits(['created', 'updated'])

onMounted(() => {
  // TODO fetch categories
  categoriesApi.getAll().then(res => {
    categoryOptions.value = res.data
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
  const groupPayload = {
    ...group.value
  }

  if (group.value.categories) {
    groupPayload.categories = group.value.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  try {
    if (groupPayload.id) {
      const res = await groupsApi.update(groupPayload.id, groupPayload)
      emit('updated', res.data)
    } else {
      const res = await groupsApi.create(groupPayload)
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
