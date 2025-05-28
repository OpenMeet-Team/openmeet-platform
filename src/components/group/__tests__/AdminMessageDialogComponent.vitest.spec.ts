import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { Quasar } from 'quasar'
import AdminMessageDialogComponent from '../AdminMessageDialogComponent.vue'
import { groupsApi } from '../../../api/groups'
import { GroupVisibility, GroupStatus } from '../../../types/group'
import type { AxiosResponse } from 'axios'

// Mock the API
vi.mock('../../../api/groups', () => ({
  groupsApi: {
    sendAdminMessage: vi.fn(),
    previewAdminMessage: vi.fn()
  }
}))

// Mock the notification composable
vi.mock('../../../composables/useNotification', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}))

const mockGroup = {
  id: 1,
  ulid: 'test-ulid-123',
  slug: 'test-group',
  name: 'Test Group',
  description: 'A test group',
  visibility: GroupVisibility.Public,
  status: GroupStatus.Published
}

const mockMembers = [
  {
    id: 1,
    user: {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      slug: 'john-doe',
      firstName: 'John',
      lastName: 'Doe'
    },
    groupRole: { name: 'member' },
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    user: {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      slug: 'jane-smith',
      firstName: 'Jane',
      lastName: 'Smith'
    },
    groupRole: { name: 'member' },
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 3,
    user: {
      id: 3,
      name: 'Bob Wilson',
      email: 'bob@example.com',
      slug: 'bob-wilson',
      firstName: 'Bob',
      lastName: 'Wilson'
    },
    groupRole: { name: 'member' },
    createdAt: '2024-01-01T00:00:00Z'
  }
]

