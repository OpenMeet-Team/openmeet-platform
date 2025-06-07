/**
 * Email verification helpers for acceptance tests
 *
 * These helpers allow tests to verify that emails are actually being sent
 * in the dev/staging environments without interfering with production email.
 */

/// <reference types="cypress" />

interface EmailMessage {
  subject: string
  from: string
  to: string[]
  text?: string
  html?: string
  date: Date
}

interface EmailVerificationOptions {
  to: string
  subject?: string | RegExp
  timeout?: number
  contains?: string | string[]
}

/**
 * Polls the email server for new messages
 * This is a simplified version - in practice you might use IMAP or an email testing service
 */
export async function checkEmailDelivery (options: EmailVerificationOptions): Promise<EmailMessage | null> {
  // Use options object properties
  console.log('Checking email delivery for:', options.to)

  // For local development with maildev
  if (Cypress.env('EMAIL_TESTING_MODE') === 'maildev') {
    return checkMaildevEmail(options)
  }

  // For dev/staging with real email
  if (Cypress.env('EMAIL_TESTING_MODE') === 'imap') {
    return checkImapEmail(options)
  }

  // For environments using email testing services like Mailosaur or Mailtrap
  if (Cypress.env('EMAIL_TESTING_MODE') === 'api') {
    return checkEmailServiceApi(options)
  }

  console.warn('No email testing mode configured')
  return null
}

/**
 * Check emails in local Maildev instance
 */
async function checkMaildevEmail (options: EmailVerificationOptions): Promise<EmailMessage | null> {
  const maildevUrl = Cypress.env('MAILDEV_URL') || 'http://localhost:1080'
  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout!) {
    try {
      // Maildev provides a REST API to fetch emails
      const response = await fetch(`${maildevUrl}/email`)
      const emails = await response.json()

      // Find matching email
      const matchingEmail = emails.find((email: Record<string, unknown>) => {
        const toMatch = email.to.some((recipient: Record<string, unknown>) =>
          recipient.address === options.to
        )

        const subjectMatch = options.subject
          ? options.subject instanceof RegExp
            ? options.subject.test(email.subject)
            : email.subject.includes(options.subject)
          : true

        const contentMatch = options.contains
          ? Array.isArray(options.contains)
            ? options.contains.every(text =>
              email.text?.includes(text) || email.html?.includes(text)
            )
            : email.text?.includes(options.contains) || email.html?.includes(options.contains)
          : true

        return toMatch && subjectMatch && contentMatch
      })

      if (matchingEmail) {
        return {
          subject: matchingEmail.subject,
          from: matchingEmail.from[0].address,
          to: matchingEmail.to.map((r: Record<string, unknown>) => r.address),
          text: matchingEmail.text,
          html: matchingEmail.html,
          date: new Date(matchingEmail.date)
        }
      }
    } catch (error) {
      console.error('Error checking maildev:', error)
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return null
}

/**
 * Check emails via IMAP (for real email servers in dev/staging)
 * Note: This would require additional dependencies like node-imap
 */
async function checkImapEmail (): Promise<EmailMessage | null> {
  // This is a placeholder - actual implementation would use IMAP library
  console.log('IMAP email checking not implemented yet')

  // In a real implementation:
  // 1. Connect to IMAP server using credentials from env
  // 2. Search for emails matching criteria
  // 3. Parse and return matching email

  return null
}

/**
 * Check emails via email testing service API (Mailosaur, Mailtrap, etc.)
 */
async function checkEmailServiceApi (options: EmailVerificationOptions): Promise<EmailMessage | null> {
  const apiKey = Cypress.env('EMAIL_SERVICE_API_KEY')
  const serverId = Cypress.env('EMAIL_SERVICE_SERVER_ID')
  const apiUrl = Cypress.env('EMAIL_SERVICE_API_URL')

  if (!apiKey || !serverId || !apiUrl) {
    console.error('Email service API credentials not configured')
    return null
  }

  const startTime = Date.now()

  while (Date.now() - startTime < options.timeout!) {
    try {
      // Example for Mailosaur-style API
      const response = await fetch(`${apiUrl}/messages?server=${serverId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })

      const data = await response.json()
      const emails = data.items || []

      // Find matching email
      const matchingEmail = emails.find((email: Record<string, unknown>) => {
        const toMatch = email.to.some((recipient: Record<string, unknown>) =>
          recipient.email === options.to
        )

        const subjectMatch = options.subject
          ? options.subject instanceof RegExp
            ? options.subject.test(email.subject)
            : email.subject.includes(options.subject)
          : true

        const contentMatch = options.contains
          ? Array.isArray(options.contains)
            ? options.contains.every(text =>
              email.text?.body?.includes(text) || email.html?.body?.includes(text)
            )
            : email.text?.body?.includes(options.contains) || email.html?.body?.includes(options.contains)
          : true

        return toMatch && subjectMatch && contentMatch
      })

      if (matchingEmail) {
        return {
          subject: matchingEmail.subject,
          from: matchingEmail.from[0].email,
          to: matchingEmail.to.map((r: Record<string, unknown>) => r.email),
          text: matchingEmail.text?.body,
          html: matchingEmail.html?.body,
          date: new Date(matchingEmail.received)
        }
      }
    } catch (error) {
      console.error('Error checking email service:', error)
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  return null
}

/**
 * Cypress command to verify email delivery
 */
Cypress.Commands.add('verifyEmail', (options: EmailVerificationOptions) => {
  return cy.wrap(null).then(() => {
    return checkEmailDelivery(options).then(email => {
      if (!email) {
        throw new Error(`No email found matching criteria: ${JSON.stringify(options)}`)
      }
      return email
    })
  })
})

/**
 * Cypress command to extract verification link from email
 */
Cypress.Commands.add('getVerificationLink', (email: EmailMessage) => {
  // Look for verification links in the email
  const linkRegex = /https?:\/\/[^\s<>"]+\/verify[^\s<>"]+/gi
  const text = email.html || email.text || ''
  const matches = text.match(linkRegex)

  if (!matches || matches.length === 0) {
    throw new Error('No verification link found in email')
  }

  return matches[0]
})

/**
 * Cypress command to clear test emails
 */
Cypress.Commands.add('clearTestEmails', () => {
  if (Cypress.env('EMAIL_TESTING_MODE') === 'maildev') {
    // Clear all emails in maildev
    const maildevUrl = Cypress.env('MAILDEV_URL') || 'http://localhost:1080'
    return cy.request('DELETE', `${maildevUrl}/email/all`)
  }

  // For other email services, implement cleanup as needed
  cy.log('Email cleanup not implemented for current email testing mode')
})

// Type definitions for the custom commands
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Verify that an email was sent
       * @example
       * cy.verifyEmail({
       *   to: 'test@example.com',
       *   subject: 'Welcome to OpenMeet',
       *   contains: ['verify your email', 'click here']
       * })
       */
      verifyEmail(options: EmailVerificationOptions): Chainable<EmailMessage>

      /**
       * Extract verification link from email
       * @example
       * cy.verifyEmail({ to: 'test@example.com' })
       *   .then(email => cy.getVerificationLink(email))
       *   .then(link => cy.visit(link))
       */
      getVerificationLink(email: EmailMessage): Chainable<string>

      /**
       * Clear all test emails (useful for test isolation)
       * @example cy.clearTestEmails()
       */
      clearTestEmails(): Chainable<unknown>
    }
  }
}
