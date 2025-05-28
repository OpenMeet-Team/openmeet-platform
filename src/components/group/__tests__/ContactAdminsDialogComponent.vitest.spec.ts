import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import ContactAdminsDialogComponent from '../ContactAdminsDialogComponent.vue'
import type { GroupEntity } from '../../../types'

// Define component instance type for testing
interface ContactAdminsComponentInstance {
  contactType: string
  subject: string
  message: string
  onSubmit: () => Promise<void>
}

// Mock the group store
const mockActionContactAdmins = vi.fn()
vi.mock('../../../stores/group-store', () => ({
  useGroupStore: () => ({
    actionContactAdmins: mockActionContactAdmins
  })
}))

// Mock the notification composable
const mockSuccess = vi.fn()
const mockError = vi.fn()
vi.mock('../../../composables/useNotification', () => ({
  useNotification: () => ({
    success: mockSuccess,
    error: mockError
  })
}))

// Mock Quasar dialog plugin
const mockDialogRef = { value: null }
const mockOnDialogHide = vi.fn()
const mockOnDialogOK = vi.fn()
const mockOnDialogCancel = vi.fn()

vi.mock('quasar', async () => {
  const actual = await vi.importActual('quasar')
  return {
    ...actual,
    useDialogPluginComponent: () => ({
      dialogRef: mockDialogRef,
      onDialogHide: mockOnDialogHide,
      onDialogOK: mockOnDialogOK,
      onDialogCancel: mockOnDialogCancel
    })
  }
})

const createWrapper = (props: { group: GroupEntity }) => {
  return mount(ContactAdminsDialogComponent, {
    props,
    global: {
      plugins: [Quasar],
      stubs: {
        'q-dialog': {
          template: '<div class="q-dialog"><slot /></div>',
          props: ['modelValue', 'persistent']
        },
        'q-card': { template: '<div class="q-card"><slot /></div>' },
        'q-card-section': { template: '<div class="q-card-section"><slot /></div>' },
        'q-card-actions': { template: '<div class="q-card-actions"><slot /></div>' },
        'q-space': { template: '<div class="q-space"></div>' },
        'q-btn': {
          template: '<button class="q-btn" @click="$emit(\'click\')">{{ label }}<slot /></button>',
          props: ['label', 'color', 'loading', 'flat', 'round', 'dense', 'icon'],
          emits: ['click']
        },
        'q-form': {
          template: '<form class="q-form" @submit.prevent="$emit(\'submit\')"><slot /></form>',
          emits: ['submit']
        },
        'q-select': {
          template: '<select class="q-select" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>',
          props: ['modelValue', 'options', 'label', 'outlined', 'emitValue', 'mapOptions', 'rules'],
          emits: ['update:modelValue']
        },
        'q-input': {
          template: '<input class="q-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          props: ['modelValue', 'label', 'type', 'outlined', 'rows', 'maxlength', 'counter', 'rules'],
          emits: ['update:modelValue']
        }
      }
    }
  })
}

describe('ContactAdminsDialogComponent', () => {
  const mockGroup: GroupEntity = {
    id: 1,
    slug: 'test-group',
    name: 'Test Group',
    description: 'A test group'
  } as GroupEntity

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correctly with group information', () => {
    const wrapper = createWrapper({ group: mockGroup })

    expect(wrapper.find('.text-h6').text()).toBe('Contact Group Admins')
    expect(wrapper.text()).toContain('Send a message to the administrators of "Test Group"')
  })

  it('displays contact type options', () => {
    const wrapper = createWrapper({ group: mockGroup })

    const selectElement = wrapper.find('.q-select')
    expect(selectElement.exists()).toBe(true)
  })

  it('displays subject and message input fields', () => {
    const wrapper = createWrapper({ group: mockGroup })

    const inputs = wrapper.findAll('.q-input')
    expect(inputs).toHaveLength(2) // subject and message
  })

  it('displays send and cancel buttons', () => {
    const wrapper = createWrapper({ group: mockGroup })

    const buttons = wrapper.findAll('.q-btn')
    const buttonTexts = buttons.map(btn => btn.text())
    expect(buttonTexts).toContain('Cancel')
    expect(buttonTexts).toContain('Send Message')
  })

  it('shows validation error when required fields are missing', async () => {
    const wrapper = createWrapper({ group: mockGroup })

    // Access component instance and call onSubmit directly
    const component = wrapper.vm as unknown as ContactAdminsComponentInstance
    await component.onSubmit()

    expect(mockError).toHaveBeenCalledWith('Please fill in all required fields')
    expect(mockActionContactAdmins).not.toHaveBeenCalled()
  })

  it('submits form successfully with valid data', async () => {
    mockActionContactAdmins.mockResolvedValue({
      success: true,
      deliveredCount: 2,
      failedCount: 0,
      messageId: 'test-message-id'
    })

    const wrapper = createWrapper({ group: mockGroup })

    // Set component data directly since we're using stubs
    const component = wrapper.vm as unknown as ContactAdminsComponentInstance
    component.contactType = 'question'
    component.subject = 'Test Subject'
    component.message = 'Test message content'

    await component.onSubmit()

    expect(mockActionContactAdmins).toHaveBeenCalledWith(
      'test-group',
      'question',
      'Test Subject',
      'Test message content'
    )
    expect(mockSuccess).toHaveBeenCalledWith('Your message has been sent to the group administrators')
    expect(mockOnDialogOK).toHaveBeenCalled()
  })

  it('handles API errors gracefully', async () => {
    const errorMessage = 'Network error'
    mockActionContactAdmins.mockRejectedValue(new Error(errorMessage))

    const wrapper = createWrapper({ group: mockGroup })

    const component = wrapper.vm as unknown as ContactAdminsComponentInstance
    component.contactType = 'report'
    component.subject = 'Test Subject'
    component.message = 'Test message content'

    await component.onSubmit()

    expect(mockError).toHaveBeenCalledWith('Failed to send message. Please try again.')
    expect(mockOnDialogOK).not.toHaveBeenCalled()
  })

  it('validates subject length limit', async () => {
    const wrapper = createWrapper({ group: mockGroup })

    const component = wrapper.vm as unknown as ContactAdminsComponentInstance
    component.contactType = 'feedback'
    component.subject = 'a'.repeat(201) // Exceeds 200 character limit
    component.message = 'Test message'

    await component.onSubmit()

    expect(mockError).toHaveBeenCalledWith('Subject must be 200 characters or less')
    expect(mockActionContactAdmins).not.toHaveBeenCalled()
  })

  it('validates message length limit', async () => {
    const wrapper = createWrapper({ group: mockGroup })

    const component = wrapper.vm as unknown as ContactAdminsComponentInstance
    component.contactType = 'question'
    component.subject = 'Test Subject'
    component.message = 'a'.repeat(5001) // Exceeds 5000 character limit

    await component.onSubmit()

    expect(mockError).toHaveBeenCalledWith('Message must be 5000 characters or less')
    expect(mockActionContactAdmins).not.toHaveBeenCalled()
  })
})