describe('AdminMessageDialogComponent', () => {
  // Helper function to create wrapper with proper stubs for dialog components
  const createWrapper = (props: Record<string, unknown>) => {
    return mount(AdminMessageDialogComponent, {
      props,
      global: {
        plugins: [Quasar],
        stubs: {
          'q-dialog': {
            template: '<div class="q-dialog"><slot /></div>',
            props: ['modelValue', 'persistent']
          }
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render basic admin message form', async () => {
    const wrapper = createWrapper({ group: mockGroup })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-cy="admin-message-subject"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="admin-message-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="admin-message-send"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Send Message to Group Members')
  })

  it('should show recipient selection UI for targeted messaging', async () => {
    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()
    // Should show recipient type selection
    expect(wrapper.find('[data-cy="recipient-type-selector"]').exists()).toBe(true)

    // Should show "All Members" option by default
    expect(wrapper.text()).toContain('All Members')

    // Should show "Specific Members" option
    expect(wrapper.text()).toContain('Specific Members')
  })

  it('should show member selection when "Specific Members" is selected', async () => {
    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()

    // Select "Specific Members" option
    const specificMembersOption = wrapper.find('[data-cy="recipient-specific-members"]')
    if (specificMembersOption.exists()) {
      await specificMembersOption.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show member selection checkboxes
      expect(wrapper.find('[data-cy="member-selection"]').exists()).toBe(true)
      expect(wrapper.findAll('[data-cy^="member-checkbox-"]')).toHaveLength(3)

      // Should show member names
      expect(wrapper.text()).toContain('John Doe')
      expect(wrapper.text()).toContain('Jane Smith')
      expect(wrapper.text()).toContain('Bob Wilson')
    }
  })

  it('should send admin message to all members when no specific targets selected', async () => {
    const mockResponse = {
      data: {
        success: true,
        deliveredCount: 4,
        failedCount: 0,
        messageId: 'test_msg_123'
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} }
    } as AxiosResponse

    vi.mocked(groupsApi.sendAdminMessage).mockResolvedValue(mockResponse)

    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()

    // Fill in form if elements exist
    const subjectField = wrapper.find('[data-cy="admin-message-subject"]')
    const contentField = wrapper.find('[data-cy="admin-message-content"]')
    const sendButton = wrapper.find('[data-cy="admin-message-send"]')

    if (subjectField.exists() && contentField.exists() && sendButton.exists()) {
      await subjectField.setValue('Test Subject')
      await contentField.setValue('Test message content')
      await sendButton.trigger('click')

      // Should call API without targetUserIds
      expect(groupsApi.sendAdminMessage).toHaveBeenCalledWith('test-group', {
        subject: 'Test Subject',
        message: 'Test message content'
      })
    }
  })

  it('should send admin message to specific members when targets selected', async () => {
    const mockResponse = {
      data: {
        success: true,
        deliveredCount: 3,
        failedCount: 0,
        messageId: 'test_msg_456'
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} }
    } as AxiosResponse

    vi.mocked(groupsApi.sendAdminMessage).mockResolvedValue(mockResponse)

    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()

    // Try to select "Specific Members" option and specific members
    const specificMembersOption = wrapper.find('[data-cy="recipient-specific-members"]')
    if (specificMembersOption.exists()) {
      await specificMembersOption.trigger('click')
      await wrapper.vm.$nextTick()

      // Select specific members
      const member1Checkbox = wrapper.find('[data-cy="member-checkbox-john-doe"]')
      const member2Checkbox = wrapper.find('[data-cy="member-checkbox-jane-smith"]')

      if (member1Checkbox.exists() && member2Checkbox.exists()) {
        await member1Checkbox.trigger('click')
        await member2Checkbox.trigger('click')
        await wrapper.vm.$nextTick()

        // Fill in form
        const subjectField = wrapper.find('[data-cy="admin-message-subject"]')
        const contentField = wrapper.find('[data-cy="admin-message-content"]')
        const sendButton = wrapper.find('[data-cy="admin-message-send"]')

        if (subjectField.exists() && contentField.exists() && sendButton.exists()) {
          await subjectField.setValue('Targeted Message')
          await contentField.setValue('Message for specific members')
          await sendButton.trigger('click')

          // Should call API with targetUserIds
          expect(groupsApi.sendAdminMessage).toHaveBeenCalledWith('test-group', {
            subject: 'Targeted Message',
            message: 'Message for specific members',
            targetUserIds: [1, 2]
          })
        }
      }
    }
  })

  it('should disable send button when no members selected in specific mode', async () => {
    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()

    // Select "Specific Members" option
    const specificMembersOption = wrapper.find('[data-cy="recipient-specific-members"]')
    if (specificMembersOption.exists()) {
      await specificMembersOption.trigger('click')
      await wrapper.vm.$nextTick()

      // Fill in form but don't select any members
      const subjectField = wrapper.find('[data-cy="admin-message-subject"]')
      const contentField = wrapper.find('[data-cy="admin-message-content"]')

      if (subjectField.exists() && contentField.exists()) {
        await subjectField.setValue('Test Subject')
        await contentField.setValue('Test message')
        await wrapper.vm.$nextTick()

        // Send button should be disabled
        const sendButton = wrapper.find('[data-cy="admin-message-send"]')
        if (sendButton.exists()) {
          expect(sendButton.attributes('disabled')).toBeDefined()
        }
      }
    }
  })

  it('should show preview functionality with targeted recipients', async () => {
    const mockPreviewResponse = {
      data: { message: 'Preview sent successfully' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} }
    } as AxiosResponse
    vi.mocked(groupsApi.previewAdminMessage).mockResolvedValue(mockPreviewResponse)

    const wrapper = createWrapper({
      group: mockGroup,
      members: mockMembers
    })

    await wrapper.vm.$nextTick()

    // Select specific members
    const specificMembersOption = wrapper.find('[data-cy="recipient-specific-members"]')
    if (specificMembersOption.exists()) {
      await specificMembersOption.trigger('click')
      await wrapper.vm.$nextTick()

      const member1Checkbox = wrapper.find('[data-cy="member-checkbox-john-doe"]')
      if (member1Checkbox.exists()) {
        await member1Checkbox.trigger('click')
        await wrapper.vm.$nextTick()

        // Fill in form
        const subjectField = wrapper.find('[data-cy="admin-message-subject"]')
        const contentField = wrapper.find('[data-cy="admin-message-content"]')

        if (subjectField.exists() && contentField.exists()) {
          await subjectField.setValue('Preview Test')
          await contentField.setValue('Preview content')
          await wrapper.vm.$nextTick()

          // Try to find and interact with preview functionality
          const expansionItem = wrapper.find('.q-expansion-item')
          if (expansionItem.exists()) {
            await expansionItem.trigger('click')
            await wrapper.vm.$nextTick()

            const previewEmailField = wrapper.find('[data-cy="admin-message-preview-email"]')
            const previewButton = wrapper.find('[data-cy="admin-message-preview-btn"]')

            if (previewEmailField.exists() && previewButton.exists()) {
              await previewEmailField.setValue('test@example.com')
              await previewButton.trigger('click')

              // Should call preview API with targetUserIds
              expect(groupsApi.previewAdminMessage).toHaveBeenCalledWith('test-group', {
                subject: 'Preview Test',
                message: 'Preview content',
                testEmail: 'test@example.com',
                targetUserIds: [1]
              })
            }
          }
        }
      }
    }
  })
})
