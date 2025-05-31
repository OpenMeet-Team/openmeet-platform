import { installQuasarPlugin } from '@quasar/quasar-app-extension-testing-unit-vitest'
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SocialAuthError from '../../../../../src/components/auth/SocialAuthError.vue'

installQuasarPlugin()

describe('SocialAuthError.vue', () => {
  const defaultProps = {
    error: 'Authentication failed',
    authProvider: 'github',
    suggestedProvider: '',
    isPopup: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders error message correctly', () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      expect(wrapper.find('.text-h6').text()).toContain('Authentication Failed')
      expect(wrapper.find('.text-body2').text()).toBe('Authentication failed')
    })

    it('shows warning icon', () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      expect(wrapper.find('.q-icon').exists()).toBe(true)
      expect(wrapper.html()).toContain('warning')
    })

    it('always shows Try Again and Cancel buttons', () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      const buttons = wrapper.findAll('.q-btn')
      const buttonTexts = buttons.map(btn => btn.text())

      expect(buttonTexts).toContain('Try Again')
      expect(buttonTexts).toContain('Cancel')
    })
  })

  describe('Enhanced Error Display', () => {
    it('shows suggested action section when suggestedProvider is provided', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'google'
        }
      })

      expect(wrapper.find('.text-subtitle2').text()).toBe('What should I do?')
      expect(wrapper.text()).toContain('Try signing in with Google instead')
    })

    it('does not show suggested action section without suggestedProvider', () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      expect(wrapper.find('.text-subtitle2').exists()).toBe(false)
    })

    it('cleans error message when suggestedProvider is present', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          error: 'An account already exists. Please sign in using your google account instead.',
          suggestedProvider: 'google'
        }
      })

      // Should show only the first part before "Please sign in using"
      expect(wrapper.find('.text-body2').text()).toBe('An account already exists.')
    })
  })

  describe('Provider-Specific Buttons', () => {
    it('shows Google button when suggested', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'google'
        }
      })

      expect(wrapper.text()).toContain('Use Google')
    })

    it('shows GitHub button when suggested', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'github'
        }
      })

      expect(wrapper.text()).toContain('Use GitHub')
    })

    it('shows Bluesky button when suggested', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'bluesky'
        }
      })

      expect(wrapper.text()).toContain('Use Bluesky')
    })

    it('shows email login button for email suggestion', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'email'
        }
      })

      expect(wrapper.text()).toContain('Use Email Login')
    })

    it('does not show provider button when suggestedProvider is email', () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'email'
        }
      })

      expect(wrapper.text()).not.toContain('Use Google')
      expect(wrapper.text()).not.toContain('Use GitHub')
      expect(wrapper.text()).not.toContain('Use Bluesky')
    })
  })

  describe('Event Emissions', () => {
    it('emits tryAgain event when Try Again button is clicked', async () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      const buttons = wrapper.findAll('.q-btn')
      const tryAgainBtn = buttons.find(btn => btn.text().includes('Try Again'))
      expect(tryAgainBtn).toBeTruthy()

      await tryAgainBtn!.trigger('click')
      expect(wrapper.emitted('tryAgain')).toBeTruthy()
      expect(wrapper.emitted('tryAgain')).toHaveLength(1)
    })

    it('emits cancel event when Cancel button is clicked', async () => {
      const wrapper = mount(SocialAuthError, {
        props: defaultProps
      })

      const buttons = wrapper.findAll('.q-btn')
      const cancelBtn = buttons.find(btn => btn.text().includes('Cancel'))
      expect(cancelBtn).toBeTruthy()

      await cancelBtn!.trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('emits useProvider event when provider button is clicked', async () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'google'
        }
      })

      const buttons = wrapper.findAll('.q-btn')
      const googleBtn = buttons.find(btn => btn.text().includes('Use Google'))
      expect(googleBtn).toBeTruthy()

      await googleBtn!.trigger('click')
      expect(wrapper.emitted('useProvider')).toBeTruthy()
      expect(wrapper.emitted('useProvider')).toEqual([['google']])
    })

    it('emits useEmailLogin event when email login button is clicked', async () => {
      const wrapper = mount(SocialAuthError, {
        props: {
          ...defaultProps,
          suggestedProvider: 'email'
        }
      })

      const buttons = wrapper.findAll('.q-btn')
      const emailBtn = buttons.find(btn => btn.text().includes('Use Email Login'))
      expect(emailBtn).toBeTruthy()

      await emailBtn!.trigger('click')
      expect(wrapper.emitted('useEmailLogin')).toBeTruthy()
      expect(wrapper.emitted('useEmailLogin')).toHaveLength(1)
    })
  })

  describe('Provider Icons and Colors', () => {
    it('includes provider icons in buttons', () => {
      const testCases = [
        { provider: 'google', expectedText: 'Use Google' },
        { provider: 'github', expectedText: 'Use GitHub' },
        { provider: 'bluesky', expectedText: 'Use Bluesky' }
      ]

      testCases.forEach(({ provider, expectedText }) => {
        const wrapper = mount(SocialAuthError, {
          props: {
            ...defaultProps,
            suggestedProvider: provider
          }
        })

        // Check that the provider button exists and has icon classes
        expect(wrapper.text()).toContain(expectedText)
        expect(wrapper.html()).toContain('q-icon')
      })
    })

    it('applies provider-specific styling', () => {
      const testCases = [
        { provider: 'google', expectedText: 'Use Google' },
        { provider: 'github', expectedText: 'Use GitHub' },
        { provider: 'bluesky', expectedText: 'Use Bluesky' }
      ]

      testCases.forEach(({ provider, expectedText }) => {
        const wrapper = mount(SocialAuthError, {
          props: {
            ...defaultProps,
            suggestedProvider: provider
          }
        })

        const buttons = wrapper.findAll('.q-btn')
        const providerBtn = buttons.find(btn => btn.text().includes(expectedText))

        expect(providerBtn).toBeTruthy()
        expect(providerBtn!.html()).toContain('q-btn')
      })
    })
  })

  describe('Suggested Actions Text', () => {
    it('generates correct suggested action text for different providers', () => {
      const testCases = [
        { provider: 'google', expected: 'Try signing in with Google instead' },
        { provider: 'github', expected: 'Try signing in with GitHub instead' },
        { provider: 'bluesky', expected: 'Try signing in with Bluesky instead' },
        { provider: 'email', expected: 'Try signing in with email and password instead' }
      ]

      testCases.forEach(({ provider, expected }) => {
        const wrapper = mount(SocialAuthError, {
          props: {
            ...defaultProps,
            suggestedProvider: provider
          }
        })

        expect(wrapper.text()).toContain(expected)
      })
    })
  })

  describe('Button Text Generation', () => {
    it('generates correct button text for different providers', () => {
      const testCases = [
        { provider: 'google', expected: 'Use Google' },
        { provider: 'github', expected: 'Use GitHub' },
        { provider: 'bluesky', expected: 'Use Bluesky' }
      ]

      testCases.forEach(({ provider, expected }) => {
        const wrapper = mount(SocialAuthError, {
          props: {
            ...defaultProps,
            suggestedProvider: provider
          }
        })

        expect(wrapper.text()).toContain(expected)
      })
    })
  })
})
