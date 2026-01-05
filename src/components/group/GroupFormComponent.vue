<template>
  <div class="c-group-form-component">
    <SpinnerComponent v-if="loading" />
    <q-form v-else ref="formRef" @submit="onSubmit" data-cy="group-form">
      <!-- Responsive Two-Column Layout -->
      <div class="row q-col-gutter-md">
        <!-- Left Column: Basic Information -->
        <div class="col-12 col-lg-7">
          <q-card class="q-mb-md" role="group" aria-labelledby="basic-info-heading">
            <q-card-section>
              <div id="basic-info-heading" class="text-h6 q-mb-md">
                <q-icon name="sym_r_group" class="q-mr-sm" aria-hidden="true" />
                Basic Information
              </div>

              <!-- Group Name -->
              <q-input data-cy="group-name" filled v-model="group.name" label="Group Name *" counter maxlength="60"
                :rules="[(val: string) => !!val || 'Group name is required']" class="q-mb-md" />

              <!-- Group Categories -->
              <div class="q-mb-md">
                <q-select data-cy="group-categories" v-model="group.categories" :options="categoryOptions" filled multiple use-chips
                  emit-value map-options option-value="id" option-label="name" label="Categories" />
              </div>

              <!-- Group Location -->
              <div class="q-mb-md">
                <LocationComponent data-cy="group-location" :location="group.location as string" :lat="group.lat as number"
                  :lon="group.lon as number" @update:model-value="onUpdateLocation" label="Group Address or location"
                  placeholder="Enter address or location" />
              </div>
            </q-card-section>
          </q-card>
        </div>

        <!-- Right Column: Group Settings -->
        <div class="col-12 col-lg-5">
          <q-card class="q-mb-md" role="group" aria-labelledby="group-settings-heading">
            <q-card-section>
              <div id="group-settings-heading" class="text-h6 q-mb-md">
                <q-icon name="sym_r_settings" class="q-mr-sm" aria-hidden="true" />
                Group Settings
              </div>

              <!-- Group Visibility -->
              <div class="q-mb-md">
                <q-select data-cy="group-visibility" v-model="group.visibility" label="Visibility" option-value="value"
                  option-label="label" emit-value map-options :options="[
                    { label: 'Public', value: 'public', disable: false },
                    { label: 'Unlisted', value: 'unlisted', disable: false },
                    { label: 'Private (Coming soon)', value: 'private', disable: true }
                  ]" filled />
                <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Private">
                  Private groups are hidden from search and accessible only by direct link or group members.
                </p>
                <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Unlisted">
                  Unlisted groups are hidden from search but anyone with the link can view them.
                </p>
                <p class="text-caption q-mt-sm" v-if="group.visibility === GroupVisibility.Public">
                  Public groups are visible to everyone and appear in search results.
                </p>
                <p class="text-caption q-mt-sm text-info">
                  <q-icon name="sym_r_info" size="xs" aria-hidden="true" />
                  Private groups with invitations launching soon. Use "Unlisted" for now.
                </p>
              </div>

              <!-- Membership Approval -->
              <q-separator spaced />
              <div class="text-subtitle2 q-my-sm q-pl-sm">Membership Settings</div>

              <q-toggle :value="true" v-model="group.requireApproval">Require approval for new group members</q-toggle>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- Full Width: Group Image Card -->
      <q-card class="q-mb-md" data-cy="image-card" role="group" aria-labelledby="image-heading">
        <q-card-section>
          <div id="image-heading" class="text-h6 q-mb-md">
            <q-icon name="sym_r_image" class="q-mr-sm" aria-hidden="true" />
            Group Image
          </div>

          <div class="row items-center q-col-gutter-md">
            <div class="col-12 col-sm-6">
              <UploadComponent data-cy="group-image" label="Group image" :crop-options="{ autoZoom: true, aspectRatio: 16 / 9 }"
                @upload="onGroupImageSelect" />
              <div class="text-caption text-grey-7 q-mt-xs">
                Recommended: 1920x1080 pixels (16:9 ratio). Images will be cropped to fit.
              </div>
            </div>

            <div class="col-12 col-sm-6" v-if="group && group.image && group.image.path">
              <q-img ratio="16/9" :src="group.image.path" spinner-color="white"
                class="rounded-borders" style="height: 120px; max-width: 220px" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- Full Width: Group Description Card -->
      <q-card class="q-mb-md" role="group" aria-labelledby="description-heading">
        <q-card-section>
          <div id="description-heading" class="text-h6 q-mb-md">
            <q-icon name="sym_r_description" class="q-mr-sm" aria-hidden="true" />
            Group Description
          </div>

          <q-tabs
            v-model="descriptionTab"
            no-caps
            align="left"
            indicator-color="primary"
          >
            <q-tab name="edit" label="Edit" icon="sym_r_edit" />
            <q-tab name="preview" label="Preview" icon="sym_r_visibility" />
          </q-tabs>

          <q-separator />

          <q-tab-panels v-model="descriptionTab" animated>
            <q-tab-panel name="edit" class="q-pa-none">
              <q-input
                data-cy="group-description"
                filled
                type="textarea"
                v-model="group.description"
                label="Group description *"
                counter
                maxlength="2000"
                autogrow
                input-style="min-height: 80px"
                class="q-mt-sm"
                :rules="[val => !!val || 'Description is required']"
              />
              <div class="text-caption text-grey-7 q-mt-xs">
                Supports <a href="https://www.markdownguide.org/basic-syntax/" target="_blank" rel="noopener">Markdown</a>: **bold**, *italic*, [links](url), - bullets
              </div>
            </q-tab-panel>

            <q-tab-panel name="preview" class="q-pa-none">
              <div class="q-pa-md markdown-preview rounded-borders q-mt-sm">
                <q-markdown
                  :src="group.description || '*No content yet*'"
                  class="text-body1 description-preview"
                />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-card-section>
      </q-card>

      <div class="row justify-center q-gutter-md q-mt-md">
        <q-btn data-cy="group-cancel" outline label="Cancel" no-caps @click="$emit('close')" />
        <q-btn data-cy="group-update" v-if="group.id" no-caps label="Update Group" color="primary" @click="onCreateOrUpdate" />
        <q-btn data-cy="group-create" v-else no-caps label="Create Group" color="primary" @click="onCreateOrUpdate" />
      </div>
    </q-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { CategoryEntity, FileEntity, GroupEntity, GroupStatus, GroupVisibility } from '../../types'
