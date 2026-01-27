import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quasar, Notify, copyToClipboard } from 'quasar'
import { createPinia, setActivePinia } from 'pinia'
import AtprotoIdentityCard from '../AtprotoIdentityCard.vue'
import type { AtprotoIdentityDto } from '../../../types/atproto'

// Mock Quasar's copyToClipboard
vi.mock('quasar', async () => {
  const actual = await vi.importActual('quasar')
  return {
    ...actual,
    copyToClipboard: vi.fn().mockResolvedValue(undefined)
  }
})

// Mock Notify
const mockNotify = vi.fn()
Notify.create = mockNotify

describe('AtprotoIdentityCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotify.mockClear()
    setActivePinia(createPinia())
  })

  // Use a realistic DID length (real PLC DIDs are ~32 chars like did:plc:z72i7hdynmk6r22z27h6tvur)
  const createMockIdentity = (overrides: Partial<AtprotoIdentityDto> = {}): AtprotoIdentityDto => ({
    did: 'did:plc:z72i7hdynmk6r22z27h6tvur',
    handle: 'alice.opnmt.me',
    pdsUrl: 'https://pds.openmeet.net',
    isCustodial: true,
    isOurPds: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides
  })

  const mountComponent = (props = {}) => {
    return mount(AtprotoIdentityCard, {
      global: {
        plugins: [Quasar]
      },
      props: {
        identity: null,
        loading: false,
        recoveryStatus: null,
        recovering: false,
        ...props
      }
    })
  }

  describe('When no identity exists', () => {
    it('should show info message about no linked identity', () => {
      const wrapper = mountComponent({ identity: null })

      expect(wrapper.text()).toContain('No AT Protocol identity linked to your account')
    })

    it('should show "Create AT Protocol Identity" button', () => {
      const wrapper = mountComponent({ identity: null })

      const button = wrapper.find('[data-cy="create-identity-btn"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Create AT Protocol Identity')
    })

    it('should emit create event when button is clicked', async () => {
      const wrapper = mountComponent({ identity: null })

      const button = wrapper.find('[data-cy="create-identity-btn"]')
      await button.trigger('click')

      expect(wrapper.emitted('create')).toBeTruthy()
    })
  })

  describe('When identity exists (custodial - managed by OpenMeet)', () => {
    it('should display handle with @ prefix', () => {
      const identity = createMockIdentity({ handle: 'alice.opnmt.me' })
      const wrapper = mountComponent({ identity })

      expect(wrapper.text()).toContain('@alice.opnmt.me')
    })

    it('should display truncated DID', () => {
      // Use a realistic DID that will definitely be truncated
      const identity = createMockIdentity({ did: 'did:plc:z72i7hdynmk6r22z27h6tvur' })
      const wrapper = mountComponent({ identity })

      // Should show truncated version (first 20 chars + ... + last 6 chars)
      expect(wrapper.text()).toMatch(/did:plc:z72i7hdynmk6\.\.\.h6tvur/)
    })

    it('should have copy button for DID', () => {
      const identity = createMockIdentity()
      const wrapper = mountComponent({ identity })

      const copyBtn = wrapper.find('[data-cy="copy-did-btn"]')
      expect(copyBtn.exists()).toBe(true)
    })

    it('should copy full DID to clipboard when copy button clicked', async () => {
      const identity = createMockIdentity({ did: 'did:plc:z72i7hdynmk6r22z27h6tvur' })
      const wrapper = mountComponent({ identity })

      const copyBtn = wrapper.find('[data-cy="copy-did-btn"]')
      await copyBtn.trigger('click')

      expect(copyToClipboard).toHaveBeenCalledWith('did:plc:z72i7hdynmk6r22z27h6tvur')
    })

    it('should show "Managed by OpenMeet" status for custodial identity', () => {
      const identity = createMockIdentity({ isCustodial: true })
      const wrapper = mountComponent({ identity })

      expect(wrapper.text()).toContain('Managed by OpenMeet')
    })

    it('should have "View Profile on Bluesky" link', () => {
      const identity = createMockIdentity({ handle: 'alice.opnmt.me' })
      const wrapper = mountComponent({ identity })

      const link = wrapper.find('[data-cy="bluesky-profile-link"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://bsky.app/profile/alice.opnmt.me')
      expect(link.attributes('target')).toBe('_blank')
    })
  })

  describe('When identity is self-managed (our PDS)', () => {
    it('should show "Self-managed" status', () => {
      const identity = createMockIdentity({
        isCustodial: false,
        isOurPds: true
      })
      const wrapper = mountComponent({ identity })

      expect(wrapper.text()).toContain('Self-managed')
      expect(wrapper.text()).not.toContain('external PDS')
    })
  })

  describe('When identity is on external PDS', () => {
    it('should show "Self-managed (external PDS)" status', () => {
      const identity = createMockIdentity({
        isCustodial: false,
        isOurPds: false,
        pdsUrl: 'https://bsky.social'
      })
      const wrapper = mountComponent({ identity })

      expect(wrapper.text()).toContain('Self-managed (external PDS)')
    })

    it('should show info message about external PDS limitations', () => {
      const identity = createMockIdentity({
        isCustodial: false,
        isOurPds: false
      })
      const wrapper = mountComponent({ identity })

      expect(wrapper.text()).toContain('Your identity is hosted on an external PDS')
    })
  })

  describe('Loading state', () => {
    it('should show loading spinner when loading is true', () => {
      const wrapper = mountComponent({ loading: true })

      const spinner = wrapper.find('[data-cy="identity-loading"]')
      expect(spinner.exists()).toBe(true)
    })

    it('should not show content while loading', () => {
      const wrapper = mountComponent({ loading: true })

      expect(wrapper.text()).not.toContain('No AT Protocol identity')
      expect(wrapper.text()).not.toContain('Create AT Protocol Identity')
    })
  })

  describe('Handle null handle', () => {
    it('should handle null handle gracefully', () => {
      const identity = createMockIdentity({ handle: null })
      const wrapper = mountComponent({ identity })

      // Should show DID but not handle
      expect(wrapper.text()).toContain('did:plc')
      // View profile link should exist and use DID as fallback
      const link = wrapper.find('[data-cy="bluesky-profile-link"]')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur')
    })
  })

  describe('Copy handle', () => {
    it('should have copy button for handle', () => {
      const identity = createMockIdentity({ handle: 'alice.opnmt.me' })
      const wrapper = mountComponent({ identity })

      const copyBtn = wrapper.find('[data-cy="copy-handle-btn"]')
      expect(copyBtn.exists()).toBe(true)
    })

    it('should copy handle to clipboard when copy button clicked', async () => {
      const identity = createMockIdentity({ handle: 'alice.opnmt.me' })
      const wrapper = mountComponent({ identity })

      const copyBtn = wrapper.find('[data-cy="copy-handle-btn"]')
      await copyBtn.trigger('click')

      expect(copyToClipboard).toHaveBeenCalledWith('alice.opnmt.me')
    })
  })

  describe('Recovery flow', () => {
    it('should show recovery banner when hasExistingAccount is true', () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: true }
      })

      expect(wrapper.text()).toContain('We found an existing AT Protocol account')
    })

    it('should show "Let OpenMeet manage it" button when recovery is available', () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: true }
      })

      const button = wrapper.find('[data-cy="recover-identity-btn"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Let OpenMeet manage it')
    })

    it('should emit recover event when recover button is clicked', async () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: true }
      })

      const button = wrapper.find('[data-cy="recover-identity-btn"]')
      await button.trigger('click')

      expect(wrapper.emitted('recover')).toBeTruthy()
    })

    it('should show "Create New Identity" as secondary option when recovery is available', () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: true }
      })

      const button = wrapper.find('[data-cy="create-identity-btn"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Create New Identity')
    })

    it('should not show recovery banner when hasExistingAccount is false', () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: false }
      })

      expect(wrapper.text()).not.toContain('We found an existing AT Protocol account')
    })

    it('should disable buttons when recovering is true', () => {
      const wrapper = mountComponent({
        identity: null,
        recoveryStatus: { hasExistingAccount: true },
        recovering: true
      })

      const recoverBtn = wrapper.find('[data-cy="recover-identity-btn"]')
      const createBtn = wrapper.find('[data-cy="create-identity-btn"]')

      expect(recoverBtn.attributes('disabled')).toBeDefined()
      expect(createBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Take ownership flow', () => {
    it('should show "Take Ownership" button for custodial identity on our PDS', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({ identity })

      const button = wrapper.find('[data-cy="take-ownership-btn"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Take Ownership')
    })

    it('should NOT show "Take Ownership" button for non-custodial identity', () => {
      const identity = createMockIdentity({
        isCustodial: false,
        isOurPds: true
      })
      const wrapper = mountComponent({ identity })

      const button = wrapper.find('[data-cy="take-ownership-btn"]')
      expect(button.exists()).toBe(false)
    })

    it('should NOT show "Take Ownership" button for external PDS identity', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: false
      })
      const wrapper = mountComponent({ identity })

      const button = wrapper.find('[data-cy="take-ownership-btn"]')
      expect(button.exists()).toBe(false)
    })

    it('should emit initiate-take-ownership event when "Take Ownership" button is clicked', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({ identity })

      const button = wrapper.find('[data-cy="take-ownership-btn"]')
      await button.trigger('click')

      expect(wrapper.emitted('initiate-take-ownership')).toBeTruthy()
    })

    it('should show instructions when takeOwnershipPending is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      expect(wrapper.text()).toContain('Check your email')
      expect(wrapper.text()).toContain('user@example.com')
    })

    it('should show password reset form with submit button when takeOwnershipPending is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Check that form elements exist
      expect(wrapper.find('[data-cy="password-reset-token"]').exists()).toBe(true)
      expect(wrapper.find('[data-cy="password-reset-password"]').exists()).toBe(true)
      expect(wrapper.find('[data-cy="password-reset-confirm"]').exists()).toBe(true)

      // Check submit button exists
      const button = wrapper.find('[data-cy="submit-password-reset-btn"]')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Set Password')
    })

    it('should emit reset-password event when form is submitted with valid data', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Access internal state directly (Quasar components don't fully render in tests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.resetToken = 'ABC123'
      vm.resetPassword = 'newpassword123'
      vm.resetPasswordConfirm = 'newpassword123'
      await wrapper.vm.$nextTick()

      const button = wrapper.find('[data-cy="submit-password-reset-btn"]')
      await button.trigger('click')

      expect(wrapper.emitted('reset-password')).toBeTruthy()
      expect(wrapper.emitted('reset-password')![0]).toEqual([{
        token: 'ABC123',
        password: 'newpassword123'
      }])
    })

    it('should hide "Take Ownership" button when takeOwnershipPending is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      const button = wrapper.find('[data-cy="take-ownership-btn"]')
      expect(button.exists()).toBe(false)
    })

    it('should show cancel button when takeOwnershipPending is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      const button = wrapper.find('[data-cy="cancel-take-ownership-btn"]')
      expect(button.exists()).toBe(true)
    })

    it('should emit cancel-take-ownership event when cancel button is clicked', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      const button = wrapper.find('[data-cy="cancel-take-ownership-btn"]')
      await button.trigger('click')

      expect(wrapper.emitted('cancel-take-ownership')).toBeTruthy()
    })

    it('should disable submit button when resettingPassword is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com',
        resettingPassword: true
      })

      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      expect(submitBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Password reset form in take ownership flow', () => {
    it('should show password reset form when takeOwnershipPending is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Should have token input
      const tokenInput = wrapper.find('[data-cy="password-reset-token"]')
      expect(tokenInput.exists()).toBe(true)

      // Should have password input
      const passwordInput = wrapper.find('[data-cy="password-reset-password"]')
      expect(passwordInput.exists()).toBe(true)

      // Should have confirm password input
      const confirmInput = wrapper.find('[data-cy="password-reset-confirm"]')
      expect(confirmInput.exists()).toBe(true)
    })

    it('should have token input with proper label', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Check the token input exists (Quasar internal structure is not fully rendered in tests)
      const tokenWrapper = wrapper.find('[data-cy="password-reset-token"]')
      expect(tokenWrapper.exists()).toBe(true)
      // Check label is present in component
      expect(wrapper.text()).toContain('Reset Code')
    })

    it('should have password inputs with proper labels', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Check password inputs exist
      const passwordWrapper = wrapper.find('[data-cy="password-reset-password"]')
      const confirmWrapper = wrapper.find('[data-cy="password-reset-confirm"]')
      expect(passwordWrapper.exists()).toBe(true)
      expect(confirmWrapper.exists()).toBe(true)
      // Check labels are present
      expect(wrapper.text()).toContain('New Password')
      expect(wrapper.text()).toContain('Confirm Password')
    })

    it('should show submit button for password reset', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      expect(submitBtn.exists()).toBe(true)
      expect(submitBtn.text()).toContain('Set Password')
    })

    it('should emit reset-password event with token and password when form is submitted', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Access internal state directly (Quasar components don't fully render in tests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.resetToken = 'ABC123'
      vm.resetPassword = 'newpassword123'
      vm.resetPasswordConfirm = 'newpassword123'
      await wrapper.vm.$nextTick()

      // Submit the form
      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      await submitBtn.trigger('click')

      expect(wrapper.emitted('reset-password')).toBeTruthy()
      expect(wrapper.emitted('reset-password')![0]).toEqual([{
        token: 'ABC123',
        password: 'newpassword123'
      }])
    })

    it('should show validation error if passwords do not match', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Access internal state directly (Quasar components don't fully render in tests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.resetToken = 'ABC123'
      vm.resetPassword = 'password1'
      vm.resetPasswordConfirm = 'password2'
      await wrapper.vm.$nextTick()

      // Try to submit
      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      await submitBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show error and not emit
      expect(vm.validationErrors.confirm).toBe('Passwords do not match')
      expect(wrapper.emitted('reset-password')).toBeFalsy()
    })

    it('should show validation error if password is too short', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Access internal state directly (Quasar components don't fully render in tests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      vm.resetToken = 'ABC123'
      vm.resetPassword = 'short'
      vm.resetPasswordConfirm = 'short'
      await wrapper.vm.$nextTick()

      // Try to submit
      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      await submitBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show error and not emit
      expect(vm.validationErrors.password).toContain('at least 8 characters')
      expect(wrapper.emitted('reset-password')).toBeFalsy()
    })

    it('should show validation error if token is empty', async () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com'
      })

      // Access internal state directly (Quasar components don't fully render in tests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vm = wrapper.vm as any

      // Don't set token, just password
      vm.resetPassword = 'newpassword123'
      vm.resetPasswordConfirm = 'newpassword123'
      await wrapper.vm.$nextTick()

      // Try to submit
      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      await submitBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show error and not emit
      expect(vm.validationErrors.token).toBe('Token is required')
      expect(wrapper.emitted('reset-password')).toBeFalsy()
    })

    it('should disable submit button when resettingPassword is true', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com',
        resettingPassword: true
      })

      const submitBtn = wrapper.find('[data-cy="submit-password-reset-btn"]')
      expect(submitBtn.attributes('disabled')).toBeDefined()
    })

    it('should show password reset error when provided', () => {
      const identity = createMockIdentity({
        isCustodial: true,
        isOurPds: true
      })
      const wrapper = mountComponent({
        identity,
        takeOwnershipPending: true,
        takeOwnershipEmail: 'user@example.com',
        passwordResetError: 'Invalid token'
      })

      expect(wrapper.text()).toContain('Invalid token')
    })
  })
})
