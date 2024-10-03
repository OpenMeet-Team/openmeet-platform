<template>
  <div>
    <q-file
      filled
      :required="required"
      :model-value="null"
      :label="label"
      accept="image/*"
      @update:model-value="onUpload"
    >
      <template v-slot:prepend>
        <q-icon name="sym_r_attach_file" />
      </template>
    </q-file>

    <!-- Loading indicator -->
    <q-spinner
      v-if="loading"
      color="primary"
      size="50px"
      class="q-mt-md"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { apiUploadFileToS3 } from 'src/api/files.ts'
import { useNotification } from 'src/composables/useNotification.ts'

interface Props {
  label?: string
  required?: boolean
}

withDefaults(defineProps<Props>(), {})

const { error } = useNotification()

const emits = defineEmits(['upload'])

// Reactive variable to track loading state
const loading = ref(false)

const onUpload = (file: File) => {
  if (!file) return

  // Set loading to true when upload starts
  loading.value = true

  apiUploadFileToS3(file)
    .then((response) => {
      emits('upload', response)
    })
    .catch((err) => {
      console.error('Upload error:', err.message)
      error(err.message)
    })
    .finally(() => {
      // Set loading to false when upload is complete
      loading.value = false
    })
}
</script>

<style scoped>
/* Add any additional styling here */
</style>
