import { ref, computed } from 'vue'

// Validation result interface
export interface PassphraseValidationResult {
  isValid: boolean
  strength: 'weak' | 'medium' | 'strong'
  feedback?: string
  score: number // 0-100
}

// Strength criteria weights
const CRITERIA_WEIGHTS = {
  length: 30, // 30% weight for length
  variety: 25, // 25% weight for character variety
  patterns: 20, // 20% weight for avoiding patterns
  entropy: 25 // 25% weight for entropy estimation
}

// Common patterns to avoid
const COMMON_PATTERNS = [
  /123456/,
  /abcdef/,
  /qwerty/,
  /password/i,
  /admin/i,
  /login/i,
  /matrix/i,
  /(.)\1{2,}/ // Repeated characters (aaa, 111, etc.)
]

// Reactive state
const validationResult = ref<PassphraseValidationResult>({
  isValid: false,
  strength: 'weak',
  score: 0
})

// Character type checkers
const hasLowercase = (str: string): boolean => /[a-z]/.test(str)
const hasUppercase = (str: string): boolean => /[A-Z]/.test(str)
const hasNumbers = (str: string): boolean => /[0-9]/.test(str)
const hasSpecialChars = (str: string): boolean => /[^A-Za-z0-9]/.test(str)
const hasSpaces = (str: string): boolean => /\s/.test(str)

// Calculate character variety score (0-100)
const calculateVarietyScore = (passphrase: string): number => {
  const checks = [
    hasLowercase(passphrase),
    hasUppercase(passphrase),
    hasNumbers(passphrase),
    hasSpecialChars(passphrase),
    hasSpaces(passphrase)
  ]

  const varietyCount = checks.filter(Boolean).length

  // Base score from variety count
  let score = 0
  if (varietyCount === 1) score = 20 // Only one type
  if (varietyCount === 2) score = 40 // Two types
  if (varietyCount === 3) score = 70 // Three types
  if (varietyCount === 4) score = 90 // Four types
  if (varietyCount === 5) score = 100 // All types

  // Penalty for very poor variety (like all same character)
  const uniqueChars = new Set(passphrase).size
  if (uniqueChars <= 1) score = 0
  if (uniqueChars <= 2 && passphrase.length > 6) score = Math.min(score, 10)

  return score
}

// Calculate length score (0-100)
const calculateLengthScore = (passphrase: string): number => {
  const length = passphrase.length

  if (length < 8) return 0
  if (length < 12) return 40
  if (length < 16) return 70
  if (length < 20) return 90
  return 100
}

// Calculate pattern avoidance score (0-100)
const calculatePatternScore = (passphrase: string): number => {
  let penalties = 0

  // Check for common patterns
  for (const pattern of COMMON_PATTERNS) {
    if (pattern.test(passphrase)) {
      penalties += 20
    }
  }

  // Check for keyboard patterns (basic)
  const keyboardPatterns = ['qwerty', 'asdf', '1234']
  for (const pattern of keyboardPatterns) {
    if (passphrase.toLowerCase().includes(pattern)) {
      penalties += 15
    }
  }

  // Check for date patterns (YYYY, MM/DD, etc.)
  if (/\b(19|20)\d{2}\b/.test(passphrase)) penalties += 10
  if (/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(passphrase)) penalties += 15

  // Check for excessive repetition (more severe penalty)
  if (/(.)\1{3,}/.test(passphrase)) penalties += 25 // 4+ repeated chars
  if (/(.)\1{2}/.test(passphrase)) penalties += 10 // 3+ repeated chars

  return Math.max(0, 100 - penalties)
}

// Simple entropy estimation (0-100)
const calculateEntropyScore = (passphrase: string): number => {
  if (passphrase.length === 0) return 0

  // Count unique characters
  const uniqueChars = new Set(passphrase).size
  const length = passphrase.length

  // Estimate entropy bits: log2(charset) * length
  let charsetSize = 0
  if (hasLowercase(passphrase)) charsetSize += 26
  if (hasUppercase(passphrase)) charsetSize += 26
  if (hasNumbers(passphrase)) charsetSize += 10
  if (hasSpecialChars(passphrase)) charsetSize += 32
  if (hasSpaces(passphrase)) charsetSize += 1

  const entropyBits = Math.log2(charsetSize) * length

  // Scale to 0-100 (60+ bits is strong)
  const score = Math.min(100, (entropyBits / 60) * 100)

  // Bonus for high unique character ratio
  const uniqueRatio = uniqueChars / length
  const uniqueBonus = uniqueRatio * 20

  return Math.min(100, score + uniqueBonus)
}

