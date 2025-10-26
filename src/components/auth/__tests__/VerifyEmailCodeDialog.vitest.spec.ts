import { mount } from '@vue/test-utils'
import VerifyEmailCodeDialog from '../VerifyEmailCodeDialog.vue'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, Notify } from 'quasar'
import { authApi } from '../../../api/auth'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../../../stores/auth-store'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'

// Mock the authApi
vi.mock('../../../api/auth', () => ({
  authApi: {
    verifyEmailCode: vi.fn()
  }
}))

// Mock the env utility
vi.mock('../../../utils/env', () => ({
  default: vi.fn((key: string) => {
    if (key === 'NODE_ENV') return 'test'
    return undefined
  })
}))

// Mock Notify
const mockNotify = vi.fn()
Notify.create = mockNotify

describe('VerifyEmailCodeDialog', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockClear()
    setActivePinia(createPinia())
    authStore = useAuthStore()
    vi.spyOn(authStore, 'actionSetToken')
    vi.spyOn(authStore, 'actionSetRefreshToken')
    vi.spyOn(authStore, 'actionSetTokenExpires')
    vi.spyOn(authStore, 'actionSetUser')
    vi.spyOn(authStore, 'initializeMatrixIfReady').mockResolvedValue()
  })

  const mountComponent = (props = {}) => {
    return mount(VerifyEmailCodeDialog, {
      global: {
        plugins: [Quasar]
      },
      props: {
        modelValue: true,
        email: 'test@example.com',
        verificationCode: undefined,
        ...props
      }
    })
  }

  describe('Paste Handling', () => {
    it('should extract digits from pasted text', async () => {
      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      })
      pasteEvent.clipboardData?.setData('text', 'Your code is: 123456')

      vm.handlePaste(pasteEvent)
      await wrapper.vm.$nextTick()

      expect(vm.code).toBe('123456')
    })

    it('should extract only digits and limit to 6', async () => {
      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      })
      pasteEvent.clipboardData?.setData('text', 'abc-123-456-789')

      vm.handlePaste(pasteEvent)
      await wrapper.vm.$nextTick()

      expect(vm.code).toBe('123456')
    })
  })

  describe('Form Submission', () => {
    it('should successfully verify code and authenticate user', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: {
            id: '123',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User'
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.verifyEmailCode).mockResolvedValue(mockResponse)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.code = '123456'
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      // Verify API was called
      expect(authApi.verifyEmailCode).toHaveBeenCalledWith({
        code: '123456',
        email: 'test@example.com'
      })

      // Verify auth store was updated
      expect(authStore.actionSetToken).toHaveBeenCalledWith('test-token')
      expect(authStore.actionSetRefreshToken).toHaveBeenCalledWith('test-refresh-token')
      expect(authStore.actionSetTokenExpires).toHaveBeenCalledWith(3600)
      expect(authStore.actionSetUser).toHaveBeenCalledWith(mockResponse.data.user)
      expect(authStore.initializeMatrixIfReady).toHaveBeenCalled()

      // Verify success notification
      expect(mockNotify).toHaveBeenCalledWith({
        type: 'positive',
        message: 'Email verified! You are now signed in.',
        position: 'top'
      })

      // Verify success event emitted
      expect(wrapper.emitted('success')).toBeTruthy()
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid code error', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Invalid verification code'
          }
        }
      }
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(mockError)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.code = '999999'
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Invalid verification code',
        position: 'top'
      })

      // Verify code field was cleared
      expect(vm.code).toBe('')
    })

    it('should handle expired code error', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Verification code has expired'
          }
        }
      }
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(mockError)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.code = '123456'
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Verification code has expired',
        position: 'top'
      })
    })

    it('should handle generic error with fallback message', async () => {
      vi.mocked(authApi.verifyEmailCode).mockRejectedValue(new Error('Network error'))

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.code = '123456'
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(mockNotify).toHaveBeenCalledWith({
        type: 'negative',
        message: 'Invalid or expired code. Please try again.',
        position: 'top'
      })
    })
  })

  describe('Dialog Controls', () => {
    it('should emit update:modelValue when dialog is cancelled', async () => {
      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.onCancel()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    })

    it('should close dialog after successful verification', async () => {
      const mockResponse: AxiosResponse = {
        data: {
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          tokenExpires: 3600,
          user: { id: '123', email: 'test@example.com' }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig
      }
      vi.mocked(authApi.verifyEmailCode).mockResolvedValue(mockResponse)

      const wrapper = mountComponent()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.code = '123456'
      await vm.onSubmit()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const events = wrapper.emitted('update:modelValue')
      expect(events?.[events.length - 1]).toEqual([false])
    })
  })
})
