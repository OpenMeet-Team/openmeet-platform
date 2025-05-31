import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSocialAuthError } from '../../../../src/composables/useSocialAuthError'
import { useRouter } from 'vue-router'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: vi.fn()
}))

describe('useSocialAuthError', () => {
  const mockPush = vi.fn()
  const mockRouter = { push: mockPush }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter)

    // Mock window properties
    Object.defineProperty(window, 'opener', {
      writable: true,
      value: null
    })

    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        origin: 'http://localhost:3000'
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Error Parsing', () => {
    it('parses enhanced social auth errors correctly', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const mockError = {
        response: {
          data: {
            errors: {
              social_auth: 'An account with this email already exists. Please sign in using your google account instead.',
              auth_provider: 'github',
              suggested_provider: 'google'
            }
          }
        }
      }

      const result = parseSocialAuthError(mockError, 'github')

      expect(result).toEqual({
        message: 'An account with this email already exists. Please sign in using your google account instead.',
        authProvider: 'github',
        suggestedProvider: 'google',
        isEnhanced: true
      })
    })

    it('parses 422 email conflict errors correctly', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const mockError = {
        response: {
          status: 422,
          data: {
            errors: {
              email: 'An account with this email already exists. Please sign in using your google account instead.'
            }
          }
        }
      }

      const result = parseSocialAuthError(mockError, 'github')

      expect(result).toEqual({
        message: 'An account with this email already exists. Please sign in using your google account instead.',
        authProvider: 'github',
        suggestedProvider: 'google',
        isEnhanced: false
      })
    })

    it('extracts suggested provider from error message correctly', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const testCases = [
        {
          message: 'Please sign in using your google account instead',
          expectedProvider: 'google'
        },
        {
          message: 'Please sign in using your github account instead',
          expectedProvider: 'github'
        },
        {
          message: 'Please sign in using your bluesky account instead',
          expectedProvider: 'bluesky'
        },
        {
          message: 'Please sign in using email and password instead',
          expectedProvider: 'email'
        }
      ]

      testCases.forEach(({ message, expectedProvider }) => {
        const mockError = {
          response: {
            status: 422,
            data: {
              errors: {
                email: message
              }
            }
          }
        }

        const result = parseSocialAuthError(mockError, 'github')
        expect(result.suggestedProvider).toBe(expectedProvider)
      })
    })

    it('handles generic errors gracefully', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const mockError = {
        message: 'Network error'
      }

      const result = parseSocialAuthError(mockError, 'github')

      expect(result).toEqual({
        message: 'Network error',
        authProvider: 'github',
        suggestedProvider: undefined,
        isEnhanced: false
      })
    })

    it('handles errors without message gracefully', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const mockError = {}

      const result = parseSocialAuthError(mockError, 'github')

      expect(result).toEqual({
        message: 'Authentication failed. Please try again.',
        authProvider: 'github',
        suggestedProvider: undefined,
        isEnhanced: false
      })
    })

    it('uses fallback provider when auth_provider is not in error', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const mockError = {
        response: {
          data: {
            errors: {
              social_auth: 'Some error message',
              suggested_provider: 'google'
              // No auth_provider field
            }
          }
        }
      }

      const result = parseSocialAuthError(mockError, 'github')
      expect(result.authProvider).toBe('github')
    })
  })

  describe('Error State Management', () => {
    it('sets and clears error correctly', () => {
      const { error, hasError, setError, clearError } = useSocialAuthError()

      expect(hasError.value).toBe(false)
      expect(error.value).toBeNull()

      const mockError = {
        response: {
          data: {
            errors: {
              social_auth: 'Test error',
              auth_provider: 'github',
              suggested_provider: 'google'
            }
          }
        }
      }

      setError(mockError, 'github')

      expect(hasError.value).toBe(true)
      expect(error.value).toEqual({
        message: 'Test error',
        authProvider: 'github',
        suggestedProvider: 'google',
        isEnhanced: true
      })

      clearError()

      expect(hasError.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('computes isEnhancedError correctly', () => {
      const { isEnhancedError, setError } = useSocialAuthError()

      const enhancedError = {
        response: {
          data: {
            errors: {
              social_auth: 'Enhanced error',
              auth_provider: 'github',
              suggested_provider: 'google'
            }
          }
        }
      }

      const genericError = {
        message: 'Generic error'
      }

      setError(enhancedError, 'github')
      expect(isEnhancedError.value).toBe(true)

      setError(genericError, 'github')
      expect(isEnhancedError.value).toBe(false)
    })

    it('computes hasSuggestion correctly', () => {
      const { hasSuggestion, setError } = useSocialAuthError()

      const errorWithSuggestion = {
        response: {
          data: {
            errors: {
              social_auth: 'Error with suggestion',
              suggested_provider: 'google'
            }
          }
        }
      }

      const errorWithoutSuggestion = {
        message: 'Generic error'
      }

      setError(errorWithSuggestion, 'github')
      expect(hasSuggestion.value).toBe(true)

      setError(errorWithoutSuggestion, 'github')
      expect(hasSuggestion.value).toBe(false)
    })
  })

  describe('Navigation Helpers', () => {
    it('redirects to correct routes for different providers', () => {
      const { redirectToProvider } = useSocialAuthError()

      const providers = ['google', 'github', 'bluesky', 'email', 'unknown']

      providers.forEach(provider => {
        redirectToProvider(provider)
        expect(mockPush).toHaveBeenCalledWith('/auth/login')
      })
    })

    it('redirects to login page', () => {
      const { redirectToLogin } = useSocialAuthError()

      redirectToLogin()
      expect(mockPush).toHaveBeenCalledWith('/auth/login')
    })

    it('redirects to email login page', () => {
      const { redirectToEmailLogin } = useSocialAuthError()

      redirectToEmailLogin()
      expect(mockPush).toHaveBeenCalledWith('/auth/login')
    })
  })

  describe('Popup Handling', () => {
    it('closes popup with message when opener exists', () => {
      const { closePopupWithMessage, setError } = useSocialAuthError()

      // Mock window.opener
      const mockOpener = {
        postMessage: vi.fn()
      }
      Object.defineProperty(window, 'opener', {
        value: mockOpener
      })

      // Mock window.close
      const mockClose = vi.fn()
      Object.defineProperty(window, 'close', {
        value: mockClose
      })

      const mockError = {
        response: {
          data: {
            errors: {
              social_auth: 'Test error',
              auth_provider: 'github',
              suggested_provider: 'google'
            }
          }
        }
      }

      setError(mockError, 'github')
      closePopupWithMessage()

      expect(mockOpener.postMessage).toHaveBeenCalledWith(
        {
          error: 'Test error',
          authProvider: 'github',
          suggestedProvider: 'google'
        },
        'http://localhost:3000'
      )
      expect(mockClose).toHaveBeenCalled()
    })

    it('closes popup with custom message', () => {
      const { closePopupWithMessage } = useSocialAuthError()

      const mockOpener = {
        postMessage: vi.fn()
      }
      Object.defineProperty(window, 'opener', {
        value: mockOpener
      })

      const mockClose = vi.fn()
      Object.defineProperty(window, 'close', {
        value: mockClose
      })

      closePopupWithMessage('Custom error message')

      expect(mockOpener.postMessage).toHaveBeenCalledWith(
        {
          error: 'Custom error message',
          authProvider: undefined,
          suggestedProvider: undefined
        },
        'http://localhost:3000'
      )
      expect(mockClose).toHaveBeenCalled()
    })

    it('does not attempt to close popup when no opener', () => {
      const { closePopupWithMessage } = useSocialAuthError()

      // Ensure no opener
      Object.defineProperty(window, 'opener', {
        value: null
      })

      const mockClose = vi.fn()
      Object.defineProperty(window, 'close', {
        value: mockClose
      })

      closePopupWithMessage('Test message')

      // Should not call close since there's no opener
      expect(mockClose).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles null/undefined errors gracefully', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const nullResult = parseSocialAuthError(null, 'github')
      const undefinedResult = parseSocialAuthError(undefined, 'github')

      expect(nullResult.message).toBe('Authentication failed. Please try again.')
      expect(undefinedResult.message).toBe('Authentication failed. Please try again.')
    })

    it('handles errors with partial response data', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const partialError = {
        response: {
          data: {
            // Missing errors field
            message: 'Server error'
          }
        }
      }

      const result = parseSocialAuthError(partialError, 'github')
      expect(result.message).toBe('Server error')
      expect(result.isEnhanced).toBe(false)
    })

    it('handles errors with malformed response structure', () => {
      const { parseSocialAuthError } = useSocialAuthError()

      const malformedError = {
        response: {
          // Missing data field
          status: 500
        }
      }

      const result = parseSocialAuthError(malformedError, 'github')
      expect(result.message).toBe('Authentication failed. Please try again.')
      expect(result.isEnhanced).toBe(false)
    })
  })
})
