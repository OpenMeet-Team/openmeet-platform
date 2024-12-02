<template>
  <div class="c-search-component row items-center q-mx-md">
    <div class="row">
      <q-select :loading="isLoading" class="xs-hide" outlined ref="searchRef" hide-dropdown-icon dense v-model="search"
        clearable use-input name="search" :placeholder="placeholderText" input-debounce="500" :options="options"
        @filter="filterFn" :behavior="Screen.width > 768 ? 'menu' : 'dialog'" style="width: 270px">
        <template v-slot:prepend>
          <div class="row items-center">
            <q-icon v-if="!isLoading" name="sym_r_search" />
            <q-spinner-dots v-if="isLoading" color="primary" size="24px" />
            <q-tooltip v-if="showShortcutHelper">
              Press {{ isMac ? '⌘' : 'Ctrl' }}+K to search
            </q-tooltip>
          </div>
        </template>
        <template v-slot:no-option>
          <q-item>
            <q-item-section class="text-grey">
              No results
            </q-item-section>
          </q-item>
        </template>
        <template v-slot:option="scope">
          <q-item @click="onSearchOptionClick(scope.opt)" v-bind="scope.itemProps">
            <q-item-section>
              {{ scope.opt.name }}
            </q-item-section>
            <q-item-label caption>
              {{ scope.opt.type }}
            </q-item-label>
          </q-item>
        </template>
        <template v-slot:selected-item>

        </template>
        <!--        <template v-slot:after>-->
        <!--          <q-select-->
        <!--            borderless-->
        <!--            class="xs-hide"-->
        <!--            ref="locationRef"-->
        <!--            hide-dropdown-icon-->
        <!--            placeholder="Location"-->
        <!--            dense-->
        <!--            v-model="search"-->
        <!--            use-input-->
        <!--            name="location"-->
        <!--            input-debounce="1000"-->
        <!--            :options="options"-->
        <!--            @filter="filterFn"-->
        <!--            style="width: 150px"-->
        <!--          >-->
        <!--            <template v-slot:append>-->
        <!--              <q-icon name="sym_r_near_me"/>-->
        <!--            </template>-->
        <!--          </q-select>-->
        <!--        </template>-->
      </q-select>
    </div>

    <!-- Mobile search icon -->
    <q-icon name="sym_r_search" class="sm-hide md-hide lg-hide xl-hide cursor-pointer" size="24px"
      @click="onSearchClick">
      <q-tooltip>
        Press {{ isMac ? '⌘' : 'Ctrl' }}+K to search
      </q-tooltip>
    </q-icon>

    <!-- Keyboard shortcut helper -->
    <q-dialog v-model="showShortcutHelper">
      <q-card style="min-width: 350px">
        <q-card-section>
          <div class="text-h6">Keyboard Shortcuts</div>
        </q-card-section>
        <q-card-section>
          <div class="row items-center q-gutter-sm">
            <q-chip square>{{ isMac ? '⌘' : 'Ctrl' }}+K</q-chip>
            <span>Focus search</span>
          </div>
          <div class="row items-center q-gutter-sm">
            <q-chip square>Esc</q-chip>
            <span>Clear search</span>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Notify, QSelect, Screen } from 'quasar'
import { useRouter } from 'vue-router'
import { searchApi } from 'src/api/search.ts'

interface SearchResult {
  name: string
  slug: string
  type: 'event' | 'group'
}

const search = ref<string>('')
const options = ref<SearchResult[]>([])
const searchRef = ref<InstanceType<typeof QSelect> | null>(null)
const isLoading = ref<boolean>(false)
const router = useRouter()
const showShortcutHelper = ref(false)

// Detect OS for showing correct keyboard shortcuts
const isMac = computed(() => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
})

// Dynamic placeholder text
const placeholderText = computed(() => {
  return `Search events & groups (${isMac.value ? '⌘' : 'Ctrl'}+K)`
})

const onSearchOptionClick = (option: SearchResult) => {
  console.log(search.value)
  searchRef.value?.reset()
  if (option.type === 'event') {
    router.push(`/events/${option.slug}`)
  } else {
    router.push(`/groups/${option.slug}`)
  }
}

const onSearchClick = () => {
  if (searchRef.value) searchRef.value.showPopup()
}

// Handle keyboard shortcuts
const handleKeydown = (event: KeyboardEvent) => {
  // Check for search shortcut (Cmd/Ctrl + K)
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault()
    focusSearch()
  }

  // Show shortcuts helper with Cmd/Ctrl + /
  if ((event.metaKey || event.ctrlKey) && event.key === '/') {
    event.preventDefault()
    showShortcutHelper.value = true
  }

  // Handle Escape key
  if (event.key === 'Escape' && searchRef.value) {
    searchRef.value.resetValidation()
    search.value = ''
  }
}

const focusSearch = () => {
  if (searchRef.value) {
    searchRef.value.showPopup()
    searchRef.value.focus()
  }
}

const filterFn = async (
  val: string,
  update: (callback: () => void) => void
) => {
  if (val === '') {
    update(() => {
      options.value = []
    })
    return
  }

  update(() => {
    options.value = []
  })

  try {
    isLoading.value = true
    const response = await searchApi.searchAll({ search: val, page: 1, limit: 5 }).finally(() => {
      isLoading.value = false
    })
    update(() => {
      options.value = response.data.events.data.map(event => ({ name: event.name, slug: event.slug, type: 'event' }))
      options.value = options.value.concat(response.data.groups.data.map(group => ({ name: group.name, slug: group.slug, type: 'group' })))
    })
  } catch (error) {
    console.error('Error fetching search results:', error)
    update(() => {
      options.value = []
    })
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)

  // Show initial tooltip about keyboard shortcut
  if (!localStorage.getItem('search-shortcut-shown')) {
    Notify.create({
      message: `Tip: Press ${isMac.value ? '⌘' : 'Ctrl'}+K to quickly access search`,
      timeout: 5000,
      actions: [{
        label: 'Got it',
        color: 'white',
        handler: () => {
          localStorage.setItem('search-shortcut-shown', 'true')
        }
      }]
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
