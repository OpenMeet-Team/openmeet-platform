<template>
  <div class="c-search-component row items-center q-mx-md">
    <div class="row">
      <q-select
        rounded
        class="xs-hide"
        outlined
        ref="searchRef"
        hide-dropdown-icon
        placeholder="Search"
        dense
        v-model="search"
        clearable
        use-input
        name="search"
        input-debounce="1000"
        :options="options"
        @filter="filterFn"
        style="width: 250px"
        behavior="dialog"
      >
        <template v-slot:prepend>
          <q-icon name="sym_r_search"/>
        </template>
        <template v-slot:no-option>
          <q-item>
            <q-item-section class="text-grey">
              No results
            </q-item-section>
          </q-item>
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
    <q-icon
      name="sym_r_search"
      class="sm-hide md-hide lg-hide xl-hide cursor-pointer"
      size="24px"
      @click="onSearchClick"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { QSelect } from 'quasar'

import { searchEvents } from 'src/api/search.ts'

interface SearchResult {
  id: string;
  title: string;
}

const search = ref<string>('')
const options = ref<SearchResult[]>([])
const searchRef = ref<InstanceType<typeof QSelect> | null>(null)

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
    const response = await searchEvents(val)
    update(() => {
      options.value = response.data
    })
  } catch (error) {
    console.error('Error fetching search results:', error)
    update(() => {
      options.value = []
      // options.value = [{ id: 'error', title: 'Error fetching results' }]
    })
  }
}
</script>

<style scoped>
/* Add any component-specific styles here */
</style>
