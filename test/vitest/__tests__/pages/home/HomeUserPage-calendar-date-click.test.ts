import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import HomeUserPage from '../../../../../src/pages/home/HomeUserPage.vue'

// Install Quasar plugin with Notify
installQuasarPlugin({ plugins: { Notify } })

// Mock the stores and composables
const mockHomeStore = {
  loading: false,
  userOrganizedGroups: [],
  userNextHostedEvent: null,
  userRecentEventDrafts: [],
  userUpcomingEvents: [],
  userMemberGroups: [],
  actionGetUserHomeState: vi.fn().mockResolvedValue({})
}

const mockAuthStore = {
  getUser: { firstName: 'Test' },
  user: { id: 1, name: 'Test User' }
}

const mockEventDialog = {
  openCreateEventDialog: vi.fn()
}

const mockGroupDialog = {
  openCreateGroupDialog: vi.fn()
}

const mockNavigation = {
  navigateToEvent: vi.fn()
}

// Mock the router
const mockRouter = {
  push: vi.fn(),
  currentRoute: { value: { fullPath: '/home' } }
}

// Mock the stores
vi.mock('src/stores/home-store', () => ({
  useHomeStore: () => mockHomeStore
}))

vi.mock('src/stores/auth-store', () => ({
  useAuthStore: () => mockAuthStore
}))

vi.mock('src/composables/useEventDialog', () => ({
  useEventDialog: () => mockEventDialog
}))

vi.mock('src/composables/useGroupDialog', () => ({
  useGroupDialog: () => mockGroupDialog
}))

vi.mock('src/composables/useNavigation', () => ({
  useNavigation: () => mockNavigation
}))

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter
}))

// Mock image utils
vi.mock('src/utils/imageUtils', () => ({
  getImageSrc: vi.fn().mockReturnValue('/mock-image.jpg')
}))

// Mock components that might cause issues in tests
vi.mock('src/components/calendar/UnifiedCalendarComponent.vue', () => ({
  default: {
    name: 'UnifiedCalendarComponent',
    props: ['mode', 'compact', 'height'],
    emits: ['event-click', 'date-click', 'date-select'],
    template: `
      <div data-testid="unified-calendar">
        <button 
          data-testid="calendar-date-button"
          @click="$emit('date-click', '2025-06-15')"
        >
          Mock Calendar Date Button
        </button>
      </div>
    `
  }
}))

describe('HomeUserPage Calendar Date Click', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call openCreateEventDialog with correct date when calendar date is clicked', async () => {
    const wrapper = mount(HomeUserPage)

    // Find the mock calendar component
    const calendarComponent = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })
    expect(calendarComponent.exists()).toBe(true)

    // Simulate clicking a date on the calendar
    const dateButton = wrapper.find('[data-testid="calendar-date-button"]')
    expect(dateButton.exists()).toBe(true)

    await dateButton.trigger('click')

    // Verify that openCreateEventDialog was called with the correct parameters
    expect(mockEventDialog.openCreateEventDialog).toHaveBeenCalledWith(
      undefined, // group parameter should be undefined
      '2025-06-15' // date parameter should be the clicked date
    )
  })

  it('should handle the date-click event correctly', async () => {
    const wrapper = mount(HomeUserPage)

    // Find the calendar component and emit the date-click event directly
    const calendarComponent = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    // Emit the date-click event with a test date
    await calendarComponent.vm.$emit('date-click', '2025-07-20')

    // Verify that openCreateEventDialog was called with the correct parameters
    expect(mockEventDialog.openCreateEventDialog).toHaveBeenCalledWith(
      undefined, // no group
      '2025-07-20' // the emitted date
    )
  })

  it('should pass undefined for group parameter when clicking calendar date', async () => {
    const wrapper = mount(HomeUserPage)
    const calendarComponent = wrapper.findComponent({ name: 'UnifiedCalendarComponent' })

    // Emit date-click event
    await calendarComponent.vm.$emit('date-click', '2025-12-25')

    // Verify the call signature
    expect(mockEventDialog.openCreateEventDialog).toHaveBeenCalledTimes(1)
    const [groupParam, dateParam] = mockEventDialog.openCreateEventDialog.mock.calls[0]

    expect(groupParam).toBeUndefined()
    expect(dateParam).toBe('2025-12-25')
  })
})
