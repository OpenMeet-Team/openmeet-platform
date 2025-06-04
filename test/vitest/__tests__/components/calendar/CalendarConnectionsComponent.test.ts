import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { Notify } from 'quasar'
import CalendarConnectionsComponent from '../../../../../src/components/calendar/CalendarConnectionsComponent.vue'

// Install Quasar plugin with Notify
installQuasarPlugin({ plugins: { Notify } })

// Mock the calendar API
vi.mock('../../../../../src/api/calendar', () => ({
  getCalendarSources: vi.fn().mockResolvedValue({ data: [] }),
  createCalendarSource: vi.fn().mockResolvedValue({
    data: {
      ulid: 'test-ulid',
      name: 'Test Calendar',
      type: 'ical',
      isActive: true
    }
  }),
  deleteCalendarSource: vi.fn().mockResolvedValue({}),
  syncCalendarSource: vi.fn().mockResolvedValue({ data: { success: true, eventsCount: 5 } }),
  testCalendarConnection: vi.fn().mockResolvedValue({ data: { success: true, message: 'Connection successful' } }),
  getAuthorizationUrl: vi.fn().mockResolvedValue({ data: { authorizationUrl: 'https://example.com/auth' } })
}))

// Mock the calendar utils
vi.mock('../../../../../src/utils/calendarUtils', () => ({
  downloadUserCalendar: vi.fn().mockResolvedValue(undefined)
}))

const createWrapper = () => {
  return mount(CalendarConnectionsComponent)
}

describe('CalendarConnectionsComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the component', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.calendar-connections').exists()).toBe(true)
    expect(wrapper.find('.text-h6').text()).toBe('Calendar Connections')
  })

  it('should show connect calendar dropdown with all options', () => {
    const wrapper = createWrapper()

    // Check if the connect button exists by looking for the text
    expect(wrapper.text()).toContain('Connect Calendar')
  })

  it('should show empty state when no calendar sources', async () => {
    const wrapper = createWrapper()

    // Wait for component to load and set loading to false
    await wrapper.vm.$nextTick()
    wrapper.vm.loading = false
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('No Calendar Connections')
    expect(wrapper.text()).toContain('Connect your external calendars (Google, Apple, Outlook, or any iCal URL)')
  })

  it('should have iCal URL dialog functionality', () => {
    const wrapper = createWrapper()

    // Check if dialog data exists
    expect(wrapper.vm.showIcalDialog).toBe(false)
    expect(wrapper.vm.icalForm).toEqual({
      name: '',
      url: '',
      isPrivate: false
    })
  })

  it('should validate URL in iCal form', async () => {
    const wrapper = createWrapper()

    // Test the URL validation function
    wrapper.vm.icalForm = {
      name: 'Test Calendar',
      url: 'invalid-url',
      isPrivate: false
    }

    // This should trigger validation error
    await wrapper.vm.createIcalSource()

    // The function should not proceed due to validation
    expect(wrapper.vm.creatingIcal).toBe(false)
  })

  it('should support Apple Calendar connection', () => {
    const wrapper = createWrapper()

    wrapper.vm.connectAppleCalendar()

    expect(wrapper.vm.showIcalDialog).toBe(true)
    expect(wrapper.vm.icalForm.name).toBe('Apple Calendar')
  })

  it('should support iCal URL connection', () => {
    const wrapper = createWrapper()

    wrapper.vm.showIcalUrlDialog()

    expect(wrapper.vm.showIcalDialog).toBe(true)
    expect(wrapper.vm.icalForm.name).toBe('')
  })
})
