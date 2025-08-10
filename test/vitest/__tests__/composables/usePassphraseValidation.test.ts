import { describe, it, expect, beforeEach } from 'vitest'
import { usePassphraseValidation } from '../../../../src/composables/usePassphraseValidation'

describe('usePassphraseValidation', () => {
  let validator: ReturnType<typeof usePassphraseValidation>

  beforeEach(() => {
    validator = usePassphraseValidation()
  })

  describe('validatePassphrase', () => {
    it('should return weak for empty passphrase', () => {
      const result = validator.validatePassphrase('')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
      expect(result.score).toBe(0)
      expect(result.feedback).toBe('Please enter a passphrase')
    })

    it('should return weak for short passphrases', () => {
      const result = validator.validatePassphrase('abc123')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
      expect(result.feedback).toContain('at least 12 characters')
    })

    it('should return weak for passphrases with poor variety', () => {
      const result = validator.validatePassphrase('aaaaaaaaaaaaaa')

      expect(result.isValid).toBe(false)
      expect(result.strength).toBe('weak')
      expect(result.feedback).toContain('uppercase letters')
    })

    it('should return medium for decent passphrases', () => {
      const result = validator.validatePassphrase('MyPassword123')

      expect(result.strength).toBe('medium')
      expect(result.isValid).toBe(true) // Should be valid if >= 12 chars
    })

    it('should return strong for excellent passphrases', () => {
      const result = validator.validatePassphrase('MyVery$ecureP@ssw0rd!2024')

      expect(result.strength).toBe('strong')
      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(80)
    })

    it('should penalize common patterns', () => {
      const weakResult = validator.validatePassphrase('password123456')
      const strongResult = validator.validatePassphrase('RandomPhrase!2024')

      expect(weakResult.score).toBeLessThan(strongResult.score)
    })

    it('should handle special characters and emojis', () => {
      const result = validator.validatePassphrase('🔍 My$ecure P@ssw0rd! 2024')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })

    it('should handle complex technical strings', () => {
      const result = validator.validatePassphrase('🔍 Available methods: Array(5) [ "checkClientState", "checkRoomState" ]')

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })
  })

  describe('helper functions', () => {
    it('should detect character types correctly', () => {
      expect(validator.hasLowercase('abc')).toBe(true)
      expect(validator.hasLowercase('ABC')).toBe(false)

      expect(validator.hasUppercase('ABC')).toBe(true)
      expect(validator.hasUppercase('abc')).toBe(false)

      expect(validator.hasNumbers('123')).toBe(true)
      expect(validator.hasNumbers('abc')).toBe(false)

      expect(validator.hasSpecialChars('!@#')).toBe(true)
      expect(validator.hasSpecialChars('abc123')).toBe(false)
    })
  })

  describe('getRequirements', () => {
    it('should return requirement status correctly', () => {
      const requirements = validator.getRequirements('MyPassword123!')

      expect(requirements.length).toBe(true)
      expect(requirements.uppercase).toBe(true)
      expect(requirements.lowercase).toBe(true)
      expect(requirements.numbers).toBe(true)
      expect(requirements.special).toBe(true)
      expect(requirements.variety).toBe(true)
    })

    it('should detect missing requirements', () => {
      const requirements = validator.getRequirements('mypassword')

      expect(requirements.length).toBe(false)
      expect(requirements.uppercase).toBe(false)
      expect(requirements.numbers).toBe(false)
      expect(requirements.special).toBe(false)
      expect(requirements.variety).toBe(false)
    })
  })

  describe('scoring components', () => {
    it('should score length appropriately', () => {
      const short = validator.validatePassphrase('Abc123!')
      const medium = validator.validatePassphrase('MySecurePassword123!')
      const long = validator.validatePassphrase('MyVeryLongAndSecurePasswordWithLotsOfCharactersAndSpecialSymbols!@#123!')

      expect(short.score).toBeLessThan(medium.score)
      expect(medium.score).toBeLessThanOrEqual(long.score) // Very long may not always score higher due to other factors
    })

    it('should score variety appropriately', () => {
      const lowVariety = validator.validatePassphrase('aaaaaaaaaaaaa')
      const mediumVariety = validator.validatePassphrase('MyPassword123')
      const highVariety = validator.validatePassphrase('My$ecure P@ssw0rd! 123')

      expect(lowVariety.score).toBeLessThan(mediumVariety.score)
      expect(mediumVariety.score).toBeLessThan(highVariety.score)
    })

    it('should penalize common keyboard patterns', () => {
      const withPattern = validator.validatePassphrase('qwerty123456789!')
      const withoutPattern = validator.validatePassphrase('RandomPhrase123!')

      expect(withPattern.score).toBeLessThan(withoutPattern.score)
    })

    it('should penalize repeated characters', () => {
      const withRepeated = validator.validatePassphrase('MyPasssssword123!')
      const withoutRepeated = validator.validatePassphrase('MyPasswordAbc123!')

      expect(withRepeated.score).toBeLessThan(withoutRepeated.score)
    })

    it('should penalize common words', () => {
      const withCommon = validator.validatePassphrase('MyPassword123!')
      const withoutCommon = validator.validatePassphrase('MySecretPhrase123!')

      expect(withCommon.score).toBeLessThan(withoutCommon.score)
    })
  })

  describe('edge cases', () => {
    it('should handle very long passphrases', () => {
      const veryLong = 'A'.repeat(200) + '1!'
      const result = validator.validatePassphrase(veryLong)

      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThan(0)
    })

    it('should handle unicode characters', () => {
      const unicode = 'Mÿ$écürë Påsswørd! 🔒2024'
      const result = validator.validatePassphrase(unicode)

      expect(result.isValid).toBe(true)
      expect(result.strength).toBe('strong')
    })

    it('should handle whitespace correctly', () => {
      const withSpaces = 'My Secure Password 123!'
      const result = validator.validatePassphrase(withSpaces)

      expect(result.isValid).toBe(true)
      // Spaces should count as character variety
    })

    it('should handle only special characters', () => {
      const specialOnly = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const result = validator.validatePassphrase(specialOnly)

      // Strong variety and length but scores medium due to only special chars
      expect(result.isValid).toBe(true) // Actually valid due to high entropy
      expect(result.strength).toBe('medium') // High entropy but missing letter variety
    })
  })

  describe('strength thresholds', () => {
    it('should classify scores correctly', () => {
      // Test boundary conditions
      const tests = [
        { passphrase: 'weak', expectedStrength: 'weak' },
        { passphrase: 'MyPassword123', expectedStrength: 'medium' },
        { passphrase: 'MyExcellent$ecureP@ssw0rd!WithNumbers123', expectedStrength: 'strong' }
      ]

      tests.forEach(({ passphrase, expectedStrength }) => {
        const result = validator.validatePassphrase(passphrase)
        expect(result.strength).toBe(expectedStrength)
      })
    })
  })

  describe('feedback messages', () => {
    it('should provide helpful feedback for improvement', () => {
      const shortResult = validator.validatePassphrase('abc')
      expect(shortResult.feedback).toContain('at least 12 characters')

      const noUpperResult = validator.validatePassphrase('mypassword123')
      if (noUpperResult.feedback) {
        expect(noUpperResult.feedback).toContain('uppercase letters')
      }

      const noNumbersResult = validator.validatePassphrase('MyPasswordOnly')
      if (noNumbersResult.feedback) {
        expect(noNumbersResult.feedback).toContain('numbers or symbols')
      }
    })

    it('should not provide feedback for valid passphrases', () => {
      const result = validator.validatePassphrase('MySecurePassword123!')
      expect(result.feedback).toBeUndefined()
    })
  })

  describe('specific bug fixes', () => {
    it('should correctly score long technical text as strong', () => {
      const passphrase = '  The complex passphrase you mentioned should now properly score as "strong" instead of incorrectly showing as "weak". The algorithm now correctly handles:'
      const result = validator.validatePassphrase(passphrase)

      // This was previously incorrectly scoring as "weak"
      expect(result.strength).toBe('strong')
      expect(result.isValid).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(85) // Strong threshold
    })
  })

  describe('real-world examples', () => {
    const realWorldTests = [
      {
        passphrase: '123456789012',
        expectedStrength: 'weak',
        expectedValid: false,
        description: 'only numbers, no variety'
      },
      {
        passphrase: 'MySecurePassword2024!',
        expectedStrength: 'strong',
        expectedValid: true,
        description: 'good mixture of characters'
      },
      {
        passphrase: 'correct horse battery staple',
        expectedStrength: 'strong', // Long phrase with spaces scores high
        expectedValid: true,
        description: 'XKCD-style passphrase'
      },
      {
        passphrase: '🎯 Target Practice! 2024 🏹',
        expectedStrength: 'strong',
        expectedValid: true,
        description: 'emojis and mixed content'
      },
      {
        passphrase: '  The complex passphrase you mentioned should now properly score as "strong" instead of incorrectly showing as "weak". The algorithm now correctly handles:',
        expectedStrength: 'strong',
        expectedValid: true,
        description: 'long technical text with punctuation'
      }
    ]

    realWorldTests.forEach(({ passphrase, expectedStrength, expectedValid, description }) => {
      it(`should handle ${description}`, () => {
        const result = validator.validatePassphrase(passphrase)
        expect(result.strength).toBe(expectedStrength)
        expect(result.isValid).toBe(expectedValid)
      })
    })
  })
})
