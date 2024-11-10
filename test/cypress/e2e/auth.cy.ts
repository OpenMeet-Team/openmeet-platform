describe('Auth', () => {
  describe('Login', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200
      }).as('login')
    })

    it('should login', () => {
      cy.visit('/auth/login').then(() => {
        cy.dataCy('login-card').should('be.visible')
        cy.dataCy('login-form').should('be.visible')
        cy.dataCy('login-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
        cy.dataCy('login-password').should('be.visible').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
        cy.dataCy('login-submit').should('be.visible')
        cy.dataCy('login-submit').click()
        cy.testRoute('/')
      })
    })
  })

  describe('Register', () => {
    beforeEach(() => {
      cy.intercept('POST', '/api/auth/register', {
        statusCode: 200
      }).as('register')
    })

    it('should register', () => {
      cy.visit('/auth/register').then(() => {
        cy.dataCy('register-form').should('be.visible')
        cy.dataCy('register-first-name').should('be.visible').type('John')
        cy.dataCy('register-last-name').should('be.visible').type('Doe')
        cy.dataCy('register-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
        cy.dataCy('register-password').should('be.visible').type('12345678')
        cy.dataCy('register-confirm-password').should('be.visible').type('12345678')
        cy.dataCy('register-accept').should('be.visible').check()
        cy.dataCy('register-submit').should('be.visible')
        cy.dataCy('register-submit').click()
      })
    })
  })

  describe('Forgot Password', () => {
    it('should reset password', () => {
      cy.intercept('POST', '/api/v1/auth/forgot/password', {
        statusCode: 204
      }).as('forgotPassword')

      cy.visit('/auth/forgot-password')
      cy.dataCy('forgot-password-form').should('be.visible')
      cy.dataCy('forgot-password-email').should('be.visible').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('forgot-password-submit').should('be.visible').click()
      cy.wait('@forgotPassword').then(() => {
        cy.dataCy('forgot-password-dialog').should('be.visible')
        cy.dataCy('forgot-password-ok').should('be.visible').click()
        // cy.dataCy('forgot-password-dialog').should('not.be.visible')
      })
    })
  })

  describe('Password Change', () => {
    it('should change password', () => {
      cy.intercept('POST', '/api/v1/auth/reset/password', {
        statusCode: 204
      }).as('changePassword')

      cy.visit('/auth/password-change')
      cy.dataCy('password-change-form').should('be.visible')
      cy.dataCy('password-change-password').should('be.visible').type('random-password-string')
      cy.dataCy('password-change-submit').should('be.visible').click()
      cy.wait('@changePassword').then(() => {
        cy.dataCy('password-change-dialog').should('be.visible')
        cy.dataCy('password-change-ok').should('be.visible').click()
        cy.testRoute('/auth/login')
      })
    })
  })

  describe('Confirm Email', () => {
    it('should confirm email', () => {
      cy.visit('/auth/confirm-email')
      cy.dataCy('confirm-email-login').should('be.visible').click()
      cy.testRoute('/auth/login')
    })
  })

  describe('Confirm New Email', () => {
    it('should confirm new email', () => {
      cy.visit('/auth/confirm-new-email')
      cy.dataCy('confirm-new-email-login').should('be.visible')
      cy.dataCy('confirm-new-email-home').should('be.visible').click()
      cy.testRoute('/')
    })
  })
})
