import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { installRouter } from '../../install-router'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useNavigation } from '../../../../src/composables/useNavigation'
import { GroupEntity, GroupVisibility, GroupStatus, EventEntity, EventStatus } from '../../../../src/types'

installQuasarPlugin()
installRouter({
  spy: {
    create: fn => vi.fn(fn),
    reset: spy => spy.mockClear()
  }
})

// Helper component to test composable with router context
const createTestComponent = (setup: () => unknown) => {
  return defineComponent({
    setup,
    render: () => h('div')
  })
}

describe('useNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('navigateToGroup', () => {
    const mockGroup: GroupEntity = {
      id: 1,
      ulid: 'test-ulid',
      slug: 'test-group',
      name: 'Test Group',
      description: 'Test description',
      visibility: GroupVisibility.Public,
      status: GroupStatus.Published,
      requireApproval: false
    }

    it('should navigate to public GroupPage when not on dashboard route', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      // Get the router mock from wrapper
      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      // Simulate being on a non-dashboard route
      await router.push({ path: '/groups/some-group' })
      await flushPromises()

      // Navigate to group
      navigation!.navigateToGroup(mockGroup)
      await flushPromises()

      // Should navigate to public GroupPage
      expect(routerPush).toHaveBeenCalledWith({
        name: 'GroupPage',
        params: { slug: 'test-group' }
      })
    })

    it('should navigate to DashboardGroupPage when on dashboard route', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      // Get the router mock from wrapper
      const router = wrapper.router
      const routerReplace = vi.spyOn(router, 'replace')

      // Simulate being on a dashboard route
      await router.push({ path: '/dashboard/groups/original-group' })
      await flushPromises()

      // Navigate to group with new slug
      navigation!.navigateToGroup(mockGroup)
      await flushPromises()

      // Should use replace to navigate to DashboardGroupPage (to avoid back-button issues)
      expect(routerReplace).toHaveBeenCalledWith({
        name: 'DashboardGroupPage',
        params: { slug: 'test-group' }
      })
    })

    it('should use router.replace for dashboard navigation to avoid back-button issues', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerReplace = vi.spyOn(router, 'replace')
      const routerPush = vi.spyOn(router, 'push')

      // Simulate being on a dashboard group edit route
      await router.push({ path: '/dashboard/groups/old-slug' })
      await flushPromises()

      // Clear call counts after setup
      routerReplace.mockClear()
      routerPush.mockClear()

      // Navigate to updated group
      navigation!.navigateToGroup({ ...mockGroup, slug: 'new-slug' })
      await flushPromises()

      // Should use replace, not push
      expect(routerReplace).toHaveBeenCalled()
      // push should not be called for dashboard navigation
      expect(routerPush).not.toHaveBeenCalled()
    })

    it('should detect dashboard context from various dashboard paths', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerReplace = vi.spyOn(router, 'replace')

      // Test different dashboard paths
      const dashboardPaths = [
        '/dashboard/groups/test-group',
        '/dashboard/groups/create',
        '/dashboard/events',
        '/dashboard'
      ]

      for (const path of dashboardPaths) {
        await router.push({ path })
        await flushPromises()
        routerReplace.mockClear()

        navigation!.navigateToGroup(mockGroup)
        await flushPromises()

        expect(routerReplace).toHaveBeenCalledWith({
          name: 'DashboardGroupPage',
          params: { slug: 'test-group' }
        })
      }
    })

    it('should navigate to public page from non-dashboard routes', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      // Test different non-dashboard paths
      const publicPaths = [
        '/groups/some-group',
        '/events',
        '/',
        '/members/user'
      ]

      for (const path of publicPaths) {
        await router.push({ path })
        await flushPromises()
        routerPush.mockClear()

        navigation!.navigateToGroup(mockGroup)
        await flushPromises()

        expect(routerPush).toHaveBeenCalledWith({
          name: 'GroupPage',
          params: { slug: 'test-group' }
        })
      }
    })
  })

  describe('navigateToEvent', () => {
    it('should navigate to EventPage for published events', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      const mockEvent: Partial<EventEntity> = {
        slug: 'test-event',
        status: EventStatus.Published
      }

      navigation!.navigateToEvent(mockEvent as EventEntity)
      await flushPromises()

      expect(routerPush).toHaveBeenCalledWith({
        name: 'EventPage',
        params: { slug: 'test-event' }
      })
    })

    it('should navigate to DashboardEventPage for draft events', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      const mockEvent: Partial<EventEntity> = {
        slug: 'draft-event',
        status: EventStatus.Draft
      }

      navigation!.navigateToEvent(mockEvent as EventEntity)
      await flushPromises()

      expect(routerPush).toHaveBeenCalledWith({
        name: 'DashboardEventPage',
        params: { slug: 'draft-event' }
      })
    })

    it('should not navigate if event is null or has no slug', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      // Test null event
      navigation!.navigateToEvent(null as unknown as EventEntity)
      expect(routerPush).not.toHaveBeenCalled()

      // Test event without slug
      navigation!.navigateToEvent({ status: EventStatus.Published } as EventEntity)
      expect(routerPush).not.toHaveBeenCalled()
    })
  })

  describe('navigateToMember', () => {
    it('should navigate to MemberPage with slug string', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      navigation!.navigateToMember('user-slug')
      await flushPromises()

      expect(routerPush).toHaveBeenCalledWith({
        name: 'MemberPage',
        params: { slug: 'user-slug' }
      })
    })

    it('should navigate to MemberPage with UserEntity object', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      navigation!.navigateToMember({ slug: 'user-object-slug' } as { slug: string })
      await flushPromises()

      expect(routerPush).toHaveBeenCalledWith({
        name: 'MemberPage',
        params: { slug: 'user-object-slug' }
      })
    })
  })

  describe('navigateToChat', () => {
    it('should navigate to DashboardChatsPage with query params', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      navigation!.navigateToChat({ user: 'user123', chat: 'chat456' })
      await flushPromises()

      expect(routerPush).toHaveBeenCalledWith({
        name: 'DashboardChatsPage',
        query: { user: 'user123', chat: 'chat456' }
      })
    })
  })
})