import { useNotification } from '../../composables/useNotification'
import { categoriesApi } from '../../api/categories'
import { groupsApi } from '../../api/groups'
import UploadComponent from '../../components/common/UploadComponent.vue'
import LocationComponent from '../../components/common/LocationComponent.vue'
import { Loading, LoadingBar, QForm } from 'quasar'
import SpinnerComponent from '../common/SpinnerComponent.vue'
import analyticsService from '../../services/analyticsService'
import { useNavigation } from '../../composables/useNavigation'

const formRef = ref<QForm | null>(null)

const group = ref<GroupEntity>({
  ulid: '',
  id: 0,
  name: '',
  slug: '',
  description: '',
  categories: [],
  location: '',
  requireApproval: false,
  status: GroupStatus.Draft,
  visibility: GroupVisibility.Public
})

const loading = ref(false)

const onUpdateLocation = (address: { lat: number, lon: number, location: string }) => {
  group.value.lat = address.lat
  group.value.lon = address.lon
  group.value.location = address.location
}

const onGroupImageSelect = (file: FileEntity) => {
  group.value.image = file
}

// No longer need the description input handler for HTML sanitization with Markdown
// Markdown content will be sanitized server-side

// Tab for description editor (edit/preview)
const descriptionTab = ref('edit')

const categoryOptions = ref<CategoryEntity[]>([])

const { error } = useNotification()

const emit = defineEmits(['created', 'updated', 'close'])
const { navigateToGroup } = useNavigation()

onMounted(async () => {
  try {
    LoadingBar.start()
    loading.value = true

    // Fetch categories
    const categoryPromise = categoriesApi.getAll().then(res => {
      categoryOptions.value = res.data
    })

    // Fetch group data conditionally if `editGroupId` exists
    let groupPromise
    if (props.editGroupSlug) {
      groupPromise = groupsApi.getDashboardGroup(props.editGroupSlug).then(res => {
        group.value = res.data
      })
    }

    // Wait for all promises to resolve, including the optional group fetch
    await Promise.all([categoryPromise, groupPromise])
  } catch (error) {
    // Handle error (optional)
    console.error('An error occurred:', error)
  } finally {
    // Stop the loading bar and reset loading state
    LoadingBar.stop()
    loading.value = false
  }
})

interface Props {
  editGroupSlug?: string
}

const props = withDefaults(defineProps<Props>(), {
  editGroupSlug: undefined
})

/**
 * Scrolls to and focuses the first form field with an error.
 * Called when form validation fails to help the user find the error.
 */
const scrollToFirstError = () => {
  const firstError = document.querySelector('.q-field--error')
  if (firstError) {
    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const input = firstError.querySelector('input, textarea') as HTMLElement | null
    input?.focus()
  }
}

/**
 * Handles create/update button click - validates first, scrolls to error on failure.
 */
const onCreateOrUpdate = async () => {
  const isValid = await formRef.value?.validate()
  if (!isValid) {
    // Wait for DOM to update with error classes before scrolling
    await nextTick()
    scrollToFirstError()
    return
  }
  // Validation passed, proceed with submission
  await onSubmit()
}

const onSubmit = async () => {
  group.value.status = GroupStatus.Published
  const groupPayload = {
    ...group.value
  }

  if (groupPayload.categories) {
    groupPayload.categories = groupPayload.categories.map(category => {
      return typeof category === 'object' ? category.id : category
    }) as number[]
  }

  Loading.show()
  try {
    if (groupPayload.slug) {
      const res = await groupsApi.update(groupPayload.slug, groupPayload)
      emit('updated', res.data)
      navigateToGroup(res.data)
      analyticsService.trackEvent('group_updated', { group_id: res.data.id, name: res.data.name })
    } else {
      const res = await groupsApi.create(groupPayload)
      navigateToGroup(res.data)
      emit('created', res.data)
      analyticsService.trackEvent('group_created', { group_id: res.data.id, name: res.data.name })
    }
  } catch (err) {
    console.log(err)
    error('Failed to create a group')
  } finally {
    Loading.hide()
  }
}

defineExpose({
  scrollToFirstError,
  group
})
</script>

<style scoped lang="scss">
.c-group-form-component {
  max-width: 1200px;
}

.markdown-preview {
  min-height: 100px;
  max-height: 400px;
  overflow-y: auto;
  background-color: rgba(0, 0, 0, 0.02);
}

.description-preview {
  :deep(a) {
    color: var(--q-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    &::after {
      display: none;
    }
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(code) {
    background-color: rgba(0, 0, 0, 0.05);
    padding: 2px 4px;
    border-radius: 4px;
    font-family: monospace;
  }

  :deep(blockquote) {
    border-left: 4px solid var(--q-primary);
    margin-left: 0;
    padding-left: 16px;
    color: rgba(0, 0, 0, 0.7);
  }
}
</style>
