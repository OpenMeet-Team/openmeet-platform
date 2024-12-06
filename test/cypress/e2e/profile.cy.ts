describe('ProfilePage', () => {
  beforeEach(() => {
    cy.visit('/dashboard/profile').then(() => {
      cy.loginPage(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    })
  })

  it('should display and update the profile page', () => {
    cy.dataCy('profile-page').should('be.visible')
    cy.dataCy('profile-form').should('be.visible')
    cy.dataCy('profile-first-name').should('be.visible').clear()
    cy.dataCy('profile-first-name').type('John')
    cy.dataCy('profile-last-name').should('be.visible').clear()
    cy.dataCy('profile-last-name').type('Doe')
    cy.dataCy('profile-bio').should('be.visible').clear()
    cy.dataCy('profile-bio').type('I am a test user')
    cy.dataCy('profile-photo').should('be.visible')
    cy.dataCy('profile-password').should('be.visible').click()
    cy.dataCy('profile-old-password').should('be.visible')
    cy.dataCy('profile-new-password').should('be.visible')
    cy.dataCy('profile-delete-account').should('be.visible')

    cy.dataCy('profile-update').should('be.visible').click()
    cy.dataCy('profile-first-name').should('have.value', 'John')
    cy.dataCy('profile-last-name').should('have.value', 'Doe')
    cy.dataCy('profile-bio').should('have.value', 'I am a test user')
  })

  it('should display the email form', () => {
    cy.dataCy('profile-email').should('be.visible').click()
  })
})
