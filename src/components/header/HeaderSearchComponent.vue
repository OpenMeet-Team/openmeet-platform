<template>
  <div class="c-search-component row items-center q-mx-md">
    <div class="row">
      <q-select :loading="isLoading" class="xs-hide" outlined ref="searchRef" hide-dropdown-icon placeholder="Search" dense
        v-model="search" clearable use-input name="search" input-debounce="500" :options="options" @filter="filterFn"
        style="max-width: 250px" behavior="dialog">
        <template v-slot:prepend>
          <q-icon v-if="!isLoading" name="sym_r_search" />
          <q-spinner-dots v-if="isLoading" color="primary" size="24px" />
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
            <q-item-section >
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
    <q-icon name="sym_r_search" class="sm-hide md-hide lg-hide xl-hide cursor-pointer" size="24px"
      @click="onSearchClick" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { QSelect } from 'quasar'
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
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
