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
})
