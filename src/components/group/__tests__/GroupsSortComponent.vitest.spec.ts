import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import GroupsSortComponent from '../GroupsSortComponent.vue'

// Mock vue-router
const mockPush = vi.fn()
const mockRoute = {
  query: {} as Record<string, string>,
  path: '/groups'
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  }),
  useRoute: () => mockRoute
}))

const createWrapper = () => {
  return mount(GroupsSortComponent, {
    global: {
      plugins: [Quasar]
    }
  })
}

describe('GroupsSortComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}
  })

  it('renders a q-select element', () => {
    const wrapper = createWrapper()
    const select = wrapper.find('[data-cy="groups-sort"]')
    expect(select.exists()).toBe(true)
  })

  it('defaults to "members" sort when no query param', () => {
    const wrapper = createWrapper()
    // Access the component's internal selectedSort ref
    expect((wrapper.vm as unknown as { selectedSort: string }).selectedSort).toBe('members')
  })

  it('uses sort value from route query param', () => {
    mockRoute.query = { sort: 'newest' }
    const wrapper = createWrapper()
    expect((wrapper.vm as unknown as { selectedSort: string }).selectedSort).toBe('newest')
  })

  it('has three sort options: members, newest, name', () => {
    const wrapper = createWrapper()
    const sorts = (wrapper.vm as unknown as { sorts: Array<{ label: string; value: string }> }).sorts
    expect(sorts).toHaveLength(3)
    expect(sorts.map((s: { value: string }) => s.value)).toEqual(['members', 'newest', 'name'])
  })

  it('has correct labels for sort options', () => {
    const wrapper = createWrapper()
    const sorts = (wrapper.vm as unknown as { sorts: Array<{ label: string; value: string }> }).sorts
    expect(sorts).toEqual([
      { label: 'Most Members', value: 'members' },
      { label: 'Newest', value: 'newest' },
      { label: 'Name (A-Z)', value: 'name' },
    ])
  })

  it('updates route with sort param and resets page to 1 when sort changes', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { onSortChange: (sort: string) => void }
    vm.onSortChange('newest')

    expect(mockPush).toHaveBeenCalledWith({
      path: '/groups',
      query: {
        sort: 'newest',
        page: 1
      }
    })
  })

  it('omits sort query param when selecting default "members" sort', () => {
    mockRoute.query = { sort: 'newest' }
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { onSortChange: (sort: string) => void }
    vm.onSortChange('members')

    expect(mockPush).toHaveBeenCalledWith({
      path: '/groups',
      query: {
        sort: undefined,
        page: 1
      }
    })
  })

  it('preserves existing query params when changing sort', () => {
    mockRoute.query = { categories: 'tech', page: '3' }
    const wrapper = createWrapper()
    const vm = wrapper.vm as unknown as { onSortChange: (sort: string) => void }
    vm.onSortChange('name')

    expect(mockPush).toHaveBeenCalledWith({
      path: '/groups',
      query: {
        categories: 'tech',
        page: 1,
        sort: 'name'
      }
    })
  })
})
