import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import DashboardGroupCreatePage from 'src/pages/dashboard/group/DashboardGroupCreatePage.vue'
import { installRouter } from '../../../install-router'
import { installPinia } from '../../../install-pinia'
import { Notify } from 'quasar'

installQuasarPlugin({
  plugins: { Notify }
})
installPinia({ stubActions: false, createSpy: vi.fn })

const mockRouter = {
  push: vi.fn()
}

const mockRoute = {
  params: {},
  query: {}
}

installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

// Mock the router
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute
}))

// Mock APIs
vi.mock('src/api/groups', () => ({
  groupsApi: {
    create: vi.fn(),
    update: vi.fn(),
    getDashboardGroup: vi.fn()
  }
}))

vi.mock('src/api/categories', () => ({
  categoriesApi: {
    getAll: vi.fn().mockResolvedValue({
      data: [
        { id: 1, name: 'Technology' },
        { id: 2, name: 'Sports' },
        { id: 3, name: 'Arts' }
      ]
    })
  }
}))

// Mock analytics service
vi.mock('src/services/analyticsService', () => ({
  default: {
    trackEvent: vi.fn()
  }
}))

// Mock navigation composable
vi.mock('src/composables/useNavigation', () => ({
  useNavigation: () => ({
    navigateToGroup: vi.fn()
  })
}))

describe('DashboardGroupCreatePage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the page with correct title and back navigation', () => {
    const wrapper = mount(DashboardGroupCreatePage)

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('.c-dashboard-group-create-page').exists()).toBe(true)
  })

  it('should contain GroupFormComponent', () => {
    const wrapper = mount(DashboardGroupCreatePage)

    expect(wrapper.findComponent({ name: 'GroupFormComponent' }).exists()).toBe(true)
  })

  it('should navigate back to groups page when close event is emitted', async () => {
    const wrapper = mount(DashboardGroupCreatePage)
    const groupForm = wrapper.findComponent({ name: 'GroupFormComponent' })

    await groupForm.vm.$emit('close')

    expect(mockRouter.push).toHaveBeenCalledWith({ name: 'DashboardGroupsPage' })
  })

  it('should have back button and correct title', () => {
    const wrapper = mount(DashboardGroupCreatePage)

    // Check for presence of back button by looking for the q-btn component
    const qBtnComponent = wrapper.findComponent({ name: 'QBtn' })
    expect(qBtnComponent.exists()).toBe(true)

    const title = wrapper.find('.text-h4')
    expect(title.text()).toBe('Create New Group')
  })

  it('should navigate to group page on successful creation', async () => {
    const wrapper = mount(DashboardGroupCreatePage)
    const groupForm = wrapper.findComponent({ name: 'GroupFormComponent' })

    const mockGroup = { id: 1, slug: 'test-group', name: 'Test Group' }
    await groupForm.vm.$emit('created', mockGroup)

    expect(mockRouter.push).toHaveBeenCalledWith({
      name: 'GroupPage',
      params: { slug: 'test-group' }
    })
  })

  it('should navigate to group page on successful update', async () => {
    const wrapper = mount(DashboardGroupCreatePage)
    const groupForm = wrapper.findComponent({ name: 'GroupFormComponent' })

    const mockGroup = { id: 1, slug: 'test-group', name: 'Test Group' }
    await groupForm.vm.$emit('updated', mockGroup)

    expect(mockRouter.push).toHaveBeenCalledWith({
      name: 'GroupPage',
      params: { slug: 'test-group' }
    })
  })

  it('should handle redirect query parameter', async () => {
    // Update the mock route to include redirect query
    mockRoute.query = { redirect: '/custom-path' }

    const wrapper = mount(DashboardGroupCreatePage)
    const backButton = wrapper.findComponent({ name: 'QBtn' })

    await backButton.trigger('click')

    expect(mockRouter.push).toHaveBeenCalledWith('/custom-path')

    // Reset for other tests
    mockRoute.query = {}
  })
})
