import { mount } from '@vue/test-utils'
import QuickRSVPDialog from '../QuickRSVPDialog.vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, Notify } from 'quasar'
import { authApi } from '../../../api/auth'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// Mock the authApi
vi.mock('../../../api/auth', () => ({
  authApi: {
    quickRsvp: vi.fn()
  }
}))

// Mock Notify
const mockNotify = vi.fn()
Notify.create = mockNotify

describe('QuickRSVPDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockClear()
  })

  const mountComponent = (props = {}) => {
    return mount(QuickRSVPDialog, {
      global: {
        plugins: [Quasar]
      },
      props: {
        modelValue: true,
        eventSlug: 'test-event',
        eventName: 'Test Event',
        status: 'confirmed',
        ...props
      }
    })
  }

  describe('Email Validation', () => {
    it('should validate email format correctly', () => {
      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { validateEmail } = wrapper.vm as any

      // Valid emails
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user+tag@example.com')).toBe(true)
      expect(validateEmail('user.name@example.co.uk')).toBe(true)

      // Invalid emails
      expect(validateEmail('notanemail')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('user @example.com')).toBe(false)
    })
  })

  describe('Form Submission', () => {
    it('should successfully submit Quick RSVP and show success notification', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          message: 'Verification code sent!',
          verificationCode: '123456'
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.quickRsvp).mockResolvedValue(mockResponse)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Set form values directly on the component
      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      // Call the submit method directly
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      // Verify API was called correctly
      expect(authApi.quickRsvp).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        eventSlug: 'test-event',
        status: 'confirmed'
      })

      // Verify success notification
      expect(mockNotify).toHaveBeenCalledWith({
        type: 'positive',
        message: 'Verification code sent!',
        position: 'top'
      })

      // Verify success event emitted
      expect(wrapper.emitted('success')).toBeTruthy()
      expect(wrapper.emitted('success')?.[0]).toEqual(['john@example.com', '123456'])
    })

    it('should submit with cancelled status when specified', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          message: 'RSVP updated',
          verificationCode: '123456'
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.quickRsvp).mockResolvedValue(mockResponse)

      const wrapper = mountComponent({ status: 'cancelled' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(authApi.quickRsvp).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        eventSlug: 'test-event',
        status: 'cancelled'
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API error and show error notification', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Event not found'
          }
        }
      }
      vi.mocked(authApi.quickRsvp).mockRejectedValue(mockError)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Event not found',
        position: 'top'
      })
    })

    it('should handle generic errors with fallback message', async () => {
      vi.mocked(authApi.quickRsvp).mockRejectedValue(new Error('Network error'))

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Failed to send RSVP. Please try again.',
        position: 'top'
      })
    })

    it('should handle rate limiting error (429)', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            message: 'Too many requests. Please try again later.'
          }
        }
      }
      vi.mocked(authApi.quickRsvp).mockRejectedValue(mockError)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Too many requests. Please try again later.',
        position: 'top'
      })
    })
  })

  describe('Dialog Controls', () => {
    it('should close dialog after successful submission', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          message: 'Success',
          verificationCode: '123456'
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.quickRsvp).mockResolvedValue(mockResponse)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.name = 'John Doe'
      vm.email = 'john@example.com'

      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const events = wrapper.emitted('update:modelValue')
      expect(events?.[events.length - 1]).toEqual([false])
    })

    it('should emit update:modelValue when dialog is cancelled', async () => {
      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Call the cancel method directly
      vm.onCancel()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })
  })
})