// Main validation function
const validatePassphrase = (passphrase: string): PassphraseValidationResult => {
  if (!passphrase) {
    const result: PassphraseValidationResult = {
      isValid: false,
      strength: 'weak',
      score: 0,
      feedback: 'Please enter a passphrase'
    }
    validationResult.value = result
    return result
  }

  // Calculate component scores
  const lengthScore = calculateLengthScore(passphrase)
  const varietyScore = calculateVarietyScore(passphrase)
  const patternScore = calculatePatternScore(passphrase)
  const entropyScore = calculateEntropyScore(passphrase)

  // Calculate weighted total score
  const totalScore = Math.round(
    (lengthScore * (CRITERIA_WEIGHTS.length / 100) +
     varietyScore * (CRITERIA_WEIGHTS.variety / 100) +
     patternScore * (CRITERIA_WEIGHTS.patterns / 100) +
     entropyScore * (CRITERIA_WEIGHTS.entropy / 100))
  )

  // Determine strength and validity
  let strength: 'weak' | 'medium' | 'strong'
  let isValid: boolean
  let feedback: string | undefined

  // More strict thresholds
  if (totalScore >= 85) {
    strength = 'strong'
    isValid = true
  } else if (totalScore >= 65 && passphrase.length >= 12) {
    strength = 'medium'
    isValid = true
  } else {
    strength = 'weak'
    isValid = false
  }

  // Generate specific feedback for improvements
  if (!isValid) {
    const issues: string[] = []

    if (passphrase.length < 12) {
      issues.push('at least 12 characters')
    }

    if (varietyScore < 50) {
      const missing: string[] = []
      if (!hasUppercase(passphrase)) missing.push('uppercase letters')
      if (!hasLowercase(passphrase)) missing.push('lowercase letters')
      if (!hasNumbers(passphrase) && !hasSpecialChars(passphrase)) {
        missing.push('numbers or symbols')
      }
      if (missing.length > 0) {
        issues.push(`${missing.join(', ')}`)
      }
    }

    if (patternScore < 70) {
      issues.push('avoid common patterns')
    }

    if (issues.length > 0) {
      feedback = `Try adding: ${issues.join(', ')}`
    } else {
      feedback = 'Passphrase needs to be stronger'
    }
  }

  const result: PassphraseValidationResult = {
    isValid,
    strength,
    score: totalScore,
    feedback
  }

  validationResult.value = result
  return result
}

// Get detailed strength information
const getStrengthDetails = computed(() => {
  return {
    score: validationResult.value.score,
    strength: validationResult.value.strength,
    isValid: validationResult.value.isValid,
    color: validationResult.value.strength === 'strong' ? 'green'
      : validationResult.value.strength === 'medium' ? 'orange' : 'red',
    icon: validationResult.value.strength === 'strong' ? 'check_circle'
      : validationResult.value.strength === 'medium' ? 'info' : 'warning',
    text: validationResult.value.strength === 'strong' ? 'Strong passphrase'
      : validationResult.value.strength === 'medium' ? 'Good passphrase' : 'Weak passphrase'
  }
})

// Check specific requirements
const getRequirements = (passphrase: string) => {
  return {
    length: passphrase.length >= 12,
    uppercase: hasUppercase(passphrase),
    lowercase: hasLowercase(passphrase),
    numbers: hasNumbers(passphrase),
    special: hasSpecialChars(passphrase),
    variety: hasNumbers(passphrase) || hasSpecialChars(passphrase)
  }
}

// Real-time validation helper
const createValidator = () => {
  return {
    validate: validatePassphrase,
    result: validationResult,
    details: getStrengthDetails,
    requirements: getRequirements
  }
}

export function usePassphraseValidation () {
  return {
    // State
    validationResult,

    // Computed
    getStrengthDetails,

    // Methods
    validatePassphrase,
    getRequirements,
    createValidator,

    // Helpers
    hasLowercase,
    hasUppercase,
    hasNumbers,
    hasSpecialChars
  }
}
