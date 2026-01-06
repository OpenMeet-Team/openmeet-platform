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

    it('should navigate to GroupPage (not DashboardGroupPage) when on dashboard route', async () => {
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

      // Simulate being on a dashboard route
      await router.push({ path: '/dashboard/groups/original-group' })
      await flushPromises()
      routerPush.mockClear()

      // Navigate to group with new slug
      navigation!.navigateToGroup(mockGroup)
      await flushPromises()

      // Should navigate to public GroupPage so user can see their changes
      expect(routerPush).toHaveBeenCalledWith({
        name: 'GroupPage',
        params: { slug: 'test-group' }
      })
    })

    it('should navigate to public group page after update (even from dashboard)', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      // Simulate being on a dashboard group edit route
      await router.push({ path: '/dashboard/groups/old-slug' })
      await flushPromises()

      // Clear call counts after setup
      routerPush.mockClear()

      // Navigate to updated group - should go to public view page
      navigation!.navigateToGroup({ ...mockGroup, slug: 'new-slug' })
      await flushPromises()

      // Should navigate to public GroupPage so user can see their changes
      expect(routerPush).toHaveBeenCalledWith({
        name: 'GroupPage',
        params: { slug: 'new-slug' }
      })
    })

    it('should always navigate to public GroupPage regardless of current context', async () => {
      let navigation: ReturnType<typeof useNavigation>

      const TestComponent = createTestComponent(() => {
        navigation = useNavigation()
        return {}
      })

      const wrapper = mount(TestComponent)
      await flushPromises()

      const router = wrapper.router
      const routerPush = vi.spyOn(router, 'push')

      // Test from various paths - all should go to public GroupPage
      const testPaths = [
        '/dashboard/groups/test-group',
        '/dashboard/groups/create',
        '/dashboard/events',
        '/dashboard',
        '/groups/some-group',
        '/'
      ]

      for (const path of testPaths) {
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
